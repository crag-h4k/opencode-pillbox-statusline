// Diagnostic summaries consume the displayed bar model, never run a second fit.
import { freshUsage, LIMIT_MAX_AGE_MS } from "./quota.mjs"
import { capsFor, iconSet } from "./render/icons.mjs"
import { clean, displayWidth } from "./render/width.mjs"
import { TIERS_TTL_MS } from "./server/tiers.mjs"

const REASONS = {
  disabled: "disabled by options",
  when: "not in this footer (when)",
  "no-data": "no data or inactive",
  empty: "no supported content at this size",
  minColumns: "below minColumns",
  attached: "attached pill is hidden or absent",
  space: "not enough space (including hysteresis)",
}

export function layoutReport(model) {
  if (!model) return "No mounted Pillbox footer on this page."
  return [
    `${model.bar} footer: terminal ${model.columns ?? "unknown"} columns, budget ${model.budget} cells`,
    `Used ${model.fit.width} cells (including gaps); overflow: ${model.fit.overflow ? "yes" : "no"}; caps: ${model.caps}`,
    "Widths below include caps and padding. Hidden pills use 0 cells.",
    "",
    ...model.diagnostics.map((pill) => {
      const widths = Object.entries(pill.widths).map(([size, width]) => `${size}=${width}`).join(" ")
      const state = pill.reason ? `hidden: ${REASONS[pill.reason] ?? pill.reason}` : `${pill.size}: ${pill.width} cells`
      return `${pill.id} (${pill.group}) ${state}${widths ? `\n  measured ${widths}` : ""}`
    }),
  ].join("\n")
}

function age(timestamp, now) {
  return typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp <= now
    ? `${Math.floor((now - timestamp) / 1000)}s ago`
    : "unknown"
}

/** Only explicitly selected quota fields reach diagnostics, even from an older server. */
export function usageSummary(providers, now) {
  const ids = [...new Set(["github-copilot", "openai", "anthropic", ...Object.keys(providers)])]
  return ids.map((id) => {
    const usage = Object.hasOwn(providers, id) ? providers[id] : undefined
    const fresh = freshUsage(usage, now)
    const hasFigures = Boolean(fresh.copilot || fresh.windows?.length)
    const stale = typeof usage?.updatedAt === "number" && now - usage.updatedAt >= LIMIT_MAX_AGE_MS
    return {
      id: clean(id),
      source: ["github-copilot", "openai", "anthropic"].includes(id) ? "direct" : "gateway",
      state: hasFigures ? "fresh" : stale ? "stale" : usage ? "unavailable" : "not reported",
      age: age(usage?.updatedAt, now),
      ...fresh,
    }
  })
}

export function sourcesReport({ usage, tiers, polling, config, now }) {
  const pollLine = (name) => {
    const state = polling[name]
    return `${name} RPC: ${state.state}; refresh ${config.sources[name].refresh}s; last success ${age(state.succeededAt, now)}`
  }
  const states = ["disabled", "unavailable", "ready", "stale"]
  const expired = tiers.state === "ready" && typeof tiers.updatedAt === "number" && now - tiers.updatedAt >= TIERS_TTL_MS
  const tierState = expired ? "stale" : states.includes(tiers.state) ? tiers.state : "unknown (server supplied no state)"
  const categories = { lightweight: 0, versatile: 0, powerful: 0, other: 0 }
  for (const value of Object.values(tiers.models)) {
    const key = ["lightweight", "versatile", "powerful"].includes(value) ? value : "other"
    categories[key] += 1
  }
  return [
    pollLine("usage"),
    "Quota figures expire after 300s. 'Not reported' does not prove a missing login.",
    ...usageSummary(usage, now).map((provider) => {
      const figures = provider.copilot
        ? provider.copilot.unlimited ? "unlimited" : `${provider.copilot.usedPercent}% used`
        : provider.windows?.map((window) => `${window.period} ${window.usedPercent}% used`).join(", ")
      return `${provider.id} (${provider.source}): ${provider.state}; auth ${provider.auth ?? "not reported"}; updated ${provider.age}${figures ? `; ${figures}` : ""}`
    }),
    "Gateway entries are reported only while valid; no file path is collected here.",
    "",
    pollLine("tiers"),
    `Copilot category source: ${tierState}; updated ${age(tiers.updatedAt, now)}`,
    `Categories: ${Object.entries(categories).map(([name, count]) => `${name}=${count}`).join(", ")}`,
    "Disabled requires tiers: true on the server entry to enable category requests.",
    "Stale categories are the server's last good map. Catalog output prices supply fallback tiers.",
    "RPC error means unavailable, timed out, or failed; raw error details are omitted.",
  ].join("\n")
}

/** The chosen set, frames, caps, and user overrides, plus known-width references. */
export function glyphSamples(config) {
  const samples = []
  function add(value, name) {
    if (typeof value === "string") {
      if (value) samples.push({ name, text: value })
      return
    }
    for (const [key, child] of Object.entries(value)) add(child, `${name}.${key}`)
  }
  add(iconSet(config.icons), config.icons)
  const caps = capsFor(config.style.caps, config.icons)
  add(caps.left, "caps.left")
  add(caps.right, "caps.right")
  for (const [id, settings] of Object.entries(config.pills)) {
    if (settings.icon) add(settings.icon, `pills.${id}.icon`)
  }
  samples.push({ name: "ASCII", text: "A" }, { name: "CJK", text: "中" }, { name: "combining", text: "e\u0301" })
  return samples.map(({ name, text }) => ({
    name,
    text: clean(text),
    width: displayWidth(clean(text)),
    codepoints: [...text].map((char) => `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`).join(" "),
  }))
}

export function glyphReport(config) {
  return [
    `Icon set: ${config.icons}; configured caps resolve to ${capsFor(config.style.caps, config.icons).style}`,
    "Each sample's closing | should align with the ruler's | on the next line.",
    "Cells are Pillbox's width calculation, not a test of your terminal font.",
    "Missing or overlapping glyphs: try nerd-bmp, unicode, or ascii in options.icons.",
    "",
    ...glyphSamples(config).flatMap(({ name, text, width, codepoints }) => [
      `${name}: ${width} cells; ${codepoints}`,
      `  |${text}|`,
      `  |${"-".repeat(width)}|`,
    ]),
  ].join("\n")
}

export function optionsReport(config, errors) {
  return [
    "Option errors",
    ...(errors.length ? errors.map((error) => `${clean(error.path) || "(root)"}: ${clean(error.message)}`) : ["None"]),
    "",
    "Resolved terminal options (defaults, preset, then overrides)",
    JSON.stringify(config, null, 2),
  ].join("\n")
}
