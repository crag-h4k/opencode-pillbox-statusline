// src/pills/subagents.mjs
// Running child sessions and queued child prompts. Shown only while there is
// child work; the icon animates while children run.
import { subagentLabel } from "../render/activity.mjs"

export default {
  id: "subagents",
  title: "Subagent activity",
  sizes: ["full", "icon"],
  defaults: { order: 60, priority: 75, accent: "feedback.warning" },
  render(data, _settings, icons) {
    const activity = data.subagents
    if (!activity || (activity.running === 0 && activity.queued === 0)) return undefined
    const frames = icons.subagentSpinner
    const icon = activity.running > 0 ? frames[(data.tick ?? 0) % frames.length] : icons.subagentQueued
    return { icon, sizes: { full: subagentLabel(activity), icon: "" } }
  },
}
