// config/defaults.mjs
// Built-in defaults and presets. A preset is a partial options object applied
// on top of the defaults, before the user's options.
import { PILLS } from "../pills/index.mjs"

/** Every pill starts from these, then its own module's defaults. */
export const COMMON_PILL_DEFAULTS = Object.freeze({
  enabled: true,
  when: "session",
  group: "left",
  size: "full",
  minSize: "hidden",
  minColumns: 0,
  value: "text.base",
})

export const ROOT_DEFAULTS = Object.freeze({
  preset: "default",
  icons: "nerd",
  style: {
    surface: ["background.raised.base", "hue.neutral.700", "diff.background.context"],
    caps: "round",
    gap: 1,
  },
  layout: { reserve: 30, hysteresis: 2 },
  sources: {
    usage: { refresh: 60 },
    tiers: { enabled: false, refresh: 21600 },
  },
})

export const PRESETS = Object.freeze({
  default: {},
  minimal: {
    pills: {
      identity: { enabled: false },
      elapsed: { enabled: false },
      subagents: { enabled: false },
      cost: { enabled: false },
      tier: { enabled: false },
    },
  },
})

/** The fully expanded defaults, before any preset or user options. */
export function builtinConfig() {
  return {
    ...structuredClone(ROOT_DEFAULTS),
    pills: Object.fromEntries(PILLS.map((pill) => [pill.id, { ...COMMON_PILL_DEFAULTS, ...structuredClone(pill.defaults) }])),
  }
}
