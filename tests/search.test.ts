import { describe, expect, it } from "vitest"
import { createSearchRegex, highlight, renderSearchTags } from "../quartz/util/search"

describe("search result tags", () => {
  it("matches the complete tag query without removing its first character", () => {
    expect(renderSearchTags("cat", ["cat", "at"], 5)).toEqual([
      '<li><p class="match-tag">#cat</p></li>',
      "<li><p>#at</p></li>",
    ])
  })

  it("matches tags without case sensitivity", () => {
    expect(renderSearchTags("AI", ["ai-tools"], 5)).toEqual([
      '<li><p class="match-tag">#ai-tools</p></li>',
    ])
  })

  it("escapes matched and unmatched tag text", () => {
    expect(renderSearchTags("<", ["<b>", "a&b"], 5)).toEqual([
      '<li><p class="match-tag">#&lt;b&gt;</p></li>',
      "<li><p>#a&amp;b</p></li>",
    ])
  })

  it("limits tag cards and handles an empty tag list", () => {
    expect(renderSearchTags("", ["one", "two"], 1)).toHaveLength(1)
    expect(renderSearchTags("", [], 5)).toEqual([])
  })
})

describe("search preview matching", () => {
  it("matches regex metacharacters literally and ignores case", () => {
    const term = "[C++] (a.b)*? ${x} ^a|b\\"
    expect(`Before ${term.toLowerCase()} after`.match(createSearchRegex(term))).toEqual([
      term.toLowerCase(),
    ])
  })

  it("does not match unrelated text as a regex alternative", () => {
    expect("a b a|b".match(createSearchRegex("a|b"))).toEqual(["a|b"])
  })
})

describe("search result highlighting", () => {
  it.each(["(", "[", "C++", "a.b", "a|b", "\\"])("treats %s as literal search text", (term) => {
    expect(highlight(term, `Read ${term} now`)).toBe(
      `Read <span class="highlight">${term}</span> now`,
    )
  })

  it("does not treat punctuation as a wildcard", () => {
    expect(highlight("a.b", "aXb a.b")).toBe('aXb <span class="highlight">a.b</span>')
  })

  it("escapes result text and highlighted matches before rendering HTML", () => {
    expect(highlight("<img>", '<img> & "quote"')).toBe(
      '<span class="highlight">&lt;img&gt;</span> &amp; &quot;quote&quot;',
    )
    expect(highlight("absent", "<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    )
  })

  it("does not match inside an escaped HTML entity", () => {
    expect(highlight("amp", "& amp")).toBe('&amp; <span class="highlight">amp</span>')
  })

  it("escapes text around repeated, case-insensitive matches", () => {
    expect(highlight("hello", "<HelloHELLO>")).toBe(
      '&lt;<span class="highlight">Hello</span><span class="highlight">HELLO</span>&gt;',
    )
  })

  it("preserves Chinese search text and escapes adjacent markup", () => {
    expect(highlight("中文", "<中文教学>")).toBe('&lt;<span class="highlight">中文</span>教学&gt;')
  })

  it("keeps a one-word summary", () => {
    expect(highlight("needle", "needle", true)).toBe('<span class="highlight">needle</span>')
  })

  it("keeps the final word when the summary fits the context window", () => {
    expect(highlight("hello", "hello world", true)).toBe(
      '<span class="highlight">hello</span> world',
    )
  })

  it("only adds ellipses for text outside the summary", () => {
    const words = Array.from({ length: 100 }, (_, i) => `word${i}`)
    const summary = highlight("word80", words.join(" "), true)
    expect(summary).toContain('<span class="highlight">word80</span>')
    expect(summary.startsWith("...")).toBe(true)
    expect(summary.endsWith("...")).toBe(false)
    expect(summary.endsWith("word99")).toBe(true)
  })

  it("returns empty text for an empty summary", () => {
    expect(highlight("", "", true)).toBe("")
  })

  it("marks a truncated suffix without dropping the final word of the window", () => {
    const words = ["needle", ...Array.from({ length: 99 }, (_, i) => `word${i + 1}`)]
    const summary = highlight("needle", words.join(" "), true)
    expect(summary.startsWith('<span class="highlight">needle</span>')).toBe(true)
    expect(summary.endsWith("word59...")).toBe(true)
  })
})
