// pills/provider.mjs
// Subscription quota for the active model's provider: GitHub Copilot monthly
// use, Codex weekly remaining, or Claude and gateway windows.
import { Schema } from "effect"
import { Color } from "../config/types.mjs"

const Percent = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 100 }))

/**
 * Text and used percentage for the provider pill, or undefined when the
 * provider has no subscription quota (for example an API key).
 * @param {{
 *   id: string, name?: string, auth?: "oauth" | "key" | "none",
 *   copilot?: { usedPercent: number, unlimited: boolean },
 *   windows?: readonly { period: "5h" | "week", usedPercent: number }[],
 * }} provider
 */
export function quota(provider) {
  if (provider.id === "github-copilot") {
    const usage = provider.copilot
    if (!usage) return { full: "GitHub Copilot", compact: "Copilot", usedPercent: 100 }
    if (usage.unlimited) return { full: "GitHub Copilot \u221e", compact: "\u221e", usedPercent: 0 }
    return { full: `GitHub Copilot ${usage.usedPercent}%`, compact: `${usage.usedPercent}%`, usedPercent: usage.usedPercent }
  }
  const windows = provider.windows ?? []
  if (provider.id === "openai") {
    if (provider.auth !== "oauth") return undefined
    const week = windows.find((window) => window.period === "week")
    if (!week) return { full: "Codex unavailable", compact: "Codex", usedPercent: 100 }
    const left = 100 - week.usedPercent
    return { full: `Codex ${left}% left`, compact: `${left}% left`, usedPercent: week.usedPercent }
  }
  if (!windows.length) return undefined
  const summary = windows.map((window) => `${window.period} ${window.usedPercent}%`).join(" \u00b7 ")
  const usedPercent = Math.max(...windows.map((window) => window.usedPercent))
  return { full: `${provider.name ?? provider.id} ${summary}`, compact: `${usedPercent}%`, usedPercent }
}

export default {
  id: "provider",
  title: "Provider quota",
  sizes: ["full", "compact"],
  options: {
    warnAt: Percent.annotate({ description: "Used percentage that switches to the warning color" }),
    errorAt: Percent.annotate({ description: "Used percentage that switches to the error color" }),
    warning: Color.annotate({ description: "Color at or above warnAt" }),
    error: Color.annotate({ description: "Color at or above errorAt" }),
  },
  defaults: {
    group: "right",
    order: 100,
    priority: 85,
    accent: "feedback.info",
    warnAt: 70,
    errorAt: 90,
    warning: "feedback.warning",
    error: "feedback.error",
  },
  render(data, settings, icons) {
    if (!data.provider) return undefined
    const result = quota(data.provider)
    if (!result) return undefined
    const accent = result.usedPercent >= settings.errorAt
      ? settings.error
      : result.usedPercent >= settings.warnAt ? settings.warning : settings.accent
    return {
      icon: data.provider.id === "github-copilot" ? icons.provider : icons.limit,
      accent,
      sizes: { full: result.full, compact: result.compact },
    }
  },
}
