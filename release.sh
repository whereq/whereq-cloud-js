#!/usr/bin/env bash
#
# release.sh — publish @whereq/cloud to npm.
#
# This wraps the manual runbook in RELEASING.md into a single command:
#
#     ./release.sh 0.6.1 "the geography endpoints"
#     ./release.sh patch
#     ./release.sh minor --dry-run
#
# It bumps the version in package.json, writes the CHANGELOG entry, runs the
# green bar, commits, pushes main, pushes the tag (the tag is what actually
# triggers the Release workflow), watches that run, and verifies the version
# on npm.
#
# The exported VERSION reads package.json, so there is exactly one version to
# keep in sync — bump it here and the SDK follows.
#
# Nothing is pushed until every check below has passed.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

PACKAGE="@whereq/cloud"
PACKAGE_ENCODED="@whereq%2Fcloud"
PACKAGE_JSON="package.json"
CHANGELOG="CHANGELOG.md"
BRANCH="main"
REGISTRY="https://registry.npmjs.org"
POLL_ATTEMPTS="${POLL_ATTEMPTS:-30}"

DRY_RUN=0
SUMMARY=""
VERSION=""
COMMITTED=0

die()  { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m  ok\033[0m %s\n' "$*"; }

# A release that fails must not leave the tree claiming a version that was
# never published — put the version bump back if we die before the commit.
cleanup() {
  local rc=$?
  if [ "$rc" -ne 0 ] && [ "$COMMITTED" -eq 0 ]; then
    git checkout -- "$PACKAGE_JSON" "$CHANGELOG" 2>/dev/null || true
    printf '\033[33m!!\033[0m the release failed — the version bump was reverted\n' >&2
  fi
  exit $rc
}
trap cleanup EXIT

usage() {
  cat <<'USAGE'
usage: ./release.sh [version|bump] [summary] [--dry-run]

  version    explicit version, e.g. 0.6.1 (no "v" prefix)
  bump       patch | minor | major — computed from the current version
  summary    optional one-liner for the CHANGELOG entry and the commit message
  --dry-run  run every check and the green bar, print the plan, push nothing

examples:
  ./release.sh 0.6.1 "the geography endpoints"
  ./release.sh patch
  ./release.sh minor --dry-run
USAGE
}

# ---------------------------------------------------------------- arguments --

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run|-n) DRY_RUN=1; shift ;;
    --help|-h)   usage; exit 0 ;;
    --)          shift; break ;;
    -*)          die "unknown option: $1 (try --help)" ;;
    *)
      if [ -z "$VERSION" ]; then
        VERSION="$1"
      elif [ -z "$SUMMARY" ]; then
        SUMMARY="$1"
      else
        die "too many arguments"
      fi
      shift ;;
  esac
done

if [ -z "$VERSION" ]; then
  usage
  die "a version (or patch|minor|major) is required"
fi

# ------------------------------------------------------------------ helpers --

have() { command -v "$1" >/dev/null 2>&1; }

current_version() {
  node -p "require('./$PACKAGE_JSON').version"
}

compute_bump() {
  node -e '
    const [kind, cur] = process.argv.slice(1);
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(cur);
    if (!m) { console.error(`cannot bump non-semver version ${cur}`); process.exit(1); }
    const [major, minor, patch] = m.slice(1).map(Number);
    if (kind === "major") console.log(`${major + 1}.0.0`);
    else if (kind === "minor") console.log(`${major}.${minor + 1}.0`);
    else if (kind === "patch") console.log(`${major}.${minor}.${patch + 1}`);
    else { console.error(`unknown bump ${kind} (use patch, minor or major)`); process.exit(1); }
  ' "$1" "$2"
}

# Which kind of bump is this? Used for the CHANGELOG heading.
bump_kind() {
  node -e '
    const [cur, next] = process.argv.slice(1);
    const c = cur.split(".").map(Number);
    const n = next.split(".").map(Number);
    if (n[0] !== c[0]) console.log("major");
    else if (n[1] !== c[1]) console.log("minor");
    else console.log("patch");
  ' "$1" "$2"
}

# Does the tag exist locally or on the remote?
tag_exists() {
  git rev-parse -q --verify "refs/tags/$1" >/dev/null 2>&1 && return 0
  git ls-remote --exit-code --tags origin "refs/tags/$1" >/dev/null 2>&1 && return 0
  return 1
}

# Is the version already on npm? 0 = yes, 1 = no, 2 = could not tell.
npm_has_version() {
  curl -sS -m 30 "$REGISTRY/$PACKAGE_ENCODED" \
    | node -e '
      let buf = "";
      process.stdin.on("data", (d) => (buf += d));
      process.stdin.on("end", () => {
        let data;
        try { data = JSON.parse(buf); } catch { process.exit(2); }
        process.exit(data.versions && data.versions[process.argv[1]] ? 0 : 1);
      });
    ' "$1"
}

# Write the version into package.json — the single place the version lives.
write_version() {
  node -e '
    const fs = require("fs");
    const [file, version] = process.argv.slice(1);
    const raw = fs.readFileSync(file, "utf8");
    const next = raw.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${version}"`);
    if (next === raw) { console.error(`could not find the version field in ${file}`); process.exit(1); }
    fs.writeFileSync(file, next);
  ' "$PACKAGE_JSON" "$VERSION"
}

# Insert the new CHANGELOG section right under the title.
write_changelog() {
  node -e '
    const fs = require("fs");
    const [file, version, heading, summary] = process.argv.slice(1);
    const raw = fs.readFileSync(file, "utf8");
    const title = /^# .*\n/.exec(raw);
    if (!title) { console.error(`could not find the title line in ${file}`); process.exit(1); }
    const body = summary
      ? summary.split("\n").map((line, i) => (i === 0 ? `- ${line}` : (line ? `  ${line}` : ""))).join("\n")
      : "- (no summary given)";
    const section = `\n## ${version}\n\n### ${heading.charAt(0).toUpperCase() + heading.slice(1)} Changes\n\n${body}\n`;
    const next = raw.slice(0, title[0].length) + section + raw.slice(title[0].length);
    fs.writeFileSync(file, next);
  ' "$CHANGELOG" "$VERSION" "$1" "$SUMMARY"
}

# The green bar — the same checks CI runs on every push.
run_verify() {
  pnpm install --frozen-lockfile
  pnpm run verify
}

# --------------------------------------------------------------- preflight --

for dep in git node pnpm npm curl gh; do
  have "$dep" || die "$dep is required but was not found on PATH"
done

git rev-parse --git-dir >/dev/null 2>&1 || die "not a git repository"

CURRENT="$(current_version)"
info "current version: $CURRENT"

case "$VERSION" in
  patch|minor|major) VERSION="$(compute_bump "$VERSION" "$CURRENT")" ;;
esac

if ! printf '%s' "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  die "invalid version '$VERSION' (expected MAJOR.MINOR.PATCH)"
fi

if [ "$VERSION" = "$CURRENT" ]; then
  die "version $VERSION is already the current version — nothing to release"
fi

# A release must move forward. npm refuses to publish over an old version
# anyway, but catching it here saves a pointless commit and tag.
if [ "$(printf '%s\n%s\n' "$CURRENT" "$VERSION" | sort -V | head -n 1)" != "$CURRENT" ]; then
  die "version $VERSION is not newer than the current version $CURRENT"
fi

if [ "$(git rev-parse --abbrev-ref HEAD)" != "$BRANCH" ]; then
  die "must be on the '$BRANCH' branch (currently on $(git rev-parse --abbrev-ref HEAD))"
fi

if [ -n "$(git status --porcelain)" ]; then
  die "the working tree is not clean — commit or stash first"
fi

info "checking the remote is in sync"
git fetch --quiet origin --tags
if [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$BRANCH")" ]; then
  AHEAD="$(git rev-list --count "origin/$BRANCH..HEAD")"
  BEHIND="$(git rev-list --count "HEAD..origin/$BRANCH")"
  if [ "$BEHIND" -gt 0 ]; then
    die "origin/$BRANCH has $BEHIND commit(s) you don't have — pull first"
  fi
  die "you have $AHEAD unpushed commit(s) — push them first"
fi

if tag_exists "v$VERSION"; then
  die "tag v$VERSION already exists"
fi

info "checking npm for $PACKAGE $VERSION"
set +e
npm_has_version "$VERSION"
NPM_RC=$?
set -e
case "$NPM_RC" in
  0) die "$PACKAGE $VERSION is already on npm — pick a new version" ;;
  2) die "could not reach npm to check the version" ;;
  *) ok "$PACKAGE $VERSION is not on npm yet" ;;
esac

gh auth status >/dev/null 2>&1 || die "gh is not authenticated (run: gh auth login)"

# ------------------------------------------------------------------- bump ---

info "bumping $CURRENT -> $VERSION"
write_version
write_changelog "$(bump_kind "$CURRENT" "$VERSION")"

git --no-pager diff -- "$PACKAGE_JSON" "$CHANGELOG"

# ------------------------------------------------------------------ tests ---

info "running the green bar (typecheck, test, build)"
run_verify
ok "green bar passed"

# ----------------------------------------------------------------- commit ---

if [ "$DRY_RUN" -eq 1 ]; then
  echo
  info "dry run — nothing was committed or pushed. Planned steps:"
  printf '  1. commit   release: v%s\n' "$VERSION"
  printf '  2. push     origin %s\n' "$BRANCH"
  printf '  3. tag      v%s\n' "$VERSION"
  printf '  4. push     origin v%s   (triggers the Release workflow)\n' "$VERSION"
  printf '  5. watch    the Release run, then verify %s %s on npm\n' "$PACKAGE" "$VERSION"
  echo
  git checkout -- "$PACKAGE_JSON" "$CHANGELOG"
  ok "reverted the version bump; the tree is clean again"
  exit 0
fi

if [ -n "$SUMMARY" ]; then
  COMMIT_MSG="release: v$VERSION — $SUMMARY"
else
  COMMIT_MSG="release: v$VERSION"
fi

info "committing"
git add "$PACKAGE_JSON" "$CHANGELOG"
git commit -m "$COMMIT_MSG"
COMMITTED=1
ok "$(git rev-parse --short HEAD) $COMMIT_MSG"

info "pushing $BRANCH"
git push origin "$BRANCH"
ok "origin/$BRANCH updated"

# -------------------------------------------------------------------- tag ---

info "tagging v$VERSION"
git tag "v$VERSION"
git push origin "v$VERSION"
ok "tag v$VERSION pushed — the Release workflow is on its way"

# --------------------------------------------------------------- watch/verify --

RELEASE_SHA="$(git rev-parse HEAD)"

info "waiting for the Release workflow"
RUN_ID=""
for _ in $(seq 1 "$POLL_ATTEMPTS"); do
  # Tolerate a transient gh failure here: the tag is already pushed, so
  # aborting now would leave the release un-watched rather than unfinished.
  RUN_ID="$( { gh run list --workflow release.yml --limit 10 \
      --json databaseId,headBranch,headSha \
      --jq ".[] | select(.headBranch == \"v$VERSION\" or .headSha == \"$RELEASE_SHA\") | .databaseId" 2>/dev/null || true; } | head -n 1 )"
  [ -n "$RUN_ID" ] && break
  sleep 3
done
[ -n "$RUN_ID" ] || die "the Release workflow for v$VERSION never appeared"

info "watching run $RUN_ID"
gh run watch "$RUN_ID" --exit-status
ok "Release workflow succeeded"

info "verifying $PACKAGE $VERSION on npm"
for _ in $(seq 1 20); do
  set +e
  npm_has_version "$VERSION"
  RC=$?
  set -e
  [ "$RC" -eq 0 ] && break
  [ "$RC" -eq 2 ] && die "could not reach npm to verify the release"
  sleep 10
done
set +e
npm_has_version "$VERSION"
RC=$?
set -e
[ "$RC" -eq 0 ] || die "$PACKAGE $VERSION is still not on npm"

ok "$PACKAGE $VERSION is live on npm"
info "https://www.npmjs.com/package/$PACKAGE"
