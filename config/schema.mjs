// config/schema.mjs
// The options schema: one definition validates cli.json options and generates
// schema.json for editors and agents (scripts/schema.mjs).
import { Schema } from "effect"
import { CAP_ALIASES, CAP_STYLE_NAMES, ICON_SET_NAMES } from "../icons.mjs"
import { PILL_IDS, PILLS } from "../pills/index.mjs"
import { Color, Columns, MinSize, Size } from "./types.mjs"

export const PRESET_NAMES = Object.freeze(["default", "minimal"])
export const CAP_NAMES = Object.freeze([...CAP_STYLE_NAMES, ...Object.keys(CAP_ALIASES)])
export { ICON_SET_NAMES }

const optional = (fields) =>
  Object.fromEntries(Object.entries(fields).map(([key, schema]) => [key, Schema.optionalKey(schema)]))

const between = (minimum, maximum) => Schema.Int.check(Schema.isBetween({ minimum, maximum }))

/** Settings every pill accepts. */
export const COMMON_PILL_FIELDS = Object.freeze({
  enabled: Schema.Boolean.annotate({ description: "Show this pill at all" }),
  when: Schema.Literals(["session", "home", "always"]).annotate({
    description: "Which footer shows it: the session prompt, the home screen, or both",
  }),
  group: Schema.Literals(["left", "right"]).annotate({ description: "Alignment group; right is flush to the edge" }),
  order: between(0, 1000).annotate({ description: "Position inside the group, low to high" }),
  priority: between(0, 100).annotate({ description: "Higher survives longer when space runs out" }),
  attach: Schema.Literals(PILL_IDS).annotate({ description: "Show and hide together with this pill" }),
  size: Size.annotate({ description: "Preferred size" }),
  minSize: MinSize.annotate({ description: "Smallest size the fit may use; hidden lets it disappear" }),
  minColumns: Columns.annotate({ description: "Hide below this terminal width" }),
  maxWidth: between(1, 200).annotate({ description: "Truncate the value to this many cells" }),
  icon: Schema.String.check(Schema.isMinLength(1)).annotate({ description: "Replaces the icon from the icon set" }),
  accent: Color.annotate({ description: "Icon color" }),
  value: Color.annotate({ description: "Text color" }),
})

/** @param {{ id: string, title: string, options?: Record<string, unknown> }} pill */
export function pillSchema(pill) {
  return Schema.Struct(optional({ ...COMMON_PILL_FIELDS, ...(pill.options ?? {}) })).annotate({ title: pill.title })
}

/** Top-level option schemas, keyed by option name. Each is decoded on its own so one bad key never drops the rest. */
export const ROOT_FIELDS = Object.freeze({
  $schema: Schema.String,
  preset: Schema.Literals(PRESET_NAMES).annotate({ description: "Starting point before your overrides" }),
  icons: Schema.Literals(ICON_SET_NAMES).annotate({
    description: "Icon set: nerd, nerd-bmp (no glyphs above U+FFFF), unicode, or ascii",
  }),
  style: Schema.Struct(optional({
    surface: Color.annotate({ description: "Pill background; the first opaque color wins" }),
    caps: Schema.Literals(CAP_NAMES).annotate({
      description: "Pill edges: round, angled, square, or flat (none). A style the icon set cannot draw falls back to flat",
    }),
    gap: between(0, 4).annotate({ description: "Columns between pills" }),
  })),
  layout: Schema.Struct(optional({
    reserve: between(0, 200).annotate({ description: "Columns kept free for the editor file name in the session footer" }),
    hysteresis: between(0, 20).annotate({ description: "Spare columns needed before a pill grows back" }),
  })),
  sources: Schema.Struct(optional({
    usage: Schema.Struct(optional({
      refresh: between(15, 3600).annotate({ description: "Seconds between provider quota refreshes" }),
    })),
    tiers: Schema.Struct(optional({
      enabled: Schema.Boolean.annotate({
        description: "Fetch GitHub Copilot model categories; sends VS Code Copilot Chat client headers",
      }),
      refresh: between(600, 86400).annotate({ description: "Seconds between category refreshes" }),
    })),
  })),
  pills: Schema.Struct(Object.fromEntries(PILLS.map((pill) => [pill.id, Schema.optionalKey(pillSchema(pill))]))),
})

export const OptionsSchema = Schema.Struct(optional(ROOT_FIELDS)).annotate({
  title: "opencode-pillbox-statusline options",
  description: "Options for the pillbox entry in OpenCode's cli.json plugins list",
})
