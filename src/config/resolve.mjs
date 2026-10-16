// src/config/resolve.mjs
// Turns raw cli.json options into a complete config. Order: built-in defaults,
// then the preset, then the user's options. Each top-level key and each pill is
// validated on its own, so one mistake drops only that entry and is reported;
// the rest of the footer still renders.
import { Result, Schema } from "effect"
import { PILL_IDS, PILLS, pillById } from "../pills/index.mjs"
import { builtinConfig, PRESETS } from "./defaults.mjs"
import { COMMON_PILL_FIELDS, pillSchema, ROOT_FIELDS } from "./schema.mjs"

const PARSE = { onExcessProperty: "error", errors: "all" }
const LADDER = ["full", "compact", "icon", "hidden"]
const PILL_SCHEMAS = new Map(PILLS.map((pill) => [pill.id, pillSchema(pill)]))

function pillKeys(id) {
  return [...Object.keys(COMMON_PILL_FIELDS), ...Object.keys(pillById(id)?.options ?? {})]
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** Deep merge for plain objects; arrays and scalars in `override` replace. */
export function merge(base, override) {
  if (!isObject(base) || !isObject(override)) return structuredClone(override)
  const out = { ...base }
  for (const [key, value] of Object.entries(override)) {
    out[key] = isObject(value) && isObject(base[key]) ? merge(base[key], value) : structuredClone(value)
  }
  return out
}

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = current
    }
  }
  return row[b.length]
}

/** The closest known name within two edits, for "did you mean" hints. */
export function suggest(name, known) {
  let best
  for (const candidate of known) {
    const score = distance(name.toLowerCase(), candidate.toLowerCase())
    if (score <= 2 && (!best || score < best.score)) best = { candidate, score }
  }
  return best?.candidate
}

function unknown(path, name, known) {
  const hint = suggest(name, known)
  return { path, message: `Unknown key "${name}"${hint ? `; did you mean "${hint}"?` : ""}` }
}

/** Splits an effect SchemaError into { path, message } entries under `prefix`. */
export function schemaIssues(error, prefix) {
  const text = String(error).replace(/^SchemaError\(/, "").replace(/\)$/, "")
  const issues = []
  for (const line of text.split("\n")) {
    const at = /^\s+at (.*)$/.exec(line)
    if (at && issues.length) {
      const suffix = at[1].replace(/\["([^"]+)"\]/g, ".$1")
      issues[issues.length - 1].path = `${prefix}${suffix}`
    } else if (line.trim()) {
      issues.push({ path: prefix, message: line.trim() })
    }
  }
  return issues.length ? issues : [{ path: prefix, message: text }]
}

function decode(schema, value, prefix, errors, known = []) {
  const result = Schema.decodeUnknownResult(schema, PARSE)(value)
  if (Result.isSuccess(result)) return { ok: true, value: result.success }
  for (const issue of schemaIssues(result.failure, prefix)) {
    if (issue.message === "Expected no excess property") {
      const name = issue.path.split(".").pop()
      errors.push(unknown(issue.path, name, known))
    } else {
      errors.push(issue)
    }
  }
  return { ok: false }
}

function validated(options, errors) {
  const user = {}
  if (options === undefined || options === null) return user
  if (!isObject(options)) {
    errors.push({ path: "", message: "Options must be an object" })
    return user
  }
  for (const [key, value] of Object.entries(options)) {
    if (key === "pills") continue
    const schema = ROOT_FIELDS[key]
    if (!schema) {
      errors.push(unknown(key, key, Object.keys(ROOT_FIELDS)))
      continue
    }
    const result = decode(schema, value, key, errors)
    if (result.ok) user[key] = result.value
  }
  if (options.pills === undefined) return user
  if (!isObject(options.pills)) {
    errors.push({ path: "pills", message: "Expected an object keyed by pill id" })
    return user
  }
  user.pills = {}
  for (const [id, value] of Object.entries(options.pills)) {
    const schema = PILL_SCHEMAS.get(id)
    if (!schema) {
      errors.push(unknown(`pills.${id}`, id, PILL_IDS))
      continue
    }
    const result = decode(schema, value, `pills.${id}`, errors, pillKeys(id))
    if (result.ok) user.pills[id] = result.value
  }
  return user
}

function settle(sizes, size) {
  for (let index = LADDER.indexOf(size); index < LADDER.length - 1; index++) {
    if (sizes.includes(LADDER[index])) return LADDER[index]
  }
  return sizes[sizes.length - 1]
}

function repair(config, errors) {
  for (const pill of PILLS) {
    const settings = config.pills[pill.id]
    if (!pill.sizes.includes(settings.size)) {
      const fixed = settle(pill.sizes, settings.size)
      errors.push({
        path: `pills.${pill.id}.size`,
        message: `"${settings.size}" is not a size of this pill (${pill.sizes.join(", ")}); using "${fixed}"`,
      })
      settings.size = fixed
    }
    if (LADDER.indexOf(settings.minSize) < LADDER.indexOf(settings.size)) {
      errors.push({
        path: `pills.${pill.id}.minSize`,
        message: `minSize "${settings.minSize}" is larger than size "${settings.size}"; using "${settings.size}"`,
      })
      settings.minSize = settings.size
    }
  }
  for (const pill of PILLS) {
    const seen = new Set([pill.id])
    let next = config.pills[pill.id].attach
    while (next) {
      if (next === pill.id) {
        errors.push({ path: `pills.${pill.id}.attach`, message: "attach forms a cycle back to this pill; ignoring it" })
        delete config.pills[pill.id].attach
        break
      }
      // A cycle further down the chain is reported by its own members.
      if (seen.has(next)) break
      seen.add(next)
      next = config.pills[next]?.attach
    }
  }
}

/**
 * @typedef {{
 *   preset: string,
 *   icons: string,
 *   style: { surface: string | string[], caps: string, gap: number },
 *   layout: { reserve: number, hysteresis: number },
 *   sources: { usage: { refresh: number }, tiers: { refresh: number } },
 *   pills: Record<string, Record<string, any>>,
 * }} PillboxConfig
 */

/**
 * @param {unknown} options  the `options` object from the cli.json plugin entry
 * @returns {{ config: PillboxConfig, errors: { path: string, message: string }[] }}
 */
export function resolveConfig(options) {
  const errors = []
  const user = validated(options, errors)
  const preset = user.preset ?? "default"
  let config = merge(builtinConfig(), PRESETS[preset])
  config = merge(config, user)
  delete config.$schema
  config.preset = preset
  repair(config, errors)
  return { config, errors }
}
