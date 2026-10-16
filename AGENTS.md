# AGENTS.md

Contract for coding agents working in this repository.

## What this is

`opencode-pillbox-statusline` is an OpenCode V2 plugin that renders the footer
as a row of configurable pills. The terminal half reads its options from the
user's `cli.json` entry; the server half takes no options and answers RPC calls.

## Rules

- Keep logic in plain `.mjs` modules with no host imports, so `node --test` can
  load them. `tui.tsx` and `index.ts` are thin host glue.
- Colors are theme tokens resolved from `context.theme`. Never add palette hex
  values as defaults; `#rrggbb` is a user escape hatch only.
- Bind no leader keys. OpenCode reserves `<leader>h/j/k/l` for session
  navigation, and `opencode-sidequest` uses others.
- Measure text with `width.mjs`. It must agree with OpenTUI, and
  `test/width.test.mjs` checks that against a real renderer.
- Every change to a pill or to layout needs a test that covers it at the widths
  it affects.
- RPC output never contains credentials, account ids, or raw provider responses.
- Use `.yaml`, not `.yml`. No em dashes in code, comments, or docs.
- Update `README.md` when a file is added or its role changes.

## Commands

```sh
npm install
npm test
npm run typecheck
prek run --all-files
```

Node 26.4 or newer is required for the OpenTUI render tests.
