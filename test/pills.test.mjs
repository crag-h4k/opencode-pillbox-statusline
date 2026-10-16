// test/pills.test.mjs
import assert from "node:assert/strict"
import test from "node:test"
import { resolveConfig } from "../src/config/resolve.mjs"
import { iconSet } from "../src/render/icons.mjs"
import { pillById } from "../src/pills/index.mjs"
import { quota } from "../src/pills/provider.mjs"

const { config } = resolveConfig(undefined)
const icons = iconSet("nerd")
const render = (id, data, overrides = {}) =>
  pillById(id).render({ now: 0, ...data }, { ...config.pills[id], ...overrides }, icons)

test("hint shows the interrupt shortcut while running and the shell exit in shell mode", () => {
  assert.equal(render("hint", { status: "idle", mode: "normal" }), undefined)
  assert.equal(render("hint", { status: "running", mode: "normal", interrupt: "ctrl+c" }).sizes.full, "ctrl+c interrupt")
  assert.equal(render("hint", { status: "running", mode: "normal" }).sizes.full, "esc interrupt")
  assert.equal(render("hint", { mode: "shell" }).sizes.full, "esc exit shell mode")
})

test("project and git truncate to maxWidth; a dirty tree switches the git accent", () => {
  assert.equal(render("project", {}), undefined)
  assert.equal(render("project", { project: "opencode-pillbox-statusline" }).sizes.full, "opencode-pillbox-\u2026")
  assert.equal(render("git", { git: { branch: "", files: 0 } }), undefined)
  const clean = render("git", { git: { branch: "main", files: 0, additions: 0, deletions: 0 } })
  assert.deepEqual(clean.sizes, { full: "main", compact: "main", icon: "" })
  assert.equal(clean.accent, undefined)
  const dirty = render("git", { git: { branch: "feat/tui-renderer-and-more", files: 2, additions: 14, deletions: 3 } })
  assert.equal(dirty.sizes.full, "feat/tui-renderer\u2026 \u20222 +14 -3")
  assert.equal(dirty.sizes.compact, "feat/tui-renderer\u2026 \u20222")
  assert.equal(dirty.accent, "feedback.warning")
})

test("identity colors the agent with the agent token and the effort with its own color", () => {
  assert.equal(render("identity", {}), undefined)
  const output = render("identity", { agent: "build", model: "gpt-5.6-sol", variant: "xhigh" })
  assert.deepEqual(output.sizes.full, [
    { text: "build", color: "agent" },
    { text: " \u00b7 gpt-5.6-sol" },
    { text: " \u00b7 xhigh", color: "feedback.warning" },
  ])
  assert.deepEqual(output.sizes.compact, [{ text: "build", color: "agent" }, { text: " \u00b7 gpt-5.6-sol" }])
  assert.equal(render("identity", { agent: "plan", variant: "high" }, { showEffort: false }).sizes.full.length, 1)
})

test("spinner animates only for foreground work; subagents animate only while children run", () => {
  const running = { mode: "normal", status: "running", waiting: false, tick: 3 }
  assert.equal(render("spinner", running).icon, icons.spinner[3])
  assert.equal(render("spinner", { ...running, waiting: true }), undefined)
  assert.equal(render("spinner", { ...running, mode: "shell" }), undefined)
  assert.equal(render("spinner", { ...running, status: "idle" }), undefined)
  assert.equal(render("subagents", { subagents: { running: 0, queued: 0 } }), undefined)
  assert.equal(render("subagents", { subagents: { running: 0, queued: 2 } }).icon, icons.subagentQueued)
  const busy = render("subagents", { tick: 2, subagents: { running: 1, queued: 3 } })
  assert.equal(busy.icon, icons.subagentSpinner[2])
  assert.equal(busy.sizes.full, "1 run \u00b7 3 queued")
})

test("elapsed, context, and cost format today's values", () => {
  assert.equal(render("elapsed", { now: 3_720_000, createdAt: 0 }), undefined, "zero createdAt means unknown")
  assert.equal(render("elapsed", { now: 3_720_001, createdAt: 1 }).sizes.full, "1h2m")
  assert.equal(render("context", {}), undefined)
  assert.deepEqual(render("context", { context: { tokens: 653_900, limit: 1_054_000 } }).sizes, { full: "653.9K (62%)", compact: "62%" })
  assert.deepEqual(render("context", { context: { tokens: 43_900 } }).sizes, { full: "43.9K", compact: "43.9K" })
  assert.equal(render("cost", { cost: 0 }), undefined)
  assert.deepEqual(render("cost", { cost: 51.29 }).sizes, { full: "$51.29", compact: "$51" })
})

test("tier uses the Copilot picker category first, then the catalog price", () => {
  assert.equal(render("tier", {}), undefined)
  const heavy = render("tier", { tier: { category: "powerful" } })
  assert.equal(heavy.sizes.full, "Heavy")
  assert.equal(heavy.accent, "feedback.error")
  assert.equal(heavy.icon, icons.tier.value.heavy)
  assert.equal(render("tier", { tier: { category: "powerful", outputCost: 10 } }).sizes.full, "Premium")
  assert.equal(render("tier", { tier: { category: "lightweight", outputCost: 60 } }).sizes.full, "Included")
  assert.equal(render("tier", { tier: { outputCost: 12 } }).sizes.full, "Standard")
  assert.equal(render("tier", { tier: { category: "unknown" } }), undefined)
  assert.equal(render("tier", { tier: { outputCost: 2 } }, { ramp: "heat" }).icon, icons.tier.heat.included)
})

test("provider quota labels match today's footer and color by threshold", () => {
  assert.deepEqual(quota({ id: "github-copilot", copilot: { usedPercent: 71, unlimited: false } }), {
    full: "GitHub Copilot 71%", compact: "71%", usedPercent: 71,
  })
  assert.equal(quota({ id: "github-copilot", copilot: { usedPercent: 0, unlimited: true } }).full, "GitHub Copilot \u221e")
  assert.equal(quota({ id: "github-copilot" }).usedPercent, 100)
  assert.equal(quota({ id: "openai", auth: "oauth", windows: [{ period: "week", usedPercent: 37 }] }).full, "Codex 63% left")
  assert.equal(quota({ id: "openai", auth: "oauth" }).full, "Codex unavailable")
  assert.equal(quota({ id: "openai", auth: "key", windows: [{ period: "week", usedPercent: 37 }] }), undefined)
  assert.equal(
    quota({ id: "anthropic", name: "Anthropic", windows: [{ period: "5h", usedPercent: 12 }, { period: "week", usedPercent: 34 }] }).full,
    "Anthropic 5h 12% \u00b7 week 34%",
  )
  assert.equal(quota({ id: "household", windows: [] }), undefined)

  const at = (usedPercent) => render("provider", { provider: { id: "github-copilot", copilot: { usedPercent, unlimited: false } } })
  assert.equal(at(69).accent, "feedback.info")
  assert.equal(at(70).accent, "feedback.warning")
  assert.equal(at(90).accent, "feedback.error")
  assert.equal(at(50).icon, icons.provider)
  assert.equal(render("provider", { provider: { id: "openai", auth: "oauth", windows: [] } }).icon, icons.limit)
})

test("sidequest shows the newest run's progress and turns red on failure", () => {
  assert.equal(render("sidequest", {}), undefined)
  const run = render("sidequest", { sidequest: { name: "config-review", done: 3, total: 6, failed: 0 } })
  assert.deepEqual(run.sizes, { full: "config-review 3/6", compact: "3/6" })
  assert.equal(render("sidequest", { sidequest: { name: "x", done: 2, total: 6, failed: 1 } }).accent, "feedback.error")
})
