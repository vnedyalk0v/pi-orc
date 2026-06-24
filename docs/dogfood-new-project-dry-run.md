# New Project Dry-Run Dogfood Report

## Summary

`pi-orc new-project --dry-run` was dogfooded against a clean temporary sandbox
intake for `vnedyalk0v/pi-orc-dogfood-sandbox-20260624`.

The dry-run completed successfully, produced a readable bootstrap plan, and did
not create the target GitHub repository. Dogfood found one small completeness
gap: rendered GitHub actions showed repeated `create-label` entries without
label names. The renderer now includes action details needed to verify labels,
issues, repositories, and projects from CLI output.

## Issue Tracking

- Issue: https://github.com/vnedyalk0v/pi-orc/issues/63
- Assignee: `vnedyalk0v`
- Status label: `status:in-progress`
- Project: `pi-orc`
- Project Status: `In Progress`
- Project fields: Priority `P0`, Type `test`, Area `repo-bootstrap`, Source
  `manual`

## Branch

`test/dogfood-new-project-dry-run`

## Dry-Run Scenario

Temporary sandbox:

```text
/tmp/pi-orc-dogfood.kM8WyI
```

Sandbox intake:

- project name: `Dogfood Sandbox App`
- repository owner: `vnedyalk0v`
- repository name: `pi-orc-dogfood-sandbox-20260624`
- visibility: `private`
- workflow mode: `assisted`
- stack profile: `typescript`
- docs skeleton: enabled
- GitHub Project planning: enabled
- initial commit and push planning: enabled

The CLI itself created no target files. The only files in the sandbox after the
run were the manually prepared intake JSON and captured dry-run output.

## Dry-Run Command

```sh
cd /tmp/pi-orc-dogfood.kM8WyI
node /Users/vnedyalk0v/Projects/Personal/pi-orc/dist/cli/pi-orc.js new-project --dry-run --intake /tmp/pi-orc-dogfood.kM8WyI/intake.json
```

Exit status: `0`

## Output Verification

The rendered plan included:

- repository: `vnedyalk0v/pi-orc-dogfood-sandbox-20260624`
- workflow mode: `assisted`
- planned directories: `.ai-workflow`, `.github/ISSUE_TEMPLATE`, `docs`,
  `docs/adr`, `docs/ai/verified-reports`
- planned files: target `AGENTS.md`, `.ai-workflow/config.yml`, issue
  templates, PR template, README, docs skeleton, `.gitignore`
- planned GitHub actions: repository creation, Project creation, label creation,
  initial issue creation
- planned git actions: init, add remote, stage, commit, push
- policy gates: write local files, create GitHub repository, create GitHub
  Project, edit repository settings, create issue, run local command, commit,
  push
- dry-run notice: `Dry run: no GitHub, git, or file mutations executed.`

## Template Verification

Template coverage matched the planned files:

- target `AGENTS.md` requires issue-scoped workflow, explicit merge approval,
  verified artifacts, and review-bot verification before action
- `.ai-workflow/config.yml` sets assisted workflow mode, GitHub Issues/PRs/CI as
  sources of truth, local-only run/cache/tmp paths, and verified reports path
- issue templates exist for bug, docs, task, and verified finding
- issue template config disables blank issues
- PR template includes related issue, verification, artifact policy, risk, and
  rollback sections
- docs skeleton includes architecture, implementation plan, MVP, PRD, ADR, and
  verified reports README

## External Mutation Check

Read-only GitHub checks before and after the dry-run both returned:

```text
GraphQL: Could not resolve to a Repository with the name 'vnedyalk0v/pi-orc-dogfood-sandbox-20260624'. (repository)
```

The target repository was not created. No npm publish, GitHub release, git tag,
repository setting change, PR creation, merge, or force push was performed.

## Problems Found

Before the fix, the dry-run output listed label planning as generic repeated
`create-label` entries. That made the required status lifecycle labels
impossible to verify from CLI output.

Fixed in `src/repo-bootstrap/BootstrapPlan.ts` by rendering details for each
planned GitHub action. Added a regression assertion in
`tests/bootstrap-plan.test.ts`.

## Files Changed

- `src/repo-bootstrap/BootstrapPlan.ts`
- `tests/bootstrap-plan.test.ts`
- `docs/dogfood-new-project-dry-run.md`

## Verification

Commands run:

```sh
npm ci
npm run build
npm test -- tests/bootstrap-plan.test.ts
node dist/cli/pi-orc.js --help
node dist/cli/pi-orc.js new-project --dry-run
node dist/cli/pi-orc.js new-project --dry-run --intake /tmp/pi-orc-dogfood.kM8WyI/intake.json
```

Final required verification run for this branch:

```sh
npm ci
npm run typecheck
npm run build
npm test
git diff --check
git diff --stat
```

## Commit / Push

Commit and push state is reported by the workflow agent after this verified
artifact is committed. No sandbox directory or raw dry-run output is intended
for commit.

## Scope Check

- Created and updated only Issue #63 and its Project item.
- Did not create a real target GitHub repository.
- Did not publish to npm.
- Did not create a GitHub release.
- Did not create a git tag.
- Did not change repository settings.
- Did not create a PR.
- Did not commit sandbox files or raw dry-run output.

## Final State

Dry-run dogfood passed after the renderer fix. Branch remains scoped to Issue
#63.
