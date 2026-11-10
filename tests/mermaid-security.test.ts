import { afterEach, expect, it, vi } from "vitest"

vi.mock("https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.4.0/mermaid.esm.min.mjs", () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn(async () => {}),
  },
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

it("restores Mermaid source as text before rendering, including theme changes", async () => {
  const source = 'graph TD; A["<img src=x onerror=alert(1)>"]'
  const htmlWrites: string[] = []
  const node = {
    innerText: source,
    textContent: "",
    set innerHTML(value: string) {
      htmlWrites.push(value)
    },
    removeAttribute: vi.fn(),
    parentElement: {
      querySelector: (selector: string) =>
        selector === "#mermaid-container" ? null : { offsetWidth: 0, style: {} },
      prepend: vi.fn(),
    },
  }
  const handlers = new Map<string, () => Promise<void>>()
  vi.stubGlobal("document", {
    addEventListener: (event: string, handler: () => Promise<void>) => handlers.set(event, handler),
    querySelector: () => ({ querySelectorAll: () => [node] }),
    documentElement: { getAttribute: () => "light" },
  })
  vi.stubGlobal("window", {
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    addCleanup: vi.fn(),
  })
  await import("../quartz/components/scripts/mermaid.inline")
  await handlers.get("nav")!()
  expect(htmlWrites).toEqual([])
  expect(node.textContent).toBe(source)
  node.textContent = ""
  await handlers.get("themechange")!()
  expect(htmlWrites).toEqual([])
  expect(node.textContent).toBe(source)
})
