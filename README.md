# pi-orc

Pi Orchestrator for verified AI development workflows.

`pi-orc` is an opinionated Pi package for structuring AI-assisted software development from project foundation to pull request review.

It is built around one workflow:

Idea → Repo → Docs → Issues → Audit → Verify → Implement → Verify → PR → Review Bot → Ready to Merge

## What this project is

`pi-orc` is a personal-first, public-second workflow package.

It is designed for developers who use Pi Coding Agent, GitHub, and AI coding agents to build and maintain software projects with stronger structure, verification, and traceability.

The package is intentionally opinionated. It does not try to be a generic sub-agent framework. Instead, it provides workflow-specific orchestration for:

- repository bootstrap
- GitHub configuration
- planning document creation
- clean-context worker sessions
- verified audit/report workflows
- GitHub issue creation from verified findings
- implementation gates
- pull request creation
- review-bot comment handling

## Core principle

No important AI-generated finding or code change should be trusted until it has passed a clean-context verification step.

## Initial MVP direction

The first version is foundation-first.

The goal of v0.1 is to create and configure a professional GitHub repository foundation for verified AI-assisted development.

v0.1 focuses on:

- package structure
- SDK-driven worker runtime
- workflow-specific worker profiles
- artifact hygiene policy
- target repository templates
- GitHub repository bootstrap planning
- GitHub adapter foundation
- dry-run support for new project creation

## Non-goals

The MVP does not aim to provide:

- a generic multi-agent framework
- a Jira replacement
- a dashboard
- autonomous merging
- deployment automation
- complex multi-repository orchestration
- fully autonomous code changes
- blind execution of review-bot comments

## Architecture decisions

See:

- `docs/adr/ADR-0001-sdk-worker-runtime.md`
- `docs/adr/ADR-0002-workflow-specific-workers.md`
- `docs/adr/ADR-0003-artifact-hygiene.md`

## License

TBD.
