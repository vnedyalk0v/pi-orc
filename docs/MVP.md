# pi-orc MVP

## Goal

Build the first usable version of `pi-orc`: an opinionated Pi package that bootstraps professional GitHub repositories for verified AI-assisted development.

The MVP follows a foundation-first sequence:

Repo → Configuration → Templates → Docs → Issues → Project → Implementation

## Product position

`pi-orc` is not a generic sub-agent framework.

It is a workflow-specific orchestration package for Pi Coding Agent. It exists to make AI-assisted software projects more structured, auditable, and maintainable.

## v0.1 scope

v0.1 must provide the foundation for future workflows.

### Included

- Public package repository structure
- Pi package manifest
- SDK-driven worker runtime skeleton
- Worker profile schema
- Worker handoff schema
- Worker result schema
- Workflow policy modes
- Target repository templates
- GitHub adapter foundation
- New project bootstrap planning flow
- Dry-run command for new project bootstrap
- Initial documentation
sue and PR templates
- Initial CI for typecheck and tests

### Excluded

- Full audit workflow
- Full verification workflow
- Implementation workers
- Pull request review monitor
- Review thread resolution
- Branch protection automation
- Release automation
- npm publishing automation
- Fully autonomous GitHub mutation mode

## v0.1 user story

As a developer starting a new AI-assisted software project, I want `pi-orc` to create a clean repository foundation so that the project begins with consistent documentation, GitHub templates, workflow policy, and future verification gates.

## v0.1 command target

The first user-facing command should be:

    pi-orc new-project --dry-run

It should produce a bootstrap plan without mutating GitHub.

Later in v0.1, execution mode may support:

    pi-orc new-project

## v0.1 expected generated target repository files

A target project bootstrapped by `pi-orc` should receive:

    .ai-workflow/
      config.yml
      README.md

    .github/
      ISSUE_TEMPLATE/
        config.yml
        task.yml
        bug.yml
        verified-finding.yml
        docs.yml
      pull_request_template.md

    docs/
      prd.md
      mvp.md
      architecture.md
      implementation-plan.md
      adr/
        ADR-0001-project-foundation.md

    AGENTS.md
    README.md
    .gitignore

## Artifact policy

Raw and unverified artifacts must not be committed.

Committed artifacts may include:

- stable architecture documents
- durable ADRs
- verified reports
- issue and PR templates
- workflow configuration
- project documentation

Local-only artifacts include:

- raw audit outputs
- temporary handoffs
- worker transcripts
- cache files
- intermediate reports
- unverified findings

## Workflow modes

`pi-orc` supports three workflow modes.

### manual

The package may generate plans and files, but external actions require explicit user action.

### assisted

The package may write local files and prepare GitHub actions, but must ask before repository creation, project creation, issue creation, commits, pushes, PR creation, or review-thread resolution.

### auto

The package may perform configured low-risk actions automatically. Dangerous or externally visible actions still require explicit policy permission.

## v0.1 success criteria

v0.1 is successful when:

- the package installs locally
- the repository has a valid Pi package structure
- SDK-driven worker runtime skeleton exists
- worker profile, handoff, and result schemas exist
- workflow modes are represented
- target repository templates exist
- `pi-orc new-project --dry-run` produces a clear bootstrap plan
- dry-run mode performs no GitHub mutation
- CI runs typecheck and tests
- the project has clean issue and PR templates
- the first implementation issues are tracked in GitHub

## Implementation order

1. Define architecture and ADRs
2. Bootstrap package tooling
3. Implement worker runtime interfaces
4. Implement SDK runtime skeleton
5. Define worker/handoff/result schemas
6. Define policy modes
7. Add target repository templates
8. Implement GitHub adapter foundation
9. Implement new-project planning flow
10. Add dry-run command
11. Add CI
