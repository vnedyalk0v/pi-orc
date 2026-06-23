import { describe, expect, it } from "vitest";

import { GhGitHubAdapter } from "../src/index.js";
import type { GitHubCommandRunner } from "../src/index.js";

describe("GhGitHubAdapter", () => {
  it("checks gh authentication through the adapter boundary", async () => {
    const adapter = new GhGitHubAdapter(async (args) => ({
      exitCode: 0,
      stdout: args.join(" "),
      stderr: ""
    }));

    await expect(adapter.checkAuth("github.com")).resolves.toEqual({
      authenticated: true,
      output: {
        exitCode: 0,
        stdout: "auth status --active --hostname github.com",
        stderr: ""
      }
    });
  });

  it("plans typed GitHub mutations behind policy categories", () => {
    const adapter = new GhGitHubAdapter();

    expect(
      adapter.plan({
        kind: "create-repository",
        name: "owner/repo",
        visibility: "private",
        description: "New project"
      })
    ).toMatchObject({
      args: ["repo", "create", "owner/repo", "--private", "--description", "New project"],
      requiredPolicyAction: "create-github-repository",
      mutating: true
    });

    expect(
      adapter.plan({
        kind: "create-label",
        repository: "owner/repo",
        name: "status:ready",
        color: "0e8a16",
        description: "Ready to implement"
      })
    ).toMatchObject({
      args: [
        "label",
        "create",
        "status:ready",
        "--repo",
        "owner/repo",
        "--color",
        "0e8a16",
        "--description",
        "Ready to implement"
      ],
      requiredPolicyAction: "edit-github-repository-settings"
    });

    expect(
      adapter.plan({
        kind: "create-project",
        owner: "owner",
        title: "Roadmap"
      })
    ).toMatchObject({
      args: ["project", "create", "--owner", "owner", "--title", "Roadmap"],
      requiredPolicyAction: "create-github-project"
    });

    expect(
      adapter.plan({
        kind: "link-project",
        owner: "owner",
        projectNumber: 1,
        repository: "repo"
      })
    ).toMatchObject({
      args: ["project", "link", "1", "--owner", "owner", "--repo", "repo"],
      requiredPolicyAction: "edit-github-repository-settings"
    });

    expect(
      adapter.plan({
        kind: "create-issue",
        repository: "owner/repo",
        title: "Do work",
        body: "Details",
        labels: ["type:feature", "status:ready"]
      })
    ).toMatchObject({
      args: [
        "issue",
        "create",
        "--repo",
        "owner/repo",
        "--title",
        "Do work",
        "--body",
        "Details",
        "--label",
        "type:feature",
        "--label",
        "status:ready"
      ],
      requiredPolicyAction: "create-github-issue"
    });

    expect(
      adapter.plan({
        kind: "add-project-item",
        owner: "owner",
        projectNumber: 1,
        itemUrl: "https://github.com/owner/repo/issues/1"
      })
    ).toMatchObject({
      args: [
        "project",
        "item-add",
        "1",
        "--owner",
        "owner",
        "--url",
        "https://github.com/owner/repo/issues/1",
        "--format",
        "json"
      ],
      requiredPolicyAction: "add-issue-to-project"
    });
  });

  it("supports dry-run execution without invoking gh", async () => {
    const runner: GitHubCommandRunner = async (args) => {
      throw new Error(`runner should not be called: ${args.join(" ")}`);
    };
    const adapter = new GhGitHubAdapter(runner);

    await expect(
      adapter.execute(
        {
          kind: "create-issue",
          repository: "owner/repo",
          title: "Do work",
          body: "Details"
        },
        { dryRun: true }
      )
    ).resolves.toMatchObject({
      dryRun: true,
      success: true
    });
  });

  it("executes through the injected gh runner when dry-run is disabled", async () => {
    const calls: string[][] = [];
    const adapter = new GhGitHubAdapter(async (args) => {
      calls.push([...args]);

      return {
        exitCode: 0,
        stdout: "ok",
        stderr: ""
      };
    });

    await expect(
      adapter.execute(
        {
          kind: "create-project",
          owner: "owner",
          title: "Roadmap"
        },
        { dryRun: false }
      )
    ).resolves.toMatchObject({
      dryRun: false,
      success: true,
      output: {
        exitCode: 0,
        stdout: "ok",
        stderr: ""
      }
    });
    expect(calls).toEqual([["project", "create", "--owner", "owner", "--title", "Roadmap"]]);
  });

  it("surfaces failed gh execution without dropping command output", async () => {
    const adapter = new GhGitHubAdapter(async () => ({
      exitCode: 1,
      stdout: "",
      stderr: "failed"
    }));

    await expect(
      adapter.execute(
        {
          kind: "create-issue",
          repository: "owner/repo",
          title: "Do work",
          body: "Details"
        },
        { dryRun: false }
      )
    ).resolves.toMatchObject({
      dryRun: false,
      success: false,
      output: {
        exitCode: 1,
        stderr: "failed"
      }
    });
  });
});
