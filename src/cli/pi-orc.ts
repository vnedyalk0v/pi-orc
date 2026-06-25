#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync
} from "node:fs";
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
  verificationRunner?: VerificationCommandRunner;
}

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const targetRepoTemplateRoot = join(packageRoot, "templates", "target-repo");
const maxVerificationOutputCharacters = 4_000;

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

    if (command.kind === "verify") {
      const result = await runVerificationWorkflow({
        commands: command.commands,
        cwd: options.cwd ?? process.cwd(),
        reportPath: command.reportPath,
        runner: options.verificationRunner ?? runShellVerificationCommand
      });

      streams.stdout.write(renderVerificationWorkflowResult(result));
      return result.status === "pass" ? 0 : 1;
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
      kind: "verify";
      commands: string[];
      reportPath?: string;
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

  if (command === "verify") {
    return parseVerifyArgs(rest);
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

function parseVerifyArgs(args: readonly string[]): ParsedCommand {
  const commands: string[] = [];
  let reportPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--cmd") {
      const command = args[index + 1];
      index += 1;

      if (!command) {
        throw new Error("--cmd requires a command string");
      }

      commands.push(command);
      continue;
    }

    if (arg === "--report") {
      reportPath = args[index + 1];
      index += 1;

      if (!reportPath) {
        throw new Error("--report requires a repository-relative report path");
      }

      continue;
    }

    throw new Error(`Unknown argument: ${arg ?? ""}`);
  }

  if (commands.length === 0) {
    throw new Error("verify requires at least one --cmd command");
  }

  return {
    kind: "verify",
    commands,
    ...(reportPath ? { reportPath } : {})
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

interface VerificationCommandRequest {
  command: string;
  cwd: string;
  maxOutputCharacters: number;
}

interface VerificationCommandResult {
  command: string;
  exitCode: number;
  startedAt: string;
  finishedAt: string;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
}

type VerificationCommandRunner = (request: VerificationCommandRequest) => Promise<VerificationCommandResult>;

interface VerificationWorkflowResult {
  status: "pass" | "fail";
  startedAt: string;
  finishedAt: string;
  checks: VerificationCommandResult[];
  reportPath?: string;
  reportMarkdown: string;
}

async function runVerificationWorkflow(input: {
  commands: readonly string[];
  cwd: string;
  reportPath?: string;
  runner: VerificationCommandRunner;
}): Promise<VerificationWorkflowResult> {
  if (input.reportPath) {
    preflightVerificationReportPath(input.cwd, input.reportPath);
  }

  const startedAt = new Date().toISOString();
  const checks: VerificationCommandResult[] = [];

  for (const command of input.commands) {
    checks.push(
      await input.runner({
        command,
        cwd: input.cwd,
        maxOutputCharacters: maxVerificationOutputCharacters
      })
    );
  }

  const finishedAt = new Date().toISOString();
  const result: VerificationWorkflowResult = {
    status: checks.every((check) => check.exitCode === 0) ? "pass" : "fail",
    startedAt,
    finishedAt,
    checks,
    ...(input.reportPath ? { reportPath: input.reportPath } : {}),
    reportMarkdown: ""
  };
  const reportMarkdown = renderVerificationReport(result);

  if (input.reportPath) {
    writeVerificationReport(input.cwd, input.reportPath, reportMarkdown);
  }

  return {
    ...result,
    reportMarkdown
  };
}

function runShellVerificationCommand(request: VerificationCommandRequest): Promise<VerificationCommandResult> {
  const startedAt = new Date().toISOString();

  return new Promise((resolveCommand) => {
    const child = spawn(request.command, {
      cwd: request.cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let resolved = false;

    const resolveOnce = (exitCode: number) => {
      if (resolved) {
        return;
      }

      resolved = true;
      resolveCommand({
        command: request.command,
        exitCode,
        startedAt,
        finishedAt: new Date().toISOString(),
        stdout,
        stderr,
        stdoutTruncated,
        stderrTruncated
      });
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      const captured = appendCapturedOutput(stdout, chunk.toString("utf8"), request.maxOutputCharacters);
      stdout = captured.output;
      stdoutTruncated ||= captured.truncated;
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const captured = appendCapturedOutput(stderr, chunk.toString("utf8"), request.maxOutputCharacters);
      stderr = captured.output;
      stderrTruncated ||= captured.truncated;
    });

    child.on("error", (error) => {
      const captured = appendCapturedOutput(stderr, error.message, request.maxOutputCharacters);
      stderr = captured.output;
      stderrTruncated ||= captured.truncated;
      resolveOnce(127);
    });

    child.on("close", (code) => {
      resolveOnce(code ?? 1);
    });
  });
}

function appendCapturedOutput(
  current: string,
  chunk: string,
  maxCharacters: number
): { output: string; truncated: boolean } {
  if (current.length >= maxCharacters) {
    return {
      output: current,
      truncated: chunk.length > 0
    };
  }

  const remaining = maxCharacters - current.length;

  return {
    output: `${current}${chunk.slice(0, remaining)}`,
    truncated: chunk.length > remaining
  };
}

function safeVerificationReportPath(cwd: string, path: string): string {
  if (!isSafeRelativeReportPath(path)) {
    throw new Error(`verify report ${path} failed: report path must be repository-relative`);
  }

  if (isLocalOnlyReportPath(path)) {
    throw new Error(`verify report ${path} failed: report path is local-only workflow state`);
  }

  const symlink = firstSymlinkPath(cwd, path);

  if (symlink) {
    throw new Error(`verify report ${path} failed: target path contains symlink ${symlink}`);
  }

  const root = resolve(cwd);
  const target = resolve(root, path);
  const fromRoot = relative(root, target);

  if (fromRoot === ".." || fromRoot.startsWith("../") || isAbsolute(fromRoot)) {
    throw new Error(`verify report ${path} failed: target path escapes ${root}`);
  }

  return target;
}

function preflightVerificationReportPath(cwd: string, path: string): void {
  const outputPath = safeVerificationReportPath(cwd, path);
  const outputStat = lstatSync(outputPath, { throwIfNoEntry: false });

  if (outputStat?.isDirectory()) {
    throw new Error(`verify report ${path} failed: report path is an existing directory`);
  }

  try {
    mkdirSync(dirname(outputPath), { recursive: true });
    accessSync(outputStat ? outputPath : dirname(outputPath), constants.W_OK);
  } catch (error) {
    throw new Error(
      `verify report ${path} failed: report path is not writable (${error instanceof Error ? error.message : String(error)})`
    );
  }
}

function isSafeRelativeReportPath(path: string): boolean {
  const segments = path.split("/");

  return (
    !path.startsWith("/") &&
    !/^[A-Za-z]:/.test(path) &&
    !path.includes("\\") &&
    segments.every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

function isLocalOnlyReportPath(path: string): boolean {
  return [".ai-workflow/runs/", ".ai-workflow/cache/", ".ai-workflow/tmp/"].some(
    (root) => path === root.slice(0, -1) || path.startsWith(root)
  );
}

function writeVerificationReport(cwd: string, reportPath: string, reportMarkdown: string): void {
  const outputPath = safeVerificationReportPath(cwd, reportPath);

  try {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, reportMarkdown);
  } catch (error) {
    throw new Error(
      `verify report ${reportPath} failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
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

function renderVerificationWorkflowResult(result: VerificationWorkflowResult): string {
  return [
    result.reportMarkdown,
    result.reportPath ? `Report written: ${result.reportPath}` : "Report not written: no --report path requested.",
    ""
  ].join("\n");
}

function renderVerificationReport(result: VerificationWorkflowResult): string {
  return [
    "# Verification Report",
    "",
    `Status: ${result.status}`,
    `Started: ${result.startedAt}`,
    `Finished: ${result.finishedAt}`,
    result.reportPath
      ? `Artifact: verified durable evidence at \`${result.reportPath}\``
      : "Artifact: stdout only; no durable report written",
    "Raw local artifacts: not written",
    "",
    "## Checks",
    ...result.checks.flatMap((check, index) => renderVerificationCheck(check, index)),
    ""
  ].join("\n");
}

function renderVerificationCheck(check: VerificationCommandResult, index: number): string[] {
  return [
    `### ${index + 1}. Command`,
    "command:",
    markdownCodeBlock(check.command),
    `- result: ${check.exitCode === 0 ? "pass" : "fail"}`,
    `- exit code: ${check.exitCode}`,
    `- started: ${check.startedAt}`,
    `- finished: ${check.finishedAt}`,
    "",
    ...renderCapturedOutput("stdout", check.stdout, check.stdoutTruncated),
    "",
    ...renderCapturedOutput("stderr", check.stderr, check.stderrTruncated),
    ""
  ];
}

function renderCapturedOutput(label: string, output: string, truncated: boolean): string[] {
  return [
    `${label}:`,
    markdownCodeBlock(output === "" ? "(empty)" : output),
    ...(truncated ? [`${label} truncated to ${maxVerificationOutputCharacters} characters.`] : [])
  ];
}

function markdownCodeBlock(output: string): string {
  const fence = "`".repeat(Math.max(3, longestBacktickRun(output) + 1));

  return `${fence}text\n${output.endsWith("\n") ? output : `${output}\n`}${fence}`;
}

function longestBacktickRun(output: string): number {
  return Math.max(0, ...Array.from(output.matchAll(/`+/g), (match) => match[0].length));
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
    "  pi-orc verify --cmd \"npm test\" [--cmd \"npm run build\"] [--report docs/ai/verified-reports/report.md]",
    "",
    "Dry-run prints a bootstrap plan only.",
    "Execution writes allowed local template files. GitHub and git actions require explicit confirmation.",
    "sync-review reads one PR review state and prints policy-gated next actions.",
    "verify runs explicit local checks and optionally writes a durable verification report.",
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
