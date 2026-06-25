import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isCliEntrypoint, runPiOrcCli } from "../src/cli/pi-orc.js";

const baseIntake = {
  projectName: "Sandbox App",
  repositoryOwner: "vnedyalk0v",
  repositoryName: "sandbox-app",
  repositoryVisibility: "private",
  description: "Sandbox execution target",
  defaultBranch: "main",
  githubProjectOwnerType: "user",
  githubProjectOwner: "vnedyalk0v",
  workflowMode: "assisted",
  stackProfile: "typescript",
  verificationCommands: ["npm test"],
  createDocsSkeleton: true,
  createGitHubProject: true,
  pushInitialCommit: true
};

function run(args: readonly string[], options: { cwd?: string } = {}) {
  let stdout = "";
  let stderr = "";
  const exitCode = runPiOrcCli(args, {
    stdout: {
      write: (chunk: string) => {
        stdout += chunk;
        return true;
      }
    },
    stderr: {
      write: (chunk: string) => {
        stderr += chunk;
        return true;
      }
    }
  }, options);

  return { exitCode, stdout, stderr };
}

function writeIntake(dir: string, overrides: Record<string, unknown> = {}) {
  const path = join(dir, "intake.json");

  writeFileSync(path, JSON.stringify({ ...baseIntake, ...overrides }, null, 2));
  return path;
}

describe("pi-orc CLI", () => {
  it("prints a new-project dry-run plan without executing mutations", () => {
    const result = run(["new-project", "--dry-run"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("# Bootstrap Plan: Example TypeScript App");
    expect(result.stdout).toContain("## GitHub Actions");
    expect(result.stdout).toContain("## Policy Gates");
    expect(result.stdout).toContain("Dry run: no GitHub, git, or file mutations executed.");
  });

  it("rejects execution without an explicit intake file", () => {
    const result = run(["new-project"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("new-project execution requires --intake path/to/intake.json");
  });

  it("writes assisted local template files and gates GitHub and git actions", () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-orc-assisted-"));

    try {
      const intakePath = writeIntake(dir);
      const result = run(["new-project", "--intake", intakePath], { cwd: dir });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(existsSync(join(dir, "AGENTS.md"))).toBe(true);
      expect(readFileSync(join(dir, ".gitignore"), "utf8")).toContain(".ai-workflow/runs/");
      expect(result.stdout).toContain("write-local-files: allowed");
      expect(result.stdout).toContain("github create-repository: requires-confirmation");
      expect(result.stdout).toContain("git commit: requires-confirmation");
      expect(existsSync(join(dir, ".git"))).toBe(false);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("keeps manual mode local file writes gated", () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-orc-manual-"));

    try {
      const intakePath = writeIntake(dir, { workflowMode: "manual" });
      const result = run(["new-project", "--intake", intakePath], { cwd: dir });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("write-local-files: requires-confirmation");
      expect(existsSync(join(dir, "AGENTS.md"))).toBe(false);
      expect(result.stdout).toContain("github create-repository: blocked");
      expect(result.stdout).toContain("git commit: blocked");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("rejects symlinked target path components before writing files", () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-orc-symlink-"));
    const outside = mkdtempSync(join(tmpdir(), "pi-orc-outside-"));

    try {
      const intakePath = writeIntake(dir);
      symlinkSync(outside, join(dir, "docs"));
      const result = run(["new-project", "--intake", intakePath], { cwd: dir });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("target path contains symlink docs");
      expect(existsSync(join(dir, "AGENTS.md"))).toBe(false);
    } finally {
      rmSync(dir, { force: true, recursive: true });
      rmSync(outside, { force: true, recursive: true });
    }
  });

  it("reports the failed local file action", () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-orc-failure-"));

    try {
      const intakePath = writeIntake(dir);
      writeFileSync(join(dir, "AGENTS.md"), "existing");
      const result = run(["new-project", "--intake", intakePath], { cwd: dir });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("write-local-files AGENTS.md failed:");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("detects the CLI entrypoint through a bin symlink", () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-orc-cli-"));
    const target = join(dir, "pi-orc.js");
    const link = join(dir, "pi-orc");

    try {
      writeFileSync(target, "");
      symlinkSync(target, link);

      expect(isCliEntrypoint(link, target)).toBe(true);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});
