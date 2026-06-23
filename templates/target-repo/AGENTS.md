# AGENTS.md

Operational guide for AI coding agents working in this repository.

## Workflow

Use issues as the unit of work:

Issue -> branch -> implementation -> verification -> PR -> CI -> review -> merge

Start from the default branch, keep each branch scoped to one issue, and do not
merge without explicit approval.

## Artifact Policy

AI output is untrusted until verified.

Commit only durable, verified artifacts:

- README files
- ADRs and architecture docs
- stable planning docs
- verified reports
- implementation verification summaries
- issue and PR templates

Do not commit raw or unverified workflow artifacts:

- raw audit outputs
- temporary handoffs
- worker transcripts
- cache files
- scratch files
- unreviewed generated reports

Local workflow state belongs under `.ai-workflow/runs/`, `.ai-workflow/cache/`,
or `.ai-workflow/tmp/`.

Verified reports may be committed under `docs/ai/verified-reports/`.

## Review Policy

Review-bot comments are signals, not truth. Verify each claim against current
code before fixing or rejecting it.

## Verification

Run the narrowest check that proves the change. If verification cannot run,
report the exact command and blocker.
