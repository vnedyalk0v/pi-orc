import { describe, expect, it } from "vitest";

import { runGhCommandForTest } from "../src/github/GitHubAdapter.js";
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

  it("loads PR review context through read-only gh commands", async () => {
    const calls: string[][] = [];
    const adapter = new GhGitHubAdapter(async (args) => {
      calls.push([...args]);

      if (args[0] === "pr") {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            headRefOid: "abc123",
            statusCheckRollup: [
              {
                name: "verify",
                conclusion: "SUCCESS",
                detailsUrl: "https://github.com/owner/repo/actions/runs/1"
              }
            ]
          }),
          stderr: ""
        };
      }

      if (args[0] === "api" && args[1] === "graphql") {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            data: {
              repository: {
                pullRequest: {
                  comments: {
                    nodes: [
                      {
                        id: "issue-comment-node",
                        databaseId: 101,
                        author: { login: "chatgpt-codex-connector[bot]" },
                        body: "Top-level review signal."
                      }
                    ]
                  },
                  reviewThreads: {
                    nodes: [
                      {
                        id: "thread-1",
                        isResolved: false,
                        comments: {
                          nodes: [
                            {
                              id: "review-comment-node",
                              databaseId: 202,
                              author: { login: "chatgpt-codex-connector[bot]" },
                              body: "Inline review signal.",
                              path: "src/file.ts",
                              line: 12
                            }
                          ]
                        }
                      }
                    ]
                  }
                }
              }
            }
          }),
          stderr: ""
        };
      }

      return {
        exitCode: 0,
        stdout: JSON.stringify([
          [
            {
              user: { login: "chatgpt-codex-connector[bot]" },
              content: "+1",
              created_at: "2026-06-25T00:00:00.000Z"
            }
          ]
        ]),
        stderr: ""
      };
    });

    await expect(adapter.loadPullRequestReviewContext({ repository: "owner/repo", pullRequestNumber: 7 })).resolves.toMatchObject({
      repository: "owner/repo",
      pullRequestNumber: 7,
      headSha: "abc123",
      comments: [
        {
          id: "101",
          source: "review-bot",
          body: "Top-level review signal."
        }
      ],
      reviewThreads: [
        {
          id: "thread-1",
          isResolved: false,
          comments: [
            {
              id: "202",
              source: "review-bot",
              path: "src/file.ts",
              line: 12
            }
          ]
        }
      ],
      checks: [
        {
          name: "verify",
          state: "success"
        }
      ],
      botReactions: [
        {
          actor: "chatgpt-codex-connector[bot]",
          reaction: "thumbs-up"
        }
      ]
    });
    expect(calls.map((call) => call.slice(0, 2))).toEqual([
      ["pr", "view"],
      ["api", "graphql"],
      ["api", "repos/owner/repo/issues/7/reactions"]
    ]);
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

  it("bounds default runner execution time", async () => {
    await expect(
      runGhCommandForTest(["-e", "setTimeout(() => {}, 5000)"], {
        command: process.execPath,
        timeoutMs: 20
      })
    ).resolves.toMatchObject({
      exitCode: 1,
      stderr: "gh command timed out"
    });
  });

  it("caps default runner stderr output", async () => {
    const result = await runGhCommandForTest(["-e", "process.stderr.write('x'.repeat(20))"], {
      command: process.execPath,
      maxOutputBytes: 5
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("gh stderr exceeded 5 byte output limit");
    expect(result.stderr).toMatch(/^x{5}\n/);
  });
});
