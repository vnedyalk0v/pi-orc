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
    expect(plan.directories.map((directory) => directory.path)).toEqual(
      expect.arrayContaining(["docs", "docs/ai", "docs/ai/verified-reports"])
    );
    expect(plan.githubActions.map((action) => action.action.kind)).toEqual(
      expect.arrayContaining(["create-repository", "create-project", "create-label", "create-issue"])
    );
    expect(plan.gitActions.map((action) => action.kind)).toEqual(["init", "add-remote", "stage", "commit", "push"]);
    expect(plan.gitActions[0]?.command).toBe("git init -b 'main'");
    expect(plan.gitActions[1]?.command).toBe("git remote add origin 'git@github.com:vnedyalk0v/example-typescript-app.git'");
    expect(plan.gitActions[2]?.command).toContain("AGENTS.md");
    expect(plan.gitActions[2]?.command).toContain(".gitignore");
    expect(plan.policyGates.map((gate) => gate.action)).toEqual(
      expect.arrayContaining([
        "write-local-files",
        "run-local-command",
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

  it("quotes intake values in rendered git commands", () => {
    const plan = generateBootstrapPlan({
      ...typescriptIntake,
      repositoryName: "tricky'repo",
      defaultBranch: "feature&x"
    });

    expect(plan.gitActions.map((action) => action.command)).toEqual(
      expect.arrayContaining([
        "git init -b 'feature&x'",
        "git remote add origin 'git@github.com:vnedyalk0v/tricky'\\''repo.git'",
        "git commit -m 'chore: bootstrap tricky'\\''repo'",
        "git push -u origin 'feature&x'"
      ])
    );
  });
});
