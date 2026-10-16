// scripts/schema.mjs
// Writes schema.json from config/schema.mjs. With --check, fails when the
// committed file is out of date instead of writing it.
import { readFileSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { Schema } from "effect"
import { OptionsSchema } from "../config/schema.mjs"

const TARGET = new URL("../schema.json", import.meta.url)

export function buildSchema() {
  const document = Schema.toJsonSchemaDocument(OptionsSchema, { onExcessProperty: "error" })
  const schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://raw.githubusercontent.com/crag-h4k/opencode-pillbox-statusline/main/schema.json",
    ...document.schema,
  }
  if (Object.keys(document.definitions ?? {}).length) schema.$defs = document.definitions
  return `${JSON.stringify(schema, null, 2)}\n`
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const next = buildSchema()
  if (process.argv.includes("--check")) {
    let current = ""
    try {
      current = readFileSync(TARGET, "utf8")
    } catch {
      // missing counts as out of date
    }
    if (current !== next) {
      console.error("schema.json is out of date; run `npm run schema`")
      process.exit(1)
    }
  } else {
    writeFileSync(TARGET, next)
  }
}
