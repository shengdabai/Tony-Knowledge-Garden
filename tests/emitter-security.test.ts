import { afterEach, describe, expect, it } from "vitest"
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
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

  it.each(["page", "new/nested/page"])(
    "rejects an escaping directory symlink before writing %s",
    async (slug) => {
      const { ctx, root } = await fixture()
      const outside = path.join(root, "public-outside")
      await mkdir(ctx.argv.output)
      await mkdir(outside)
      await writeFile(path.join(outside, "page.html"), "original")
      await symlink(outside, path.join(ctx.argv.output, "linked"), "dir")

      await expect(
        write({ ctx, slug: `linked/${slug}` as FullSlug, ext: ".html", content: "unsafe" }),
      ).rejects.toThrow("Emitter output must stay inside the output directory")
      expect(await readFile(path.join(outside, "page.html"), "utf8")).toBe("original")
      await expect(lstat(path.join(outside, "new"))).rejects.toMatchObject({ code: "ENOENT" })
    },
  )

  it.each([false, true])("rejects a leaf symlink (target exists: %s)", async (exists) => {
    const { ctx, root } = await fixture()
    const outside = path.join(root, "outside.html")
    await mkdir(ctx.argv.output)
    if (exists) await writeFile(outside, "original")
    await symlink(outside, path.join(ctx.argv.output, "page.html"))

    await expect(
      write({ ctx, slug: "page" as FullSlug, ext: ".html", content: "unsafe" }),
    ).rejects.toThrow("Emitter output must not be a symbolic link")
    expect((await lstat(path.join(ctx.argv.output, "page.html"))).isSymbolicLink()).toBe(true)
    if (exists) {
      expect(await readFile(outside, "utf8")).toBe("original")
    } else {
      await expect(lstat(outside)).rejects.toMatchObject({ code: "ENOENT" })
    }
  })

  it("rejects a leaf symlink even when its target is inside the output", async () => {
    const { ctx } = await fixture()
    await mkdir(ctx.argv.output)
    const target = path.join(ctx.argv.output, "target.html")
    await writeFile(target, "original")
    await symlink(target, path.join(ctx.argv.output, "page.html"))

    await expect(
      write({ ctx, slug: "page" as FullSlug, ext: ".html", content: "unsafe" }),
    ).rejects.toThrow("Emitter output must not be a symbolic link")
    expect(await readFile(target, "utf8")).toBe("original")
  })

  it("allows directory symlinks whose real paths stay inside the real output", async () => {
    const { ctx, root } = await fixture()
    const realOutput = path.join(root, "real-output")
    await mkdir(path.join(realOutput, "nested"), { recursive: true })
    await symlink(realOutput, ctx.argv.output, "dir")
    await symlink(path.join(realOutput, "nested"), path.join(realOutput, "linked"), "dir")

    const file = await write({
      ctx,
      slug: "linked/new/page" as FullSlug,
      ext: ".html",
      content: "safe",
    })
    expect(await readFile(file, "utf8")).toBe("safe")
    expect(await readFile(path.join(realOutput, "nested/new/page.html"), "utf8")).toBe("safe")
  })

  it("allows overwriting a regular output file", async () => {
    const { ctx } = await fixture()
    await mkdir(ctx.argv.output)
    await writeFile(path.join(ctx.argv.output, "page.html"), "original")
    const file = await write({ ctx, slug: "page" as FullSlug, ext: ".html", content: "updated" })
    expect(await readFile(file, "utf8")).toBe("updated")
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
