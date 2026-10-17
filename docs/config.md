# Configuration

Pillbox has separate terminal and server entries. Put presentation options in
the plugin's `options` object in `~/.config/opencode/cli.json` (or
`$XDG_CONFIG_HOME/opencode/cli.json`). Only the `tiers` switch belongs in
`opencode.json(c)`. See [installation](../README.md#install) for both entries.

## Editors and schema

[`schema.json`](../schema.json) describes the terminal **options object**, not
the whole CLI configuration. It ships in the npm package. The published source
URL is:

```text
https://raw.githubusercontent.com/crag-h4k/opencode-pillbox-statusline/main/schema.json
```

Use `https://opencode.ai/v2/cli.json` as the root `$schema` of `cli.json` and
`https://opencode.ai/config.json` in `opencode.json(c)`. Pillbox accepts an
`options.$schema` hint, but some editors apply `$schema` only at the document
root. In those editors, validate a standalone copy of the options object
against Pillbox's schema, or configure a schema association for that object.
Use a release tag instead of `main` in the URL to match a pinned release.

```jsonc
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": [
    "-opencode.prompt.footer",
    {
      "package": "opencode-pillbox-statusline@0.1.0",
      "options": {
        "$schema": "https://raw.githubusercontent.com/crag-h4k/opencode-pillbox-statusline/main/schema.json",
        "icons": "nerd-bmp",
        "pills": {
          "cost": { "enabled": false },
          "git": { "maxWidth": 24 }
        }
      }
    }
  ]
}
```

## Resolution and errors

Built-in defaults apply first, then the preset, then your overrides. Objects
merge recursively; arrays replace. An invalid top-level entry falls back as a
unit. An invalid pill entry falls back as a unit, without discarding other
pills. Unknown keys are errors, with spelling suggestions where possible.

An unsupported preferred size moves to the next supported smaller size. A
`minSize` larger than the preferred size is repaired, and attachment cycles are
broken. These repairs also produce errors. The terminal shows a warning toast
and logs option errors when the plugin loads. `/pillbox`, section **Options**,
shows all errors and the complete resolved terminal options.

## Root options

| Key | Default | Values and behavior |
| --- | --- | --- |
| `preset` | `default` | `default`, `minimal` |
| `icons` | `nerd` | `nerd`, `nerd-bmp`, `unicode`, `ascii` |
| `style.surface` | `background.raised.base`, `hue.neutral.700`, `diff.background.context` | Ordered fallback list of theme colors |
| `style.caps` | `round` | `round`, `angled`, `square`, `flat`; `none` is an alias for `flat` |
| `style.gap` | `1` | Integer cells between pills, 0-4 |
| `layout.reserve` | `0` | Integer cells removed from the footer budget, 0-200 |
| `layout.hysteresis` | `2` | Spare cells needed before a session pill grows back, 0-20 |
| `sources.usage.refresh` | `60` | Seconds between quota RPC polls, 15-3600 |
| `sources.tiers.refresh` | `21600` | Seconds between category RPC polls, 600-86400 |

`minimal` disables identity, elapsed, subagents, cost, and tier. It retains the
project, Git, context, and provider pills, plus the interrupt hint. The spinner
is attached to identity, so it also disappears unless identity is re-enabled.
Sidequest stays disabled in either preset.

Nerd Font sets need a compatible font. `nerd-bmp` avoids code points above
U+FFFF for terminals that mishandle supplementary-plane glyphs. `unicode` uses
no private-use glyphs, and `ascii` uses printable ASCII only. Round and angled
caps fall back to flat in `unicode` and `ascii`; square caps also fall back to
flat in `ascii`. If the theme has no opaque surface color, the renderer drops
caps regardless of the configured style.

## Per-pill options

Each entry under `pills` accepts these keys. The [pill reference](pills.md)
lists supported sizes, individual defaults, and pill-specific settings.

| Key | Default | Values and behavior |
| --- | --- | --- |
| `enabled` | `true` except sidequest | Boolean |
| `when` | `session` except project and Git (`always`) | `session`, `home`, `always` |
| `group` | `left` except provider (`right`) | Alignment group |
| `order` | Per pill | Integer 0-1000, increasing within the group |
| `priority` | Per pill | Integer 0-100; higher survives longer |
| `attach` | Unset except spinner and tier (`identity`) | Another pill id; hide when that pill is absent or hidden |
| `size` | `full` except spinner (`icon`) | Preferred supported size: `full`, `compact`, `icon` |
| `minSize` | `hidden` | Smallest allowed size, or `hidden` to allow removal |
| `minColumns` | `0` | Hide below this terminal width, integer 0-1000 |
| `maxWidth` | Per pill where used | Integer 1-200; limits text fields in project, Git, identity, and sidequest |
| `icon` | Icon set | Nonempty override string; may occupy multiple cells |
| `accent` | Per pill | Icon color token or fallback list |
| `value` | `text.base` except hint | Text color token or fallback list |

`maxWidth` is not a cap on the complete pill: Git's counts and identity's agent
and effort fields have their own widths. Numerical pills do not use it.
Dynamic states can override `accent`, including dirty Git, provider quota
thresholds, and tier bands. Configure their specific color settings instead.

## Fit and colors

The session footer measures its slot, subtracts `layout.reserve`, and fits
pills into that budget. The home footer uses the terminal width minus reserve.
`minColumns` always refers to terminal width, even if a sidebar or neighboring
footer element leaves a smaller slot.

The fit starts at each pill's preferred size. The lowest-priority pill steps
down through its supported sizes, then hides if allowed. Equal priorities
shrink the pill with the higher `order` first. An attachment hides when its
parent disappears. Session pills grow only when the result leaves the
configured hysteresis slack; shrinking is immediate. If minimum sizes prevent
a fit, diagnostics report overflow.

Colors resolve against the active theme. A fallback list uses the first opaque
color. Tokens include `text.base`, `text.muted`, `feedback.error`,
`feedback.warning`, `feedback.success`, `feedback.info`, `hue.<name>`,
`hue.<name>.<step>`, `categorical.<n>`, and `agent`. A hue without a step uses
200 in dark mode or 300 in light mode. Other dotted theme paths and `#rrggbb`
are accepted. See the [README color table](../README.md#colors).

## Sources

Polling runs only while the corresponding pill is enabled: provider for
usage, tier for categories. A poll has a 15-second timeout and cannot overlap
another poll of the same source. Server requests have their own 10-second
timeouts. Each quota provider and the gateway file are cached for one minute,
so a shorter terminal interval does not force more upstream requests.

Quota figures older than five minutes are removed before rendering. Copilot
categories cache for six hours and back off for fifteen minutes on failure;
the last good category map is kept for the same account. Unlike quota figures,
stale categories remain usable. A category request is allowed only when the
server's plugin entry has `"options": { "tiers": true }`. Read the
[privacy and endpoint notes](../README.md#data-sources-and-privacy) before
enabling it.

## Diagnostics

Run `/pillbox` or select **Pillbox diagnostics** in the command palette. No
default shortcut is bound. Use 1-4 to choose a section, arrows or Page Up/Down
to scroll, and Escape to close.

| Section | Contents |
| --- | --- |
| Layout | Current footer's terminal width, budget, actual fitted width, overflow, effective caps, every pill's selected size and width or hide reason, and measured candidate sizes |
| Sources | RPC polling state and last success, direct and gateway quota freshness and auth kind, category source state and category counts |
| Options | All load-time option errors, followed by the resolved terminal options |
| Glyphs | Chosen icon set, every spinner frame and tier glyph, cap glyphs, custom icon overrides, code points, computed cell widths, and visual rulers |

Layout reads the mounted footer's existing fit, including hysteresis. It does
not recompute a second layout. Layout and source state update while the dialog
is open. A page with no mounted Pillbox footer says so.

Hide reasons distinguish `disabled`, the wrong footer (`when`), absent data or
inactive state (`no-data`), no content at a supported size (`empty`),
`minColumns`, a hidden attachment (`attached`), and insufficient `space`.
Space includes a pill held hidden by hysteresis.

RPC `disabled` means the terminal is not polling because its pill is disabled.
RPC `ready` means a call succeeded, not that every provider returned quota.
`error` covers a missing server plugin, timeout, or failed call. A provider
marked `not reported` may be disconnected or unavailable; it is not proof of
a missing login. Gateway entries appear only while the server considers them
valid, so absent files and invalid files cannot be distinguished here.

The category source separately reports `disabled`, `unavailable`, `ready`, or
`stale`. Older server halves that do not report this field show `unknown`.
Source diagnostics select quota numbers, auth kind, timestamps, and category
counts. They do not display tokens, account ids, raw responses, raw exceptions,
model inventories, or the gateway file path. Options show your configured
values, including custom icon strings.

For glyph checks, compare each sample's closing bar to the ruler below it.
Computed cell widths cannot verify font coverage or how your terminal paints
a glyph. If the bars do not line up or icons overlap, try `nerd-bmp`, `unicode`,
or `ascii`. Configured caps are shown here even when the active theme causes
the footer to use flat caps; **Layout** reports the effective style.
