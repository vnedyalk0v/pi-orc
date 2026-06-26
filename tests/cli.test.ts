import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isCliEntrypoint, runPiOrcCli } from "../src/cli/pi-orc.js";
import type {
  IssueStartAdapter,
  IssueStartContext,
  PullRequestReviewContext,
  PullRequestReviewContextAdapter
} from "../src/index.js";

type CliOptions = NonNullable<Parameters<typeof runPiOrcCli>[2]>;
type VerificationRunner = NonNullable<CliOptions["verificationRunner"]>;

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

const baseReviewContext: PullRequestReviewContext = {
  repository: "owner/repo",
  pullRequestNumber: 7,
  headSha: "abc123",
  comments: [],
  reviewThreads: [],
  checks: [
    {
      name: "verify",
      state: "success",
      detailsUrl: "https://github.com/owner/repo/actions/runs/1"
    }
  ],
  botReactions: [
    {
      actor: "chatgpt-codex-connector[bot]",
      reaction: "eyes",
      createdAt: "2026-06-25T00:00:00.000Z"
    }
  ]
};

const baseIssueStartContext: IssueStartContext = {
  issue: {
    number: 95,
    title: "feat(cli): add issue start workflow",
    state: "open",
    url: "https://github.com/owner/repo/issues/95",
    labels: ["type:feature", "priority:p1", "status:ready", "source:manual"],
    assignees: ["vnedyalk0v"]
  },
  project: {
    id: "project-id",
    statusFieldId: "status-field-id",
    inProgressOptionId: "in-progress-option-id"
  },
  projectItem: {
    id: "item-id",
    status: "Todo",
    priority: "P1",
    type: "feature",
    area: "workflow",
    source: "manual"
  }
};

function fakeReviewAdapter(context: PullRequestReviewContext): PullRequestReviewContextAdapter {
  return {
    loadPullRequestReviewContext: async () => context
  };
}

function fakeIssueStartAdapter(context: IssueStartContext): IssueStartAdapter {
  return {
    loadIssueStartContext: async () => context,
    addIssueAssignee: async () => {},
    addIssueToProject: async () => {},
    replaceIssueStatusLabels: async () => {},
    setIssueProjectStatus: async () => {}
  };
}

function fakeVerificationRunner(
  results: Record<string, { exitCode: number; stdout?: string; stderr?: string }> = {}
): VerificationRunner {
  return async ({ command }) => {
    const result = results[command] ?? { exitCode: 0, stdout: "ok\n", stderr: "" };

    return {
      command,
      exitCode: result.exitCode,
      startedAt: "2026-06-25T00:00:00.000Z",
      finishedAt: "2026-06-25T00:00:01.000Z",
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      stdoutTruncated: false,
      stderrTruncated: false
    };
  };
}

async function run(args: readonly string[], options: CliOptions = {}) {
  let stdout = "";
  let stderr = "";
  const exitCode = await runPiOrcCli(
    args,
    {
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
    },
    options
  );

  return { exitCode, stdout, stderr };
}

function writeIntake(dir: string, overrides: Record<string, unknown> = {}) {
  const path = join(dir, "intake.json");

  writeFileSync(path, JSON.stringify({ ...baseIntake, ...overrides }, null, 2));
  return path;
}

describe("pi-orc CLI", () => {
  it("prints a new-project dry-run plan without executing mutations", async () => {
    const result = await run(["new-project", "--dry-run"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("# Bootstrap Plan: Example TypeScript App");
    expect(result.stdout).toContain("## GitHub Actions");
    expect(result.stdout).toContain("## Policy Gates");
    expect(result.stdout).toContain("Dry run: no GitHub, git, or file mutations executed.");
  });

  it("rejects execution without an explicit intake file", async () => {
    const result = await run(["new-project"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("new-project execution requires --intake path/to/intake.json");
  });

  it("writes assisted local template files and gates GitHub and git actions", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-orc-assisted-"));

    try {
      const intakePath = writeIntake(dir);
      const result = await run(["new-project", "--intake", intakePath], { cwd: dir });

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

  it("keeps manual mode local file writes gated", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-orc-manual-"));

    try {
      const intakePath = writeIntake(dir, { workflowMode: "manual" });
      const result = await run(["new-project", "--intake", intakePath], { cwd: dir });

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

  it("rejects symlinked target path components before writing files", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-orc-symlink-"));
    const outside = mkdtempSync(join(tmpdir(), "pi-orc-outside-"));

    try {
      const intakePath = writeIntake(dir);
      symlinkSync(outside, join(dir, "docs"));
      const result = await run(["new-project", "--intake", intakePath], { cwd: dir });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("target path contains symlink docs");
      expect(existsSync(join(dir, "AGENTS.md"))).toBe(false);
    } finally {
      rmSync(dir, { force: true, recursive: true });
      rmSync(outside, { force: true, recursive: true });
    }
  });

  it("reports the failed local file action", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-orc-failure-"));

    try {
      const intakePath = writeIntake(dir);
      writeFileSync(join(dir, "AGENTS.md"), "existing");
      const result = await run(["new-project", "--intake", intakePath], { cwd: dir });

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

  it("runs verification commands and prints a passing report", async () => {
    const result = await run(["verify", "--cmd", "npm test", "--cmd", "npm run build"], {
      verificationRunner: fakeVerificationRunner({
        "npm test": { exitCode: 0, stdout: "  padded  " },
        "npm run build": { exitCode: 0, stdout: "ok\n" }
      })
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("# Verification Report");
    expect(result.stdout).toContain("Status: pass");
    expect(result.stdout).toContain("Artifact: stdout only; no durable report written");
    expect(result.stdout).toContain("### 1. Command");
    expect(result.stdout).toContain("```text\nnpm test\n```");
    expect(result.stdout).toContain("```text\nnpm run build\n```");
    expect(result.stdout).toContain("```text\n  padded  \n```");
    expect(result.stdout).toContain("pi-orc raw local artifacts: not written; requested commands may write their own files");
  });

  it("returns failure when a verification command exits non-zero", async () => {
    const result = await run(["verify", "--cmd", "npm test", "--cmd", "npm run build"], {
      verificationRunner: fakeVerificationRunner({
        "npm test": { exitCode: 0, stdout: "tests passed\n" },
        "npm run build": { exitCode: 2, stderr: "build failed\n" }
      })
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Status: fail");
    expect(result.stdout).toContain("```text\nnpm run build\n```");
    expect(result.stdout).toContain("- exit code: 2");
    expect(result.stdout).toContain("build failed");
  });

  it("uses fenced command text when commands contain backticks", async () => {
    const command = "echo ```";
    const result = await run(["verify", "--cmd", command], {
      verificationRunner: fakeVerificationRunner({
        [command]: { exitCode: 0, stdout: "ok\n" }
      })
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("````text\necho ```\n````");
  });

  it("uses longer report fences when captured output contains backticks", async () => {
    const result = await run(["verify", "--cmd", "npm test"], {
      verificationRunner: fakeVerificationRunner({
        "npm test": { exitCode: 0, stdout: "```md\n# heading\n```\n" }
      })
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("````text\n```md\n# heading\n```\n````");
  });

  it("preserves UTF-8 output split across shell output chunks", async () => {
    const command = `"${process.execPath}" -e "const b = Buffer.from([0xcf, 0x80]); process.stdout.write(b.subarray(0, 1)); setTimeout(() => process.stdout.write(b.subarray(1)), 0);"`;
    const result = await run(["verify", "--cmd", command]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("π");
    expect(result.stdout).not.toContain("�");
  });

  it("rejects verify without explicit commands", async () => {
    const result = await run(["verify"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("verify requires at least one --cmd command");
  });

  it("rejects blank verification commands", async () => {
    const result = await run(["verify", "--cmd", "   "]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--cmd requires a command string");
  });

  it("writes a durable verification report when requested", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-orc-verify-report-"));

    try {
      const reportPath = "docs/ai/verified-reports/verification.md";
      const result = await run(["verify", "--cmd", "npm test", "--report", reportPath], {
        cwd: dir,
        verificationRunner: fakeVerificationRunner({
          "npm test": { exitCode: 0, stdout: "verified\n" }
        })
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain(`Report written: ${reportPath}`);
      expect(readFileSync(join(dir, reportPath), "utf8")).toContain(
        `Artifact: verified durable evidence at \`${reportPath}\``
      );
      expect(readFileSync(join(dir, reportPath), "utf8")).toContain("verified");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("rejects verify reports under local-only workflow state before running commands", async () => {
    let called = false;
    const runner: VerificationRunner = async ({ command }) => {
      called = true;

      return {
        command,
        exitCode: 0,
        startedAt: "2026-06-25T00:00:00.000Z",
        finishedAt: "2026-06-25T00:00:01.000Z",
        stdout: "",
        stderr: "",
        stdoutTruncated: false,
        stderrTruncated: false
      };
    };
    const result = await run(
      ["verify", "--cmd", "npm test", "--report", ".ai-workflow/runs/verification.md"],
      {
        verificationRunner: runner
      }
    );

    expect(result.exitCode).toBe(1);
    expect(called).toBe(false);
    expect(result.stderr).toContain("report path is local-only workflow state");
  });

  it("rejects case variants of local-only verify report paths", async () => {
    const result = await run(["verify", "--cmd", "npm test", "--report", ".AI-WORKFLOW/runs/verification.md"], {
      verificationRunner: fakeVerificationRunner()
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("report path is local-only workflow state");
  });

  it("rejects verify reports that point at an existing directory before running commands", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-orc-verify-dir-"));
    let called = false;
    const runner: VerificationRunner = async ({ command }) => {
      called = true;

      return {
        command,
        exitCode: 0,
        startedAt: "2026-06-25T00:00:00.000Z",
        finishedAt: "2026-06-25T00:00:01.000Z",
        stdout: "",
        stderr: "",
        stdoutTruncated: false,
        stderrTruncated: false
      };
    };

    try {
      mkdirSync(join(dir, "docs/ai/verified-reports"), { recursive: true });
      const result = await run(["verify", "--cmd", "npm test", "--report", "docs/ai/verified-reports"], {
        cwd: dir,
        verificationRunner: runner
      });

      expect(result.exitCode).toBe(1);
      expect(called).toBe(false);
      expect(result.stderr).toContain("report path is an existing directory");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("prints a read-only sync-review summary with no comments", async () => {
    const result = await run(["sync-review", "--repo", "owner/repo", "--pr", "7"], {
      reviewAdapter: fakeReviewAdapter(baseReviewContext)
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("# PR Review Sync: owner/repo#7");
    expect(result.stdout).toContain("Summary: 0 valid, 0 rejected, 0 unresolved review-bot comment(s).");
    expect(result.stdout).toContain("- verify: success");
    expect(result.stdout).toContain("Read-only: no comments, review-thread resolutions, commits, pushes, or merges executed.");
  });

  it("prints a dry-run start-issue plan for one explicit issue", async () => {
    const result = await run(
      [
        "start-issue",
        "--repo",
        "owner/repo",
        "--issue",
        "95",
        "--project-owner",
        "owner",
        "--project",
        "7",
        "--assignee",
        "vnedyalk0v"
      ],
      {
        issueStartAdapter: fakeIssueStartAdapter(baseIssueStartContext)
      }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("# Issue Start: https://github.com/owner/repo/issues/95");
    expect(result.stdout).toContain("- replace-status-label: requires-confirmation; executed=false");
    expect(result.stdout).toContain("- set-project-status: requires-confirmation; executed=false");
    expect(result.stdout).toContain("Proposed: feat/add-issue-start-workflow");
    expect(result.stdout).toContain("Dry run: no GitHub issue/project mutations executed.");
  });

  it("rejects start-issue without one explicit issue", async () => {
    const result = await run(["start-issue", "--repo", "owner/repo", "--project-owner", "owner", "--project", "7"], {
      issueStartAdapter: fakeIssueStartAdapter(baseIssueStartContext)
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("start-issue requires --issue number");
  });

  it("rejects start-issue without an explicit assignee", async () => {
    const result = await run(["start-issue", "--repo", "owner/repo", "--issue", "95", "--project-owner", "owner", "--project", "7"], {
      issueStartAdapter: fakeIssueStartAdapter(baseIssueStartContext)
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("start-issue requires --assignee user");
  });

  it("prints valid sync-review comments with policy-gated reply plans", async () => {
    const result = await run(["sync-review", "--repo", "owner/repo", "--pr", "7"], {
      reviewAdapter: fakeReviewAdapter({
        ...baseReviewContext,
        reviewThreads: [
          {
            id: "thread-1",
            isResolved: false,
            comments: [
              {
                id: "comment-1",
                source: "review-bot",
                author: "chatgpt-codex-connector[bot]",
                body: "Missing guard.",
                path: "src/file.ts",
                line: 12,
                verification: {
                  status: "valid",
                  evidence: "Guard is absent.",
                  fixPlan: "Add guard."
                }
              }
            ]
          }
        ]
      })
    });

    expect(result.stdout).toContain("## Valid Review-Bot Comments");
    expect(result.stdout).toContain("- comment-1 src/file.ts:12: Missing guard.");
    expect(result.stdout).toContain("fix: Add guard.");
    expect(result.stdout).toContain("- comment-on-review comment-1: requires-confirmation");
  });

  it("prints rejected sync-review comments separately", async () => {
    const result = await run(["sync-review", "--repo", "owner/repo", "--pr", "7"], {
      reviewAdapter: fakeReviewAdapter({
        ...baseReviewContext,
        comments: [
          {
            id: "comment-2",
            source: "review-bot",
            author: "chatgpt-codex-connector[bot]",
            body: "Missing export.",
            verification: {
              status: "invalid",
              evidence: "Export exists.",
              rejectionReason: "Reply with export evidence."
            }
          }
        ]
      })
    });

    expect(result.stdout).toContain("## Rejected Review-Bot Comments");
    expect(result.stdout).toContain("- comment-2: Missing export.");
    expect(result.stdout).toContain("reply: Reply with export evidence.");
  });

  it("prints unresolved sync-review comments and verification steps", async () => {
    const result = await run(["sync-review", "--repo", "owner/repo", "--pr", "7"], {
      reviewAdapter: fakeReviewAdapter({
        ...baseReviewContext,
        reviewThreads: [
          {
            id: "thread-2",
            isResolved: false,
            comments: [
              {
                id: "comment-3",
                source: "review-bot",
                author: "chatgpt-codex-connector[bot]",
                body: "Maybe stale.",
                verification: {
                  status: "unresolved",
                  reason: "Needs code check.",
                  nextStep: "Inspect current branch."
                }
              }
            ]
          }
        ]
      })
    });

    expect(result.stdout).toContain("## Unresolved Review-Bot Comments");
    expect(result.stdout).toContain("next: Inspect current branch.");
    expect(result.stdout).toContain("- comment-3 in thread-2: Inspect current branch.");
  });

  it("rejects sync-review without explicit inputs", async () => {
    const result = await run(["sync-review", "--repo", "owner/repo"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("sync-review requires --pr number");
  });
});
