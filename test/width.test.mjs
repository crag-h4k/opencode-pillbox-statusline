// test/width.test.mjs
import assert from "node:assert/strict"
import test from "node:test"
import { clean, displayWidth, fit } from "../width.mjs"

// Footer glyphs plus known narrow, wide, and zero-width references.
const SAMPLES = {
  ascii: "project main",
  powerlineCaps: "\uE0B6\uE0B4",
  gitBranch: "\uE0A0",
  folderPlane15: "\u{F024B}",
  robotPlane15: "\u{F06A9}",
  clockPlane15: "\u{F0954}",
  braille: "\u280B",
  ellipsisAndMiddot: "\u2026 \u00B7 \u2248",
  cjk: "\u4E2D\u6587",
  emoji: "\u{1F600}",
  combining: "e\u0301",
}

test("Nerd Font icons take one cell; CJK and emoji take two", () => {
  assert.equal(displayWidth(SAMPLES.folderPlane15), 1)
  assert.equal(displayWidth(SAMPLES.gitBranch), 1)
  assert.equal(displayWidth(SAMPLES.powerlineCaps), 2)
  assert.equal(displayWidth(SAMPLES.cjk), 4)
  assert.equal(displayWidth(SAMPLES.emoji), 2)
  assert.equal(displayWidth(SAMPLES.combining), 1)
})

test("clean strips escapes and control characters", () => {
  assert.equal(clean("\u001b[31mred\u001b[0m"), "red")
  assert.equal(clean("a\tb\nc"), "a b c")
  assert.equal(clean(undefined), "")
})

test("fit truncates by cells with an ellipsis and never overflows", () => {
  assert.equal(fit("feat/oc2-pillbox", 8), "feat/oc…")
  assert.equal(fit("short", 8), "short")
  assert.equal(fit("short", 8, true), "short   ")
  assert.equal(fit("\u4E2D\u6587\u4E2D", 4), "\u4E2D\u2026")
  for (let columns = 1; columns <= 20; columns++) {
    assert.ok(displayWidth(fit("\u{F024B} feat/\u4E2D\u6587-branch", columns)) <= columns)
  }
})

// Draws each sample with OpenTUI and compares the cells it used with displayWidth.
// OpenTUI's Node build needs node:ffi (Node 26.4 or newer).
test("displayWidth agrees with OpenTUI's renderer under every width method", async (t) => {
  let createTestRenderer
  let TextRenderable
  try {
    ;({ createTestRenderer } = await import("@opentui/core/testing"))
    ;({ TextRenderable } = await import("@opentui/core"))
  } catch (error) {
    t.skip(`OpenTUI unavailable: ${error?.code ?? error?.message ?? error}`)
    return
  }
  const width = 30
  const entries = Object.entries(SAMPLES)
  for (const method of ["wcwidth", "unicode", "unicode-wide"]) {
    const setup = await createTestRenderer({ width, height: entries.length, widthMethod: method })
    try {
      setup.renderer.root.add(new TextRenderable(setup.renderer, {
        id: "samples",
        content: entries.map(([, text]) => text).join("\n"),
      }))
      await setup.renderOnce()
      const lines = setup.captureSpans().lines
      entries.forEach(([name, text], row) => {
        const rendered = lines[row].spans.map((span) => span.text).join("")
        const padding = [...rendered].length - [...text].length
        assert.equal(width - padding, displayWidth(text), `${method}: ${name}`)
      })
    } finally {
      await setup.dispose()
    }
  }
})
