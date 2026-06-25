import { describe, expect, it } from "vitest";

import { packageInfo, PiSdkWorkerRuntime } from "../src/index.js";
import type { PiSdkSessionFactoryOptions, WorkerHandoff, WorkerProfile, WorkerRunResult } from "../src/index.js";

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
  it("runs a clean-context SDK session and validates worker output", async () => {
    const workerResult: WorkerRunResult = {
      runId: "smoke-run",
      status: "success",
      summary: "Worker produced verified output.",
      artifacts: [],
      events: [
        {
          type: "worker.completed",
          message: "Worker completed.",
          timestamp: "2026-06-25T00:00:00.000Z"
        }
      ],
      errors: []
    };
    let factoryOptions: PiSdkSessionFactoryOptions | undefined;
    let prompted = "";
    let promptOptions: unknown;
    let disposed = false;
    const runtime = new PiSdkWorkerRuntime({
      createAgentSession: async (options) => {
        factoryOptions = options;

        return {
          prompt: async (text, options) => {
            prompted = text;
            promptOptions = options;
          },
          messages: [
            {
              role: "assistant",
              content: [
                {
                  type: "text",
                  text: JSON.stringify(workerResult)
                }
              ]
            }
          ],
          dispose: async () => {
            disposed = true;
          }
        };
      }
    });
    const result = await runtime.run({
      profile,
      handoff
    });

    expect(result).toEqual(workerResult);
    expect(factoryOptions?.profile.id).toBe("foundation-worker");
    expect(factoryOptions?.handoff.runId).toBe("smoke-run");
    expect(factoryOptions?.prompt).toContain("Do not assume parent chat history.");
    expect(prompted).toContain('"workerId": "foundation-worker"');
    expect(promptOptions).toEqual({ expandPromptTemplates: false });
    expect(disposed).toBe(true);
  });

  it("blocks execution when no SDK session factory is configured", async () => {
    const runtime = new PiSdkWorkerRuntime();
    const result = await runtime.run({
      profile,
      handoff
    });

    expect(result.status).toBe("blocked");
    expect(result.events[0]?.type).toBe("runtime.missing_session_factory");
    expect(result.errors[0]?.code).toBe("missing_session_factory");
  });

  it("returns failure when profile id and handoff workerId differ", async () => {
    let called = false;
    const runtime = new PiSdkWorkerRuntime({
      createAgentSession: async () => {
        called = true;
        throw new Error("must not start");
      }
    });
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
    expect(called).toBe(false);
  });

  it("returns failure when SDK output does not match WorkerRunResultSchema", async () => {
    const runtime = new PiSdkWorkerRuntime({
      createAgentSession: async () => ({
        prompt: async () => {},
        getLastAssistantText: () =>
          JSON.stringify({
            runId: "smoke-run",
            status: "success",
            summary: "Invalid success result.",
            artifacts: [],
            events: [],
            errors: [
              {
                code: "not_allowed",
                message: "success cannot include errors"
              }
            ]
          })
      })
    });
    const result = await runtime.run({
      profile,
      handoff
    });

    expect(result.status).toBe("failure");
    expect(result.events[0]?.type).toBe("runtime.invalid_worker_output");
    expect(result.errors[0]?.code).toBe("invalid_worker_output");
  });

  it("returns failure when success output misses required durable artifacts", async () => {
    const runtime = new PiSdkWorkerRuntime({
      createAgentSession: async () => ({
        prompt: async () => {},
        getLastAssistantText: () =>
          JSON.stringify({
            runId: "smoke-run",
            status: "success",
            summary: "Done but missing file.",
            artifacts: [],
            events: [
              {
                type: "worker.completed",
                message: "Worker completed.",
                timestamp: "2026-06-25T00:00:00.000Z"
              }
            ],
            errors: []
          })
      })
    });
    const result = await runtime.run({
      profile,
      handoff: {
        ...handoff,
        expectedOutput: {
          requiredFiles: ["docs/result.md"],
          format: "markdown"
        }
      }
    });

    expect(result.status).toBe("failure");
    expect(result.events[0]?.type).toBe("runtime.output_contract_mismatch");
    expect(result.errors[0]).toEqual({
      code: "output_contract_mismatch",
      message: "Worker success is missing required verified durable artifact(s): docs/result.md"
    });
  });

  it("returns failure when success output includes unverified required durable artifacts", async () => {
    const runtime = new PiSdkWorkerRuntime({
      createAgentSession: async () => ({
        prompt: async () => {},
        getLastAssistantText: () =>
          JSON.stringify({
            runId: "smoke-run",
            status: "success",
            summary: "Done with unverified file.",
            artifacts: [
              {
                path: "docs/result.md",
                kind: "durable",
                verified: false
              }
            ],
            events: [
              {
                type: "worker.completed",
                message: "Worker completed.",
                timestamp: "2026-06-25T00:00:00.000Z"
              }
            ],
            errors: []
          })
      })
    });
    const result = await runtime.run({
      profile,
      handoff: {
        ...handoff,
        expectedOutput: {
          requiredFiles: ["docs/result.md"],
          format: "markdown"
        }
      }
    });

    expect(result.status).toBe("failure");
    expect(result.events[0]?.type).toBe("runtime.output_contract_mismatch");
    expect(result.errors[0]).toEqual({
      code: "output_contract_mismatch",
      message: "Worker success is missing required verified durable artifact(s): docs/result.md"
    });
  });

  it("returns failure when SDK execution fails", async () => {
    const runtime = new PiSdkWorkerRuntime({
      createAgentSession: async () => {
        throw new Error("sdk unavailable");
      }
    });
    const result = await runtime.run({
      profile,
      handoff
    });

    expect(result.status).toBe("failure");
    expect(result.events[0]?.type).toBe("runtime.sdk_failure");
    expect(result.errors[0]).toEqual({
      code: "sdk_execution_failed",
      message: "sdk unavailable"
    });
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
