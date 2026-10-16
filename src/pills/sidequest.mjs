// src/pills/sidequest.mjs
// Progress of the newest opencode-sidequest DAG run in this session. Off by
// default: sidequest already shows its own strip above the prompt.
import { fit } from "../render/width.mjs"

export default {
  id: "sidequest",
  title: "Sidequest DAG progress",
  sizes: ["full", "compact"],
  defaults: { enabled: false, order: 65, priority: 55, maxWidth: 16, accent: "feedback.info" },
  render(data, settings, icons) {
    const run = data.sidequest
    if (!run?.total) return undefined
    const progress = `${run.done}/${run.total}${run.failed ? ` ${run.failed}\u00d7` : ""}`
    return {
      icon: icons.subagentQueued,
      accent: run.failed ? "feedback.error" : settings.accent,
      sizes: { full: `${fit(run.name, settings.maxWidth)} ${progress}`, compact: progress },
    }
  },
}
