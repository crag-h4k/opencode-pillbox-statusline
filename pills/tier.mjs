// pills/tier.mjs
// How heavy the active model is: GitHub Copilot's picker category when the
// tiers source is on, else a band from the model's catalog output price.
import { Schema } from "effect"
import { Color } from "../config/types.mjs"

export default {
  id: "tier",
  title: "Model tier",
  sizes: ["full", "icon"],
  options: {
    ramp: Schema.Literals(["value", "heat"]).annotate({ description: "Icon ramp: value (circle to sack) or heat (snowflake to fire)" }),
    bands: Schema.Struct({
      included: Schema.optionalKey(Color),
      standard: Schema.optionalKey(Color),
      premium: Schema.optionalKey(Color),
      heavy: Schema.optionalKey(Color),
    }).annotate({ description: "Color per tier band" }),
  },
  defaults: {
    order: 90,
    priority: 40,
    attach: "identity",
    ramp: "value",
    bands: {
      included: "feedback.success",
      standard: "feedback.info",
      premium: "feedback.warning",
      heavy: "feedback.error",
    },
  },
}
