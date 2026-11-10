import { afterEach, describe, expect, it } from "vitest"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { VFile } from "vfile"
import { write } from "../quartz/plugins/emitters/helpers"
import { AliasRedirects } from "../quartz/plugins/emitters/aliases"
import { BuildCtx } from "../quartz/util/ctx"
import { FullSlug } from "../quartz/util/path"

const temporaryDirs: string[] = []
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "quartz-emitter-security-"))
  temporaryDirs.push(root)
  return { root, ctx: { argv: { output: path.join(root, "public") } } as BuildCtx }
}

afterEach(async () => {
  await Promise.all(temporaryDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe("emitter output boundaries", () => {
  it.each(["../outside", "nested/../../outside"])("rejects escaping slug %s", async (slug) => {
    const { ctx, root } = await fixture()
    await expect(
      write({ ctx, slug: slug as FullSlug, ext: ".html", content: "unsafe" }),
    ).rejects.toThrow()
    await expect(readFile(path.join(root, "outside.html"))).rejects.toThrow()
  })

  it("preserves nested output and harmless dot segments", async () => {
    const { ctx } = await fixture()
    const file = await write({
      ctx,
      slug: "nested/../page" as FullSlug,
      ext: ".html",
      content: "safe",
    })
    expect(await readFile(file, "utf8")).toBe("safe")
  })

  it("rejects traversal supplied by an alias", async () => {
    const { ctx, root } = await fixture()
    const file = new VFile("")
    file.data.slug = "page" as FullSlug
    file.data.aliases = ["../outside" as FullSlug]
    const outputs = await AliasRedirects().emit(ctx, [[{ type: "root", children: [] }, file]], {
      css: [],
      js: [],
      additionalHead: [],
    })
    await expect(
      (async () => {
        for await (const output of outputs) await output
      })(),
    ).rejects.toThrow()
    await expect(readFile(path.join(root, "outside.html"))).rejects.toThrow()
  })

  it("escapes page slugs in alias titles and URL attributes", async () => {
    const { ctx } = await fixture()
    const file = new VFile("")
    file.data.slug = 'page"><script>alert(1)</script>' as FullSlug
    file.data.aliases = ["alias" as FullSlug]
    const outputs = await AliasRedirects().emit(ctx, [[{ type: "root", children: [] }, file]], {
      css: [],
      js: [],
      additionalHead: [],
    })
    for await (const output of outputs) {
      const html = await readFile(await output, "utf8")
      expect(html).not.toContain("<script>")
      expect(html).toContain("&lt;script&gt;")
      expect(html).toContain('href="./page&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"')
    }
  })
})
