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
      id: "smoke-run",
      profile: {
        id: "foundation-worker",
        name: "Foundation worker",
        cleanContext: true
      },
      prompt: "No real SDK session should start in the skeleton."
    });

    expect(result.status).toBe("failure");
    expect(result.artifacts).toEqual([]);
    expect(result.events[0]?.type).toBe("runtime.not_implemented");
    expect(result.errors[0]?.code).toBe("not_implemented");
  });
});
