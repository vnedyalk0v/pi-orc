# v0.1.0 Final Release Readiness Audit

Issue: #70
Date: 2026-06-24

## Summary

READY WITH WARNINGS

`pi-orc` is ready for v0.1.0 release after this audit branch is reviewed,
merged, and Issue #70 is closed. The package metadata, license, CI, install
verification, dogfood dry-run verification, package output, and main protection
ruleset all support release readiness.

The remaining warnings are operational: this audit issue is still open while the
audit branch is unmerged, no changelog exists, and first npm publish will claim
the public `pi-orc` package name.

## Repository State

- Repository: `vnedyalk0v/pi-orc`
- Default branch: `main`
- Starting branch: `main`
- Audit branch: `chore/final-v0-1-release-readiness`
- Latest `main` commit: `0037f25a32ff013d2a2f18a1977b8df217028c67`
- Latest `main` subject: `docs(repo): add Apache-2.0 license metadata`
- Working tree before docs edits: clean
- Open issues: one, Issue #70 for this final audit
- Open PRs: none
- Latest `main` CI run: success
- GitHub releases: none
- Local tags: none
- Remote tags: none
- npm registry package state: `pi-orc` not found on the public npm registry

Commands:

```sh
git checkout main
git pull --ff-only
git status --short
git log --oneline --decorate --max-count=10
gh issue list --state open --limit 100
gh pr list --state open --limit 100
gh run list --limit 10
gh release list
git tag --list
git ls-remote --tags origin
npm view pi-orc version --json
```

Results:

- `git pull --ff-only`: `Already up to date.`
- `git status --short`: no output
- `gh issue list --state open --limit 100`: only Issue #70 open
- `gh pr list --state open --limit 100`: no output
- `gh run list --limit 10`: latest `main` CI run completed with success
- `gh release list`: no output
- `git tag --list`: no output
- `git ls-remote --tags origin`: no output
- `npm view pi-orc version --json`: `E404 Not Found`

## Package Metadata

- `name`: `pi-orc`
- `version`: `0.1.0`
- `license`: `Apache-2.0`
- `main`: `./dist/index.js`
- `types`: `./dist/index.d.ts`
- `bin`: `pi-orc` -> `./dist/cli/pi-orc.js`
- `exports`: root import and root types point at `dist/index.*`
- `files`: `dist/`, `templates/`, `README.md`, `docs/`
- `pi`: `{}`
- Runtime dependencies: `zod`
- Peer dependency: `@earendil-works/pi-coding-agent` `0.79.x`

Commands:

```sh
cat package.json
node -p "require('./package.json').version"
node -p "require('./package.json').license"
node -p "require('./package.json').name"
```

Results:

- `node -p "require('./package.json').version"`: `0.1.0`
- `node -p "require('./package.json').license"`: `Apache-2.0`
- `node -p "require('./package.json').name"`: `pi-orc`

## License Readiness

- `LICENSE` is present and contains the Apache License, Version 2.0 text.
- `docs/license-decision.md` records Apache-2.0 as selected on 2026-06-24.
- `package.json` declares `"license": "Apache-2.0"`.
- `README.md` license section says Apache-2.0.
- `README.md` no longer says license TBD.
- `docs/release-checklist-v0.1.0.md` reflects the resolved license blocker.

Commands:

```sh
rg -n "Apache|TBD|license|License" LICENSE README.md docs/license-decision.md docs/release-checklist-v0.1.0.md
ls -l LICENSE README.md docs/license-decision.md docs/release-checklist-v0.1.0.md
```

Result: pass.

## Verification Results

Commands run after this audit document and checklist update were created:

```sh
npm ci
npm run typecheck
npm run build
npm test
rm -rf dist
npm pack --dry-run --json
git diff --check
git diff --stat
```

Results:

- `npm ci`: pass; 192 packages added/audited, 0 vulnerabilities; warning:
  `node-domexception@1.0.0` is deprecated.
- `npm run typecheck`: pass.
- `npm run build`: pass.
- `npm test`: pass; 7 test files passed, 40 tests passed.
- `rm -rf dist`: pass; no output.
- `npm pack --dry-run --json`: pass; `prepack` rebuilt `dist`; package
  output contained 60 entries including this audit document.
- `git diff --check`: pass; no output.
- `git diff --stat`: pass; docs-only diff.

## Package Output

`npm pack --dry-run --json` rebuilt `dist` through `prepack` and verified the
package output.

Confirmed included:

- `package/dist/index.js`
- `package/dist/index.d.ts`
- `package/dist/cli/pi-orc.js`
- `package/templates/`
- `package/docs/`
- `package/README.md`
- `package/LICENSE`
- `package/package.json`

Confirmed excluded:

- `package/src/`
- `package/tests/`
- `.ai-workflow/runs`
- `.ai-workflow/cache`
- `.ai-workflow/tmp`
- local tarballs
- raw run output
- worker transcripts

## Pi Package Installability

`docs/package-installability.md` supports v0.1.0 readiness.

It verified:

- package metadata matches the current package surface
- `npm pack --dry-run --json` passes
- built CLI help runs
- local npm tarball install works in a clean temporary project
- `import('pi-orc')` works
- Pi local package install works with `pi install -l`
- Pi package listing works after approval
- empty `pi` manifest is intentional for v0.1.0

No package metadata change is needed for installability.

## Dogfood Dry-Run

`docs/dogfood-new-project-dry-run.md` supports v0.1.0 readiness.

It verified:

- `pi-orc new-project --dry-run` exits `0`
- dry-run output includes repository, workflow mode, planned files, GitHub
  actions, git actions, and policy gates
- dry-run output states no GitHub, git, or file mutations were executed
- target GitHub repository was not created
- the label-rendering gap found during dogfood was fixed and tested

## Main Protection Ruleset

Live GitHub state confirms the main protection ruleset is active.

Commands:

```sh
REPO_FULL="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
OWNER="${REPO_FULL%/*}"
REPO="${REPO_FULL#*/}"

gh api "repos/$OWNER/$REPO/rulesets" --jq '.[] | {id,name,target,enforcement,source_type}'

RULESET_ID="$(
  gh api "repos/$OWNER/$REPO/rulesets" \
    --jq '.[] | select(.name == "pi-orc main protection") | .id' \
    | head -n 1
)"

echo "RULESET_ID=$RULESET_ID"

gh api "repos/$OWNER/$REPO/rulesets/$RULESET_ID"
gh api "repos/$OWNER/$REPO/rules/branches/main"
gh api repos/vnedyalk0v/pi-orc/branches/main --jq '{name, protected, commit_sha: .commit.sha}'
```

Results:

- Ruleset ID: `18080562`
- Ruleset name: `pi-orc main protection`
- Enforcement: `active`
- Target: `branch`
- Source type: `Repository`
- Condition include: `~DEFAULT_BRANCH`
- Branch `main` protected: `true`
- Required status check context: `verify`
- Strict required status check policy: `true`
- Pull request rule exists
- Required approving review count: `0`
- Required review thread resolution: `true`
- Allowed merge method: `squash`
- Non-fast-forward rule exists
- Deletion rule exists
- Bypass actors: `[]`
- Current user bypass: `never`

## Release Blockers

No product, package, license, CI, ruleset, or installability blocker remains.

Operational blocker before release action:

- Merge this audit branch and close Issue #70 so the repository has no open
  release-readiness issues.

## Accepted Warnings

- First npm publish will claim the public `pi-orc` package name.
- No changelog exists; GitHub release notes are acceptable for v0.1.0.
- `pi` manifest is intentionally `{}` because v0.1.0 ships no Pi resources.

## Not Performed

- No npm publish performed.
- No GitHub release created.
- No git tag created.
- No version bump performed.
- No runtime code changed.
- No CI workflow changed.
- No repository settings changed.
- No ruleset modified.

## Recommended Release Action

Publish to npm and create a GitHub release after:

1. this audit branch is merged,
2. Issue #70 is closed,
3. latest `main` CI is green, and
4. the owner explicitly approves the release action.

Do not release yet while this audit branch remains unmerged.
