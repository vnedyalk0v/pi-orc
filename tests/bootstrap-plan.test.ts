import { describe, expect, it } from "vitest";

import { createBootstrapPlanDryRun, generateBootstrapPlan, renderBootstrapPlanMarkdown } from "../src/index.js";

const typescriptIntake = {
  projectName: "Example TypeScript App",
  repositoryOwner: "vnedyalk0v",
  repositoryName: "example-typescript-app",
  repositoryVisibility: "private",
  description: "Example bootstrap target",
  workflowMode: "assisted",
  stackProfile: "typescript",
  verificationCommands: ["npm run typecheck", "npm test"],
  createGitHubProject: true,
  pushInitialCommit: true
};

describe("bootstrap plan generation", () => {
  it("generates a dry-run bootstrap plan from TypeScript intake", () => {
    const plan = generateBootstrapPlan(typescriptIntake);

    expect(plan.repository).toBe("vnedyalk0v/example-typescript-app");
    expect(plan.files.map((file) => file.path)).toEqual(
      expect.arrayContaining(["AGENTS.md", "README.md", ".gitignore", "docs/architecture.md"])
    );
    expect(plan.githubActions.map((action) => action.action.kind)).toEqual(
      expect.arrayContaining(["create-repository", "create-project", "create-label", "create-issue"])
    );
    expect(plan.gitActions.map((action) => action.kind)).toEqual(["commit", "push"]);
    expect(plan.policyGates.map((gate) => gate.action)).toEqual(
      expect.arrayContaining([
        "write-local-files",
        "create-github-repository",
        "create-github-project",
        "edit-github-repository-settings",
        "create-github-issue",
        "commit",
        "push"
      ])
    );
  });

  it("renders the bootstrap plan as readable Markdown", () => {
    const markdown = renderBootstrapPlanMarkdown(generateBootstrapPlan(typescriptIntake));

    expect(markdown).toContain("# Bootstrap Plan: Example TypeScript App");
    expect(markdown).toContain("## Files");
    expect(markdown).toContain("## GitHub Actions");
    expect(markdown).toContain("## Policy Gates");
  });

  it("creates printable dry-run output without mutation", () => {
    const dryRun = createBootstrapPlanDryRun(typescriptIntake);

    expect(dryRun.mutates).toBe(false);
    expect(dryRun.markdown).toContain("Repository: `vnedyalk0v/example-typescript-app`");
  });
});
