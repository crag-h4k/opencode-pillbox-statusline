// src/server/copilot.mjs
// GitHub Copilot account helpers shared by the usage and tiers sources. The
// quota parser is adapted from opencode-copilot-statusline 1.0.0 (MIT, see
// THIRD_PARTY_NOTICES.md). No host imports.

export const COPILOT_INTEGRATION = "github-copilot"
export const GITHUB_API = "https://api.github.com"
export const GITHUB_API_VERSION = "2025-04-01"
export const USER_AGENT = "opencode-pillbox-statusline"

const WINDOW_IDS = ["premium_interactions", "chat"]

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

/**
 * API base for the credential: github.com, or the account's GitHub Enterprise
 * host. A malformed enterprise value returns undefined so the caller makes no
 * request, rather than sending an enterprise token to github.com.
 */
export function githubBase(credential) {
  const enterprise = credential?.metadata?.enterpriseUrl
  if (enterprise === undefined || enterprise === null || enterprise === "") return GITHUB_API
  const match = typeof enterprise === "string" && /^(?:https:\/\/)?([a-z0-9.-]+(?::\d+)?)\/*$/i.exec(enterprise)
  return match ? `https://api.${match[1]}` : undefined
}

/** The token for an OAuth login or an API key, else undefined. */
export function copilotToken(credential) {
  if (credential?.type === "oauth") return credential.access || credential.refresh || undefined
  if (credential?.type === "key") return credential.key || undefined
  return undefined
}

/**
 * Monthly premium-request usage from /copilot_internal/user, falling back to
 * the chat window for Copilot Free. Undefined when the account has no quota.
 * @returns {{ usedPercent: number, unlimited: boolean } | undefined}
 */
export function parseCopilotUsage(body) {
  if (!isRecord(body) || !isRecord(body.quota_snapshots)) return undefined
  for (const id of WINDOW_IDS) {
    const window = body.quota_snapshots[id]
    if (!isRecord(window)) continue
    if (window.unlimited === true) return { usedPercent: 0, unlimited: true }
    if (window.has_quota === false) continue
    const entitlement = asNumber(window.entitlement)
    if (entitlement !== undefined && entitlement <= 0) continue
    const remaining = asNumber(window.remaining)
    let percent
    if (entitlement !== undefined && remaining !== undefined) percent = (1 - remaining / entitlement) * 100
    else if (typeof window.percent_remaining === "number") percent = 100 - window.percent_remaining
    if (percent === undefined || !Number.isFinite(percent)) continue
    return { usedPercent: Math.min(100, Math.max(0, Math.round(percent))), unlimited: false }
  }
  return undefined
}

/**
 * Fetches /copilot_internal/user with an honest client identity. Returns the
 * parsed JSON body or throws on a non-OK response.
 */
export async function fetchCopilotUser({ fetch, base, token, timeoutMs }) {
  const response = await fetch(`${base}/copilot_internal/user`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "User-Agent": USER_AGENT,
    },
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}
