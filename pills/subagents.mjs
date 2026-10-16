// pills/subagents.mjs
// Running child sessions and queued child prompts. Shown only while there is
// child work; the icon animates while children run.
export default {
  id: "subagents",
  title: "Subagent activity",
  sizes: ["full", "icon"],
  defaults: { order: 60, priority: 75, accent: "feedback.warning" },
}
