// pills/context.mjs
// Context usage of the latest assistant message after the most recent
// compaction, with the share of the model's context limit.
import { compactNumber } from "../format.mjs"

export default {
  id: "context",
  title: "Context usage",
  sizes: ["full", "compact"],
  defaults: { order: 70, priority: 65, accent: "hue.accent" },
  render(data, _settings, icons) {
    const usage = data.context
    if (!usage?.tokens) return undefined
    const tokens = compactNumber(usage.tokens)
    if (!usage.limit) return { icon: icons.context, sizes: { full: tokens, compact: tokens } }
    const percent = `${Math.round((usage.tokens / usage.limit) * 100)}%`
    return { icon: icons.context, sizes: { full: `${tokens} (${percent})`, compact: percent } }
  },
}
