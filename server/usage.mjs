// server/usage.mjs
// The pillbox.usage source: subscription quota per provider. GitHub Copilot
// monthly use, Codex and Claude OAuth windows, and figures that gateways
// publish to a local file. Each provider has its own cache and retries at most
// once a minute; switching accounts clears the previous account's figures.
// Returns quota numbers only. No host imports.
import { constants } from "node:fs"
import { open } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { normalizeUsage, parseClaudeUsage, parseCodexUsage } from "../usage.mjs"
import { COPILOT_INTEGRATION, copilotToken, fetchCopilotUser, githubBase, parseCopilotUsage } from "./copilot.mjs"

export const RETRY_MS = 60_000
export const TIMEOUT_MS = 10_000
export const GATEWAY_MAX_BYTES = 64 * 1024
export const GATEWAY_MAX_PROVIDERS = 32

const GATEWAY_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/
// Providers pillbox queries directly. A gateway file cannot speak for them.
const DIRECT_IDS = new Set([COPILOT_INTEGRATION, "openai", "anthropic"])

const OAUTH_SOURCES = {
  anthropic: {
    url: "https://api.anthropic.com/api/oauth/usage",
    headers: () => ({ "anthropic-beta": "oauth-2025-04-20" }),
    parse: parseClaudeUsage,
  },
  openai: {
    url: "https://chatgpt.com/backend-api/wham/usage",
    headers: (credential) => {
      const account = credential.metadata?.accountId ?? credential.metadata?.account_id
      return typeof account === "string" && account ? { "ChatGPT-Account-Id": account } : {}
    },
    parse: parseCodexUsage,
  },
}

/**
 * Reads a small regular file without blocking: a FIFO, device, or directory is
 * rejected, and so is anything over GATEWAY_MAX_BYTES.
 * @param {string} path
 */
export async function readGatewayFile(path) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NONBLOCK)
  try {
    const stat = await handle.stat()
    if (!stat.isFile()) throw new Error("not a regular file")
    const buffer = Buffer.alloc(GATEWAY_MAX_BYTES + 1)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    if (bytesRead > GATEWAY_MAX_BYTES) throw new Error("too large")
    return buffer.toString("utf8", 0, bytesRead)
  } finally {
    await handle.close()
  }
}

/**
 * @param {{
 *   integration: { connection: { active(id: string): Promise<any>, resolve(connection: any): Promise<any> } },
 *   fetch?: typeof globalThis.fetch,
 *   now?: () => number,
 *   feed?: string,
 *   read?: (path: string) => Promise<string>,
 *   log?: (message: string) => void,
 * }} deps
 */
export function createUsage({
  integration,
  fetch = globalThis.fetch,
  now = Date.now,
  feed = process.env.OPENCODE_PROVIDER_USAGE_FILE || join(homedir(), ".cache/opencode/provider-usage/usage.json"),
  read = readGatewayFile,
  log = (message) => console.error(message),
}) {
  const cache = new Map()
  const pending = new Map()
  let gatewayCache

  /** Runs `load` at most once a minute per provider and account, keeping the last figures on failure. */
  async function throttled(id, account, load) {
    if (cache.get(id)?.account !== account) cache.delete(id)
    const current = cache.get(id)
    const key = `${id}:${account}`
    if (pending.has(key)) return pending.get(key)
    if (current && now() - current.attemptedAt < RETRY_MS) return current.value
    const entry = { account, attemptedAt: now(), value: current?.value }
    cache.set(id, entry)
    const request = (async () => {
      let value = current?.value
      try {
        value = await load()
      } catch {
        log(`[pillbox] ${id} quota request failed; retrying in a minute`)
      }
      if (cache.get(id) !== entry) return undefined
      entry.value = value
      entry.attemptedAt = now()
      return value
    })()
    pending.set(key, request)
    try {
      return await request
    } finally {
      pending.delete(key)
    }
  }

  async function connect(id) {
    try {
      const connection = await integration.connection.active(id)
      if (!connection) return undefined
      return { connection, credential: await integration.connection.resolve(connection) }
    } catch {
      return undefined
    }
  }

  async function copilot() {
    const linked = await connect(COPILOT_INTEGRATION)
    const token = copilotToken(linked?.credential)
    const base = linked && githubBase(linked.credential)
    if (!token || !base) {
      cache.delete(COPILOT_INTEGRATION)
      return undefined
    }
    const auth = linked.credential.type === "oauth" ? "oauth" : "key"
    const usage = await throttled(COPILOT_INTEGRATION, linked.connection.id ?? "default", async () => {
      const parsed = parseCopilotUsage(await fetchCopilotUser({ fetch, base, token, timeoutMs: TIMEOUT_MS }))
      return parsed ? { copilot: parsed, updatedAt: now() } : undefined
    })
    return usage ? { auth, ...usage } : { auth }
  }

  async function oauth(id) {
    const source = OAUTH_SOURCES[id]
    const linked = await connect(id)
    if (!linked) {
      cache.delete(id)
      return undefined
    }
    const { credential } = linked
    if (credential?.type !== "oauth") {
      cache.delete(id)
      return credential ? { auth: "key" } : undefined
    }
    // Same as the dotfiles footer: an expired or missing token makes no request,
    // and the pill reports the quota as unavailable until OpenCode refreshes it.
    const expired = typeof credential.expires === "number" && credential.expires <= now()
    if (typeof credential.access !== "string" || !credential.access || expired) return { auth: "oauth" }
    const usage = await throttled(id, linked.connection.id ?? "default", async () => {
      const response = await fetch(source.url, {
        headers: { Accept: "application/json", Authorization: `Bearer ${credential.access}`, ...source.headers(credential) },
        redirect: "error",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const windows = source.parse(await response.json())
      return windows.length ? { windows, updatedAt: now() } : undefined
    })
    return usage ? { auth: "oauth", ...usage } : { auth: "oauth" }
  }

  async function gateways() {
    if (gatewayCache && now() - gatewayCache.at < RETRY_MS) return gatewayCache.value
    let value = {}
    try {
      const data = JSON.parse(await read(feed))
      const providers = data && typeof data.providers === "object" && data.providers ? data.providers : {}
      value = Object.fromEntries(
        Object.entries(providers)
          .filter(([id]) => GATEWAY_ID.test(id) && !DIRECT_IDS.has(id))
          .slice(0, GATEWAY_MAX_PROVIDERS)
          .flatMap(([id, usage]) => {
            const normalized = normalizeUsage(usage, now())
            return normalized ? [[id, normalized]] : []
          }),
      )
    } catch (error) {
      if (error?.code !== "ENOENT") log("[pillbox] gateway quota file is unreadable, too large, or not a regular file")
    }
    gatewayCache = { at: now(), value }
    return value
  }

  return {
    async get() {
      const [gateway, githubCopilot, openai, anthropic] = await Promise.all([
        gateways(),
        copilot(),
        oauth("openai"),
        oauth("anthropic"),
      ])
      const providers = { ...gateway }
      for (const [id, usage] of [[COPILOT_INTEGRATION, githubCopilot], ["openai", openai], ["anthropic", anthropic]]) {
        if (usage) providers[id] = usage
      }
      return { providers }
    },
  }
}
