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
  success: boolean;
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
  "link-project": "edit-github-repository-settings",
  "create-issue": "create-github-issue",
  "add-project-item": "add-issue-to-project"
};

const defaultGhCommandTimeoutMs = 120_000;
const defaultGhCommandMaxOutputBytes = 1_000_000;
const defaultGhCommandForceKillAfterMs = 1_000;

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
        dryRun: true,
        success: true
      };
    }

    const output = await this.run(plan.args);

    return {
      plan,
      dryRun: false,
      success: output.exitCode === 0,
      output
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

interface RunGhCommandOptions {
  command?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export function runGhCommandForTest(
  args: readonly string[],
  options: RunGhCommandOptions = {}
): Promise<GitHubCommandOutput> {
  return new Promise((resolve, reject) => {
    const command = options.command ?? "gh";
    const timeoutMs = options.timeoutMs ?? defaultGhCommandTimeoutMs;
    const maxOutputBytes = options.maxOutputBytes ?? defaultGhCommandMaxOutputBytes;
    const child = spawn(command, [...args], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let failedOutput: GitHubCommandOutput | undefined;
    let settled = false;
    let forceKillTimeout: NodeJS.Timeout | undefined;

    const finish = (output: GitHubCommandOutput) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      clearTimeout(forceKillTimeout);
      resolve(output);
    };

    const failWithError = (message: string) => {
      if (failedOutput) {
        return;
      }

      failedOutput = {
        exitCode: 1,
        stdout,
        stderr: stderr ? `${stderr}\n${message}` : message
      };
      child.kill();
      forceKillTimeout = setTimeout(() => {
        child.kill("SIGKILL");
      }, defaultGhCommandForceKillAfterMs);
    };

    const timeout = setTimeout(() => {
      failWithError("gh command timed out");
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      const result = appendChunk(stdout, stdoutBytes, chunk, maxOutputBytes);
      stdout = result.output;
      stdoutBytes = result.bytes;

      if (result.exceeded) {
        failWithError(`gh stdout exceeded ${maxOutputBytes} byte output limit`);
      }
    });
    child.stderr.on("data", (chunk: string) => {
      const result = appendChunk(stderr, stderrBytes, chunk, maxOutputBytes);
      stderr = result.output;
      stderrBytes = result.bytes;

      if (result.exceeded) {
        failWithError(`gh stderr exceeded ${maxOutputBytes} byte output limit`);
      }
    });
    child.on("error", (error) => {
      if (failedOutput) {
        finish(failedOutput);
        return;
      }

      settled = true;
      clearTimeout(timeout);
      clearTimeout(forceKillTimeout);
      reject(error);
    });
    child.on("close", (exitCode) => {
      finish(
        failedOutput ?? {
          exitCode: exitCode ?? 1,
          stdout,
          stderr
        }
      );
    });
  });
}

function runGhCommand(args: readonly string[]): Promise<GitHubCommandOutput> {
  return runGhCommandForTest(args);
}

function appendChunk(output: string, outputBytes: number, chunk: string, maxBytes: number) {
  const chunkBytes = Buffer.byteLength(chunk, "utf8");

  if (outputBytes + chunkBytes <= maxBytes) {
    return {
      output: output + chunk,
      bytes: outputBytes + chunkBytes,
      exceeded: false
    };
  }

  const remainingBytes = Math.max(maxBytes - outputBytes, 0);

  return {
    output: output + truncateUtf8(chunk, remainingBytes),
    bytes: maxBytes,
    exceeded: true
  };
}

function truncateUtf8(value: string, maxBytes: number): string {
  let bytes = 0;
  let result = "";

  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, "utf8");

    if (bytes + characterBytes > maxBytes) {
      break;
    }

    bytes += characterBytes;
    result += character;
  }

  return result;
}
