// icons.mjs
// Icon sets and pill cap styles, plus lookups that fall back safely. Every glyph
// and spinner frame is one terminal cell by width.mjs. No host imports.
//
// Sets:
// - nerd: today's footer glyphs, including Material Design icons above U+FFFF;
//   the tier ramps use the intended circle-outline, gem, sack, and campfire.
// - nerd-bmp: the same concepts using only code points at or below U+FFFF, for
//   clients that mishandle supplementary-plane glyphs (Termius redraw stacking).
//   Every glyph has shipped in Nerd Fonts since 3.0.0.
// - unicode: no private-use code points; covered by Menlo and DejaVu Sans Mono
//   except the braille spinner, which renders through font fallback.
// - ascii: printable ASCII only.

/**
 * @typedef {{ included: string, standard: string, premium: string, heavy: string }} TierRamp
 * @typedef {{
 *   project: string
 *   git: string
 *   identity: string
 *   elapsed: string
 *   subagentQueued: string
 *   context: string
 *   cost: string
 *   provider: string
 *   limit: string
 *   tier: { value: TierRamp, heat: TierRamp }
 *   spinner: readonly string[]
 *   subagentSpinner: readonly string[]
 * }} IconSet
 * @typedef {"nerd" | "nerd-bmp" | "unicode" | "ascii"} IconSetName
 * @typedef {{ left: string, right: string, sets: readonly IconSetName[] }} CapStyle
 * @typedef {{ style: string, left: string, right: string }} Caps
 */

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

const BRAILLE_SPINNER = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"]
const SUBAGENT_SPINNER = [".", "o", "O", "o"]

export const DEFAULT_ICON_SET = "nerd"
export const DEFAULT_CAP_STYLE = "round"

/** @type {Readonly<Record<IconSetName, IconSet>>} */
export const ICON_SETS = deepFreeze({
  nerd: {
    project: "\u{F024B}", // md-folder
    git: "\uE0A0", // pl-branch
    identity: "\u{F06A9}", // md-robot
    elapsed: "\u{F0954}", // md-clock
    subagentQueued: "\u{F04FB}", // md-tag_multiple
    context: "\u{F035B}", // md-memory
    cost: "\u2248", // almost equal to
    provider: "\u{F02A4}", // md-github
    limit: "\u{F04C5}", // md-speedometer
    tier: {
      value: {
        included: "\u{F0766}", // md-circle_outline
        standard: "\u{F0114}", // md-cash
        premium: "\u{F01C8}", // md-diamond_stone
        heavy: "\u{F0D2E}", // md-sack
      },
      heat: {
        included: "\u{F0717}", // md-snowflake
        standard: "\u{F0EDD}", // md-campfire
        premium: "\u{F0238}", // md-fire
        heavy: "\u{F15D7}", // md-fire_alert
      },
    },
    spinner: [...BRAILLE_SPINNER],
    subagentSpinner: [...SUBAGENT_SPINNER],
  },
  "nerd-bmp": {
    project: "\uF07B", // fa-folder
    git: "\uE0A0", // pl-branch
    identity: "\uF477", // oct-hubot
    elapsed: "\uF4AB", // oct-clock_fill
    subagentQueued: "\uF02C", // fa-tags
    context: "\uF2DB", // fa-microchip
    cost: "\u2248", // almost equal to
    provider: "\uF09B", // fa-github
    limit: "\uEACD", // cod-dashboard
    tier: {
      value: {
        included: "\uF10C", // fa-circle_o
        standard: "\uF0D6", // fa-money
        premium: "\uF219", // fa-gem
        heavy: "\uF19C", // fa-bank
      },
      heat: {
        included: "\uF2DC", // fa-snowflake_o
        standard: "\uE3BF", // weather-fire
        premium: "\uF06D", // fa-fire
        heavy: "\uE3C0", // weather-volcano
      },
    },
    spinner: [...BRAILLE_SPINNER],
    subagentSpinner: [...SUBAGENT_SPINNER],
  },
  unicode: {
    project: "\u2302", // house
    git: "\u2325", // option key, a forking path
    identity: "\u2726", // black four pointed star
    elapsed: "\u25F7", // circle with upper right quadrant
    subagentQueued: "\u22EF", // midline horizontal ellipsis
    context: "\u25A6", // square with crosshatch fill
    cost: "\u2248", // almost equal to
    provider: "@",
    limit: "\u25D4", // circle with upper right quadrant black
    tier: {
      value: {
        included: "\u25CB", // white circle
        standard: "\u00A4", // currency sign
        premium: "\u25C7", // white diamond
        heavy: "\u25C6", // black diamond
      },
      heat: {
        included: "\u2591", // light shade
        standard: "\u2592", // medium shade
        premium: "\u2593", // dark shade
        heavy: "\u2588", // full block
      },
    },
    spinner: [...BRAILLE_SPINNER],
    subagentSpinner: [...SUBAGENT_SPINNER],
  },
  ascii: {
    project: "/",
    git: "*",
    identity: ">",
    elapsed: ":",
    subagentQueued: "&",
    context: "#",
    cost: "~",
    provider: "@",
    limit: "%",
    tier: {
      value: { included: ".", standard: "-", premium: "=", heavy: "#" },
      heat: { included: "_", standard: "~", premium: "^", heavy: "!" },
    },
    spinner: ["|", "/", "-", "\\"],
    subagentSpinner: [...SUBAGENT_SPINNER],
  },
})

/**
 * Pill edges. A cap is drawn in the surface color on the terminal background.
 * `sets` lists the icon sets whose code point rules the cap glyphs satisfy:
 * Powerline caps are private-use, so `unicode` and `ascii` fall back to `flat`.
 * `square` uses half blocks, so it keeps the same width as `round`.
 * @type {Readonly<Record<string, CapStyle>>}
 */
export const CAP_STYLES = deepFreeze({
  round: { left: "\uE0B6", right: "\uE0B4", sets: ["nerd", "nerd-bmp"] },
  angled: { left: "\uE0B2", right: "\uE0B0", sets: ["nerd", "nerd-bmp"] },
  square: { left: "\u2590", right: "\u258C", sets: ["nerd", "nerd-bmp", "unicode"] },
  flat: { left: "", right: "", sets: ["nerd", "nerd-bmp", "unicode", "ascii"] },
})

/** Accepted spellings that resolve to another cap style. */
export const CAP_ALIASES = deepFreeze({ none: "flat" })

export const ICON_SET_NAMES = deepFreeze(Object.keys(ICON_SETS))
export const CAP_STYLE_NAMES = deepFreeze(Object.keys(CAP_STYLES))

/**
 * Resolves an icon set name, falling back to `nerd` for anything unknown.
 * @param {unknown} name
 * @returns {IconSetName}
 */
export function iconSetName(name) {
  return typeof name === "string" && Object.hasOwn(ICON_SETS, name)
    ? /** @type {IconSetName} */ (name)
    : DEFAULT_ICON_SET
}

/**
 * @param {unknown} name
 * @returns {IconSet}
 */
export function iconSet(name) {
  return ICON_SETS[iconSetName(name)]
}

/** @param {unknown} style */
function capStyleName(style) {
  if (typeof style !== "string") return DEFAULT_CAP_STYLE
  const name = Object.hasOwn(CAP_ALIASES, style) ? CAP_ALIASES[style] : style
  return Object.hasOwn(CAP_STYLES, name) ? name : DEFAULT_CAP_STYLE
}

const RESOLVED_CAPS = deepFreeze(
  Object.fromEntries(
    Object.entries(CAP_STYLES).map(([style, cap]) => [style, { style, left: cap.left, right: cap.right }]),
  ),
)

/**
 * Cap glyphs for a style and icon set. An unknown style means `round`; a style
 * whose glyphs break the set's code point rules gives `flat`.
 * @param {unknown} style
 * @param {unknown} setName
 * @returns {Caps}
 */
export function capsFor(style, setName) {
  const name = capStyleName(style)
  return CAP_STYLES[name].sets.includes(iconSetName(setName)) ? RESOLVED_CAPS[name] : RESOLVED_CAPS.flat
}
