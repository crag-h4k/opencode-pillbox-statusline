// pills/identity.mjs
// Active agent, model, and effort variant. Compact drops the effort; icon keeps
// only the agent icon.
import { Schema } from "effect"
import { Color } from "../config/types.mjs"
import { fit } from "../width.mjs"

export default {
  id: "identity",
  title: "Agent, model, and effort",
  sizes: ["full", "compact", "icon"],
  options: {
    agentColor: Color.annotate({ description: "Color of the agent name; `agent` uses the agent's configured color" }),
    effortColor: Color.annotate({ description: "Color of the effort variant" }),
    showEffort: Schema.Boolean.annotate({ description: "Show the effort variant in the full size" }),
  },
  defaults: {
    order: 40,
    priority: 60,
    maxWidth: 20,
    accent: "hue.interactive",
    agentColor: "agent",
    effortColor: "feedback.warning",
    showEffort: true,
  },
  render(data, settings, icons) {
    if (!data.agent) return undefined
    const agent = { text: fit(data.agent, 12), color: settings.agentColor }
    const model = data.model ? [{ text: ` \u00b7 ${fit(data.model, settings.maxWidth)}` }] : []
    const effort = settings.showEffort && data.variant
      ? [{ text: ` \u00b7 ${fit(data.variant, 10)}`, color: settings.effortColor }]
      : []
    return {
      icon: icons.identity,
      sizes: { full: [agent, ...model, ...effort], compact: [agent, ...model], icon: "" },
    }
  },
}
