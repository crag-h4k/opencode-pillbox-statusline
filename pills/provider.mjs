// pills/provider.mjs
// Subscription quota for the active model's provider: GitHub Copilot monthly
// use, Codex and Claude windows, or a gateway's published figures.
import { Schema } from "effect"
import { Color } from "../config/types.mjs"

const Percent = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 100 }))

export default {
  id: "provider",
  title: "Provider quota",
  sizes: ["full", "compact"],
  options: {
    warnAt: Percent.annotate({ description: "Used percentage that switches to the warning color" }),
    errorAt: Percent.annotate({ description: "Used percentage that switches to the error color" }),
    warning: Color.annotate({ description: "Color at or above warnAt" }),
    error: Color.annotate({ description: "Color at or above errorAt" }),
  },
  defaults: {
    group: "right",
    order: 100,
    priority: 85,
    accent: "feedback.info",
    warnAt: 70,
    errorAt: 90,
    warning: "feedback.warning",
    error: "feedback.error",
  },
}
