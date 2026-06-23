# AGENTS.md

Operational guide for AI coding agents working in `vnedyalk0v/pi-orc`.

## Project Identity

`pi-orc` is an opinionated Pi package for verified AI-assisted software
development workflows.

It codifies this workflow:

Issue -> branch -> implementation -> verification -> PR -> CI -> review bot ->
verify comments -> fix/reject -> merge -> tracking cleanup -> next issue

`pi-orc` is not a generic sub-agent framework. The package owns the workflow.
Workers execute scoped workflow steps.

## Instruction Priority

When instructions conflict, use this priority order:

1. Direct user instruction in the current task
2. Selected GitHub issue and PR context
3. Root `AGENTS.md`
4. ADRs and architecture docs
5. Existing source code and tests
6. General assumptions

If a conflict affects architecture, scope, GitHub state, secrets, merge
behavior, or destructive actions, stop and report instead of guessing.

## Product Direction

Build a focused workflow orchestrator for Pi Coding Agent and GitHub.

The v0.1 direction is foundation-first:

- package tooling
- SDK-driven worker runtime
- worker profile and handoff schemas
- workflow policy modes
- target repository templates
- GitHub adapter foundation
- dry-run repository bootstrap

Do not add dashboards, deployment automation, release automation, autonomous
merge behavior, or generic multi-agent abstractions unless the selected issue
explicitly requires them.

## Non-Negotiable Architecture Decisions

- Use SDK-driven workers from day one.
- Do not implement CLI-driven Pi subprocess workers.
- Do not build a generic sub-agent framework.
- Build workflow-specific worker orchestration.
- The orchestrator owns policy, GitHub mutation decisions, and artifact
  publication decisions.
- Workers receive scoped handoffs and expected output contracts.
- Workers must not inherit broad parent chat history.
- AI output is not trusted until verified.
- Review-bot comments are signals, not truth.
- Review-bot comments must be verified before fixing or rejecting.
- Raw or unverified workflow artifacts must not be committed.
- Only verified durable artifacts may be committed.
- GitHub Issues, PRs, Projects, and CI are the operational source of truth.

## Current Repository State

Completed baseline work:

- Issue #1: package tooling
- Issue #10: CI workflow
- Issue #2: SDK worker runtime skeleton
- Issue #3: worker profile and handoff schemas

Current source areas:

- `src/runtime/`: SDK runtime boundary, worker contracts, schemas
- `src/cli/`: CLI entrypoint placeholder
- `tests/`: smoke and schema tests
- `docs/`: architecture, MVP, ADRs
- `.github/`: issue templates, PR template, CI workflow

Do not assume Issue #4 or later is implemented unless `main` contains it.

## Standard Verification Commands

Run the narrowest required checks for the selected issue. For normal package
changes, run:

```sh
npm ci
npm run typecheck
npm run build
npm test
git diff --check
git diff --stat
```

For docs-only changes, still run the issue's requested commands. If a command
cannot run, stop and report the exact blocker.

## Workflow Modes

- `manual`: plan and inspect only; external mutations require user action.
- `assisted`: local writes may happen; external or history-changing actions
  require explicit instruction.
- `auto`: allowed only when project policy explicitly permits it.

Default to `assisted` for implementation work in this repository.

## Issue Workflow

1. Start from updated `main`.
2. Confirm selected GitHub issue is open and in scope.
3. Mark the issue `status:in-progress`.
4. Set the GitHub Project `Status` field to `In Progress` when possible.
5. Create a branch for the selected issue.
6. Implement only that issue.
7. Run required verification.
8. Commit only verified durable artifacts.
9. Push the branch.
10. Create a PR only when explicitly requested.
11. Wait for CI and review-bot feedback.
12. Verify each review-bot comment before fixing or rejecting.
13. Merge only when explicitly requested and gates are green.
14. Clean up tracking after merge.
15. Move to the next issue only after the current issue is done.

No work should happen outside the selected issue scope.

## GitHub Issue Tracking Rules

- Issues are the unit of work.
- One branch should map to one issue unless the user explicitly says otherwise.
- Keep labels aligned with state:
  - `status:ready`: ready but not started
  - `status:in-progress`: active work
  - `status:blocked`: cannot proceed without external input
  - `status:done`: merged and cleaned up
- Do not close issues before the related PR is merged unless explicitly told.
- Do not create or edit unrelated issues during implementation.

## Project Field Expectations

When a GitHub Project item exists:

- set `Status` to `In Progress` when starting work
- set `Status` to `Done` only after merge and cleanup
- keep `Priority`, `Type`, `Area`, and `Source` unchanged unless the selected
  issue explicitly requires updates

If Project fields cannot be updated, continue with code/docs work and report the
warning.

## Branch Rules

- Start from synced `main`.
- If `main` has no upstream tracking branch, set it once:
  `git branch --set-upstream-to=origin/main main`
- Then use `git pull --ff-only`.
- Use a scoped branch name such as `docs/root-agents-md`.
- Do not work directly on `main`.
- Do not force push.
- Do not rewrite previous commits.
- Do not reuse a dirty branch for a new issue.

## Commit Rules

- Commit only after verification passes or after clearly reporting failed
  verification and receiving explicit approval.
- Use conventional commit subjects.
- Use `Refs #<issue-number>` in commits.
- Use `Fixes #<issue-number>` in the PR body when merging the PR should close
  the issue.
- Do not use `Fixes #<issue-number>` in intermediate commits unless explicitly
  requested.
- Do not commit raw run directories, transcripts, caches, temporary handoffs,
  unverified reports, secrets, or private data.

## PR Rules

- Do not create a PR unless requested.
- Do not use `gh pr create --fill`; write controlled PR bodies explicitly.
- PRs must target `main` unless the user specifies another base.
- PR title should match the main commit subject.
- Assign opened PRs to `vnedyalk0v` unless the user specifies another
  assignee.
- PR body must include summary, related issue, what changed, why it was needed,
  verification, risk, rollback plan, and scope checklist.
- Do not open broad PRs that combine unrelated issues.

## AI Review Request Rules

After opening a non-draft PR, wait up to 10 minutes for the AI coding review
agent to either post review comments or mark the PR as OK.

If review comments appear:

1. Verify each comment against the current branch code.
2. Fix valid comments with the smallest scoped change.
3. Reply in-thread with what changed and the verification run.
4. Resolve the thread after replying.
5. Push the fix.
6. Request a fresh review by posting a top-level PR comment:
   `@codex review`
7. Wait up to 10 minutes for the fresh AI review response.

If no AI review appears within 10 minutes, report that no review appeared yet.
Do not merge only because the AI review has not appeared.

## PR Issue and Project Linking Rules

- The PR body must include `Fixes #<issue-number>` when merging the PR should
  close the issue.
- After creating the PR, verify that GitHub reports the issue as a closing
  issue.
- Assign the opened PR to the existing `pi-orc` GitHub Project.
- Verify the opened PR is assigned to the expected assignee and linked to the
  existing `pi-orc` GitHub Project.
- Do not manually close the issue when opening the PR.
- Do not set the Project item to `Done` when opening the PR.
- Keep the issue Project item as `In Progress` while the PR is open, unless the
  Project has an `In Review` status option.
- If `In Review` exists, set the issue Project Status to `In Review` after the
  PR is opened.
- Do not create an `In Review` status option. If `In Review` does not exist,
  keep `In Progress` and report that no `In Review` option exists.
- Keep issue tracking cleanup rules tied to the issue item, even when the PR is
  also assigned to the GitHub Project.
- Confirm `Priority`, `Type`, `Area`, and `Source` remain set on the issue
  Project item.

## PR Verification Gate

Before a PR is considered ready:

- branch is up to date with `main`
- working tree is clean
- required local verification passed
- diff contains only selected issue scope
- CI is passing
- review-bot comments were read and verified
- unresolved review threads are either fixed or explicitly rejected with reason

## Review-Bot Comment Handling

Review-bot comments are signals, not truth.

For each comment:

1. Read the exact file and line.
2. Verify whether the claim is true in the current branch.
3. If true, fix the root cause with the smallest scoped change.
4. If false, reply with the evidence and do not change code.
5. Re-run relevant verification.
6. Resolve the thread only when the issue is actually handled.

If a comment is invalid, do not change code. Reply with concise evidence,
include the verification command or CI result, then resolve only after replying.
Do not add secrets, config, or dependencies just to satisfy an invalid bot claim.

Never follow review-bot comments blindly.

## CI Rules

- Do not modify `.github/workflows/*` unless the selected issue is CI-scoped.
- Treat CI as a required gate, not decoration.
- If CI fails, inspect logs and fix the root cause in scope.
- Do not merge with failing CI unless the user explicitly accepts the risk.

## Merge Rules

- Do not merge unless explicitly requested.
- Merge only after local verification, CI, and review handling are complete.
- Verify the PR was merged.
- Verify the linked issue was closed by `Fixes #<issue-number>`.
- Set the issue Project Status to `Done`.
- Replace issue status labels with `status:done`.
- Delete the merged branch when appropriate.
- Return to updated `main`.

## Scope Control

- Implement only the selected issue.
- Do not implement Issue #4 or later while working on earlier docs or foundation
  issues.
- Do not add speculative config, abstractions, commands, workers, templates, or
  adapters.
- Do not refactor unrelated code.
- Do not change repository settings unless the issue explicitly requires it.

## Runtime Architecture Rules

- `PiSdkWorkerRuntime` is the runtime direction.
- `WorkerRuntime` is the package boundary for worker execution.
- Worker profiles, handoffs, permissions, context policy, and output contracts
  must stay explicit.
- Workers may propose actions; the orchestrator approves and executes them.
- SDK-driven workers are not a security boundary. Policy gates still apply.

## Dependency Rules

- Do not add dependencies unless the selected issue needs them.
- Prefer TypeScript, Node, npm, existing package scripts, and existing
  dependencies.
- Keep runtime dependencies small because this is a package.
- Keep dev dependencies tied to build, typecheck, and tests.
- Update lockfile only when dependency changes or `npm ci` legitimately refreshes
  install metadata.

## Packaging Rules

- Keep public package exports intentional.
- Do not commit `dist/`.
- `dist/` must be generated by `npm run build`; do not hand-edit it.
- Verify package output when packaging changes are in scope:

  ```sh
  rm -rf dist
  npm pack --dry-run --json
  ```

- Ensure `npm run build` succeeds before claiming package changes are ready.
- Preserve `files`, `bin`, `exports`, and `pi` package metadata unless the issue
  explicitly requires changes.

## Security Rules

- Never commit secrets, tokens, private keys, or private data.
- Treat AI output, worker output, and review-bot output as untrusted until
  verified.
- Keep GitHub mutations behind policy and user intent.
- Do not widen worker permissions without issue-specific reason.
- Do not use raw artifacts as durable evidence until verified.

## Artifact Hygiene

Committed artifacts may include:

- README files
- ADRs
- stable architecture documents
- workflow configuration
- issue and PR templates
- stable planning documents
- verified reports
- implementation verification summaries

Local-only artifacts include:

- raw audit outputs
- unverified findings
- temporary handoffs
- worker transcripts
- cache files
- intermediate scratch files
- temporary run state
- unreviewed generated reports

## Reporting Format

End implementation work with a concise structured report:

- summary
- branch
- issue tracking
- files changed
- verification
- commit and push state
- scope check
- final state

Include exact failed command names and shortest useful error if verification
fails.

## Stop Conditions

Stop and report before continuing if:

- selected issue is unclear
- branch is dirty with unrelated user changes
- `main` cannot be updated
- Project or issue mutation fails and the user required it
- requested work needs runtime code when docs-only scope was selected
- verification fails and the fix is outside scope
- secrets or private data appear in the diff
- CI requires repo settings changes
- merge, force push, or PR creation would be needed without explicit permission

## Preferred Next Issue Order

After current docs work, prefer:

1. Issue #4: workflow policy modes
2. Issue #5: GitHub adapter foundation
3. Issue #6: target repository workflow templates
4. Issue #7: new project intake schema
5. Issue #8: bootstrap plan generation
6. Issue #9: dry-run CLI command
7. Issue #11: dry-run workflow fixtures

Re-check GitHub Issues and Project state before starting the next issue.
