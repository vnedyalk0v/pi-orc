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
- exposes the `pi-orc-new-project` Pi Coding Agent skill
- supports `pi-orc new-project --dry-run`
- supports assisted local template writes with `pi-orc new-project --intake`
- supports read-only PR review summaries with `pi-orc sync-review --repo --pr`
- supports issue-start tracking checks with `pi-orc start-issue --repo --issue`
- supports explicit verification commands with `pi-orc verify --cmd`
- validates new-project intake with typed schemas
- renders planned repository files, GitHub actions, git actions, and policy
  gates
- includes target repository templates for docs, issue templates, pull request
  templates, workflow config, and `AGENTS.md`
- exposes SDK-driven worker runtime contracts and workflow policy helpers
- keeps GitHub mutations, commits, pushes, and PR work behind explicit policy
  boundaries

The dry-run command does not create repositories, projects, issues, commits, or
pushes. Assisted execution may write local template files, but GitHub, commit,
and push actions remain confirmation-gated.

## Try it from this checkout

```sh
npm ci
npm run build
node dist/cli/pi-orc.js --help
node dist/cli/pi-orc.js new-project --dry-run
node dist/cli/pi-orc.js sync-review --repo owner/name --pr 123
node dist/cli/pi-orc.js start-issue --repo owner/name --issue 95 --project-owner owner --project 7
node dist/cli/pi-orc.js verify --cmd "npm test"
node dist/cli/pi-orc.js verify --cmd "npm test" --report docs/ai/verified-reports/report.md
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

## Use it as a Pi package

`pi-orc` ships one explicit Pi Coding Agent skill:
`pi-orc-new-project`. The skill guides new-project bootstrap work through the
existing CLI flow: intake validation, dry-run planning, assisted local template
writes, and verification gates.

From a packed local package:

```sh
npm pack --json
tmp=$(mktemp -d)
mkdir -p "$tmp/pkg" "$tmp/project" "$tmp/agent"
tar -xzf pi-orc-0.1.0.tgz -C "$tmp/pkg"
cd "$tmp/project"
npm init -y
npm install /path/to/pi-orc/pi-orc-0.1.0.tgz
PI_CODING_AGENT_DIR="$tmp/agent" PI_OFFLINE=1 ./node_modules/.bin/pi install -l ../pkg/package
PI_CODING_AGENT_DIR="$tmp/agent" PI_OFFLINE=1 ./node_modules/.bin/pi list --approve
```

Pi discovers:

- one skill: `skills/pi-orc-new-project/SKILL.md`
- no extensions
- no prompts
- no themes

The skill does not add release automation, autonomous merge behavior, UI
extensions, prompt templates, themes, or generic sub-agent framework behavior.

## Package surface

Main exports include:

- `createBootstrapPlanDryRun`
- `generateBootstrapPlan`
- `renderBootstrapPlanMarkdown`
- `NewProjectIntakeSchema`
- `defaultPlanningWorkerProfile`
- `defaultVerificationWorkerProfile`
- `defaultWorkerProfiles`
- `defaultWorkflowPolicies`
- `decideWorkflowAction`
- `PiSdkWorkerRuntime`
- `GhGitHubAdapter`
- `startIssueWorkflow`

The package also exports the related TypeScript types for worker profiles,
handoffs, workflow policies, bootstrap plans, GitHub actions, and issue-start
workflows.

The default planning and verification profiles are clean-context worker
profiles. They allow only scoped planning/report output, deny GitHub mutation,
commit, push, pull request, and review-thread actions, and do not implement
workers themselves.

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

- full audit workflow
- full verification workflow
- implementation workers
- autonomous pull request review handling
- review-thread resolution execution
- branch protection automation
- release automation
- npm publishing automation
- autonomous merge behavior

## Documentation

- [Architecture](docs/architecture.md)
- [MVP scope](docs/MVP.md)
- [Package installability](docs/package-installability.md)
- [Dogfood dry-run report](docs/dogfood-new-project-dry-run.md)
- [Pi skill package dogfood report](docs/dogfood-pi-skill-installation.md)
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
