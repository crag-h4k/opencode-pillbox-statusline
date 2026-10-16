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

## Configuration

Options are keyed by pill id, so an override names only what changes. Colors
are theme tokens such as `feedback.warning` or `hue.accent`, never palette
copies.

```jsonc
{
  "package": "opencode-pillbox-statusline",
  "options": {
    "pills": {
      "cost": { "enabled": false },
      "git": { "order": 15, "maxWidth": 24 }
    }
  }
}
```

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

CI runs the same hooks from `.github/workflows/ci.yaml`, which calls the reusable
`.github/workflows/prek.yaml`.

| File | Role |
| --- | --- |
| `width.mjs` | Terminal cell widths that match OpenTUI, cleaning, and truncation |
| `usage.mjs` | Provider quota parsing, normalization, and summaries |
| `activity.mjs` | Spinner frames and foreground and subagent activity |
| `test/` | `node:test` suites, including OpenTUI render checks |

## License

MIT. See [LICENSE](LICENSE).
