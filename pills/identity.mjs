// pills/identity.mjs
// Active agent, model, and effort variant. Compact drops the effort; icon keeps
// only the agent icon.
import { Schema } from "effect"
import { Color } from "../config/types.mjs"

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
}
