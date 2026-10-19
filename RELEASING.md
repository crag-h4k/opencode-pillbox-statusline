# Releasing

How a pillbox version reaches npm. Version `0.1.0` is published. Release Please
creates GitHub releases; the npm trusted-publishing job is implemented but remains
disabled until setup is complete. No npm token exists in CI.

## Table of Contents

- [How a release flows](#how-a-release-flows)
- [One-time setup](#one-time-setup)
- [First release](#first-release)
- [Every later release](#every-later-release)
- [Token rotation](#token-rotation)

## How a release flows

```mermaid
flowchart LR
  A[Conventional commits on main] --> B[Release Please opens or updates the release PR]
  B --> C[Maintainer merges the release PR]
  C --> D[Tag vX.Y.Z and GitHub release]
  D --> E[ci.yaml publish job: npm stage publish over OIDC]
  E --> F[Maintainer approves the staged version with 2FA]
  F --> G[Version live on npm with provenance]
```

| Piece | Where |
| --- | --- |
| Release Please config and manifest | `.github/release-please/` |
| Release and publish jobs | `.github/workflows/ci.yaml` (`release-please`, `publish`) |
| Changelog | `CHANGELOG.md`, written by Release Please |

The publish job runs only when a release was just created and the repository
variable `NPM_TRUSTED_PUBLISHING` is `true`. It uses the GitHub environment
`npm`, installs from the lockfile without caches, builds the compiled terminal
half, runs the tests, and stages the package. npm generates provenance
automatically because the repository and the package are public.

## One-time setup

| Step | Done by |
| --- | --- |
| Make the repository public, so npm can generate provenance | GitHub settings |
| Give the shared fine-grained PAT `release_please_ci` access to this repository with Contents, Pull requests, and Issues read and write | GitHub account settings |
| Save it as the repository secret `RELEASE_PLEASE_CI`, so CI runs on release PRs | Repository settings |
| Optional: add protection rules to the `npm` environment, for example a required reviewer | Repository settings |

## First release

Version `0.1.0` was published from the `v0.1.0` tag after typechecking, tests,
tarball inspection, and an isolated OpenCode load check. This initial publication
used maintainer authentication and has no CI provenance.

The release manifest now records `0.1.0`. Subsequent version bumps follow
Conventional Commits. Keep `NPM_TRUSTED_PUBLISHING` unset until the following
setup is completed for the next release:

1. Configure trusted publishing right before the next release. A new trusted
   publisher expires unless it publishes within 2 days.

   ```sh
   npm trust github opencode-pillbox-statusline --repo crag-h4k/opencode-pillbox-statusline \
     --file ci.yaml --env npm --allow-staged-publish
   ```

2. On npmjs.com, set the package's publishing access to "Require two-factor
   authentication and disallow tokens".
3. Set the repository variable `NPM_TRUSTED_PUBLISHING` to `true`.

## Every later release

1. Merge the Release Please PR.
2. Wait for the `publish` job in the main-push CI run that creates the release.
3. Review the staged version with `npm stage list opencode-pillbox-statusline`
   or the Staged Packages tab on npmjs.com, then approve it with 2FA
   (`npm stage approve <stage-id>`).

## Token rotation

When the shared `release_please_ci` PAT expires or is revoked, Release Please
fails on main pushes. Create a replacement with the same selected repositories
and permissions, then update `RELEASE_PLEASE_CI` in every repository using it.
