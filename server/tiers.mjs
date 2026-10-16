// server/tiers.mjs
// The pillbox.tiers source: GitHub Copilot's model picker category per model
// (lightweight, versatile, powerful). Off unless the server half's options in
// opencode.jsonc set `tiers: true`: the /models endpoint is undocumented and
// only answers editor clients, so that one request identifies as the VS Code
// Copilot Chat integration. The account's API host comes from
// /copilot_internal/user. Categories change rarely, so results are cached for
// six hours, failures back off for fifteen minutes, and every failure keeps the
// last good map for the same account. No host imports.
import { COPILOT_INTEGRATION, copilotToken, fetchCopilotUser, GITHUB_API, githubBase, USER_AGENT } from "./copilot.mjs"

export const TIERS_TTL_MS = 6 * 60 * 60 * 1_000
export const FAILURE_BACKOFF_MS = 15 * 60 * 1_000
export const TIMEOUT_MS = 10_000
export const DEFAULT_COPILOT_API = "https://api.githubcopilot.com"

const EDITOR_HEADERS = Object.freeze({
  Accept: "application/json",
  "Copilot-Integration-Id": "vscode-chat",
  "Editor-Version": "vscode/1.95.0",
  "User-Agent": USER_AGENT,
})

/**
 * The Copilot API origin for this account. github.com accounts accept any
 * *.githubcopilot.com host and fall back to the default; GitHub Enterprise
 * accounts accept only copilot-api.<their host> and never fall back, so an
 * enterprise token is not sent to the public host.
 */
export function copilotApi(value, base) {
  const enterprise = base !== GITHUB_API ? new URL(base).hostname.replace(/^api\./, "") : undefined
  let url
  try {
    url = typeof value === "string" ? new URL(value) : undefined
  } catch {
    url = undefined
  }
  const clean = url && url.protocol === "https:" && !url.username && !url.password
  if (enterprise) return clean && url.hostname === `copilot-api.${enterprise}` ? url.origin : undefined
  const trusted = clean && (url.hostname === "githubcopilot.com" || url.hostname.endsWith(".githubcopilot.com"))
  return trusted ? url.origin : DEFAULT_COPILOT_API
}

/**
 * @param {{
 *   integration: { connection: { active(id: string): Promise<any>, resolve(connection: any): Promise<any> } },
 *   enabled?: boolean,
 *   fetch?: typeof globalThis.fetch,
 *   now?: () => number,
 *   log?: (message: string) => void,
 * }} deps
 */
export function createTiers({ integration, enabled = false, fetch = globalThis.fetch, now = Date.now, log = (message) => console.error(message) }) {
  let models = {}
  let fetchedAt = 0
  let failedAt = Number.NEGATIVE_INFINITY
  let account
  let pending

  async function load(token, base) {
    let user
    try {
      user = await fetchCopilotUser({ fetch, base, token, timeoutMs: TIMEOUT_MS })
    } catch {
      user = undefined
    }
    const api = copilotApi(user?.endpoints?.api, base)
    if (!api) return undefined
    const response = await fetch(`${api}/models`, {
      headers: { ...EDITOR_HEADERS, Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = await response.json()
    if (!Array.isArray(body?.data)) return undefined
    const map = {}
    for (const model of body.data) {
      if (typeof model?.id === "string" && typeof model.model_picker_category === "string" && !(model.id in map)) {
        map[model.id] = model.model_picker_category
      }
    }
    return Object.keys(map).length ? map : undefined
  }

  async function refresh() {
    const connection = await integration.connection.active(COPILOT_INTEGRATION)
    if (connection?.id !== account) {
      account = connection?.id
      models = {}
      fetchedAt = 0
      failedAt = Number.NEGATIVE_INFINITY
    }
    if (!connection) return
    if (Object.keys(models).length && now() - fetchedAt < TIERS_TTL_MS) return
    if (now() - failedAt < FAILURE_BACKOFF_MS) return
    const credential = await integration.connection.resolve(connection)
    const token = copilotToken(credential)
    const base = githubBase(credential)
    if (!token || !base) return
    try {
      const fresh = await load(token, base)
      if (fresh) {
        models = fresh
        fetchedAt = now()
      } else {
        failedAt = now()
      }
    } catch {
      failedAt = now()
      log("[pillbox] Copilot model categories unavailable; keeping the last good map")
    }
  }

  return {
    async get() {
      if (!enabled) return { models: {} }
      pending ??= refresh().finally(() => {
        pending = undefined
      })
      try {
        await pending
      } catch {
        // integration errors leave the current map in place
      }
      return { models }
    },
  }
}
