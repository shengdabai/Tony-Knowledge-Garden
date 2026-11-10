import path from "path"
import fs from "fs"
import { BuildCtx } from "../../util/ctx"
import { FilePath, FullSlug, joinSegments } from "../../util/path"
import { Readable } from "stream"

type WriteOptions = {
  ctx: BuildCtx
  slug: FullSlug
  ext: `.${string}` | ""
  content: string | Buffer | Readable
}

function assertInsideOutput(output: string, target: string) {
  const relativePath = path.relative(output, target)
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error("Emitter output must stay inside the output directory")
  }
}

export const write = async ({ ctx, slug, ext, content }: WriteOptions): Promise<FilePath> => {
  const pathToPage = path.normalize(joinSegments(ctx.argv.output, slug + ext)) as FilePath
  const output = path.resolve(ctx.argv.output)
  const target = path.resolve(pathToPage)
  assertInsideOutput(output, target)

  await fs.promises.mkdir(output, { recursive: true })
  const realOutput = await fs.promises.realpath(output)
  const dir = path.dirname(target)
  // Check before mkdir: even creating missing parents can escape through a symlink.
  let parent = dir
  while (true) {
    try {
      const realParent = await fs.promises.realpath(parent)
      assertInsideOutput(realOutput, realParent)
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      parent = path.dirname(parent)
    }
  }

  try {
    if ((await fs.promises.lstat(target)).isSymbolicLink()) {
      throw new Error("Emitter output must not be a symbolic link")
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }

  await fs.promises.mkdir(dir, { recursive: true })
  await fs.promises.writeFile(target, content)
  return pathToPage
}
