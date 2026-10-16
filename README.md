# opencode-pillbox-statusline

A config-driven footer statusline for [OpenCode V2](https://opencode.ai/v2/docs/).
The footer is a row of pills: project, Git, agent and model, elapsed time,
subagents, context, cost, model tier, and provider quota. Every pill is a node
with its own settings, and all colors come from the active OpenCode theme.

Developed against OpenCode 2.0.29 and its plugin API.

## Table of Contents

- [Install](#install)
- [Configuration](#configuration)
- [Development](#development)
- [License](#license)

## Install

The package is not published yet. Load it from a checkout by absolute path.
OpenCode passes `opencode.jsonc` options only to a plugin's server half, so
pillbox is registered twice: once in `opencode.jsonc` for the server half, and
once in `cli.json` with the options for the terminal half.

```jsonc
// ~/.config/opencode/opencode.jsonc
{
  "plugins": ["/absolute/path/to/opencode-pillbox-statusline"]
}
```

```jsonc
// ~/.config/opencode/cli.json
{
  "plugins": [
    "-opencode.prompt.footer",
    { "package": "/absolute/path/to/opencode-pillbox-statusline", "options": {} }
  ]
}
```

Run `npm install` in the checkout first, the same as `opencode-sidequest`. The
terminal reloads plugins when their files change.

Pillbox replaces the `prompt.footer.status` slot and adds to
`home.footer.status`. When two plugins replace the same slot, the one enabled
last wins, so disable any other footer plugin with a `-<plugin id>` entry in
the same `plugins` list. `-opencode.prompt.footer` also removes OpenCode's
command-palette hint.

## Configuration

Options are keyed by pill id, so an override names only what changes. Lists
replace rather than merge. Built-in defaults apply first, then the preset, then
your options. A mistake drops only its own entry and shows up as an error; the
rest of the footer still renders.

```jsonc
{
  "package": "opencode-pillbox-statusline",
  "options": {
    "$schema": "https://raw.githubusercontent.com/crag-h4k/opencode-pillbox-statusline/main/schema.json",
    "preset": "default",
    "pills": {
      "cost": { "enabled": false },
      "git": { "order": 15, "maxWidth": 24, "dirtyAccent": ["hue.yellow", "feedback.warning"] }
    }
  }
}
```

[`schema.json`](schema.json) describes every key for editors and agents.

| Key | Purpose |
| --- | --- |
| `preset` | `default` or `minimal` (project, Git, context, and provider quota) |
| `icons` | `nerd`, `nerd-bmp` (no glyphs above U+FFFF), `unicode`, or `ascii` |
| `style` | `surface` (pill background), `caps` (`round`, `angled`, `square`, or `flat`; a style the icon set cannot draw falls back to `flat`), `gap` |
| `layout` | `reserve` (columns kept for the editor file name) and `hysteresis` |
| `sources` | `usage.refresh`, and `tiers.enabled` and `tiers.refresh` for GitHub Copilot model categories |
| `pills.<id>` | `enabled`, `when`, `group`, `order`, `priority`, `attach`, `size`, `minSize`, `minColumns`, `maxWidth`, `icon`, `accent`, `value`, plus the pill's own settings |

Pills: `hint`, `project`, `git`, `spinner`, `identity`, `elapsed`, `subagents`,
`sidequest` (off by default), `context`, `cost`, `tier`, and `provider`.

### Colors

Colors are tokens resolved against the active OpenCode theme, so pillbox has no
palette of its own. A setting can list several tokens; the first opaque color
wins.

| Token | Resolves to |
| --- | --- |
| `text.base`, `text.muted` | Theme text colors |
| `feedback.error`, `.warning`, `.success`, `.info` | Theme feedback colors |
| `hue.<name>` or `hue.<name>.<step>` | A hue scale; no step means 200 in dark mode and 300 in light |
| `categorical.<n>` | A categorical theme color |
| `agent` | The active agent's configured color |
| Any other dot path | For example `diff.background.context` |
| `#rrggbb` | A fixed color, for themes without a match |

Themes converted from the V1 format name their hues by angle, so `hue.yellow`
may be missing or another color. The defaults use only `text.*`, `feedback.*`,
`hue.accent`, `hue.interactive`, and `agent`, which every theme defines.

### Layout

Each pill starts at its preferred size. While the footer is too wide, the
lowest-priority pill that can still shrink steps down one size (full, compact,
icon, hidden). Ties go to the pill with the higher `order`. A pill with
`attach` hides together with that pill, and `minColumns` hides a pill below a
terminal width. A pill only grows back once `hysteresis` spare columns are free.

## Development

```sh
npm install
npm test
npm run typecheck
```

The tests need Node 26.4 or newer: the render tests draw real frames with
OpenTUI, whose Node build uses `node:ffi`.

Linting and the other checks run through [prek](https://prek.j178.dev/), locally on
every commit and in CI. The type check and the tests are hooks too, so run
`npm install` first.

```sh
uv tool install prek==0.5.4
prek install --overwrite
prek run --all-files
```

| Hook | Checks |
| --- | --- |
| gitleaks | Secrets in staged content |
| pre-commit-hooks | Whitespace, end of file, YAML and JSON syntax, merge markers, large files |
| actionlint | GitHub Actions workflows |
| markdownlint-cli2 | Markdown, configured in `.markdownlint.yaml` |
| biome-ci | TypeScript and JavaScript lint rules, configured in `biome.jsonc`; read-only, with the formatter off |
| typecheck, test | `tsc --noEmit` and the `node:test` suites |
| schema | `schema.json` matches the options schema; run `npm run schema` to regenerate it |

CI runs the same hooks from `.github/workflows/ci.yaml`, which calls the reusable
`.github/workflows/prek.yaml`.

| File | Role |
| --- | --- |
| `config/schema.mjs` | Options schema; validates options and generates `schema.json` |
| `config/defaults.mjs` | Built-in defaults and presets |
| `config/resolve.mjs` | Merges defaults, preset, and options; reports and drops invalid entries |
| `config/types.mjs` | Shared schema pieces: color tokens and sizes |
| `pills/` | One module per pill with its defaults and own settings; `index.mjs` registers them |
| `theme.mjs` | Color token resolution against the OpenCode theme |
| `layout.mjs` | Pill anatomy and the priority fit |
| `bar.mjs` | Renders the enabled pills from a data snapshot and fits them into one bar |
| `format.mjs` | Durations, money, compact numbers, context usage, and tier bands |
| `tui.tsx` | Terminal half: builds the snapshot from OpenCode state, measures, resolves colors, draws both footers |
| `icons.mjs` | Icon sets (`nerd`, `nerd-bmp`, `unicode`, `ascii`), cap styles, and safe fallbacks |
| `width.mjs` | Terminal cell widths that match OpenTUI, cleaning, and truncation |
| `usage.mjs` | Provider quota parsing, normalization, and summaries |
| `activity.mjs` | Spinner frames and foreground and subagent activity |
| `scripts/schema.mjs` | Writes `schema.json`; `--check` fails when it is stale |
| `test/` | `node:test` suites, including OpenTUI render checks and real theme fixtures |

## License

MIT. See [LICENSE](LICENSE).
