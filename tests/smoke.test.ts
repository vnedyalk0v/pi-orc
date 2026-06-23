import { describe, expect, it } from "vitest";

import { packageInfo, PiSdkWorkerRuntime } from "../src/index.js";
import type { WorkerHandoff, WorkerProfile } from "../src/index.js";

const profile: WorkerProfile = {
  id: "foundation-worker",
  title: "Foundation worker",
  purpose: "Exercise the SDK runtime skeleton.",
  contextPolicy: "issue-scoped",
  cleanContext: true,
  tools: {
    bash: "allow",
    github: "deny"
  },
  permissions: {
    mayEditFiles: true,
    mayRunBash: true,
    mayRunGitHubMutation: false,
    mayCommit: false,
    mayPush: false,
    mayCreatePullRequest: false,
    mayResolveReviewThread: false
  },
  outputContract: {
    requiredFiles: [],
    format: "markdown"
  }
};

const handoff: WorkerHandoff = {
  version: "1",
  runId: "smoke-run",
  workerId: "foundation-worker",
  objective: "No real SDK session should start in the skeleton.",
  relevantFiles: [],
  constraints: [],
  decisions: [],
  risks: [],
  expectedOutput: {
    requiredFiles: [],
    format: "markdown"
  },
  forbiddenActions: ["start real SDK session"]
};

describe("packageInfo", () => {
  it("exports stable package metadata", () => {
    expect(packageInfo).toEqual({
      name: "pi-orc",
      description: "Pi Orchestrator for verified AI development workflows."
    });
  });
});

describe("PiSdkWorkerRuntime", () => {
  it("exposes a clean-context SDK runtime skeleton", async () => {
    const runtime = new PiSdkWorkerRuntime();
    const result = await runtime.run({
      profile,
      handoff
    });

    expect(result.runId).toBe("smoke-run");
    expect(result.status).toBe("failure");
    expect(result.artifacts).toEqual([]);
    expect(result.events[0]?.type).toBe("runtime.not_implemented");
    expect(result.errors[0]?.code).toBe("not_implemented");
  });

  it("returns failure when profile id and handoff workerId differ", async () => {
    const runtime = new PiSdkWorkerRuntime();
    const result = await runtime.run({
      profile: {
        ...profile,
        id: "other-worker"
      },
      handoff
    });

    expect(result.status).toBe("failure");
    expect(result.events[0]?.type).toBe("runtime.profile_mismatch");
    expect(result.errors[0]?.code).toBe("profile_mismatch");
  });

  it("rejects invalid profiles before runtime execution", async () => {
    const runtime = new PiSdkWorkerRuntime();

    await expect(
      runtime.run({
        profile: {
          ...profile,
          cleanContext: false
        },
        handoff
      } as never)
    ).rejects.toThrow();
  });

  it("rejects invalid handoffs before runtime execution", async () => {
    const runtime = new PiSdkWorkerRuntime();

    await expect(
      runtime.run({
        profile,
        handoff: {
          ...handoff,
          version: "2"
        }
      } as never)
    ).rejects.toThrow();
  });
});
