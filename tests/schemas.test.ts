import { describe, expect, it } from "vitest";

import {
  WorkerHandoffSchema,
  WorkerProfileSchema,
  WorkerRunResultSchema,
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

  it("accepts worker run results with artifacts, events, and errors", () => {
    const result = WorkerRunResultSchema.parse({
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
      events: [
        {
          type: "worker.started",
          message: "Worker started.",
          timestamp: "2026-06-23T00:00:00.000Z"
        }
      ],
      errors: [
        {
          code: "missing_context",
          message: "Required issue context missing."
        }
      ]
    });

    expect(result.artifacts[0]?.verified).toBe(true);
  });
});
