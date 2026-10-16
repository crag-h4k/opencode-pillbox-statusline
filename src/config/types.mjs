// src/config/types.mjs
// Shared schema pieces for options. Kept apart from config/schema.mjs so pill
// modules can import them without a cycle.
import { Schema } from "effect"
import { TOKEN_PATTERN } from "../render/theme.mjs"

export const Token = Schema.String.check(Schema.isPattern(TOKEN_PATTERN)).annotate({
  description: "Theme color token: text.base, feedback.warning, hue.accent, hue.cyan.200, categorical.0, agent, or #rrggbb",
})

/** One token, or a fallback list where the first opaque color wins. */
export const Color = Schema.Union([Token, Schema.NonEmptyArray(Token)])

export const SIZE_NAMES = Object.freeze(["full", "compact", "icon"])
export const Size = Schema.Literals(SIZE_NAMES)
export const MinSize = Schema.Literals([...SIZE_NAMES, "hidden"])

export const Columns = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 1000 }))
