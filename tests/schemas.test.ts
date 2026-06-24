import { describe, expect, it } from "vitest";

import {
  NewProjectIntakeSchema,
  WorkerHandoffSchema,
  WorkerProfileSchema,
  WorkerRunResultSchema,
  WorkflowArtifactSchema,
  type WorkerProfile
} from "../src/index.js";

const permissions = {
  mayEditFiles: true,
  mayRunBash: true,
  mayRunGitHubMutation: false,
  mayCommit: false,
  mayPush: false,
  mayCreatePullRequest: false,
  mayResolveReviewThread: false
};

const event = {
  type: "worker.started",
  message: "Worker started.",
  timestamp: "2026-06-23T00:00:00.000Z"
};

const error = {
  code: "missing_context",
  message: "Required issue context missing."
};

describe("worker contract schemas", () => {
  it("accepts a strict SDK worker profile", () => {
    const profile: WorkerProfile = WorkerProfileSchema.parse({
      id: "plan-writer",
      title: "Plan writer",
      purpose: "Write verified workflow plans.",
      contextPolicy: "issue-scoped",
      cleanContext: true,
      tools: {
        bash: "allow",
        github: "deny"
      },
      permissions,
      outputContract: {
        requiredFiles: ["plans/README.md"],
        format: "markdown"
      }
    });

    expect(profile.permissions.mayCommit).toBe(false);
  });

  it("rejects invalid handoffs before worker execution", () => {
    const result = WorkerHandoffSchema.safeParse({
      version: "1",
      runId: "run-1",
      workerId: "plan-writer",
      objective: "",
      relevantFiles: [],
      constraints: [],
      decisions: [],
      risks: [],
      expectedOutput: {
        requiredFiles: [],
        format: "yaml"
      },
      forbiddenActions: []
    });

    expect(result.success).toBe(false);
  });

  it("accepts success results with empty errors", () => {
    const result = WorkerRunResultSchema.parse({
      runId: "run-1",
      status: "success",
      summary: "Worker produced verified output.",
      artifacts: [],
      events: [event],
      errors: []
    });

    expect(result.status).toBe("success");
  });

  it("rejects success results with non-empty errors", () => {
    const result = WorkerRunResultSchema.safeParse({
      runId: "run-1",
      status: "success",
      summary: "Worker produced verified output.",
      artifacts: [],
      events: [event],
      errors: [error]
    });

    expect(result.success).toBe(false);
  });

  it("accepts failure and blocked worker run results with errors", () => {
    const failure = WorkerRunResultSchema.parse({
      runId: "run-1",
      status: "failure",
      summary: "Worker stopped before durable output.",
      artifacts: [
        {
          path: "plans/README.md",
          kind: "durable",
          verified: true
        }
      ],
      events: [event],
      errors: [error]
    });
    const blocked = WorkerRunResultSchema.parse({
      runId: "run-2",
      status: "blocked",
      summary: "Worker needs missing context.",
      artifacts: [],
      events: [event],
      errors: [error]
    });

    expect(failure.artifacts[0]?.verified).toBe(true);
    expect(blocked.errors[0]?.code).toBe("missing_context");
  });

  it("enforces raw artifact hygiene while allowing durable verification states", () => {
    expect(
      WorkflowArtifactSchema.parse({
        path: ".ai-workflow/runs/run-1/raw.md",
        kind: "raw",
        verified: false
      }).verified
    ).toBe(false);

    expect(
      WorkflowArtifactSchema.safeParse({
        path: ".ai-workflow/runs/run-1/raw.md",
        kind: "raw",
        verified: true
      }).success
    ).toBe(false);

    expect(
      WorkflowArtifactSchema.parse({
        path: "docs/ai/verified-reports/run-1.md",
        kind: "durable",
        verified: true
      }).verified
    ).toBe(true);

    expect(
      WorkflowArtifactSchema.parse({
        path: "docs/ai/verified-reports/run-1.md",
        kind: "durable",
        verified: false
      }).verified
    ).toBe(false);
  });
});

describe("new project intake schema", () => {
  it("applies documented defaults to minimal intake", () => {
    const intake = NewProjectIntakeSchema.parse({
      projectName: "Example App",
      repositoryOwner: "vnedyalk0v",
      repositoryName: "example-app"
    });

    expect(intake).toMatchObject({
      repositoryVisibility: "private",
      description: "",
      defaultBranch: "main",
      githubProjectOwnerType: "user",
      githubProjectOwner: "vnedyalk0v",
      workflowMode: "assisted",
      stackProfile: "generic",
      verificationCommands: [],
      createDocsSkeleton: true,
      createGitHubProject: false,
      pushInitialCommit: false
    });
  });

  it("represents organization project ownership and workflow modes", () => {
    const intake = NewProjectIntakeSchema.parse({
      projectName: "Example App",
      repositoryOwner: "example-org",
      repositoryName: "example-app",
      repositoryVisibility: "public",
      githubProjectOwnerType: "organization",
      githubProjectOwner: "example-org",
      workflowMode: "auto",
      stackProfile: "typescript",
      verificationCommands: ["npm run typecheck", "npm test"],
      createGitHubProject: true,
      pushInitialCommit: true
    });

    expect(intake.githubProjectOwnerType).toBe("organization");
    expect(intake.workflowMode).toBe("auto");
    expect(intake.verificationCommands).toEqual(["npm run typecheck", "npm test"]);
  });

  it("accepts valid GitHub and git identifiers", () => {
    const intake = NewProjectIntakeSchema.parse({
      projectName: "Example App",
      repositoryOwner: "a".repeat(39),
      repositoryName: "a".repeat(100),
      defaultBranch: "a".repeat(250),
      githubProjectOwner: "example-org"
    });

    expect(intake.repositoryOwner).toHaveLength(39);
    expect(intake.repositoryName).toHaveLength(100);
    expect(intake.githubProjectOwner).toBe("example-org");
    expect(intake.defaultBranch).toHaveLength(250);

    expect(
      NewProjectIntakeSchema.safeParse({
        projectName: "Example App",
        repositoryOwner: "vnedyalk0v",
        repositoryName: "example-app",
        defaultBranch: "\u{1F600}".repeat(62)
      }).success
    ).toBe(true);

    expect(
      NewProjectIntakeSchema.safeParse({
        projectName: "Example App",
        repositoryOwner: "vnedyalk0v",
        repositoryName: "example-app",
        defaultBranch: "release]candidate"
      }).success
    ).toBe(true);

    expect(
      NewProjectIntakeSchema.safeParse({
        projectName: "Example App",
        repositoryOwner: "vnedyalk0v",
        repositoryName: "example-app",
        defaultBranch: `${"a/".repeat(1783)}a`
      }).success
    ).toBe(true);
  });

  it("rejects invalid GitHub and git identifiers", () => {
    const baseIntake = {
      projectName: "Example App",
      repositoryOwner: "vnedyalk0v",
      repositoryName: "example-app"
    };

    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, repositoryOwner: "bad owner" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, repositoryOwner: "bad/owner" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, repositoryOwner: "a".repeat(40) }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, githubProjectOwner: "a".repeat(40) }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, repositoryName: "bad/repo" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, repositoryName: "a".repeat(101) }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, repositoryName: "foo.git" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, repositoryName: "foo.wiki" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, repositoryName: "foo.GIT" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: "feature bad" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: "release[candidate" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: "feature..bad" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: "/feature" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: "feature//x" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: "foo@{bar" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: "HEAD" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: "refs/heads/main" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: "a".repeat(40) }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: "-bad" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: "+main" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: ".hidden" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: "release.lock/hotfix" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: "feature/.hidden" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: "feature/hotfix.lock" }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: "a".repeat(251) }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: "\u{1F600}".repeat(63) }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: `${"a/".repeat(1784)}a` }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: `${"a/".repeat(2039)}a` }).success).toBe(false);
    expect(NewProjectIntakeSchema.safeParse({ ...baseIntake, defaultBranch: `${"a/".repeat(2040)}a` }).success).toBe(false);
  });

  it("rejects unknown fields and unsupported enum values", () => {
    expect(
      NewProjectIntakeSchema.safeParse({
        projectName: "Example App",
        repositoryOwner: "vnedyalk0v",
        repositoryName: "example-app",
        workflowMode: "autonomous"
      }).success
    ).toBe(false);

    expect(
      NewProjectIntakeSchema.safeParse({
        projectName: "Example App",
        repositoryOwner: "vnedyalk0v",
        repositoryName: "example-app",
        unexpected: true
      }).success
    ).toBe(false);
  });
});
