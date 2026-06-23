import { describe, expect, it } from "vitest";

import { packageInfo } from "../src/index.js";

describe("packageInfo", () => {
  it("exports stable package metadata", () => {
    expect(packageInfo).toEqual({
      name: "pi-orc",
      description: "Pi Orchestrator for verified AI development workflows."
    });
  });
});
