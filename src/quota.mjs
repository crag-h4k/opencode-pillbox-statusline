// src/quota.mjs
// Provider quota windows: parse upstream usage responses, normalize gateway
// figures, and summarize them for display. Shared by the server and TUI halves.
// No host imports.

export const LIMIT_MAX_AGE_MS = 5 * 60_000

function window(period, percent) {
  if (typeof percent !== "number" || !Number.isFinite(percent)) return undefined
  return { period, usedPercent: Math.min(100, Math.max(0, Math.round(percent))) }
}

/** Codex (ChatGPT OAuth) usage. Windows are classified by duration, not position. */
export function parseCodexUsage(body) {
  const windows = []
  for (const key of ["primary_window", "secondary_window"]) {
    const value = body?.rate_limit?.[key]
    const period = value?.limit_window_seconds === 604_800
      ? "week"
      : value?.limit_window_seconds === 18_000 ? "5h" : undefined
    const parsed = period && window(period, value.used_percent)
    if (parsed && !windows.some((item) => item.period === period)) windows.push(parsed)
  }
  return windows.sort((a, b) => (a.period === "5h" ? 0 : 1) - (b.period === "5h" ? 0 : 1))
}

/** Claude (Anthropic OAuth) usage. Absent windows are dropped; zero usage is kept. */
export function parseClaudeUsage(body) {
  return [window("5h", body?.five_hour?.utilization), window("week", body?.seven_day?.utilization)]
    .filter(Boolean)
}

/** Keeps only `period` and `usedPercent`, and drops figures older than five minutes. */
export function normalizeUsage(usage, now = Date.now()) {
  if (!usage || typeof usage.updatedAt !== "number" || !Number.isFinite(usage.updatedAt)) return undefined
  const age = now - usage.updatedAt
  if (age < 0 || age >= LIMIT_MAX_AGE_MS || !Array.isArray(usage.windows)) return undefined
  const windows = ["5h", "week"].flatMap((period) => {
    const value = usage.windows.find((item) => item?.period === period)
    const parsed = window(period, value?.usedPercent)
    return parsed ? [parsed] : []
  })
  if (!windows.length) return undefined
  return { updatedAt: usage.updatedAt, windows }
}

/** Text such as "5h 12% · week 34%", plus the highest window for color thresholds. */
export function limitSummary(usage, now = Date.now()) {
  const normalized = normalizeUsage(usage, now)
  if (!normalized) return undefined
  const { windows } = normalized
  return {
    text: windows.map((value) => `${value.period} ${value.usedPercent}%`).join(" · "),
    usedPercent: Math.max(...windows.map((value) => value.usedPercent)),
  }
}

/**
 * One provider's pillbox.usage entry with stale figures removed, ready for the
 * provider pill. Figures older than five minutes are dropped rather than shown
 * as current.
 * @param {{ auth?: string, updatedAt?: number, copilot?: object, windows?: object[] } | undefined} usage
 */
export function freshUsage(usage, now = Date.now()) {
  if (!usage || typeof usage !== "object") return {}
  const out = {}
  if (usage.auth === "oauth" || usage.auth === "key") out.auth = usage.auth
  const age = typeof usage.updatedAt === "number" ? now - usage.updatedAt : Number.NaN
  const copilot = usage.copilot
  const validCopilot = copilot && typeof copilot.unlimited === "boolean" && typeof copilot.usedPercent === "number" &&
    Number.isFinite(copilot.usedPercent)
  if (validCopilot && age >= 0 && age < LIMIT_MAX_AGE_MS) {
    out.copilot = { usedPercent: Math.min(100, Math.max(0, Math.round(copilot.usedPercent))), unlimited: copilot.unlimited }
  }
  if (usage.windows) {
    const normalized = normalizeUsage({ updatedAt: usage.updatedAt, windows: usage.windows }, now)
    if (normalized) out.windows = normalized.windows
  }
  return out
}
