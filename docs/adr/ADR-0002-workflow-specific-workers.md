# ADR-0002: Build workflow-specific workers, not a generic sub-agent framework

## Status

Accepted

## Context

`pi-orc` needs clean-context worker sessions for AI-assisted development workflows.

A generic sub-agent framework could provide general primitives such as:

- spawn worker
- pass prompt
- return output
- chain workers

However, `pi-orc` has stronger workflow-specific requirements:

- verified findings before GitHub issues
- GitHub actions behind policy gates
- no unverified reports committed
- one issue should map to scoped implementation where possible
- review-bot comments must be verified before fixing
- workers must receive compact handoffs
- workers must not inherit full parent context
- workers must obey artifact hygiene rules

## Decision

`pi-orc` will not implement or depend on a generic sub-agent framework.

Instead, it will implement workflow-specific worker orchestration.

The internal runtime will support worker profiles, but those profiles exist only to serve the `pi-orc` workflow.

## Rationale

The goal of `pi-orc` is not to support arbitrary agent graphs.

The goal is to make one opinionated workflow reliable:

Idea → Repo → Docs → Issues → Audit → Verify → Implement → Verify → PR → Review Bot → Ready to Merge

Generic sub-agent abstractions would add unnecessary complexity.

Workflow-specific workers allow the package to encode the exact rules that matter:

- what context a worker gets
- what files it may touch
- what outputs are required
- what GitHub actions are forbidden
- what must be verified before publication
- when user confirmation is required

## Consequences

### Positive

- Less generic complexity
- Better alignment with the intended workflow
- Easier policy enforcement
- Easier artifact hygiene
- Better defaults for the author's real projects
- Easier to explain and maintain

### Negative

- Less reusable as a general sub-agent system
- Some users may need to adapt to the opinionatitable for arbitrary multi-agent experimentation

## Design rule

The package owns the workflow.

Workers execute scoped workflow steps.

Workers do not decide the workflow.
