# pi-orc

Pi Orchestrator for verified AI development workflows.

`pi-orc` is an opinionated Pi package for bootstrapping GitHub repository
foundations for AI-assisted software projects. Version `0.1.0` is foundation
first: it can model a new project, render a bootstrap plan, and expose the typed
runtime, policy, GitHub adapter, and repo-bootstrap boundaries that later
workflow automation will build on.

## What v0.1.0 does

- provides a TypeScript package with one public library export
- provides the `pi-orc` CLI binary
- supports `pi-orc new-project --dry-run`
- validates new-project intake with typed schemas
- renders planned repository files, GitHub actions, git actions, and policy
  gates
- includes target repository templates for docs, issue templates, pull request
  templates, workflow config, and `AGENTS.md`
- exposes SDK-driven worker runtime contracts and workflow policy helpers
- keeps GitHub mutations, commits, pushes, and PR work behind explicit policy
  boundaries

The dry-run command does not create repositories, projects, issues, commits, or
pushes.

## Try it from this checkout

```sh
npm ci
npm run build
node dist/cli/pi-orc.js --help
node dist/cli/pi-orc.js new-project --dry-run
```

With your own intake file:

```sh
node dist/cli/pi-orc.js new-project --dry-run --intake path/to/intake.json
```

Minimal intake shape:

```json
{
  "projectName": "Example TypeScript App",
  "repositoryOwner": "vnedyalk0v",
  "repositoryName": "example-typescript-app",
  "repositoryVisibility": "private",
  "description": "Example bootstrap target",
  "defaultBranch": "main",
  "githubProjectOwnerType": "user",
  "githubProjectOwner": "vnedyalk0v",
  "workflowMode": "assisted",
  "stackProfile": "typescript",
  "verificationCommands": ["npm run typecheck", "npm test"],
  "createDocsSkeleton": true,
  "createGitHubProject": true,
  "pushInitialCommit": true
}
```

## Package surface

Main exports include:

- `createBootstrapPlanDryRun`
- `generateBootstrapPlan`
- `renderBootstrapPlanMarkdown`
- `NewProjectIntakeSchema`
- `defaultWorkflowPolicies`
- `decideWorkflowAction`
- `PiSdkWorkerRuntime`
- `GhGitHubAdapter`

The package also exports the related TypeScript types for worker profiles,
handoffs, workflow policies, bootstrap plans, and GitHub actions.

## Project direction

`pi-orc` is not a generic sub-agent framework. The package owns a focused
workflow:

```text
Issue -> branch -> implementation -> verification -> PR -> CI -> review signal -> verified fix/reject -> merge
```

Workers execute scoped workflow steps. The orchestrator owns policy decisions,
GitHub mutation decisions, and artifact publication decisions.

## Non-goals for v0.1.0

`pi-orc` does not yet provide:

- execution mode for `pi-orc new-project`
- full audit workflow
- full verification workflow
- implementation workers
- pull request review monitoring
- review-thread resolution
- branch protection automation
- release automation
- npm publishing automation
- autonomous merge behavior

## Documentation

- [Architecture](docs/architecture.md)
- [MVP scope](docs/MVP.md)
- [Package installability](docs/package-installability.md)
- [Dogfood dry-run report](docs/dogfood-new-project-dry-run.md)
- [v0.1.0 release checklist](docs/release-checklist-v0.1.0.md)
- [Final v0.1.0 release-readiness audit](docs/release-readiness-final-audit-v0.1.0.md)

Architecture decisions:

- [ADR-0001: SDK worker runtime](docs/adr/ADR-0001-sdk-worker-runtime.md)
- [ADR-0002: workflow-specific workers](docs/adr/ADR-0002-workflow-specific-workers.md)
- [ADR-0003: artifact hygiene](docs/adr/ADR-0003-artifact-hygiene.md)

## Core principle

AI output is not trusted until verified. Raw or unverified workflow artifacts
must not be committed. Only verified durable artifacts belong in the repository.

## License

Apache-2.0. See [LICENSE](LICENSE).
