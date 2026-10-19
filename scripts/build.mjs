// scripts/build.mjs
// Compiles the two TSX files into dist/ with the same Solid transform OpenCode
// applies to a plugin loaded from a path. OpenCode skips everything under
// node_modules, so an installed package has to ship the compiled form. Without
// it the footer paints once and never updates: the spinner stays on one frame
// and late quota and cost figures never appear.
//
// Only the TSX files are compiled. Their relative imports point back at src/,
// so the logic modules exist once.
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, relative, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const SRC = join(ROOT, "src")

/** Basenames of the src/*.tsx files that ship compiled. */
export const COMPILED = ["tui", "diagnostics"]

// The transform OpenCode itself applies to path-loaded plugins. It is not in the
// package's export map, so load it by file URL from the installed package.
async function loadTransform() {
  const entry = fileURLToPath(import.meta.resolve("@opentui/solid"))
  const module = await import(pathToFileURL(join(dirname(entry), "scripts", "solid-transform.js")).href)
  return module.transformSolidSource
}

function toSpecifier(path) {
  const posix = path.split(sep).join("/")
  return posix.startsWith(".") ? posix : `./${posix}`
}

/**
 * Where a relative import in a src/*.tsx file points once the file moves to outDir.
 * @param {string} specifier  as written in the source
 * @param {string} outDir
 */
export function rewriteImport(specifier, outDir) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return specifier
  const name = specifier.replace(/^\.\//, "").replace(/\.tsx$/, "")
  if (specifier.endsWith(".tsx") && COMPILED.includes(name)) return `./${name}.js`
  if (!specifier.startsWith("./")) throw new Error(`Cannot rewrite ${specifier}: only sibling imports are supported`)
  return toSpecifier(relative(outDir, join(SRC, specifier)))
}

/**
 * @param {{ outDir?: string }} [options]
 * @returns {Promise<string[]>} the files written
 */
export async function build({ outDir = join(ROOT, "dist") } = {}) {
  const transform = await loadTransform()
  await mkdir(outDir, { recursive: true })
  const written = []
  for (const name of COMPILED) {
    const filename = join(SRC, `${name}.tsx`)
    const code = await transform(await readFile(filename, "utf8"), {
      filename,
      resolvePath: (specifier) => rewriteImport(specifier, outDir),
    })
    const target = join(outDir, `${name}.js`)
    await writeFile(target, `// Generated from src/${name}.tsx by scripts/build.mjs. Do not edit.\n${code}\n`)
    written.push(target)
  }
  return written
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const file of await build()) console.log(relative(ROOT, file))
}
