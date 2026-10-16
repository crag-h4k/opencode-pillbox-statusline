// test/server.test.mjs
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { copilotToken, githubBase, parseCopilotUsage } from "../src/server/copilot.mjs"
import { copilotApi, createTiers, DEFAULT_COPILOT_API, FAILURE_BACKOFF_MS, TIERS_TTL_MS } from "../src/server/tiers.mjs"
import { createUsage, GATEWAY_MAX_BYTES, readGatewayFile, RETRY_MS } from "../src/server/usage.mjs"
import { freshUsage, LIMIT_MAX_AGE_MS } from "../src/quota.mjs"

const SECRET = "secret-token-value"
const ACCOUNT = "secret-account-id"

function integration(credentials) {
  return {
    connection: {
      active: async (id) => (credentials[id] ? { id: credentials[id].connection ?? `${id}-1` } : undefined),
      resolve: async (connection) => {
        const id = Object.keys(credentials).find((key) => (credentials[key].connection ?? `${key}-1`) === connection.id)
        return credentials[id]?.credential
      },
    },
  }
}

function fakeFetch(routes) {
  const calls = []
  const fetch = async (url, options) => {
    calls.push({ url, options })
    const route = Object.entries(routes).find(([prefix]) => url.startsWith(prefix))
    if (!route) return { ok: false, status: 404, json: async () => ({}) }
    const [status, body] = typeof route[1] === "function" ? route[1](url, options) : route[1]
    return { ok: status === 200, status, json: async () => body }
  }
  return { fetch, calls }
}

const COPILOT_USER = { quota_snapshots: { premium_interactions: { entitlement: 300, remaining: 87 } }, endpoints: { api: "https://api.business.githubcopilot.com" } }
const CODEX = { rate_limit: { primary_window: { limit_window_seconds: 604800, used_percent: 37 } } }
const CLAUDE = { five_hour: { utilization: 12 }, seven_day: { utilization: 34 } }

test("Copilot quota parsing matches the upstream package's rules", () => {
  assert.deepEqual(parseCopilotUsage(COPILOT_USER), { usedPercent: 71, unlimited: false })
  assert.deepEqual(parseCopilotUsage({ quota_snapshots: { premium_interactions: { unlimited: true } } }), { usedPercent: 0, unlimited: true })
  assert.deepEqual(parseCopilotUsage({ quota_snapshots: { premium_interactions: { has_quota: false }, chat: { percent_remaining: 40 } } }), { usedPercent: 60, unlimited: false })
  assert.equal(parseCopilotUsage({ quota_snapshots: { premium_interactions: { entitlement: 0 } } }), undefined)
  assert.equal(parseCopilotUsage({}), undefined)
  assert.equal(parseCopilotUsage(null), undefined)
})

test("GitHub Enterprise hosts are honored, and a malformed one stops the request instead of falling back to github.com", () => {
  assert.equal(githubBase({}), "https://api.github.com")
  assert.equal(githubBase({ metadata: { enterpriseUrl: "ghe.example.com" } }), "https://api.ghe.example.com")
  assert.equal(githubBase({ metadata: { enterpriseUrl: "https://ghe.example.com/" } }), "https://api.ghe.example.com")
  assert.equal(githubBase({ metadata: { enterpriseUrl: "evil.example/path?x=" } }), undefined)
  assert.equal(githubBase({ metadata: { enterpriseUrl: 42 } }), undefined)
  assert.equal(copilotToken({ type: "oauth", access: "", refresh: "r" }), "r")
  assert.equal(copilotToken({ type: "key", key: "k" }), "k")
  assert.equal(copilotToken({ type: "wellknown" }), undefined)
})

test("usage combines Copilot, Codex, Claude, and gateways without leaking credentials", async () => {
  const credentials = {
    "github-copilot": { credential: { type: "oauth", access: SECRET } },
    openai: { credential: { type: "oauth", access: SECRET, metadata: { accountId: ACCOUNT } } },
    anthropic: { credential: { type: "oauth", access: SECRET } },
  }
  const { fetch, calls } = fakeFetch({
    "https://api.github.com/copilot_internal/user": [200, COPILOT_USER],
    "https://chatgpt.com/": [200, CODEX],
    "https://api.anthropic.com/": [200, CLAUDE],
  })
  const feed = JSON.stringify({
    providers: { household: { updatedAt: 1000, access_token: SECRET, windows: [{ period: "week", usedPercent: 92, token: SECRET }] } },
  })
  const usage = createUsage({ integration: integration(credentials), fetch, now: () => 1000, read: async () => feed, log: () => {} })
  const result = await usage.get()

  assert.deepEqual(Object.keys(result.providers).sort(), ["anthropic", "github-copilot", "household", "openai"])
  assert.deepEqual(result.providers["github-copilot"], { auth: "oauth", copilot: { usedPercent: 71, unlimited: false }, updatedAt: 1000 })
  assert.deepEqual(result.providers.openai.windows, [{ period: "week", usedPercent: 37 }])
  assert.deepEqual(result.providers.anthropic.windows, [{ period: "5h", usedPercent: 12 }, { period: "week", usedPercent: 34 }])
  assert.deepEqual(result.providers.household, { updatedAt: 1000, windows: [{ period: "week", usedPercent: 92 }] })
  assert.doesNotMatch(JSON.stringify(result), new RegExp(`${SECRET}|${ACCOUNT}|access_token|endpoints`))

  const copilotCall = calls.find((call) => call.url.includes("copilot_internal"))
  assert.equal(copilotCall.options.headers["User-Agent"], "opencode-pillbox-statusline")
  assert.equal(copilotCall.options.headers["Copilot-Integration-Id"], undefined, "no editor impersonation for quota")
  assert.equal(calls.find((call) => call.url.includes("chatgpt")).options.headers["ChatGPT-Account-Id"], ACCOUNT)
  assert.equal(calls.find((call) => call.url.includes("anthropic")).options.headers["anthropic-beta"], "oauth-2025-04-20")
  assert.ok(calls.every((call) => call.options.redirect === "error"))
})

test("API keys and missing logins make no quota requests", async () => {
  const credentials = {
    openai: { credential: { type: "key", key: SECRET } },
    anthropic: { credential: { type: "key", key: SECRET } },
  }
  const { fetch, calls } = fakeFetch({})
  const usage = createUsage({ integration: integration(credentials), fetch, read: async () => { throw Object.assign(new Error(), { code: "ENOENT" }) } })
  const result = await usage.get()
  assert.deepEqual(result.providers, { openai: { auth: "key" }, anthropic: { auth: "key" } })
  assert.equal(calls.length, 0)
})

test("a malformed enterprise host means no Copilot request at all", async () => {
  const credentials = { "github-copilot": { credential: { type: "oauth", access: SECRET, metadata: { enterpriseUrl: "evil.example/x?" } } } }
  const { fetch, calls } = fakeFetch({})
  const result = await createUsage({ integration: integration(credentials), fetch, read: async () => "{}" }).get()
  assert.equal(result.providers["github-copilot"], undefined)
  assert.equal(calls.length, 0)
})

test("requests are throttled per account; failures keep the last figures; switching accounts clears them", async () => {
  let clock = 1000
  let fail = false
  const credentials = { openai: { connection: "account-a", credential: { type: "oauth", access: SECRET } } }
  const { fetch, calls } = fakeFetch({ "https://chatgpt.com/": () => (fail ? [503, {}] : [200, CODEX]) })
  const usage = createUsage({ integration: integration(credentials), fetch, now: () => clock, read: async () => "{}", log: () => {} })

  assert.equal((await usage.get()).providers.openai.updatedAt, 1000)
  await usage.get()
  assert.equal(calls.length, 1, "a second call within a minute is served from cache")

  clock += RETRY_MS
  fail = true
  assert.equal((await usage.get()).providers.openai.updatedAt, 1000, "a failure keeps the previous figures")
  assert.equal(calls.length, 2)

  credentials.openai.connection = "account-b"
  clock += 1
  const switched = await usage.get()
  assert.deepEqual(switched.providers.openai, { auth: "oauth" }, "the previous account's figures are not reused")
})

test("stale figures are dropped before display", () => {
  const usage = { auth: "oauth", updatedAt: 1000, copilot: { usedPercent: 50, unlimited: false }, windows: [{ period: "week", usedPercent: 20 }] }
  const { updatedAt: _, ...display } = usage
  assert.deepEqual(freshUsage(usage, 1000 + LIMIT_MAX_AGE_MS - 1), display)
  assert.deepEqual(freshUsage(usage, 1000 + LIMIT_MAX_AGE_MS), { auth: "oauth" })
  assert.deepEqual(freshUsage(undefined), {})
  assert.deepEqual(freshUsage({ auth: "key" }), { auth: "key" })
})

test("tiers send editor headers only to the account's Copilot models endpoint and cache for six hours", async () => {
  let clock = 1000
  const credentials = { "github-copilot": { credential: { type: "oauth", access: SECRET } } }
  const { fetch, calls } = fakeFetch({
    "https://api.github.com/copilot_internal/user": [200, COPILOT_USER],
    "https://api.business.githubcopilot.com/models": [200, { data: [
      { id: "gpt-6-luna", model_picker_category: "lightweight" },
      { id: "claude-opus-5.5", model_picker_category: "powerful" },
      { id: "no-category" },
    ] }],
  })
  const tiers = createTiers({ integration: integration(credentials), enabled: true, fetch, now: () => clock, log: () => {} })
  const result = await tiers.get()
  assert.deepEqual(result, { models: { "gpt-6-luna": "lightweight", "claude-opus-5.5": "powerful" } })

  const [user, models] = calls
  assert.equal(user.options.headers["User-Agent"], "opencode-pillbox-statusline")
  assert.equal(user.options.headers["Copilot-Integration-Id"], undefined)
  assert.equal(models.url, "https://api.business.githubcopilot.com/models")
  assert.equal(models.options.headers["Copilot-Integration-Id"], "vscode-chat")
  assert.ok(calls.every((call) => call.options.redirect === "error"))
  assert.doesNotMatch(JSON.stringify(result), new RegExp(SECRET))

  await tiers.get()
  assert.equal(calls.length, 2, "cached")
  clock += TIERS_TTL_MS
  await tiers.get()
  assert.equal(calls.length, 4, "refreshed after six hours")
})

test("tiers ignore a Copilot API host outside githubcopilot.com and keep the last map on failure", async () => {
  let clock = 0
  let broken = false
  const credentials = { "github-copilot": { credential: { type: "oauth", access: SECRET } } }
  const { fetch, calls } = fakeFetch({
    "https://api.github.com/copilot_internal/user": [200, { endpoints: { api: "https://attacker.example" } }],
    [`${DEFAULT_COPILOT_API}/models`]: () => (broken ? [500, {}] : [200, { data: [{ id: "m", model_picker_category: "versatile" }] }]),
  })
  const tiers = createTiers({ integration: integration(credentials), enabled: true, fetch, now: () => clock, log: () => {} })
  assert.deepEqual(await tiers.get(), { models: { m: "versatile" } })
  assert.ok(!calls.some((call) => call.url.includes("attacker")))
  clock += TIERS_TTL_MS
  broken = true
  assert.deepEqual(await tiers.get(), { models: { m: "versatile" } })
})

test("OpenAI follows the dotfiles rules: an expired or missing token makes no request and reads as unavailable", async () => {
  const { fetch, calls } = fakeFetch({ "https://chatgpt.com/": [200, CODEX] })
  const make = (credential) =>
    createUsage({ integration: integration({ openai: { credential } }), fetch, now: () => 5000, read: async () => "{}" })
  const expired = await make({ type: "oauth", access: SECRET, expires: 4999 }).get()
  assert.deepEqual(expired.providers.openai, { auth: "oauth" })
  const missing = await make({ type: "oauth", access: "" }).get()
  assert.deepEqual(missing.providers.openai, { auth: "oauth" })
  assert.equal(calls.length, 0)
  const live = await make({ type: "oauth", access: SECRET, expires: 9999 }).get()
  assert.deepEqual(live.providers.openai.windows, [{ period: "week", usedPercent: 37 }])
})

test("gateway entries cannot speak for direct providers, need plain ids, and are capped", async () => {
  const providers = {
    openai: { updatedAt: 1000, windows: [{ period: "week", usedPercent: 1 }] },
    "github-copilot": { updatedAt: 1000, windows: [{ period: "week", usedPercent: 1 }] },
    "Bad Id!": { updatedAt: 1000, windows: [{ period: "week", usedPercent: 1 }] },
  }
  for (let index = 0; index < 40; index++) providers[`gw${index}`] = { updatedAt: 1000, windows: [{ period: "week", usedPercent: index }] }
  let reads = 0
  const usage = createUsage({
    integration: integration({}),
    now: () => 1000,
    read: async () => {
      reads += 1
      return JSON.stringify({ providers })
    },
  })
  const result = await usage.get()
  assert.ok(!("openai" in result.providers) && !("github-copilot" in result.providers) && !("Bad Id!" in result.providers))
  assert.equal(Object.keys(result.providers).length, 32)
  await usage.get()
  assert.equal(reads, 1, "the gateway file is read at most once a minute")
})

test("the gateway reader rejects directories, FIFOs, and oversized files without blocking", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "pillbox-gateway-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const small = join(directory, "usage.json")
  writeFileSync(small, '{"providers":{}}')
  assert.equal(await readGatewayFile(small), '{"providers":{}}')
  const large = join(directory, "large.json")
  writeFileSync(large, "x".repeat(GATEWAY_MAX_BYTES + 1))
  await assert.rejects(readGatewayFile(large), /too large/)
  await assert.rejects(readGatewayFile(directory), /not a regular file|EISDIR/)
  const fifo = join(directory, "fifo")
  try {
    execFileSync("mkfifo", [fifo])
  } catch {
    t.diagnostic("mkfifo unavailable; FIFO case skipped")
    return
  }
  await assert.rejects(readGatewayFile(fifo), /not a regular file/)
})

test("tiers make no request unless the server option enables them", async () => {
  const { fetch, calls } = fakeFetch({})
  const credentials = { "github-copilot": { credential: { type: "oauth", access: SECRET } } }
  const tiers = createTiers({ integration: integration(credentials), fetch })
  assert.deepEqual(await tiers.get(), { models: {} })
  assert.equal(calls.length, 0)
})

test("enterprise tokens only go to copilot-api on their own host, never the public default", () => {
  assert.equal(copilotApi("https://api.business.githubcopilot.com", "https://api.github.com"), "https://api.business.githubcopilot.com")
  assert.equal(copilotApi(undefined, "https://api.github.com"), DEFAULT_COPILOT_API)
  assert.equal(copilotApi("https://evil.example", "https://api.github.com"), DEFAULT_COPILOT_API)
  assert.equal(copilotApi("https://copilot-api.acme.ghe.com", "https://api.acme.ghe.com"), "https://copilot-api.acme.ghe.com")
  assert.equal(copilotApi("https://api.githubcopilot.com", "https://api.acme.ghe.com"), undefined)
  assert.equal(copilotApi(undefined, "https://api.acme.ghe.com"), undefined)
  assert.equal(copilotApi("http://copilot-api.acme.ghe.com", "https://api.acme.ghe.com"), undefined)
})

test("tiers back off after a failure, share one request between callers, and reset on an account switch", async () => {
  let clock = 0
  let ok = false
  const credentials = { "github-copilot": { connection: "a", credential: { type: "oauth", access: SECRET } } }
  const { fetch, calls } = fakeFetch({
    "https://api.github.com/copilot_internal/user": [200, {}],
    [`${DEFAULT_COPILOT_API}/models`]: () => (ok ? [200, { data: [{ id: "m", model_picker_category: "powerful" }] }] : [503, {}]),
  })
  const tiers = createTiers({ integration: integration(credentials), enabled: true, fetch, now: () => clock, log: () => {} })
  await Promise.all([tiers.get(), tiers.get(), tiers.get()])
  assert.equal(calls.length, 2, "three concurrent callers share one attempt")
  await tiers.get()
  assert.equal(calls.length, 2, "backing off after the failure")
  clock += FAILURE_BACKOFF_MS
  ok = true
  assert.deepEqual(await tiers.get(), { models: { m: "powerful" } })
  credentials["github-copilot"].connection = "b"
  ok = false
  assert.deepEqual(await tiers.get(), { models: {} }, "the previous account's map is dropped")
})
