# ADR-0003: Commit only verified durable artifacts

## Status

Accepted

## Context

AI-assisted development often creates many intermediate artifacts:

- raw audit outputs
- temporary plans
- unverified findings
- worker handoffs
- transcripts
- tool logs
- generated notes
- partial reports

Committing all of these artifacts makes a repository noisy and difficult to maintain.

At the same time, some AI workflow artifacts are valuable and should be preserved:

- verified reports
- architecture decisions
- implementation verification summaries
- final PR notes
- stable planning documents

## Decision

`pi-orc` will enforce an artifact hygiene policy.

Raw and unverified artifacts must remain local-only.

Only verified durable artifacts may be committed.

## Committed artifacts

The following artifacts may be committed:

- README files
- ADRs
- stable architecture documents
- workflow configuration
- issue templates
- PR templates
- stable planning documents
- verified reports
- implementation verification summaries
- final decision records

## Local-only artifacts

The following artifacts must not be committed by default:

- raw audit outputs
- unverified findings
- temporary handoffs
- worker transcripts
- cache files
- intermediate scratch files
- temporary run state
- unreviewed generated reports

## Target repository default

A target repository should gitignore:

    .ai-workflow/runs/
    .ai-workflow/cache/
    .ai-workflow/tmp/

Verified reports may be committed under:

    docs/ai/verified-reports/

## Rationale

This preserves the useful parts of the AI workflow without turning the repository into a transcript archive.

The repository should show:

- what was decided
- what was verified
- what was implemented
- why changes were made

It should not preserve every intermediate AI thought, raw audit output, or temporary work file.

## Consequences

### Positive

- Cleaner repository history
- Better professional presentation
- Less noise in pull requests
- Better separation between working state and durable state
- Easier auditability

### Negative

- Some raw context may be lost unless retained locally
- Debugging old worker behavior may require local run artifacts
- The package must clearly distinguish verified and unverified outputs

## Enforcement

The package should:

- generate `.gitignore` entries for local-only workflow directories
- mark raw reports as unverified
- require verification before reports can be promoted
- never create GitHub issues from unverified findings by default
