// theme.mjs
// Resolves color tokens against OpenCode's ResolvedTheme (`context.theme`).
// Pillbox holds no palette: every color is a token, and a setting may list
// several so the first opaque match wins. No host imports.
//
// Token grammar:
//   text.base, text.muted           theme text colors
//   feedback.<kind>                 text.feedback.<kind>.base (error, warning, success, info)
//   hue.<name>[.<step>]             a hue scale; no step means 200 in dark mode, 300 in light
//   categorical.<n>[.<step>]        a categorical entry, same step rule
//   agent                           the active agent's color (see agentColor)
//   #rrggbb, #rrggbbaa              escape hatch for themes without a match
//   any other dot path              walked into the theme; a { base } node uses its base

export const FEEDBACK_KINDS = Object.freeze(["error", "warning", "success", "info"])
export const HUE_STEPS = Object.freeze([100, 200, 300, 400, 500, 600, 700, 800, 900])
export const TOKEN_PATTERN = /^(#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?|agent|[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+)$/

const HEX = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/

function isRgba(value) {
  return value !== null && typeof value === "object" && ["r", "g", "b", "a"].every((key) => typeof value[key] === "number")
}

/** @param {string} token */
export function isValidToken(token) {
  return typeof token === "string" && TOKEN_PATTERN.test(token)
}

/** Alpha from 0 to 1 for an RGBA object or a hex string; undefined for anything else. */
export function alpha(color) {
  if (isRgba(color)) return color.a
  if (typeof color === "string") {
    const match = HEX.exec(color)
    if (match) return match[2] ? Number.parseInt(match[2], 16) / 255 : 1
  }
  return undefined
}

/** True for a fully opaque color. Translucent and transparent colors count as missing. */
export function isOpaque(color) {
  const value = alpha(color)
  return value !== undefined && value >= 0.999
}

/** Lowercase #rrggbb, with an alpha byte only when the color is not opaque. */
export function toHex(color) {
  if (typeof color === "string" && HEX.test(color)) return color.toLowerCase()
  if (!isRgba(color)) return undefined
  const byte = (n) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, "0")
  return `#${byte(color.r)}${byte(color.g)}${byte(color.b)}${color.a < 0.999 ? byte(color.a) : ""}`
}

function defaultStep(mode) {
  return mode === "light" ? 300 : 200
}

function walk(node, keys) {
  let current = node
  for (const key of keys) {
    if (current === null || typeof current !== "object") return undefined
    current = current[key]
  }
  return current
}

function leaf(value) {
  if (isRgba(value) || typeof value === "string") return value
  if (value && typeof value === "object" && "base" in value) return leaf(value.base)
  return undefined
}

function scaleStep(scale, step, mode) {
  if (!scale || typeof scale !== "object") return undefined
  return leaf(scale[step ?? defaultStep(mode)])
}

/**
 * Resolves one token. Returns the theme's color value (an RGBA object or a hex
 * string) or undefined; never throws.
 * @param {object} theme  context.theme
 * @param {string} token
 * @param {{ mode?: "dark" | "light", agentColor?: unknown }} [options]
 */
export function resolveToken(theme, token, options = {}) {
  if (!isValidToken(token)) return undefined
  const mode = options.mode ?? "dark"
  if (token.startsWith("#")) return token.toLowerCase()
  if (token === "agent") return options.agentColor
  const [head, ...rest] = token.split(".")
  if (head === "feedback" && rest.length === 1) return leaf(walk(theme, ["text", "feedback", rest[0], "base"]))
  if (head === "hue") {
    const step = rest[1] === undefined ? undefined : Number(rest[1])
    if (rest.length > 2 || (step !== undefined && !HUE_STEPS.includes(step))) return undefined
    return scaleStep(walk(theme, ["hue", rest[0]]), step, mode)
  }
  if (head === "categorical") {
    const index = Number(rest[0])
    const step = rest[1] === undefined ? undefined : Number(rest[1])
    if (!Number.isInteger(index) || rest.length > 2 || (step !== undefined && !HUE_STEPS.includes(step))) return undefined
    return scaleStep(walk(theme, ["categorical", index]), step, mode)
  }
  return leaf(walk(theme, [head, ...rest]))
}

/**
 * Resolves a token or a fallback list to the first opaque color.
 * @param {object} theme
 * @param {string | readonly string[] | undefined} tokens
 * @param {{ mode?: "dark" | "light", agentColor?: unknown }} [options]
 */
export function resolveColor(theme, tokens, options = {}) {
  const list = tokens === undefined ? [] : Array.isArray(tokens) ? tokens : [tokens]
  for (const token of list) {
    const color = resolveToken(theme, token, options)
    if (isOpaque(color)) return color
  }
  return undefined
}

/**
 * An agent's own configured color, else a categorical color picked by its
 * position in the agent list, so agents without a color still get a stable one.
 * @param {object} theme
 * @param {readonly { id: string, color?: string }[]} agents
 * @param {string} agentID
 * @param {"dark" | "light"} [mode]
 */
export function agentColor(theme, agents, agentID, mode = "dark") {
  const index = agents.findIndex((agent) => agent.id === agentID)
  if (index === -1) return undefined
  const own = agents[index].color
  if (isOpaque(own)) return own
  const palette = Array.isArray(theme?.categorical) ? theme.categorical : []
  if (palette.length === 0) return undefined
  return scaleStep(palette[index % palette.length], undefined, mode)
}
