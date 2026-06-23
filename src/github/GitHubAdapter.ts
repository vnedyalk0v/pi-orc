import { spawn } from "node:child_process";

import type { WorkflowActionCategory } from "../runtime/index.js";

export type GitHubRepositoryVisibility = "public" | "private" | "internal";

export interface CreateRepositoryAction {
  kind: "create-repository";
  name: string;
  visibility: GitHubRepositoryVisibility;
  description?: string;
}

export interface CreateLabelAction {
  kind: "create-label";
  repository: string;
  name: string;
  color?: string;
  description?: string;
}

export interface CreateProjectAction {
  kind: "create-project";
  owner: string;
  title: string;
}

export interface LinkProjectAction {
  kind: "link-project";
  owner: string;
  projectNumber: number;
  repository: string;
}

export interface CreateIssueAction {
  kind: "create-issue";
  repository: string;
  title: string;
  body: string;
  labels?: readonly string[];
}

export interface AddProjectItemAction {
  kind: "add-project-item";
  owner: string;
  projectNumber: number;
  itemUrl: string;
}

export type GitHubAction =
  | CreateRepositoryAction
  | CreateLabelAction
  | CreateProjectAction
  | LinkProjectAction
  | CreateIssueAction
  | AddProjectItemAction;

export interface GitHubCommandPlan {
  command: "gh";
  args: readonly string[];
  action: GitHubAction;
  requiredPolicyAction: WorkflowActionCategory;
  mutating: true;
}

export interface GitHubCommandOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface GitHubAuthCheck {
  authenticated: boolean;
  output: GitHubCommandOutput;
}

export interface GitHubExecuteOptions {
  dryRun: boolean;
}

export interface GitHubActionResult {
  plan: GitHubCommandPlan;
  dryRun: boolean;
  output?: GitHubCommandOutput;
}

export type GitHubCommandRunner = (args: readonly string[]) => Promise<GitHubCommandOutput>;

export interface GitHubAdapter {
  checkAuth(hostname?: string): Promise<GitHubAuthCheck>;
  plan(action: GitHubAction): GitHubCommandPlan;
  execute(action: GitHubAction, options: GitHubExecuteOptions): Promise<GitHubActionResult>;
}

const requiredPolicyActions: Record<GitHubAction["kind"], WorkflowActionCategory> = {
  "create-repository": "create-github-repository",
  "create-label": "edit-github-repository-settings",
  "create-project": "create-github-project",
  "link-project": "add-issue-to-project",
  "create-issue": "create-github-issue",
  "add-project-item": "add-issue-to-project"
};

export class GhGitHubAdapter implements GitHubAdapter {
  constructor(private readonly run: GitHubCommandRunner = runGhCommand) {}

  async checkAuth(hostname?: string): Promise<GitHubAuthCheck> {
    const args = ["auth", "status", "--active"];

    if (hostname) {
      args.push("--hostname", hostname);
    }

    const output = await this.run(args);

    return {
      authenticated: output.exitCode === 0,
      output
    };
  }

  plan(action: GitHubAction): GitHubCommandPlan {
    return {
      command: "gh",
      args: actionArgs(action),
      action,
      requiredPolicyAction: requiredPolicyActions[action.kind],
      mutating: true
    };
  }

  async execute(action: GitHubAction, options: GitHubExecuteOptions): Promise<GitHubActionResult> {
    const plan = this.plan(action);

    if (options.dryRun) {
      return {
        plan,
        dryRun: true
      };
    }

    return {
      plan,
      dryRun: false,
      output: await this.run(plan.args)
    };
  }
}

function actionArgs(action: GitHubAction): string[] {
  switch (action.kind) {
    case "create-repository":
      return compact(["repo", "create", action.name, `--${action.visibility}`, flag("--description", action.description)]);
    case "create-label":
      return compact([
        "label",
        "create",
        action.name,
        "--repo",
        action.repository,
        flag("--color", action.color),
        flag("--description", action.description)
      ]);
    case "create-project":
      return ["project", "create", "--owner", action.owner, "--title", action.title];
    case "link-project":
      return ["project", "link", String(action.projectNumber), "--owner", action.owner, "--repo", action.repository];
    case "create-issue":
      return compact([
        "issue",
        "create",
        "--repo",
        action.repository,
        "--title",
        action.title,
        "--body",
        action.body,
        ...flatLabels(action.labels)
      ]);
    case "add-project-item":
      return [
        "project",
        "item-add",
        String(action.projectNumber),
        "--owner",
        action.owner,
        "--url",
        action.itemUrl,
        "--format",
        "json"
      ];
  }
}

function flag(name: string, value?: string): string[] {
  return value ? [name, value] : [];
}

function flatLabels(labels: readonly string[] = []): string[] {
  return labels.flatMap((label) => ["--label", label]);
}

function compact(parts: readonly (string | readonly string[])[]): string[] {
  return parts.flat();
}

function runGhCommand(args: readonly string[]): Promise<GitHubCommandOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn("gh", [...args], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1,
        stdout,
        stderr
      });
    });
  });
}
