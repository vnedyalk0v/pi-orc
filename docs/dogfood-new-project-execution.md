# New Project Execution Dogfood Report

## Summary

`pi-orc new-project --intake <file>` was dogfooded against a clean temporary
sandbox intake for `vnedyalk0v/pi-orc-dogfood-execution-20260625`.

The command exited successfully, wrote the planned local target repository
template files, and did not create a Git repository or GitHub repository.
GitHub repository, project, label, and issue actions were reported as
confirmation-gated. Commit and push actions were also reported as
confirmation-gated.

No product gaps were found during this dogfood pass.

## Issue Tracking

- Issue: https://github.com/vnedyalk0v/pi-orc/issues/77
- Assignee: `vnedyalk0v`
- Status label during execution: `status:in-progress`
- Project: `pi-orc`
- Project Status during execution: `In Progress`
- Project fields: Priority `P2`, Type `test`, Area `testing`, Source
  `planning`

## Branch

`test/issue-77-new-project-dogfood`

## Sandbox Scenario

Temporary sandbox:

```text
/tmp/pi-orc-exec-dogfood.Ag4S56
```

Sandbox intake:

- project name: `Dogfood Execution App`
- repository owner: `vnedyalk0v`
- repository name: `pi-orc-dogfood-execution-20260625`
- visibility: `private`
- workflow mode: `assisted`
- stack profile: `typescript`
- docs skeleton: enabled
- GitHub Project planning: enabled
- initial commit and push planning: enabled

## Command

```sh
cd /tmp/pi-orc-exec-dogfood.Ag4S56
node /Users/vnedyalk0v/Projects/Personal/pi-orc/dist/cli/pi-orc.js new-project --intake /tmp/pi-orc-exec-dogfood.Ag4S56/intake.json
```

Exit status: `0`

`stderr` was empty.

## Local File Verification

The command wrote the expected local target files:

- `.ai-workflow/README.md`
- `.ai-workflow/config.yml`
- `.github/ISSUE_TEMPLATE/bug.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/ISSUE_TEMPLATE/docs.yml`
- `.github/ISSUE_TEMPLATE/task.yml`
- `.github/ISSUE_TEMPLATE/verified-finding.yml`
- `.github/pull_request_template.md`
- `.gitignore`
- `AGENTS.md`
- `README.md`
- `docs/adr/ADR-0001-project-foundation.md`
- `docs/ai/verified-reports/README.md`
- `docs/architecture.md`
- `docs/implementation-plan.md`
- `docs/mvp.md`
- `docs/prd.md`

The sandbox also contained only local dogfood input/output files:
`intake.json`, `output.md`, and `stderr.txt`. These raw sandbox artifacts are
not committed.

No `.git` directory existed after execution.

## Gate Verification

The rendered output included:

- `write-local-files: allowed`
- `github create-repository: requires-confirmation`
- `github create-project: requires-confirmation`
- `github create-label: requires-confirmation`
- `github create-issue: requires-confirmation`
- `git commit: requires-confirmation`
- `git push: requires-confirmation`

The output also listed local git setup actions as planned actions, but the CLI
did not execute them. The sandbox check confirmed no `.git` directory was
created.

## External Mutation Check

Read-only GitHub checks before and after the execution both returned:

```text
GraphQL: Could not resolve to a Repository with the name 'vnedyalk0v/pi-orc-dogfood-execution-20260625'. (repository)
```

The target repository was not created. No GitHub Project, label, issue, npm
publish, GitHub release, git tag, repository setting change, PR creation,
merge, commit, or push was performed for the sandbox target.

## Problems Found

No gaps were found during this dogfood pass, so no follow-up issue was created.

## Files Changed

- `docs/dogfood-new-project-execution.md`

## Verification

Commands run:

```sh
npm ci
npm run typecheck
npm run build
npm test
node dist/cli/pi-orc.js new-project --intake /tmp/pi-orc-exec-dogfood.Ag4S56/intake.json
gh repo view vnedyalk0v/pi-orc-dogfood-execution-20260625 --json nameWithOwner,url
```

Final branch verification:

```sh
git diff --check
git diff --stat
```

## Scope Check

- Used only Issue #77 and its Project item.
- Did not create a real target GitHub repository.
- Did not create a target GitHub Project.
- Did not create target labels or issues.
- Did not initialize a target git repository.
- Did not create a target commit or push.
- Did not publish to npm.
- Did not create a GitHub release.
- Did not create a git tag.
- Did not change repository settings.
- Did not commit sandbox files or raw command output.

## Final State

Execution-mode dogfood passed. Branch remains scoped to Issue #77 until this
report is merged.
