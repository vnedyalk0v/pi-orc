# v0.1.0 Release Checklist

Issue: #65
Date: 2026-06-24

## Release Goal

Prepare `pi-orc` for a deliberate v0.1.0 release after the foundation workflow
is complete.

This checklist is release-readiness documentation only. It does not publish to
npm, create a GitHub release, create a git tag, or change runtime behavior.

## Current Version

- `package.json` version: `0.1.0`
- npm package name: `pi-orc`
- npm registry state: package not found on the public npm registry
- GitHub releases: none
- Git tags on `origin`: none

## Release Status

No v0.1.0 release has been created yet.

Current readiness state:

- package metadata is present and packable
- CI is configured and latest `main` CI passed
- package installability was verified in `docs/package-installability.md`
- Pi resource discovery was verified in `docs/package-installability.md`
- dogfood dry-run was verified in `docs/dogfood-new-project-dry-run.md`
- license remains undecided
- branch protection is documented but not applied

## Required Blockers Before Release

- Choose a license.
- Add matching `LICENSE` or `LICENSE.md`.
- Add `package.json` `license` metadata when a license is selected.
- Update the README license section from `TBD`.
- Decide whether v0.1.0 should be published to npm or only released on GitHub.
- Re-run all verification commands after final release-readiness changes.
- Confirm `main` branch protection or explicitly accept releasing without it.

## Optional Warnings

- `pi` manifest is intentionally `{}` because v0.1 ships no Pi resources.
- No changelog exists yet; GitHub release notes may be enough for v0.1.
- Branch protection plan exists in `docs/main-branch-protection-plan.md`, but
  repository rulesets are currently empty.
- Public npm package `pi-orc` does not exist yet, so first publish will claim the
  package name.

## Verification Commands

Run from a clean `main` checkout before any future release action:

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

Release must not proceed if any command fails.

## Package Output Checklist

Before release, `npm pack --dry-run --json` must show expected package contents:

- `package/dist/index.js`
- `package/dist/index.d.ts`
- `package/dist/cli/pi-orc.js`
- `package/templates/`
- `package/README.md`
- `package/docs/`
- `package/package.json`

It must not include:

- `package/src/`
- `package/tests/`
- `.ai-workflow/runs`
- `.ai-workflow/cache`
- `.ai-workflow/tmp`
- local tarballs
- raw audit output or worker transcripts

## Pi Installability Checklist

Use `docs/package-installability.md` as baseline evidence, then re-check after
any final release change:

```sh
npm pack --json
tmp=$(mktemp -d)
mkdir -p "$tmp/pkg" "$tmp/project" "$tmp/agent"
tar -xzf pi-orc-0.1.0.tgz -C "$tmp/pkg"
cd "$tmp/project"
npm init -y
npm install /path/to/pi-orc/pi-orc-0.1.0.tgz
./node_modules/.bin/pi-orc --help
node --input-type=module -e "import('pi-orc').then(m => console.log(JSON.stringify(m.packageInfo)))"
PI_CODING_AGENT_DIR="$tmp/agent" PI_OFFLINE=1 /path/to/pi-orc/node_modules/.bin/pi install -l "$tmp/pkg/package"
PI_CODING_AGENT_DIR="$tmp/agent" PI_OFFLINE=1 /path/to/pi-orc/node_modules/.bin/pi list --approve
```

Expected result:

- installed `pi-orc` binary prints help
- `import('pi-orc')` works
- Pi local install succeeds
- Pi approved package list shows the local package
- Pi resource discovery reports no resources until intentional resources exist

## Dogfood Checklist

Use `docs/dogfood-new-project-dry-run.md` as baseline evidence, then re-run a
dry-run scenario after final release changes:

```sh
npm run build
node dist/cli/pi-orc.js new-project --dry-run
node dist/cli/pi-orc.js new-project --dry-run --intake path/to/intake.json
```

Expected result:

- command exits `0`
- output includes repository, workflow mode, planned files, planned GitHub
  actions, planned git actions, and policy gates
- output includes `Dry run: no GitHub, git, or file mutations executed.`
- no target GitHub repository is created
- no target files are written by the dry-run command

## License Checklist

Current state:

- README license section says `TBD`
- no `license` field exists in `package.json`
- no `LICENSE` or `LICENSE.md` file exists
- `docs/license-decision.md` records the required owner decision

Before release:

- choose one license
- add the license file
- update README license text
- add package license metadata when appropriate
- re-run package verification

## CI/Branch Protection Checklist

Current state:

- CI workflow: `.github/workflows/ci.yml`
- CI job name: `verify`
- latest `main` CI run: success
- default branch: `main`
- repository rulesets: none
- classic branch protection: not enabled

Before release:

- confirm latest `main` CI is green
- decide whether to apply `docs/main-branch-protection-plan.md`
- if branch protection is applied, require check context `verify`
- if branch protection is not applied, record that as an explicit accepted risk

## Future Release Steps

Run only after blockers are resolved and release approval is explicit:

```sh
git switch main
git pull --ff-only
npm ci
npm run typecheck
npm run build
npm test
rm -rf dist
npm pack --dry-run --json
```

If the release will be npm-published:

```sh
npm publish --access public
```

If the release will be GitHub-released:

```sh
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
gh release create v0.1.0 --title "v0.1.0" --notes-file path/to/release-notes.md
```

If version `0.1.0` must change before release, get explicit approval before any
version bump.

## Rollback Plan

If verification fails before publishing:

- do not tag
- do not publish
- do not create a GitHub release
- fix the blocker in a scoped issue and PR

If a git tag is created incorrectly in a future release task:

```sh
git tag -d v0.1.0
git push origin :refs/tags/v0.1.0
```

If a GitHub release is created incorrectly in a future release task:

```sh
gh release delete v0.1.0
```

If npm publish succeeds with a bad package, do not unpublish without owner
approval. Prefer a corrective patch release unless npm policy and owner
approval both allow unpublish.

## Publish Decision

No publish decision has been made yet.

Valid future outcomes:

- GitHub release only, no npm publish
- npm publish plus GitHub release
- no release until license and branch-protection risks are resolved

Current task performed none of those release actions.
