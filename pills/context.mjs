// pills/context.mjs
// Context usage of the latest assistant message after the most recent
// compaction, with the share of the model's context limit.
export default {
  id: "context",
  title: "Context usage",
  sizes: ["full", "compact"],
  defaults: { order: 70, priority: 65, accent: "hue.accent" },
}
