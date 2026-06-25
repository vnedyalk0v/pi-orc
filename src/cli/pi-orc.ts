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
  renderBootstrapPlanMarkdown
} from "../index.js";
import type { BootstrapFileAction, BootstrapPlan, WorkflowPolicyDecisionStatus } from "../index.js";
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
}

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const targetRepoTemplateRoot = join(packageRoot, "templates", "target-repo");

export function runPiOrcCli(
  args: readonly string[],
  streams: PiOrcCliStreams = process,
  options: PiOrcCliOptions = {}
): number {
  try {
    const command = parseArgs(args);

    if (command.kind === "help") {
      streams.stdout.write(helpText());
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
      kind: "help";
    };

function parseArgs(args: readonly string[]): ParsedCommand {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return { kind: "help" };
  }

  const [command, ...rest] = args;

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
    "",
    "Dry-run prints a bootstrap plan only.",
    "Execution writes allowed local template files. GitHub and git actions require explicit confirmation.",
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
  process.exitCode = runPiOrcCli(process.argv.slice(2));
}
