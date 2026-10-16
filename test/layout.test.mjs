// test/layout.test.mjs
import assert from "node:assert/strict"
import test from "node:test"
import { resolveConfig } from "../src/config/resolve.mjs"
import { fitBar, partsWidth, pillParts, sizesOf } from "../src/render/layout.mjs"
import { displayWidth } from "../src/render/width.mjs"

const CAPS = { left: "\uE0B6", right: "\uE0B4" }

test("pill anatomy matches today's footer: caps, padded icon, text, trailing pad", () => {
  const full = pillParts({ icon: "X", text: "main", size: "full", caps: CAPS })
  assert.deepEqual(full.map((part) => part.text), ["\uE0B6", " ", "X", " ", "main", " ", "\uE0B4"])
  assert.equal(partsWidth(full), 10)
  assert.equal(partsWidth(pillParts({ icon: "X", text: "main", size: "icon", caps: CAPS })), 5)
  assert.equal(partsWidth(pillParts({ icon: "X", text: "main", size: "full" })), 8)
  assert.equal(partsWidth(pillParts({ text: "esc interrupt", size: "full" })), 15)
  assert.equal(partsWidth(pillParts({ text: "esc interrupt", size: "full", plain: true })), 13)
  assert.deepEqual(pillParts({ icon: "X", size: "icon", plain: true }).map((part) => part.text), ["X"])
  assert.deepEqual(pillParts({ icon: "X", text: "run", size: "full", plain: true }).map((part) => part.text), ["X", " ", "run"])
  assert.equal(partsWidth(pillParts({ icon: "\u{F024B}", text: "\u4E2D", size: "full", caps: CAPS })), 8)
})

const pill = (id, priority, widths, extra = {}) => ({ id, group: "left", order: priority, priority, widths, ...extra })

test("everything fits at its preferred size when there is room", () => {
  const result = fitBar({ pills: [pill("a", 50, { full: 10 }), pill("b", 40, { full: 10 })], budget: 21 })
  assert.deepEqual(result.placed.map((item) => [item.id, item.size]), [["b", "full"], ["a", "full"]])
  assert.equal(result.width, 21)
  assert.equal(result.overflow, false)
})

test("the lowest priority shrinks one size at a time, then hides", () => {
  const pills = [
    pill("keep", 90, { full: 20 }),
    pill("shrink", 10, { full: 20, compact: 12, icon: 5 }, { order: 20 }),
  ]
  const at = (budget) => fitBar({ pills, budget }).placed.map((item) => `${item.id}:${item.size}`)
  assert.deepEqual(at(41), ["shrink:full", "keep:full"])
  assert.deepEqual(at(33), ["shrink:compact", "keep:full"])
  assert.deepEqual(at(26), ["shrink:icon", "keep:full"])
  assert.deepEqual(at(25), ["keep:full"])
  assert.equal(fitBar({ pills, budget: 25 }).hidden[0].reason, "space")
})

test("equal priorities drop the higher order first; minSize and minColumns hold", () => {
  const pills = [
    pill("first", 50, { full: 10 }, { order: 1 }),
    pill("second", 50, { full: 10 }, { order: 2 }),
    pill("sticky", 1, { full: 10, icon: 4 }, { order: 3, minSize: "icon" }),
    pill("wide", 99, { full: 10 }, { order: 4, minColumns: 200 }),
  ]
  const result = fitBar({ pills, budget: 15, columns: 120 })
  assert.deepEqual(result.placed.map((item) => `${item.id}:${item.size}`), ["first:full", "sticky:icon"])
  assert.deepEqual(Object.fromEntries(result.hidden.map((item) => [item.id, item.reason])), { second: "space", wide: "minColumns" })
})

test("attached pills hide with their parent, and overflow is reported when nothing can shrink", () => {
  const pills = [
    pill("identity", 60, { full: 20 }, { order: 40 }),
    pill("spinner", 60, { icon: 1 }, { order: 39, attach: "identity", size: "icon" }),
    pill("project", 95, { full: 10 }, { order: 10, minSize: "full" }),
  ]
  const result = fitBar({ pills, budget: 12 })
  assert.deepEqual(result.placed.map((item) => item.id), ["project"])
  assert.equal(result.hidden.find((item) => item.id === "spinner").reason, "attached")
  const stuck = fitBar({ pills: [pills[2]], budget: 5 })
  assert.equal(stuck.overflow, true)
  assert.equal(stuck.placed.length, 1)
})

test("hysteresis delays growth by the configured slack, never shrinking", () => {
  const pills = [pill("cost", 50, { full: 10, compact: 6 })]
  const previous = new Map([["cost", "compact"]])
  assert.equal(fitBar({ pills, budget: 11, hysteresis: 2, previous }).placed[0].size, "compact")
  assert.equal(fitBar({ pills, budget: 12, hysteresis: 2, previous }).placed[0].size, "full")
  assert.equal(fitBar({ pills, budget: 9, hysteresis: 2, previous: new Map([["cost", "full"]]) }).placed[0].size, "compact")
  const hidden = fitBar({ pills, budget: 7, hysteresis: 2, previous: new Map([["cost", "hidden"]]) })
  assert.equal(hidden.placed.length, 0)
  assert.deepEqual([...sizesOf(fitBar({ pills, budget: 20 }))], [["cost", "full"]])
})

// A realistic session footer built from the default config with today's sample
// values, swept across terminal widths.
function sessionPills() {
  const { config } = resolveConfig(undefined)
  const samples = {
    hint: { full: "esc interrupt" },
    project: { full: "work", icon: "" },
    git: { full: "main \u20222 +14 -3", compact: "main \u20222", icon: "" },
    spinner: { icon: "" },
    identity: { full: "build \u00b7 gpt-5.6-sol \u00b7 xhigh", compact: "build \u00b7 gpt-5.6-sol", icon: "" },
    elapsed: { full: "12m", icon: "" },
    subagents: { full: "1 run", icon: "" },
    context: { full: "43.9K (4%)", compact: "4%" },
    cost: { full: "$23.79", compact: "$24" },
    tier: { full: "Premium", icon: "" },
    provider: { full: "GitHub Copilot 52%", compact: "52%" },
  }
  return Object.entries(samples).map(([id, texts]) => {
    const settings = config.pills[id]
    const plain = id === "hint" || id === "spinner"
    const widths = Object.fromEntries(Object.entries(texts).map(([size, text]) => [
      size,
      partsWidth(pillParts({ icon: id === "hint" ? "" : "X", text, size, caps: CAPS, plain })),
    ]))
    return { id, ...settings, widths }
  })
}

test("the default footer never overflows from 40 to 240 columns and drops in priority order", () => {
  const pills = sessionPills()
  let previousVisible = 0
  for (let columns = 40; columns <= 240; columns++) {
    const result = fitBar({ pills, budget: columns - 30, columns, gap: 1 })
    assert.equal(result.overflow, false, `overflow at ${columns}`)
    assert.ok(result.width <= columns - 30, `too wide at ${columns}`)
    assert.ok(result.placed.length >= previousVisible, `a wider terminal never shows fewer pills (${columns})`)
    previousVisible = result.placed.length
  }
  const at = (columns) => fitBar({ pills, budget: columns - 30, columns }).placed.map((item) => item.id)
  assert.deepEqual(at(240), ["hint", "project", "git", "spinner", "identity", "elapsed", "subagents", "context", "cost", "tier", "provider"])
  assert.ok(at(99).includes("project") && at(99).includes("git") && at(99).includes("provider"))
  assert.ok(!at(99).includes("elapsed"), "elapsed is the first to go")
  for (const columns of [99, 151, 200]) {
    const ids = at(columns)
    assert.equal(ids.includes("spinner"), ids.includes("identity"), `spinner follows identity at ${columns}`)
  }
  assert.ok(displayWidth("esc interrupt") === 13)
})
