// test/activity.test.mjs
import assert from "node:assert/strict"
import test from "node:test"
import {
  BACKGROUND_SPINNER_FRAMES,
  FOREGROUND_SPINNER_FRAMES,
  familyActivity,
  foregroundActive,
  foregroundSpinnerFrame,
  spinnerClockActive,
  subagentFrame,
  subagentLabel,
  waitingForInput,
} from "../activity.mjs"
import { displayWidth } from "../width.mjs"

test("spinner frames are distinct single-cell glyphs", () => {
  for (const frame of [...FOREGROUND_SPINNER_FRAMES, ...BACKGROUND_SPINNER_FRAMES]) {
    assert.equal(displayWidth(frame), 1)
  }
  assert.equal(new Set(FOREGROUND_SPINNER_FRAMES).size, FOREGROUND_SPINNER_FRAMES.length)
  assert.equal(new Set(BACKGROUND_SPINNER_FRAMES).size, 3)
  assert.equal(FOREGROUND_SPINNER_FRAMES.some((frame) => BACKGROUND_SPINNER_FRAMES.includes(frame)), false)
})

test("foreground activity follows execution, input, and shell state", () => {
  const running = { mode: "normal", status: "running", waiting: false }
  assert.equal(foregroundActive(running), true)
  assert.equal(foregroundActive({ ...running, status: "idle" }), false)
  assert.equal(foregroundActive({ ...running, waiting: true }), false)
  assert.equal(foregroundActive({ ...running, mode: "shell" }), false)
  assert.equal(waitingForInput(0, 0), false)
  assert.equal(waitingForInput(1, 0), true)
  assert.equal(waitingForInput(0, 1), true)
})

test("subagent activity keeps running and queued counts", () => {
  const statuses = new Map([["child-a", "running"], ["child-b", "idle"], ["child-c", "running"]])
  const pending = new Map([["child-a", 1], ["child-b", 2], ["child-c", 0]])
  const activity = familyActivity(
    [...statuses.keys()],
    (sessionID) => statuses.get(sessionID),
    (sessionID) => pending.get(sessionID),
  )
  assert.deepEqual(activity, { running: 2, queued: 3 })
  assert.equal(subagentLabel(activity), "2 run · 3 queued")
  assert.equal(subagentLabel({ running: 0, queued: 3 }), "3 queued")
  assert.equal(subagentLabel({ running: 0, queued: 0 }), "")
})

test("running subagents animate while queued-only work stays static", () => {
  assert.equal(subagentFrame(0, 0, "Q"), "Q")
  assert.equal(subagentFrame(0, 3, "Q"), "Q")
  assert.equal(subagentFrame(1, 0, "Q"), BACKGROUND_SPINNER_FRAMES[0])
  assert.equal(subagentFrame(1, 2, "Q"), BACKGROUND_SPINNER_FRAMES[2])
  assert.equal(foregroundSpinnerFrame(10), FOREGROUND_SPINNER_FRAMES[0])
  assert.equal(spinnerClockActive(false, 0), false)
  assert.equal(spinnerClockActive(true, 0), true)
  assert.equal(spinnerClockActive(false, 1), true)
})
