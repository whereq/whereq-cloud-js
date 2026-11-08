# Releasing `whereq.cloud` (JS/TS → npm)

Publishing is automated: **push a version tag `vX.Y.Z` and GitHub Actions publishes to npm
via Trusted Publishing (OIDC).** No tokens are stored anywhere. The script below wraps the
whole flow into one command.

## Release a new version (the recurring steps)

Use the script — it does all of the below and refuses to push a half-finished release:

```bash
./release.sh 0.7.0 "the geography endpoints"    # explicit version
./release.sh patch                              # or let it compute the bump
./release.sh minor --dry-run                    # preview: checks + green bar, pushes nothing
```

`release.sh` bumps the version in **`package.json`**, writes the `CHANGELOG.md` entry, runs
the green bar (typecheck → test → build), commits, pushes `main`, pushes the tag, watches the
Release workflow and verifies the version on npm. It stops before touching anything remote
if any precondition fails.

If you'd rather do it by hand, the steps are:

1. **Bump the version** in `package.json` → `"version": "X.Y.Z"`.
   (Keep it in sync with the tag you'll push — the tag is `v` + this version.)
2. **Write the CHANGELOG entry** for the new version under the title.
3. **Make sure the green bar passes locally**:
   ```bash
   pnpm run verify   # typecheck + test + build
   ```
4. **Commit to `main`** and push:
   ```bash
   git add -A && git commit -m "release: vX.Y.Z" && git push origin main
   ```
   (Pushing to `main` only runs CI — it does **not** publish.)
5. **Tag and push the tag** — this is what triggers the publish:
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
6. Watch **Actions → Release**. On success, verify at <https://www.npmjs.com/package/@whereq/cloud>:
   ```bash
   npm view @whereq/cloud version
   ```

That's it. `npm i @whereq/cloud@latest` picks up the new version within a minute or two.

> **The step people forget.** Pushing to `main` does not publish — only the **tag** does.
> A feature merged without a version bump and a tag sits on npm forever without anyone
> noticing, because CI stays green. That is why `release.sh` checks for an existing tag
> and an existing npm version *before* it touches anything.

## Rules / gotchas

- **Tag must match the version** in `package.json` (tag `v0.7.0` ⇒ version `0.7.0`). The
  `Release` workflow **fails fast** on a mismatch (`verify the tag matches the package
  version`) instead of uploading a stale version and having npm reject it as a duplicate.
- **Never re-use a version** — npm refuses to overwrite an existing version. Bump and re-tag.
- **Never hardcode the version in `src/index.ts`.** It used to be a literal, and the release
  tooling only bumped `package.json` — so the release PR went red on `keeps VERSION in step
  with the package version` and the release stalled with npm still on the old version.
  `VERSION` now reads `package.json`; if you see a string literal there, that is a bug.
- **`release.yml` is load-bearing.** npm's Trusted Publisher is registered against this
  repository *and this workflow filename*. Renaming the file breaks publishing until the
  npm side is updated. The git ref is not part of that match, so tag builds work.
- The release job runs the green bar (typecheck → test → build) before publishing, and
  publishes with the **npm CLI** (not pnpm) — npm's OIDC exchange needs npm ≥ 11.5.1.
- `pnpm/action-setup` reads **`"packageManager": "pnpm@…"`** from `package.json` — keep it set or CI
  fails at setup.
- `pnpm-lock.yaml` must be committed (CI uses `--frozen-lockfile`); run `pnpm install` after dep changes.
- Local green bar before pushing: `pnpm run verify` (typecheck + test + build).

## One-time setup (done once per repo — for reference / disaster recovery)

- **npm Trusted Publisher** — npmjs.com → `@whereq/cloud` → Settings → Publishing → Trusted
  Publisher → GitHub Actions:
  - Organization or user: `whereq` · Repository: `whereq-cloud-js`
  - Workflow filename: `release.yml` · Environment: leave empty
  - Allowed actions: `npm publish`
- No `NPM_TOKEN` secret is needed — the workflow authenticates via OIDC. The
  `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` line resolves to empty and is unused; publish
  authenticates via OIDC when no token is configured.
- `package.json` has `publishConfig: { access: "public", provenance: true }`; the workflow has
  `id-token: write` for OIDC provenance.
- **First publish** (`0.1.0`): the workflow publishes the version in `package.json` on the
  first `v*` tag push.
