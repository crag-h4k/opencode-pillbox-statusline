// src/render/format.mjs
// Pure formatting and derivation shared by the pills: durations, money,
// compact numbers, context usage, and model tier bands. Ported from the
// dotfiles footer. No host imports.

const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
const MONEY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const WHOLE_MONEY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

/** @param {number} value */
export function compactNumber(value) {
  return COMPACT.format(value)
}

/** @param {number} value */
export function money(value) {
  return MONEY.format(value)
}

/** @param {number} value */
export function wholeMoney(value) {
  return WHOLE_MONEY.format(value)
}

/** Age such as "<1m", "12m", "3h4m", or "2d5h". */
export function duration(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  if (minutes < 1) return "<1m"
  const days = Math.floor(minutes / 1_440)
  const hours = Math.floor((minutes % 1_440) / 60)
  const mins = minutes % 60
  if (days > 0) return `${days}d${hours}h`
  if (hours > 0) return `${hours}h${mins}m`
  return `${mins}m`
}

/** Last path segment, ignoring trailing separators. */
export function basename(path) {
  const clean = String(path ?? "").replace(/[\\/]+$/, "")
  return clean.split(/[\\/]/).pop() || clean
}

/**
 * Context usage of the latest assistant message after the most recent
 * completed compaction, ignoring messages past a revert point.
 * @param {{
 *   messages: readonly any[],
 *   revertMessageID?: string,
 *   models?: readonly { providerID: string, id: string, limit?: { context?: number } }[],
 * }} input
 * @returns {{ tokens: number, limit?: number } | undefined}
 */
export function contextUsage({ messages, revertMessageID, models = [] }) {
  const boundary = revertMessageID ? messages.findIndex((message) => message.id === revertMessageID) : -1
  if (revertMessageID && boundary === -1) return undefined
  const end = boundary === -1 ? messages.length : boundary
  let compaction = -1
  for (let index = end - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.type === "compaction" && message.status === "completed") {
      compaction = index
      break
    }
  }
  for (let index = end - 1; index > compaction; index -= 1) {
    const message = messages[index]
    if (message.type !== "assistant" || !message.tokens) continue
    const { tokens } = message
    const total = tokens.input + tokens.output + tokens.reasoning + tokens.cache.read + tokens.cache.write
    if (!(total > 0)) return undefined
    const model = models.find((item) => item.providerID === message.model?.providerID && item.id === message.model?.id)
    const limit = model?.limit?.context
    return limit ? { tokens: total, limit } : { tokens: total }
  }
  return undefined
}

export const TIER_BANDS = Object.freeze(["included", "standard", "premium", "heavy"])
export const TIER_LABELS = Object.freeze({ included: "Included", standard: "Standard", premium: "Premium", heavy: "Heavy" })

/**
 * GitHub Copilot's picker category is authoritative; catalog output price only
 * splits "powerful" into premium and heavy. An unpriced powerful model is heavy.
 * @param {string} category
 * @param {number | undefined} outputCost  USD per million output tokens
 */
export function categoryBand(category, outputCost) {
  if (category === "lightweight") return "included"
  if (category === "versatile") return "standard"
  if (category === "powerful") return outputCost === undefined || outputCost >= 25 ? "heavy" : "premium"
  return undefined
}

/** Band from catalog output price, used without a picker category. */
export function priceBand(outputPerMillion) {
  if (outputPerMillion <= 5) return "included"
  if (outputPerMillion <= 12) return "standard"
  if (outputPerMillion <= 20) return "premium"
  return "heavy"
}
