# Releasing `whereq.cloud` (JS/TS → npm)

Publishing is automated with **[Changesets](https://github.com/changesets/changesets)**, mirroring
`whereq-react`. You describe each change with a *changeset*; CI opens a "Version Packages" PR that
bumps the version + CHANGELOG; merging that PR publishes to npm. npm creds live only in CI as the
`NPM_TOKEN` secret; provenance is attested via OIDC.

## Release a new version (the recurring steps)

1. **Make your code changes** on a branch or `main`.
2. **Add a changeset** describing the change and the bump type (patch / minor / major):
   ```bash
   pnpm changeset
   ```
   Pick `@whereq/cloud`, choose the bump, write a one-line summary. This writes a file under
   `.changeset/` — **commit it** with your change.
3. **Push to `main`** (or merge your PR). The **Release** workflow runs and, because a changeset is
   pending, opens/updates a **"Version Packages" PR** that applies the version bump + CHANGELOG.
4. **Review & merge the "Version Packages" PR.** On merge (no changesets left), the Release workflow
   runs `changeset publish` → **publishes to npm** and pushes the git tag + GitHub Release.
5. Verify at <https://www.npmjs.com/package/@whereq/cloud>:
   ```bash
   npm view @whereq/cloud version
   ```

`npm i @whereq/cloud@latest` then picks up the new version.

## Rules / gotchas

- **Every user-facing change needs a changeset** (step 2) — no changeset ⇒ no version bump ⇒ nothing
  publishes. For a quick release with no code change, `pnpm changeset` + pick `patch`.
- `pnpm/action-setup` reads **`"packageManager": "pnpm@…"`** from `package.json` — keep it set or CI
  fails at setup.
- `pnpm-lock.yaml` must be committed (CI uses `--frozen-lockfile`); run `pnpm install` after dep changes.
- Local green bar before pushing: `pnpm run verify` (typecheck + test + build).

## One-time setup (done once per repo — for reference)

- **npm token**: npmjs.com → create an **automation / granular access token** with publish rights for
  `whereq.cloud` (a granular token scoped to *this package* is least-privilege; a classic automation
  token also works account-wide).
- **GitHub secret**: repo → Settings → Secrets and variables → Actions → add **`NPM_TOKEN`**.
  Optionally add a `CHANGESETS_TOKEN` (PAT) so the auto-opened "Version Packages" PR triggers CI.
- `package.json` has `publishConfig: { access: "public", provenance: true }`; workflow has
  `id-token: write` for OIDC provenance.
- **First publish** (`0.1.0`, no changeset): once `NPM_TOKEN` exists, the Release workflow publishes
  the current version on the next push to `main` (or re-run the workflow).
