#!/usr/bin/env node

import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createBootstrapPlanDryRun,
  decideWorkflowAction,
  defaultWorkflowPolicies,
  generateBootstrapPlan,
  GhGitHubAdapter,
  renderBootstrapPlanMarkdown,
  syncPullRequestReview
} from "../index.js";
import type {
  BootstrapFileAction,
  BootstrapPlan,
  PullRequestReviewContextAdapter,
  PullRequestReviewItem,
  PullRequestReviewMutationPlan,
  PullRequestReviewSyncResult,
  PullRequestReviewVerificationStep,
  WorkflowPolicyDecisionStatus
} from "../index.js";
import type { NewProjectIntake } from "../index.js";

const sampleNewProjectIntake = {
  projectName: "Example TypeScript App",
  repositoryOwner: "vnedyalk0v",
  repositoryName: "example-typescript-app",
  repositoryVisibility: "private",
  description: "Example bootstrap target",
  defaultBranch: "main",
  githubProjectOwnerType: "user",
  githubProjectOwner: "vnedyalk0v",
  workflowMode: "assisted",
  stackProfile: "typescript",
  verificationCommands: ["npm run typecheck", "npm test"],
  createDocsSkeleton: true,
  createGitHubProject: true,
  pushInitialCommit: true
} satisfies NewProjectIntake;

export interface PiOrcCliStreams {
  stdout: Pick<NodeJS.WriteStream, "write">;
  stderr: Pick<NodeJS.WriteStream, "write">;
}

export interface PiOrcCliOptions {
  cwd?: string;
  reviewAdapter?: PullRequestReviewContextAdapter;
}

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const targetRepoTemplateRoot = join(packageRoot, "templates", "target-repo");

export async function runPiOrcCli(
  args: readonly string[],
  streams: PiOrcCliStreams = process,
  options: PiOrcCliOptions = {}
): Promise<number> {
  try {
    const command = parseArgs(args);

    if (command.kind === "help") {
      streams.stdout.write(helpText());
      return 0;
    }

    if (command.kind === "sync-review") {
      const result = await syncPullRequestReview({
        repository: command.repository,
        pullRequestNumber: command.pullRequestNumber,
        policy: defaultWorkflowPolicies.assisted,
        adapter: options.reviewAdapter ?? new GhGitHubAdapter()
      });

      streams.stdout.write(renderReviewSyncResult(result));
      return 0;
    }

    const intake = command.intakePath ? readJson(command.intakePath) : sampleNewProjectIntake;

    if (command.dryRun) {
      const dryRun = createBootstrapPlanDryRun(intake);

      streams.stdout.write(`${dryRun.markdown}\n\nDry run: no GitHub, git, or file mutations executed.\n`);
      return 0;
    }

    if (!command.intakePath) {
      throw new Error("new-project execution requires --intake path/to/intake.json");
    }

    const plan = generateBootstrapPlan(intake);
    const result = executeLocalBootstrap(plan, options.cwd ?? process.cwd());

    streams.stdout.write(`${renderBootstrapPlanMarkdown(plan)}\n\n${renderExecutionResult(result)}`);
    return 0;
  } catch (error) {
    streams.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    streams.stderr.write(helpText());
    return 1;
  }
}

type ParsedCommand =
  | {
      kind: "new-project";
      dryRun: boolean;
      intakePath?: string;
    }
  | {
      kind: "sync-review";
      repository: string;
      pullRequestNumber: number;
    }
  | {
      kind: "help";
    };

function parseArgs(args: readonly string[]): ParsedCommand {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return { kind: "help" };
  }

  const [command, ...rest] = args;

  if (command === "sync-review") {
    return parseSyncReviewArgs(rest);
  }

  if (command !== "new-project") {
    throw new Error(`Unknown command: ${command ?? ""}`);
  }

  let dryRun = false;
  let intakePath: string | undefined;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--intake") {
      intakePath = rest[index + 1];
      index += 1;

      if (!intakePath) {
        throw new Error("--intake requires a JSON file path");
      }

      continue;
    }

    throw new Error(`Unknown argument: ${arg ?? ""}`);
  }

  return {
    kind: "new-project",
    dryRun,
    ...(intakePath ? { intakePath } : {})
  };
}

function parseSyncReviewArgs(args: readonly string[]): ParsedCommand {
  let repository: string | undefined;
  let pullRequestNumber: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--repo") {
      repository = args[index + 1];
      index += 1;

      if (!repository) {
        throw new Error("--repo requires an owner/name repository");
      }

      continue;
    }

    if (arg === "--pr") {
      pullRequestNumber = parsePullRequestNumber(args[index + 1]);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg ?? ""}`);
  }

  if (!repository) {
    throw new Error("sync-review requires --repo owner/name");
  }

  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    throw new Error(`Invalid repository: ${repository}`);
  }

  if (!pullRequestNumber) {
    throw new Error("sync-review requires --pr number");
  }

  return {
    kind: "sync-review",
    repository,
    pullRequestNumber
  };
}

function parsePullRequestNumber(value: string | undefined): number {
  if (!value) {
    throw new Error("--pr requires a pull request number");
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid pull request number: ${value}`);
  }

  return parsed;
}

interface LocalBootstrapExecutionResult {
  fileDecision: WorkflowPolicyDecisionStatus;
  filesWritten: string[];
  githubGates: string[];
  gitGates: string[];
}

function executeLocalBootstrap(plan: BootstrapPlan, cwd: string): LocalBootstrapExecutionResult {
  const policy = defaultWorkflowPolicies[plan.workflowMode];
  const writeDecision = decideWorkflowAction(policy, "write-local-files");
  const filesWritten =
    writeDecision.status === "allowed" ? writeTemplateFiles(cwd, plan.files) : [];
  const githubAdapter = new GhGitHubAdapter();
  const githubGates = plan.githubActions.map(({ action }) => {
    const command = githubAdapter.plan(action);
    const decision = decideWorkflowAction(policy, command.requiredPolicyAction);

    return `${action.kind}: ${decision.status} (${formatCommand(command.command, command.args)})`;
  });
  const gitGates = plan.gitActions.map((action) => {
    const decision = decideWorkflowAction(policy, action.requiredPolicyAction);

    return `${action.kind}: ${decision.status} (${action.command})`;
  });

  return {
    fileDecision: writeDecision.status,
    filesWritten,
    githubGates,
    gitGates
  };
}

function writeTemplateFiles(cwd: string, files: readonly BootstrapFileAction[]): string[] {
  const targets = files.map((file) => ({
    file,
    outputPath: safeTargetPath(cwd, file.path)
  }));
  const symlinked = targets.find(({ file }) => firstSymlinkPath(cwd, file.path));
  const existing = targets.find(({ outputPath }) => existsSync(outputPath));

  if (symlinked) {
    throw new Error(
      `write-local-files ${symlinked.file.path} failed: target path contains symlink ${firstSymlinkPath(cwd, symlinked.file.path)}`
    );
  }

  if (existing) {
    throw new Error(`write-local-files ${existing.file.path} failed: target already exists`);
  }

  return targets.map(({ file, outputPath }) => writeTemplateFile(file, outputPath));
}

function writeTemplateFile(file: BootstrapFileAction, outputPath: string): string {
  try {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, readFileSync(join(targetRepoTemplateRoot, file.template)), { flag: "wx" });
    return file.path;
  } catch (error) {
    throw new Error(
      `write-local-files ${file.path} failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function safeTargetPath(cwd: string, path: string): string {
  const root = resolve(cwd);
  const target = resolve(root, path);
  const fromRoot = relative(root, target);

  if (fromRoot === ".." || fromRoot.startsWith("../") || isAbsolute(fromRoot)) {
    throw new Error(`write-local-files ${path} failed: target path escapes ${root}`);
  }

  return target;
}

function firstSymlinkPath(cwd: string, path: string): string | undefined {
  const root = resolve(cwd);
  const parts = path.split("/");

  for (let index = 0; index < parts.length; index += 1) {
    const current = resolve(root, ...parts.slice(0, index + 1));
    const stat = lstatSync(current, { throwIfNoEntry: false });

    if (stat?.isSymbolicLink()) {
      return relative(root, current);
    }
  }

  return undefined;
}

function renderExecutionResult(result: LocalBootstrapExecutionResult): string {
  return [
    "## Execution",
    `write-local-files: ${result.fileDecision}`,
    ...result.filesWritten.map((path) => `- wrote \`${path}\``),
    "",
    "## Confirmation Required",
    ...result.githubGates.map((gate) => `- github ${gate}`),
    ...result.gitGates.map((gate) => `- git ${gate}`)
  ].join("\n");
}

function renderReviewSyncResult(result: PullRequestReviewSyncResult): string {
  return [
    `# PR Review Sync: ${result.context.repository}#${result.context.pullRequestNumber}`,
    "",
    `Head: ${result.context.headSha}`,
    `Summary: ${result.summary}`,
    "",
    "## Checks",
    ...renderChecks(result),
    "",
    "## Bot Reactions",
    ...renderBotReactions(result),
    "",
    "## Valid Review-Bot Comments",
    ...renderReviewItems(result.verifiedValidComments, "fix"),
    "",
    "## Rejected Review-Bot Comments",
    ...renderReviewItems(result.rejectedComments, "reply"),
    "",
    "## Unresolved Review-Bot Comments",
    ...renderReviewItems(result.unresolvedComments, "next"),
    "",
    "## Verification Plan",
    ...renderVerificationPlan(result.verificationPlan),
    "",
    "## Proposed Mutations",
    ...renderMutationPlans(result.proposedMutations),
    "",
    "Read-only: no comments, review-thread resolutions, commits, pushes, or merges executed.",
    ""
  ].join("\n");
}

function renderChecks(result: PullRequestReviewSyncResult): string[] {
  return result.context.checks.length
    ? result.context.checks.map((check) => `- ${check.name}: ${check.state}${check.detailsUrl ? ` (${check.detailsUrl})` : ""}`)
    : ["- none"];
}

function renderBotReactions(result: PullRequestReviewSyncResult): string[] {
  return result.context.botReactions.length
    ? result.context.botReactions.map((reaction) => `- ${reaction.actor}: ${reaction.reaction} at ${reaction.createdAt}`)
    : ["- none"];
}

function renderReviewItems(items: readonly PullRequestReviewItem[], planLabel: string): string[] {
  return items.length ? items.flatMap((item) => renderReviewItem(item, planLabel)) : ["- none"];
}

function renderReviewItem(item: PullRequestReviewItem, planLabel: string): string[] {
  const location = item.comment.path ? ` ${item.comment.path}${item.comment.line ? `:${item.comment.line}` : ""}` : "";

  return [
    `- ${item.comment.id}${location}: ${oneLine(item.comment.body)}`,
    `  evidence: ${item.evidence}`,
    `  ${planLabel}: ${item.plan}`
  ];
}

function renderVerificationPlan(steps: readonly PullRequestReviewVerificationStep[]): string[] {
  return steps.length
    ? steps.map((step) => `- ${step.commentId}${step.threadId ? ` in ${step.threadId}` : ""}: ${step.action}`)
    : ["- none"];
}

function renderMutationPlans(plans: readonly PullRequestReviewMutationPlan[]): string[] {
  return plans.length
    ? plans.map((plan) => `- ${plan.mutation} ${plan.commentId}: ${plan.decision.status} (${plan.reason})`)
    : ["- none"];
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatCommand(command: string, args: readonly string[]): string {
  return [command, ...args].map(shellQuote).join(" ");
}

function shellQuote(value: string): string {
  return /^[A-Za-z0-9_./:=@+-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function helpText(): string {
  return [
    "Usage:",
    "  pi-orc new-project --dry-run [--intake path/to/intake.json]",
    "  pi-orc new-project --intake path/to/intake.json",
    "  pi-orc sync-review --repo owner/name --pr number",
    "",
    "Dry-run prints a bootstrap plan only.",
    "Execution writes allowed local template files. GitHub and git actions require explicit confirmation.",
    "sync-review reads one PR review state and prints policy-gated next actions.",
    ""
  ].join("\n");
}

export function isCliEntrypoint(
  entryPath: string | undefined = process.argv[1],
  modulePath = fileURLToPath(import.meta.url)
): boolean {
  return Boolean(entryPath && realpathSync(entryPath) === realpathSync(modulePath));
}

if (isCliEntrypoint()) {
  process.exitCode = await runPiOrcCli(process.argv.slice(2));
}
