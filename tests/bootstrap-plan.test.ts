import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createBootstrapPlanDryRun, generateBootstrapPlan, renderBootstrapPlanMarkdown } from "../src/index.js";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "new-project");
const fixtureNames = [
  "personal-project",
  "organization-project",
  "typescript-project",
  "unknown-stack-project"
] as const;
const fixtures = Object.fromEntries(fixtureNames.map((name) => [name, readFixture(name)]));
const typescriptIntake = fixtures["typescript-project"];

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
    expect(
      plan.githubActions.flatMap(({ action }) =>
        action.kind === "create-label" && action.name.startsWith("status:") ? [action.name] : []
      )
    ).toEqual(expect.arrayContaining(["status:ready", "status:in-progress", "status:blocked", "status:done"]));
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
    expect(markdown).toContain("create-label `status:in-progress`");
    expect(markdown).toContain("create-issue `chore: verify project foundation`");
    expect(markdown).toContain("## Policy Gates");
  });

  it("creates printable dry-run output without mutation", () => {
    const dryRun = createBootstrapPlanDryRun(typescriptIntake);

    expect(dryRun.mutates).toBe(false);
    expect(dryRun.markdown).toContain("Repository: `vnedyalk0v/example-typescript-app`");
  });

  it("quotes valid intake values in rendered git commands", () => {
    const plan = generateBootstrapPlan({
      ...typescriptIntake,
      repositoryName: "tricky.repo_name-x",
      defaultBranch: "feature&x"
    });

    expect(plan.gitActions.map((action) => action.command)).toEqual(
      expect.arrayContaining([
        "git init -b 'feature&x'",
        "git remote add origin 'git@github.com:vnedyalk0v/tricky.repo_name-x.git'",
        "git commit -m 'chore: bootstrap tricky.repo_name-x'",
        "git push -u origin 'feature&x'"
      ])
    );
  });

  it.each(fixtureNames)("generates a non-mutating dry-run plan for %s", (fixtureName) => {
    const dryRun = createBootstrapPlanDryRun(fixtures[fixtureName]);
    const filePaths = dryRun.plan.files.map((file) => file.path);
    const githubActionKinds = dryRun.plan.githubActions.map((action) => action.action.kind);
    const policyGates = dryRun.plan.policyGates.map((gate) => gate.action);

    expect(dryRun.mutates).toBe(false);
    expect(filePaths).toEqual(
      expect.arrayContaining(["AGENTS.md", "README.md", ".ai-workflow/config.yml", ".github/pull_request_template.md"])
    );
    expect(githubActionKinds).toEqual(expect.arrayContaining(["create-repository", "create-label", "create-issue"]));
    expect(policyGates).toEqual(
      expect.arrayContaining([
        "write-local-files",
        "create-github-repository",
        "edit-github-repository-settings",
        "create-github-issue"
      ])
    );
    expect(dryRun.markdown).toContain("## Files");
    expect(dryRun.markdown).toContain("## GitHub Actions");
    expect(dryRun.markdown).toContain("## Policy Gates");
  });

  it("plans GitHub Projects for personal and organization fixtures", () => {
    const personalProject = generateBootstrapPlan(fixtures["personal-project"]).githubActions.find(
      (action) => action.action.kind === "create-project"
    )?.action;
    const organizationProject = generateBootstrapPlan(fixtures["organization-project"]).githubActions.find(
      (action) => action.action.kind === "create-project"
    )?.action;

    expect(personalProject).toMatchObject({ kind: "create-project", owner: "vnedyalk0v" });
    expect(organizationProject).toMatchObject({ kind: "create-project", owner: "example-org" });
  });
});

function readFixture(name: (typeof fixtureNames)[number]): Record<string, unknown> {
  return JSON.parse(readFileSync(join(fixtureDir, `${name}.json`), "utf8")) as Record<string, unknown>;
}
