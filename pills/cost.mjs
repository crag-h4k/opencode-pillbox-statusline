// pills/cost.mjs
// Aggregate cost of the session and its child sessions.
import { money, wholeMoney } from "../format.mjs"

export default {
  id: "cost",
  title: "Session cost",
  sizes: ["full", "compact"],
  defaults: { order: 80, priority: 50, accent: "feedback.success" },
  render(data, _settings, icons) {
    if (!(data.cost > 0)) return undefined
    return { icon: icons.cost, sizes: { full: money(data.cost), compact: wholeMoney(data.cost) } }
  },
}
