import { describe, expect, it } from "vitest";

import { packageInfo, PiSdkWorkerRuntime } from "../src/index.js";

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
    });

    expect(result.runId).toBe("smoke-run");
    expect(result.status).toBe("failure");
    expect(result.artifacts).toEqual([]);
    expect(result.events[0]?.type).toBe("runtime.not_implemented");
    expect(result.errors[0]?.code).toBe("not_implemented");
  });

  it("rejects invalid handoffs before runtime execution", async () => {
    const runtime = new PiSdkWorkerRuntime();

    await expect(runtime.run({ version: "2" } as never)).rejects.toThrow();
  });
});
