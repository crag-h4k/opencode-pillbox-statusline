// test/quota.test.mjs
import assert from "node:assert/strict"
import test from "node:test"
import { LIMIT_MAX_AGE_MS, limitSummary, normalizeUsage, parseClaudeUsage, parseCodexUsage } from "../src/quota.mjs"

test("Codex classifies quota windows by duration, including weekly-only primary windows", () => {
  assert.deepEqual(parseCodexUsage({ rate_limit: {
    primary_window: { limit_window_seconds: 604800, used_percent: 92 },
    secondary_window: null,
  } }), [{ period: "week", usedPercent: 92 }])
  assert.deepEqual(parseCodexUsage({ rate_limit: {
    primary_window: { limit_window_seconds: 604800, used_percent: 35.4 },
    secondary_window: { limit_window_seconds: 18000, used_percent: 0 },
  } }), [{ period: "5h", usedPercent: 0 }, { period: "week", usedPercent: 35 }])
  for (const body of [null, {}, { rate_limit: { primary_window: {} } }]) {
    assert.deepEqual(parseCodexUsage(body), [])
  }
  assert.deepEqual(parseCodexUsage({ rate_limit: {
    primary_window: { limit_window_seconds: 604800, used_percent: "32" },
    secondary_window: { limit_window_seconds: 3600, used_percent: 12 },
  } }), [])
})

test("Claude hides absent limits while preserving zero usage", () => {
  assert.deepEqual(parseClaudeUsage({ five_hour: { utilization: 0 }, seven_day: { utilization: 40.8 } }), [
    { period: "5h", usedPercent: 0 }, { period: "week", usedPercent: 41 },
  ])
  assert.deepEqual(parseClaudeUsage({ five_hour: null, seven_day: { utilization: 99 } }), [
    { period: "week", usedPercent: 99 },
  ])
  assert.deepEqual(parseClaudeUsage({ seven_day: { utilization: null } }), [])
  assert.deepEqual(parseClaudeUsage({ seven_day: { utilization: Infinity } }), [])
})

test("normalized usage keeps only period and percent, clamped, and drops stale figures", () => {
  const usage = {
    updatedAt: 1000,
    token: "excluded",
    windows: [{ period: "week", usedPercent: 120, token: "excluded" }, { period: "day", usedPercent: 5 }],
  }
  assert.deepEqual(normalizeUsage(usage, 1000), { updatedAt: 1000, windows: [{ period: "week", usedPercent: 100 }] })
  assert.equal(normalizeUsage(usage, 1000 + LIMIT_MAX_AGE_MS), undefined)
  assert.equal(normalizeUsage({ ...usage, updatedAt: "1000" }, 1000), undefined)
  assert.equal(normalizeUsage({ updatedAt: 1000, windows: "week" }, 1000), undefined)
})

test("quota summaries show actual windows and expire during outages", () => {
  const usage = { updatedAt: 1000, windows: [{ period: "week", usedPercent: 92 }] }
  assert.deepEqual(limitSummary(usage, 1000), { text: "week 92%", usedPercent: 92 })
  assert.equal(limitSummary(usage, 1000 + LIMIT_MAX_AGE_MS), undefined)
  assert.equal(limitSummary(usage, 999), undefined)
  assert.equal(limitSummary({ ...usage, windows: [] }, 1000), undefined)
  assert.deepEqual(limitSummary({ ...usage, windows: [
    { period: "week", usedPercent: 32 }, { period: "5h", usedPercent: 99 },
  ] }, 1000), { text: "5h 99% · week 32%", usedPercent: 99 })
})
