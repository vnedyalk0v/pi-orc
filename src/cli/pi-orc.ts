#!/usr/bin/env node

import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createBootstrapPlanDryRun } from "../index.js";
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

export function runPiOrcCli(args: readonly string[], streams: PiOrcCliStreams = process): number {
  try {
    const command = parseArgs(args);

    if (command.kind === "help") {
      streams.stdout.write(helpText());
      return 0;
    }

    const intake = command.intakePath ? readJson(command.intakePath) : sampleNewProjectIntake;
    const dryRun = createBootstrapPlanDryRun(intake);

    streams.stdout.write(`${dryRun.markdown}\n\nDry run: no GitHub, git, or file mutations executed.\n`);
    return 0;
  } catch (error) {
    streams.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    streams.stderr.write(helpText());
    return 1;
  }
}

type ParsedCommand =
  | {
      kind: "new-project-dry-run";
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

  if (!dryRun) {
    throw new Error("new-project currently requires --dry-run");
  }

  return {
    kind: "new-project-dry-run",
    ...(intakePath ? { intakePath } : {})
  };
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function helpText(): string {
  return [
    "Usage:",
    "  pi-orc new-project --dry-run [--intake path/to/intake.json]",
    "",
    "Prints a bootstrap plan only. Does not create repositories, projects, issues, commits, or pushes.",
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
