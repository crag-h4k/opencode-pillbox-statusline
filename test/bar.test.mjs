// test/bar.test.mjs
import assert from "node:assert/strict"
import test from "node:test"
import { barModel } from "../src/render/bar.mjs"
import { resolveConfig } from "../src/config/resolve.mjs"
import { contextUsage, duration, priceBand } from "../src/render/format.mjs"
import { partsWidth } from "../src/render/layout.mjs"

// Today's footer state from the dotfiles docs capture, as a snapshot.
const SNAPSHOT = {
  mode: "normal",
  status: "running",
  waiting: false,
  interrupt: "esc",
  now: 12 * 60_000 + 1,
  tick: 0,
  project: "project",
  git: { branch: "main", files: 2, additions: 14, deletions: 3 },
  agent: "build",
  model: "gpt-5.6-sol",
  variant: "xhigh",
  createdAt: 1,
  subagents: { running: 1, queued: 0 },
  context: { tokens: 43_900, limit: 1_054_000 },
  cost: 23.79,
  tier: { category: "powerful", outputCost: 30 },
  provider: { id: "github-copilot", copilot: { usedPercent: 52, unlimited: false } },
}

const ids = (model) => model.pills.map((pill) => pill.id)

test("a wide session footer shows every pill in order, with the provider on the right", () => {
  const { config } = resolveConfig(undefined)
  const model = barModel(config, SNAPSHOT, { bar: "session", budget: 230, columns: 260 })
  assert.deepEqual(ids(model), ["hint", "project", "git", "spinner", "identity", "elapsed", "subagents", "context", "cost", "tier", "provider"])
  assert.equal(model.pills.at(-1).group, "right")
  assert.equal(model.fit.overflow, false)
  const text = (id) => model.pills.find((pill) => pill.id === id).parts.map((part) => part.text).join("")
  assert.equal(text("git"), "\uE0B6 \uE0A0 main \u20222 +14 -3 \uE0B4")
  assert.equal(text("hint"), "esc interrupt")
  assert.equal(text("spinner"), "\u280B")
  assert.equal(text("cost"), "\uE0B6 \u2248 $23.79 \uE0B4")
})

test("plain pills never get caps; flat drops caps from every pill", () => {
  const { config } = resolveConfig(undefined)
  const model = barModel(config, SNAPSHOT, { bar: "session", budget: 230 })
  for (const pill of model.pills) {
    assert.equal(pill.parts.some((part) => part.role === "cap"), !pill.plain, pill.id)
  }
  const flat = barModel(config, SNAPSHOT, { bar: "session", budget: 230, flat: true })
  assert.ok(flat.pills.every((pill) => !pill.parts.some((part) => part.role === "cap")))
  const ascii = barModel(resolveConfig({ icons: "ascii" }).config, SNAPSHOT, { bar: "session", budget: 230 })
  assert.ok(ascii.pills.every((pill) => !pill.parts.some((part) => part.role === "cap")), "ascii cannot draw round caps")
})

test("the home footer shows only pills marked home or always", () => {
  const { config } = resolveConfig(undefined)
  const model = barModel(config, SNAPSHOT, { bar: "home", budget: 200 })
  assert.deepEqual(ids(model), ["project", "git"])
})

test("disabled pills, empty data, and orphaned attachments are left out", () => {
  const { config } = resolveConfig({ pills: { cost: { enabled: false }, identity: { enabled: false } } })
  const model = barModel(config, { ...SNAPSHOT, provider: undefined }, { bar: "session", budget: 230 })
  for (const id of ["cost", "identity", "spinner", "tier", "provider"]) assert.ok(!ids(model).includes(id), id)
})

test("colors come from settings unless the pill overrides them", () => {
  const { config } = resolveConfig({ pills: { context: { accent: "hue.cyan" } } })
  const model = barModel(config, SNAPSHOT, { bar: "session", budget: 230 })
  const pill = (id) => model.pills.find((item) => item.id === id)
  assert.equal(pill("context").accent, "hue.cyan")
  assert.equal(pill("git").accent, "feedback.warning", "dirty tree")
  assert.equal(pill("tier").accent, "feedback.error", "heavy band")
  assert.equal(pill("identity").parts.find((part) => part.text === "build").color, "agent")
  assert.equal(pill("cost").value, "text.base")
})

test("measured widths match the drawn runs, and the fit never exceeds the budget", () => {
  const { config } = resolveConfig(undefined)
  for (let budget = 20; budget <= 220; budget += 7) {
    const model = barModel(config, SNAPSHOT, { bar: "session", budget, columns: budget + 30 })
    const drawn = model.pills.reduce((total, pill) => total + partsWidth(pill.parts), 0)
    const gaps = Math.max(0, model.pills.length - 1) * config.style.gap
    assert.equal(drawn + gaps, model.fit.width, `budget ${budget}`)
    assert.ok(model.fit.width <= budget || model.fit.overflow, `budget ${budget}`)
  }
})

test("a custom icon replaces the icon set's glyph", () => {
  const { config } = resolveConfig({ pills: { cost: { icon: "$" } } })
  const model = barModel(config, SNAPSHOT, { bar: "session", budget: 230 })
  assert.ok(model.pills.find((pill) => pill.id === "cost").parts.some((part) => part.role === "icon" && part.text === "$"))
})

test("context usage reads the newest assistant message after the last compaction", () => {
  const tokens = (input) => ({ input, output: 10, reasoning: 0, cache: { read: 0, write: 0 } })
  const model = { providerID: "openai", id: "gpt" }
  const messages = [
    { id: "a", type: "assistant", tokens: tokens(5000), model },
    { id: "c", type: "compaction", status: "completed" },
    { id: "u", type: "user" },
    { id: "b", type: "assistant", tokens: tokens(990), model },
  ]
  const models = [{ providerID: "openai", id: "gpt", limit: { context: 10_000 } }]
  assert.deepEqual(contextUsage({ messages, models }), { tokens: 1000, limit: 10_000 })
  assert.deepEqual(contextUsage({ messages: messages.slice(0, 3), models }), undefined, "nothing after the compaction")
  assert.deepEqual(contextUsage({ messages, revertMessageID: "u", models }), undefined)
  assert.equal(contextUsage({ messages, revertMessageID: "missing" }), undefined)
  assert.deepEqual(contextUsage({ messages: messages.slice(0, 1) }), { tokens: 5010 })
})

test("durations and price bands match the old footer", () => {
  assert.equal(duration(59_000), "<1m")
  assert.equal(duration(12 * 60_000), "12m")
  assert.equal(duration(26 * 3_600_000), "1d2h")
  assert.deepEqual([4, 5, 11, 20, 21].map(priceBand), ["included", "included", "standard", "premium", "heavy"])
})
