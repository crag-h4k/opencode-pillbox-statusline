// test/config.test.mjs
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { Result, Schema } from "effect"
import { COMMON_PILL_DEFAULTS } from "../config/defaults.mjs"
import { resolveConfig, suggest } from "../config/resolve.mjs"
import { pillSchema } from "../config/schema.mjs"
import { SIZE_NAMES } from "../config/types.mjs"
import { PILL_IDS, PILLS } from "../pills/index.mjs"
import { buildSchema } from "../scripts/schema.mjs"

test("defaults resolve cleanly and every pill carries the common settings", () => {
  const { config, errors } = resolveConfig(undefined)
  assert.deepEqual(errors, [])
  assert.deepEqual(Object.keys(config.pills), [...PILL_IDS])
  for (const settings of Object.values(config.pills)) {
    for (const key of Object.keys(COMMON_PILL_DEFAULTS)) assert.ok(key in settings, key)
  }
  assert.equal(config.pills.provider.group, "right")
  assert.equal(config.pills.sidequest.enabled, false)
  assert.equal(config.pills.tier.attach, "identity")
})

test("the pill registry is consistent", () => {
  assert.equal(new Set(PILL_IDS).size, PILL_IDS.length)
  for (const pill of PILLS) {
    assert.ok(pill.sizes.length > 0 && pill.sizes.every((size) => SIZE_NAMES.includes(size)), pill.id)
    assert.ok(Object.keys(pill.options ?? {}).every((key) => key in pill.defaults), `${pill.id} defaults every option`)
    const decoded = Schema.decodeUnknownResult(pillSchema(pill), { onExcessProperty: "error" })(pill.defaults)
    assert.ok(Result.isSuccess(decoded), `${pill.id} defaults satisfy its schema: ${Result.isFailure(decoded) ? decoded.failure : ""}`)
    if (pill.defaults.attach) assert.ok(PILL_IDS.includes(pill.defaults.attach))
  }
})

test("user options merge over defaults; lists replace instead of merging", () => {
  const { config, errors } = resolveConfig({
    style: { surface: ["#112233"] },
    pills: { git: { order: 15, maxWidth: 24 }, tier: { bands: { heavy: "hue.red" } } },
  })
  assert.deepEqual(errors, [])
  assert.deepEqual(config.style.surface, ["#112233"])
  assert.equal(config.style.caps, "round")
  assert.equal(config.pills.git.order, 15)
  assert.equal(config.pills.git.priority, 90)
  assert.equal(config.pills.tier.bands.heavy, "hue.red")
  assert.equal(config.pills.tier.bands.included, "feedback.success")
})

test("presets apply before user options", () => {
  const minimal = resolveConfig({ preset: "minimal" }).config
  assert.equal(minimal.pills.cost.enabled, false)
  assert.equal(minimal.pills.git.enabled, true)
  const reenabled = resolveConfig({ preset: "minimal", pills: { cost: { enabled: true } } }).config
  assert.equal(reenabled.pills.cost.enabled, true)
})

test("each mistake drops only its own entry and is reported with a path", () => {
  const { config, errors } = resolveConfig({
    stlye: {},
    icons: "emoji",
    pills: {
      gti: {},
      git: { priorty: 10 },
      cost: { enabled: false },
      context: { accent: "teal" },
      provider: { warnAt: 101 },
    },
  })
  const byPath = Object.fromEntries(errors.map((error) => [error.path, error.message]))
  assert.match(byPath.stlye, /did you mean "style"/)
  assert.match(byPath.icons, /nerd/)
  assert.match(byPath["pills.gti"], /did you mean "git"/)
  assert.match(byPath["pills.git.priorty"], /did you mean "priority"/)
  assert.ok(byPath["pills.context.accent"])
  assert.match(byPath["pills.provider.warnAt"], /between 0 and 100/)
  assert.equal(config.pills.cost.enabled, false, "valid pills still apply")
  assert.equal(config.icons, "nerd")
  assert.equal(config.pills.git.priority, 90)
})

test("non-object options fall back to defaults with one error", () => {
  const { config, errors } = resolveConfig("cost: off")
  assert.equal(errors.length, 1)
  assert.equal(config.pills.cost.enabled, true)
})

test("impossible sizes and attach cycles are repaired and reported", () => {
  const { config, errors } = resolveConfig({
    pills: {
      project: { size: "compact" },
      cost: { size: "compact", minSize: "full" },
      identity: { attach: "tier" },
    },
  })
  const paths = errors.map((error) => error.path).sort()
  assert.deepEqual(paths, ["pills.cost.minSize", "pills.identity.attach", "pills.project.size"])
  assert.equal(config.pills.project.size, "icon")
  assert.equal(config.pills.cost.minSize, "compact")
  assert.equal(config.pills.spinner.attach, "identity", "pills outside the cycle keep their attach")
})

test("suggest finds near misses only", () => {
  assert.equal(suggest("contex", ["context", "cost"]), "context")
  assert.equal(suggest("zzzz", ["context", "cost"]), undefined)
})

test("schema.json is generated from the options schema and rejects unknown keys", () => {
  const committed = readFileSync(new URL("../schema.json", import.meta.url), "utf8")
  assert.equal(committed, buildSchema(), "run `npm run schema`")
  const schema = JSON.parse(committed)
  assert.equal(schema.additionalProperties, false)
  assert.equal(schema.properties.pills.additionalProperties, false)
  assert.deepEqual(Object.keys(schema.properties.pills.properties), [...PILL_IDS])
  assert.equal(schema.properties.pills.properties.git.additionalProperties, false)
  assert.ok(schema.properties.pills.properties.provider.properties.warnAt)
})
