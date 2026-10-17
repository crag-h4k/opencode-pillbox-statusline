# Pill reference

Pills are configured by id under the terminal entry's `options.pills`. Shared
keys and layout behavior are documented in [Configuration](config.md). Use
`/pillbox` to see which size the actual fit selected and why a pill is hidden.

## Defaults

All pills default to `size: "full"` and `minSize: "hidden"` except spinner,
whose only size is `icon`. They appear in the session footer unless noted.
All are enabled except sidequest. Every pill uses `text.base` for values except
hint, which uses `text.muted`.

| Id | Sizes | Order | Priority | Default accent | Placement and attachment |
| --- | --- | --- | --- | --- | --- |
| `hint` | full | 0 | 100 | `text.muted` | Left, plain text |
| `project` | full, icon | 10 | 95 | `feedback.info` | Left, home and session |
| `git` | full, compact, icon | 20 | 90 | `feedback.success` | Left, home and session |
| `spinner` | icon | 39 | 60 | `hue.accent` | Left, plain, attached to identity |
| `identity` | full, compact, icon | 40 | 60 | `hue.interactive` | Left |
| `elapsed` | full, icon | 50 | 30 | `hue.accent` | Left |
| `subagents` | full, icon | 60 | 75 | `feedback.warning` | Left |
| `sidequest` | full, compact | 65 | 55 | `feedback.info` | Left, disabled |
| `context` | full, compact | 70 | 65 | `hue.accent` | Left |
| `cost` | full, compact | 80 | 50 | `feedback.success` | Left |
| `tier` | full, icon | 90 | 40 | By band | Left, attached to identity |
| `provider` | full, compact | 100 | 85 | By quota | Right |

## Hint and spinner

`hint` shows the interrupt shortcut while the session runs, or `esc exit shell
mode` in shell mode. It is absent while idle. It has no surface or caps.

`spinner` animates one cell while foreground model or tool work runs. It stops
and hides while waiting for permission or form input, in shell mode, or while
idle. It also hides with identity. The frame set follows `icons`.

## Project

Shows the project name, falling back to its directory basename. `maxWidth`
defaults to 18 cells. The full size truncates the name with an ellipsis; icon
size keeps only the icon. No project name means no pill.

## Git

Shows the branch, dirty-file count, and in full size, additions and deletions.
Compact drops line counts; icon drops all text. A clean worktree shows only
the branch in full and compact sizes. No branch means no pill.

| Setting | Default | Purpose |
| --- | --- | --- |
| `maxWidth` | `18` | Branch-name width, before counts |
| `dirtyAccent` | `feedback.warning` | Icon color when files have changes |

## Identity

Shows the active agent and model id. Full adds the model variant when present;
compact omits it, and icon omits all text. No agent means no pill. The agent
name is limited to 12 cells, and the variant to 10.

| Setting | Default | Purpose |
| --- | --- | --- |
| `maxWidth` | `20` | Model-id width |
| `agentColor` | `agent` | Agent-name color from its configured color or categorical fallback |
| `effortColor` | `feedback.warning` | Variant text color |
| `showEffort` | `true` | Include the variant in full size |

## Elapsed

Wall-clock age since session creation, such as `<1m`, `12m`, or `1d2h`.
This is session age, not model execution time. The icon size drops the age.
No creation timestamp means no pill.

## Subagents

Shows running child sessions and queued child prompts across the session
family. It animates while children run, including when the foreground session
is idle. Queued-only work uses a static icon. It hides when both counts are
zero. Icon size drops the counts.

## Sidequest

The pure renderer supports a run name, done/total count, and failed count.
`maxWidth` defaults to 16 for the name; compact drops the name. Failed runs
use `feedback.error`.

The terminal adapter does not yet supply Sidequest run data. Enabling this
pill alone therefore leaves it hidden with `no-data`. It defaults off because
opencode-sidequest already supplies its own progress strip.

## Context

Uses the latest assistant message after the most recent completed compaction,
respecting the session's revert boundary. Full shows token count and, when a
model limit is known, its percentage. Compact shows the percentage, or the
token count when no limit is known. Zero or missing token usage hides it.

## Cost

Uses OpenCode's aggregate session-family cost in USD. Full shows cents;
compact rounds to whole dollars. Zero or missing cost hides it. Provider
subscription quota is separate and does not contribute a dollar estimate.

## Tier

Shows the active model's cost band. Copilot category data takes precedence for
GitHub Copilot models. Other models, and those without a recognized category,
use catalog output price in USD per million tokens. With neither category nor
price, the pill hides. Icon size omits the band label.

| Band | Catalog output price | Copilot category | Default band color |
| --- | --- | --- | --- |
| included | At most $5 | `lightweight` | `feedback.success` |
| standard | Above $5 through $12 | `versatile` | `feedback.info` |
| premium | Above $12 through $20 | `powerful` with known output price below $25 | `feedback.warning` |
| heavy | Above $20 | `powerful` with unknown output price or at least $25 | `feedback.error` |

`ramp` chooses `value` (default, circle/cash/gem/sack in the Nerd set) or `heat`
(snowflake/campfire/fire/fire-alert). `bands.included`, `bands.standard`,
`bands.premium`, and `bands.heavy` override colors independently. A custom
`icon` overrides the selected ramp glyph.

Category requests require the server's `tiers: true` switch. Without it,
catalog price fallback still works. See the
[source documentation](config.md#sources) and
[endpoint notes](../README.md#data-sources-and-privacy).

## Provider

Shows quota for the active model's provider. Full includes its name and quota;
compact keeps a shorter quota summary. It has no icon-only size.

| Provider | Display |
| --- | --- |
| GitHub Copilot | Monthly percentage used, or unlimited. Without figures, shows only the name in the error color |
| OpenAI via ChatGPT OAuth | Codex weekly percentage left. Missing weekly quota reads `Codex unavailable` (compact: `Codex`) |
| Anthropic via OAuth | Available 5-hour and weekly percentages used |
| Gateway file | Available 5-hour and weekly percentages used |
| OpenAI API key, or any other provider without quota windows | Hidden |

| Setting | Default | Purpose |
| --- | --- | --- |
| `accent` | `feedback.info` | Normal quota icon color |
| `warnAt` | `70` | Used percentage at or above which `warning` applies |
| `errorAt` | `90` | Used percentage at or above which `error` applies |
| `warning` | `feedback.warning` | Warning icon color |
| `error` | `feedback.error` | Error icon color |

Thresholds are integers from 0 to 100. Error is checked before warning. When
several windows exist, the highest used percentage controls color and compact
text. Codex text shows remaining percentage, but its color still uses the used
percentage. Figures expire after five minutes; the diagnostics source section
shows freshness independently of whether the current provider pill is visible.
