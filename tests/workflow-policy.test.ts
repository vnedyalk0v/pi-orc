import { describe, expect, it } from "vitest";

import {
  decideWorkflowAction,
  defaultWorkflowPolicies,
  workflowActionCategories,
  workflowModes
} from "../src/index.js";

describe("default workflow policies", () => {
  it("defines a decision for every action in every mode", () => {
    for (const mode of workflowModes) {
      const policy = defaultWorkflowPolicies[mode];

      expect(policy.mode).toBe(mode);
      expect(Object.keys(policy.decisions).sort()).toEqual([...workflowActionCategories].sort());
    }
  });

  it("keeps manual mode inspect-only by default", () => {
    const manual = defaultWorkflowPolicies.manual;

    expect(decideWorkflowAction(manual, "read-repository").status).toBe("allowed");
    expect(decideWorkflowAction(manual, "prepare-github-mutation").status).toBe("allowed");
    expect(decideWorkflowAction(manual, "write-local-files").status).toBe("requires-confirmation");
    expect(decideWorkflowAction(manual, "create-github-issue").status).toBe("blocked");
    expect(decideWorkflowAction(manual, "commit").status).toBe("blocked");
  });

  it("lets assisted mode do local work but gates GitHub and history changes", () => {
    const assisted = defaultWorkflowPolicies.assisted;

    expect(decideWorkflowAction(assisted, "write-local-files").status).toBe("allowed");
    expect(decideWorkflowAction(assisted, "run-local-command").status).toBe("allowed");
    expect(decideWorkflowAction(assisted, "edit-github-issue").status).toBe("requires-confirmation");
    expect(decideWorkflowAction(assisted, "edit-github-project-item").status).toBe("requires-confirmation");
    expect(decideWorkflowAction(assisted, "create-pull-request").status).toBe("requires-confirmation");
    expect(decideWorkflowAction(assisted, "resolve-review-thread").status).toBe("requires-confirmation");
    expect(decideWorkflowAction(assisted, "push").status).toBe("requires-confirmation");
  });

  it("allows auto mode local work without silently allowing dangerous actions", () => {
    const auto = defaultWorkflowPolicies.auto;

    expect(decideWorkflowAction(auto, "write-local-files").status).toBe("allowed");
    expect(decideWorkflowAction(auto, "create-github-issue").status).toBe("requires-confirmation");
    expect(decideWorkflowAction(auto, "force-push").status).toBe("blocked");
    expect(decideWorkflowAction(auto, "delete-repository").status).toBe("blocked");
    expect(decideWorkflowAction(auto, "rewrite-history").status).toBe("blocked");
  });
});
