// pills/sidequest.mjs
// Progress of the newest opencode-sidequest DAG run in this session. Off by
// default: sidequest already shows its own strip above the prompt.
export default {
  id: "sidequest",
  title: "Sidequest DAG progress",
  sizes: ["full", "compact"],
  defaults: { enabled: false, order: 65, priority: 55, accent: "feedback.info" },
}
