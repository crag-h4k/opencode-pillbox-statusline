# AGENTS.md

Contract for coding agents working in this repository.

## What this is

`opencode-pillbox-statusline` is an OpenCode V2 plugin that renders the footer
as a row of configurable pills. The terminal half reads its options from the
user's `cli.json` entry; the server half takes only the `tiers` option and
answers RPC calls.

## Rules

- Keep logic in plain `.mjs` modules that `node --test` can load. They may
  import `effect` (OpenCode supplies it at runtime) but never `@opencode/*` or
  OpenTUI. `src/tui.tsx` and `src/index.ts` are thin host glue.
- Colors are theme tokens resolved by `theme.mjs`. Never add palette hex values
  as defaults; `#rrggbb` is a user escape hatch only. Defaults use only
  `text.*`, `feedback.*`, `hue.accent`, `hue.interactive`, and `agent`.
- Bind no leader keys. OpenCode reserves `<leader>h/j/k/l` for session
  navigation, and `opencode-sidequest` uses others.
- Measure text with `src/render/width.mjs`. It must agree with OpenTUI, and
  `test/width.test.mjs` checks that against a real renderer.
- Every change to a pill or to layout needs a test that covers it at the widths
  it affects.
- RPC output never contains credentials, account ids, or raw provider responses.
- Every outbound request uses `redirect: "error"` and a timeout, and goes only to
  the hosts listed in the README's "Data sources and privacy" table. Adding a
  host or a request means updating that table and `test/server.test.mjs`.
- Requests that impersonate another client stay behind the server's `tiers`
  option and are documented as such.
- Use `.yaml`, not `.yml`. No em dashes in code, comments, or docs.
- Update `README.md` when a file is added or its role changes.

## Adding or changing a pill

1. Create `src/pills/<id>.mjs` exporting `id`, `title`, `sizes`, `defaults`,
   `render`, and, for settings of its own, `options` (effect schemas, each with
   a default in `defaults`). `render(data, settings, icons)` is pure: it reads
   the data snapshot documented at the top of `src/render/bar.mjs` and returns
   `{ icon, sizes: { full, compact, icon }, accent? }`, or `undefined` to hide
   the pill. A size's text is a string or a list of `{ text, color }` runs.
   Set `plain: true` for a pill drawn without a surface or caps.
2. Register it in `src/pills/index.mjs`. If it needs new data, add the field to
   the snapshot in `src/tui.tsx` and document it in `src/render/bar.mjs`.
3. Run `npm run schema` so `schema.json` picks it up.
4. Add tests: `test/pills.test.mjs` for the render, `test/bar.test.mjs` for
   how it fits in a bar, and `test/config.test.mjs` checks the registry.

Changing anything in `src/config/` also needs `npm run schema`; the `schema` hook
and a test fail when `schema.json` is stale.

## Branches, commits, and releases

- Work on a feature branch named for its Conventional Commit type (`feat/`,
  `fix/`, `ci/`, `docs/`, `chore/`, `refactor/`) and merge through a PR.
- Commit messages follow Conventional Commits: Release Please derives the
  version and `CHANGELOG.md` from them. Never edit `CHANGELOG.md`, the version
  in `package.json`, or `.github/release-please/manifest.json` by hand.
- The publish job in `ci.yaml` is registered with npm trusted publishing by its
  file name. Do not move it into a reusable workflow. See `RELEASING.md`.

## Commands

```sh
npm install
npm test
npm run typecheck
npm run schema
prek run --all-files
```

Node 26.4 or newer is required for the OpenTUI render tests.
