import { NewProjectIntakeSchema } from "../runtime/index.js";
import type { GitHubAction } from "../github/index.js";
import type { NewProjectIntake, WorkflowActionCategory } from "../runtime/index.js";

export interface BootstrapDirectoryAction {
  path: string;
  requiredPolicyAction: "write-local-files";
}

export interface BootstrapFileAction {
  path: string;
  template: string;
  requiredPolicyAction: "write-local-files";
}

export interface BootstrapGitHubAction {
  action: GitHubAction;
  requiredPolicyAction: WorkflowActionCategory;
}

export interface BootstrapGitAction {
  kind: "init" | "add-remote" | "stage" | "commit" | "push";
  command: string;
  requiredPolicyAction: "run-local-command" | "commit" | "push";
}

export interface BootstrapPolicyGate {
  action: WorkflowActionCategory;
  reason: string;
}

export interface BootstrapPlan {
  projectName: string;
  repository: string;
  workflowMode: NewProjectIntake["workflowMode"];
  directories: BootstrapDirectoryAction[];
  files: BootstrapFileAction[];
  githubActions: BootstrapGitHubAction[];
  gitActions: BootstrapGitAction[];
  policyGates: BootstrapPolicyGate[];
}

export interface BootstrapPlanDryRun {
  plan: BootstrapPlan;
  markdown: string;
  mutates: false;
}

const targetRepoTemplates = [
  ".ai-workflow/README.md",
  ".ai-workflow/config.yml",
  ".github/ISSUE_TEMPLATE/bug.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/ISSUE_TEMPLATE/docs.yml",
  ".github/ISSUE_TEMPLATE/task.yml",
  ".github/ISSUE_TEMPLATE/verified-finding.yml",
  ".github/pull_request_template.md",
  "AGENTS.md",
  "README.md",
  "docs/adr/ADR-0001-project-foundation.md",
  "docs/ai/verified-reports/README.md",
  "docs/architecture.md",
  "docs/implementation-plan.md",
  "docs/mvp.md",
  "docs/prd.md",
  "gitignore"
] as const;

const targetRepoLabels = [
  ["type:task", "1d76db", "Planned implementation or maintenance work"],
  ["type:bug", "d73a4a", "Reproducible defect"],
  ["type:finding", "fbca04", "Independently verified finding"],
  ["type:docs", "0075ca", "Documentation work"],
  ["status:ready", "0e8a16", "Ready to implement"],
  ["source:manual", "ededed", "Created manually"],
  ["source:verified", "5319e7", "Created from verified evidence"]
] as const;

export function generateBootstrapPlan(input: unknown): BootstrapPlan {
  const intake = NewProjectIntakeSchema.parse(input);
  const repository = `${intake.repositoryOwner}/${intake.repositoryName}`;
  const files = fileActions(intake);
  const githubActions = githubPlanActions(intake, repository);
  const gitActions = gitPlanActions(intake, files, repository);
  const requiredActions = [
    ...files.map((file) => file.requiredPolicyAction),
    ...githubActions.map((githubAction) => githubAction.requiredPolicyAction),
    ...gitActions.map((gitAction) => gitAction.requiredPolicyAction)
  ];

  return {
    projectName: intake.projectName,
    repository,
    workflowMode: intake.workflowMode,
    directories: directoryActions(files),
    files,
    githubActions,
    gitActions,
    policyGates: [...new Set(requiredActions)].map((action) => ({
      action,
      reason: `Required before executing planned ${action} work.`
    }))
  };
}

export function createBootstrapPlanDryRun(input: unknown): BootstrapPlanDryRun {
  const plan = generateBootstrapPlan(input);

  return {
    plan,
    markdown: renderBootstrapPlanMarkdown(plan),
    mutates: false
  };
}

export function renderBootstrapPlanMarkdown(plan: BootstrapPlan): string {
  return [
    `# Bootstrap Plan: ${plan.projectName}`,
    "",
    `Repository: \`${plan.repository}\``,
    `Workflow mode: \`${plan.workflowMode}\``,
    "",
    "## Directories",
    ...plan.directories.map((action) => `- \`${action.path}\``),
    "",
    "## Files",
    ...plan.files.map((action) => `- \`${action.path}\` from \`${action.template}\``),
    "",
    "## GitHub Actions",
    ...plan.githubActions.map((action) => `- ${action.action.kind} (${action.requiredPolicyAction})`),
    "",
    "## Git Actions",
    ...plan.gitActions.map((action) => `- ${action.kind}: \`${action.command}\``),
    "",
    "## Policy Gates",
    ...plan.policyGates.map((gate) => `- \`${gate.action}\`: ${gate.reason}`)
  ].join("\n");
}

function fileActions(intake: NewProjectIntake): BootstrapFileAction[] {
  return targetRepoTemplates
    .map((template) => ({
      path: targetPath(template),
      template,
      requiredPolicyAction: "write-local-files" as const
    }))
    .filter((action) => intake.createDocsSkeleton || !action.path.startsWith("docs/"));
}

function directoryActions(files: readonly BootstrapFileAction[]): BootstrapDirectoryAction[] {
  const directories = files.flatMap((file) => {
    const parts = file.path.split("/").slice(0, -1);

    return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
  });

  return [...new Set(directories)].map((path) => ({
    path,
    requiredPolicyAction: "write-local-files"
  }));
}

function githubPlanActions(intake: NewProjectIntake, repository: string): BootstrapGitHubAction[] {
  const actions: BootstrapGitHubAction[] = [
    {
      action: {
        kind: "create-repository",
        name: repository,
        visibility: intake.repositoryVisibility,
        description: intake.description || undefined
      },
      requiredPolicyAction: "create-github-repository"
    },
    ...targetRepoLabels.map<BootstrapGitHubAction>(([name, color, description]) => ({
      action: {
        kind: "create-label",
        repository,
        name,
        color,
        description
      },
      requiredPolicyAction: "edit-github-repository-settings"
    })),
    {
      action: {
        kind: "create-issue",
        repository,
        title: "chore: verify project foundation",
        body: `Verify the initial ${intake.projectName} repository foundation.`,
        labels: ["type:task", "status:ready", "source:manual"]
      },
      requiredPolicyAction: "create-github-issue"
    }
  ];

  if (intake.createGitHubProject) {
    actions.splice(1, 0, {
      action: {
        kind: "create-project",
        owner: intake.githubProjectOwner,
        title: intake.projectName
      },
      requiredPolicyAction: "create-github-project"
    });
  }

  return actions;
}

function gitPlanActions(
  intake: NewProjectIntake,
  files: readonly BootstrapFileAction[],
  repository: string
): BootstrapGitAction[] {
  if (!intake.pushInitialCommit) {
    return [];
  }

  return [
    {
      kind: "init",
      command: `git init -b ${shellQuote(intake.defaultBranch)}`,
      requiredPolicyAction: "run-local-command"
    },
    {
      kind: "add-remote",
      command: `git remote add origin ${shellQuote(`git@github.com:${repository}.git`)}`,
      requiredPolicyAction: "run-local-command"
    },
    {
      kind: "stage",
      command: `git add ${files.map((file) => shellQuote(file.path)).join(" ")}`,
      requiredPolicyAction: "commit"
    },
    {
      kind: "commit",
      command: `git commit -m ${shellQuote(`chore: bootstrap ${intake.repositoryName}`)}`,
      requiredPolicyAction: "commit"
    },
    {
      kind: "push",
      command: `git push -u origin ${shellQuote(intake.defaultBranch)}`,
      requiredPolicyAction: "push"
    }
  ];
}

function targetPath(template: string): string {
  return template === "gitignore" ? ".gitignore" : template;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
