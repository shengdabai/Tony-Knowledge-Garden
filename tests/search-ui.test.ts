import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const search = vi.hoisted(() => vi.fn())
vi.mock("flexsearch", () => ({
  default: {
    Document: class {
      addAsync = vi.fn().mockResolvedValue(undefined)
      searchAsync = search
    },
  },
}))

// Minimal DOM fixture: exercise the shipped event handlers without a browser or network.
class ElementFixture {
  children: ElementFixture[] = []
  parent: ElementFixture | null = null
  classes = new Set<string>()
  listeners = new Map<string, Set<(event: any) => unknown>>()
  dataset: Record<string, string> = {}
  style = { zIndex: "" }
  id = ""
  value = ""
  private html = ""
  set innerHTML(value: string) {
    this.html = value
    this.replaceChildren()
  }
  get innerHTML(): string {
    return this.html + this.children.map((child) => child.innerHTML).join("")
  }
  classList = {
    add: (...names: string[]) => names.forEach((name) => this.classes.add(name)),
    remove: (...names: string[]) => names.forEach((name) => this.classes.delete(name)),
    contains: (name: string) => this.classes.has(name),
    toggle: (name: string, force: boolean) => {
      if (force) this.classes.add(name)
      else this.classes.delete(name)
    },
  }
  set className(value: string) {
    this.classes = new Set(value.split(" "))
  }
  get firstChild() {
    return this.children[0] ?? null
  }
  get firstElementChild() {
    return this.firstChild
  }
  get nextElementSibling(): ElementFixture | null {
    return this.parent?.children[this.parent.children.indexOf(this) + 1] ?? null
  }
  get previousElementSibling(): ElementFixture | null {
    return this.parent?.children[this.parent.children.indexOf(this) - 1] ?? null
  }
  append(...items: ElementFixture[]) {
    items.forEach((item) => {
      item.parent = this
      this.children.push(item)
    })
  }
  appendChild(item: ElementFixture) {
    this.append(item)
    return item
  }
  removeChild(item: ElementFixture) {
    this.children.splice(this.children.indexOf(item), 1)
    item.parent = null
  }
  remove() {
    this.parent?.removeChild(this)
  }
  replaceChildren(...items: ElementFixture[]) {
    this.children.forEach((item) => {
      item.parent = null
    })
    this.children = []
    this.append(...items)
  }
  getElementsByClassName(name: string): ElementFixture[] {
    return this.children.flatMap((child) => [
      ...(child.classes.has(name) ? [child] : []),
      ...child.getElementsByClassName(name),
    ])
  }
  querySelector(selector: string) {
    return this.getElementsByClassName(selector.slice(1))[0]
  }
  querySelectorAll() {
    return []
  }
  closest(): null {
    return null
  }
  contains(item: ElementFixture): boolean {
    return item === this || this.children.some((child) => child.contains(item))
  }
  addEventListener(name: string, fn: (event: any) => unknown) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set())
    this.listeners.get(name)!.add(fn)
  }
  removeEventListener(name: string, fn: (event: any) => unknown) {
    this.listeners.get(name)?.delete(fn)
  }
  async fire(name: string, event: Record<string, unknown> = {}) {
    await Promise.all(
      [...(this.listeners.get(name) ?? [])].map((fn) => fn.call(this, { target: this, ...event })),
    )
  }
  focus() {
    doc.activeElement = this
  }
  click = vi.fn(() => {
    void this.fire("click")
  })
  scrollIntoView = vi.fn()
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const result = (id: number) => [{ field: "title", result: [id] }]
const response = (text: string, ok = true) => ({ ok, text: async () => text })
let doc: ElementFixture & { activeElement?: ElementFixture; createElement?: unknown }
let root: ElementFixture, container: ElementFixture, button: ElementFixture
let input: ElementFixture, layout: ElementFixture
let cleanups: (() => void)[]
const fetchMock = vi.fn()
const results = () => layout.querySelector(".results-container")!
const preview = () => layout.querySelector(".preview-container")!
const type = (value: string) => {
  input.value = value
  return input.fire("input")
}
const key = (key: string, extra = {}) =>
  doc.fire("keydown", {
    key,
    preventDefault: vi.fn(),
    ...extra,
  })

beforeEach(async () => {
  vi.resetModules()
  search.mockReset().mockResolvedValue([{ field: "title", result: [0, 1] }])
  fetchMock.mockReset().mockResolvedValue(response("page"))
  cleanups = []
  doc = new ElementFixture()
  doc.createElement = () => new ElementFixture()
  root = new ElementFixture()
  root.className = "search"
  container = new ElementFixture()
  container.className = "search-container"
  button = new ElementFixture()
  button.className = "search-button"
  input = new ElementFixture()
  input.className = "search-bar"
  layout = new ElementFixture()
  layout.className = "search-layout"
  layout.dataset.preview = "true"
  container.append(input, layout)
  root.append(button, container)
  doc.append(root)
  vi.stubGlobal("document", doc)
  vi.stubGlobal("window", { addCleanup: (fn: () => void) => cleanups.push(fn) })
  vi.stubGlobal("location", new URL("https://example.test/"))
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal(
    "Node",
    class {
      static TEXT_NODE = 3
      static ELEMENT_NODE = 1
    },
  )
  vi.stubGlobal(
    "fetchData",
    Promise.resolve({
      alpha: { title: "Alpha", content: "Alpha content", tags: [] },
      beta: { title: "Beta", content: "Beta content", tags: [] },
    }),
  )
  vi.stubGlobal(
    "DOMParser",
    class {
      parseFromString(text: string) {
        const body = new ElementFixture()
        const child = new ElementFixture()
        child.innerHTML = text
        body.append(child)
        return { body, getElementsByClassName: () => [body], querySelectorAll: () => [] }
      }
    },
  )
  await import("../quartz/components/scripts/search.inline")
  await doc.fire("nav", { detail: { url: "index" } })
  await button.fire("click")
})

afterEach(() => {
  cleanups.forEach((fn) => fn())
  vi.unstubAllGlobals()
})

describe("search interactions", () => {
  it("ignores a late search response after a newer query", async () => {
    const old = deferred<ReturnType<typeof result>>()
    search.mockReturnValueOnce(old.promise).mockResolvedValueOnce(result(1))
    const pending = type("alpha")
    await type("beta")
    old.resolve(result(0))
    await pending
    expect(results().firstChild?.id).toBe("beta")
    expect(results().firstChild?.innerHTML).toContain('class="highlight">Beta')
  })

  it("does not restore results when a pending search finishes after closing", async () => {
    const old = deferred<ReturnType<typeof result>>()
    search.mockReturnValueOnce(old.promise)
    const pending = type("alpha")
    await key("k", { ctrlKey: true })
    old.resolve(result(0))
    await pending
    expect(results().children).toHaveLength(0)
  })

  it("clears results and invalidates pending searches for whitespace input", async () => {
    const old = deferred<ReturnType<typeof result>>()
    search.mockReturnValueOnce(old.promise)
    const pending = type("alpha")
    await type("   ")
    old.resolve(result(0))
    await pending
    expect(layout.classList.contains("display-results")).toBe(false)
    expect(results().children).toHaveLength(0)
  })

  it("does not let a slower preview replace the latest hovered result", async () => {
    const old = deferred<ReturnType<typeof response>>()
    fetchMock.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response("new preview"))
    const pending = type("a")
    await vi.waitFor(() => expect(results().children).toHaveLength(2))
    await results().children[1].fire("mouseenter")
    old.resolve(response("old preview"))
    await pending
    expect(preview().firstChild?.firstChild?.innerHTML).toBe("new preview")
  })

  it("does not restore a pending preview after the search is closed", async () => {
    const old = deferred<ReturnType<typeof response>>()
    fetchMock.mockReturnValueOnce(old.promise)
    const pending = type("a")
    await vi.waitFor(() => expect(results().children).toHaveLength(2))
    await key("k", { ctrlKey: true })
    old.resolve(response("old preview"))
    await pending
    expect(preview().children).toHaveLength(0)
  })

  it("opens a result without waiting for its preview request", async () => {
    await type("a")
    const card = results().firstChild!
    fetchMock.mockReturnValue(new Promise(() => {}))
    // Use a different card so this preview is not already cached.
    const target = results().children[1]
    target.focus()
    void key("Enter")
    expect(target.click).toHaveBeenCalledTimes(1)
    expect(card.click).not.toHaveBeenCalled()
  })

  it("keeps results usable when preview loading fails, and retries on hover", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"))
    await expect(type("a")).resolves.toBeUndefined()
    expect(results().children).toHaveLength(2)
    await results().firstChild!.fire("mouseenter")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not cache an HTTP failure as a successful preview", async () => {
    fetchMock.mockResolvedValueOnce(response("not found", false))
    await type("a")
    expect(preview().children).toHaveLength(0)
    await results().firstChild!.fire("mouseenter")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not steal focus when Escape is pressed while search is closed", async () => {
    await key("k", { ctrlKey: true })
    const articleLink = new ElementFixture()
    articleLink.focus()
    const preventDefault = vi.fn()
    await key("Escape", { preventDefault })
    expect(doc.activeElement === articleLink).toBe(true)
    expect(preventDefault).not.toHaveBeenCalled()
  })

  it("navigates results in both directions and returns to the input", async () => {
    await type("a")
    await key("ArrowDown")
    expect(doc.activeElement === results().children[0]).toBe(true)
    await key("ArrowDown")
    expect(doc.activeElement === results().children[1]).toBe(true)
    await key("ArrowUp")
    expect(doc.activeElement === results().children[0]).toBe(true)
    await key("ArrowUp")
    expect(doc.activeElement === input).toBe(true)
  })

  it("ignores navigation keys during IME composition", async () => {
    await type("a")
    await key("ArrowDown", { isComposing: true })
    expect(doc.activeElement === input).toBe(true)
  })

  it("keeps the search open when Escape cancels IME composition", async () => {
    await key("Escape", { isComposing: true })
    expect(container.classList.contains("active")).toBe(true)
    expect(doc.activeElement === input).toBe(true)
  })

  it("closes on Escape after composition and on an outside click", async () => {
    await key("Escape")
    expect(container.classList.contains("active")).toBe(false)
    await button.fire("click")
    await container.fire("click", { preventDefault: vi.fn(), stopPropagation: vi.fn() })
    expect(container.classList.contains("active")).toBe(false)
  })

  it("removes the original button listener during SPA cleanup", async () => {
    cleanups.forEach((fn) => fn())
    expect(button.listeners.get("click")?.size).toBe(0)
  })

  it("recreates exactly one result panel on repeated SPA setup", async () => {
    cleanups.forEach((fn) => fn())
    cleanups = []
    await doc.fire("nav", { detail: { url: "beta" } })
    expect(layout.getElementsByClassName("results-container")).toHaveLength(1)
    expect(layout.getElementsByClassName("preview-container")).toHaveLength(1)
  })
})
