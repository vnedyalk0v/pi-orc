import { describe, expect, it } from "vitest";

import { defaultWorkflowPolicies, syncPullRequestReview } from "../src/index.js";
import type { PullRequestReviewContext, PullRequestReviewContextAdapter } from "../src/index.js";

const baseContext: PullRequestReviewContext = {
  repository: "owner/repo",
  pullRequestNumber: 7,
  headSha: "abc123",
  comments: [],
  reviewThreads: [],
  checks: [
    {
      name: "verify",
      state: "success",
      detailsUrl: "https://github.com/owner/repo/actions/runs/1"
    }
  ],
  botReactions: [
    {
      actor: "chatgpt-codex-connector[bot]",
      reaction: "eyes",
      createdAt: "2026-06-25T00:00:00.000Z"
    }
  ]
};

function fakeAdapter(context: PullRequestReviewContext): PullRequestReviewContextAdapter {
  return {
    loadPullRequestReviewContext: async () => context
  };
}

describe("syncPullRequestReview", () => {
  it("loads PR review context with no comments", async () => {
    const result = await syncPullRequestReview({
      repository: "owner/repo",
      pullRequestNumber: 7,
      policy: defaultWorkflowPolicies.assisted,
      adapter: fakeAdapter(baseContext)
    });

    expect(result.summary).toBe("0 valid, 0 rejected, 0 unresolved review-bot comment(s).");
    expect(result.context.checks[0]?.state).toBe("success");
    expect(result.context.botReactions[0]?.reaction).toBe("eyes");
    expect(result.proposedMutations).toEqual([]);
  });

  it("separates verified valid comments and gates reply and thread resolution", async () => {
    const result = await syncPullRequestReview({
      repository: "owner/repo",
      pullRequestNumber: 7,
      policy: defaultWorkflowPolicies.assisted,
      adapter: fakeAdapter({
        ...baseContext,
        reviewThreads: [
          {
            id: "thread-1",
            isResolved: false,
            comments: [
              {
                id: "comment-1",
                source: "review-bot",
                author: "chatgpt-codex-connector[bot]",
                body: "Missing required check.",
                path: "src/file.ts",
                line: 12,
                verification: {
                  status: "valid",
                  evidence: "The check is absent in current code.",
                  fixPlan: "Add the missing check before returning success."
                }
              }
            ]
          }
        ]
      })
    });

    expect(result.verifiedValidComments).toHaveLength(1);
    expect(result.rejectedComments).toEqual([]);
    expect(result.unresolvedComments).toEqual([]);
    expect(result.proposedMutations.map((mutation) => [mutation.mutation, mutation.decision.status])).toEqual([
      ["comment-on-review", "requires-confirmation"],
      ["resolve-review-thread", "requires-confirmation"]
    ]);
  });

  it("separates rejected comments and gates the rejection reply", async () => {
    const result = await syncPullRequestReview({
      repository: "owner/repo",
      pullRequestNumber: 7,
      policy: defaultWorkflowPolicies.assisted,
      adapter: fakeAdapter({
        ...baseContext,
        comments: [
          {
            id: "comment-2",
            source: "review-bot",
            author: "chatgpt-codex-connector[bot]",
            body: "This public export is missing.",
            verification: {
              status: "invalid",
              evidence: "The export already exists in src/index.ts.",
              rejectionReason: "Reply with export evidence; do not change code."
            }
          }
        ]
      })
    });

    expect(result.verifiedValidComments).toEqual([]);
    expect(result.rejectedComments[0]?.plan).toBe("Reply with export evidence; do not change code.");
    expect(result.unresolvedComments).toEqual([]);
    expect(result.proposedMutations).toHaveLength(1);
    expect(result.proposedMutations[0]?.decision.action).toBe("comment-on-review");
    expect(result.proposedMutations[0]?.decision.status).toBe("requires-confirmation");
  });

  it("keeps unresolved review-thread comments out of mutation plans", async () => {
    const result = await syncPullRequestReview({
      repository: "owner/repo",
      pullRequestNumber: 7,
      policy: defaultWorkflowPolicies.assisted,
      adapter: fakeAdapter({
        ...baseContext,
        reviewThreads: [
          {
            id: "thread-2",
            isResolved: false,
            comments: [
              {
                id: "comment-3",
                source: "review-bot",
                author: "chatgpt-codex-connector[bot]",
                body: "Maybe stale output can be reused.",
                verification: {
                  status: "unresolved",
                  reason: "Needs code-path verification.",
                  nextStep: "Trace the session message flow before editing."
                }
              }
            ]
          }
        ]
      })
    });

    expect(result.verifiedValidComments).toEqual([]);
    expect(result.rejectedComments).toEqual([]);
    expect(result.unresolvedComments[0]?.evidence).toBe("Needs code-path verification.");
    expect(result.verificationPlan).toEqual([
      {
        commentId: "comment-3",
        threadId: "thread-2",
        action: "Trace the session message flow before editing."
      }
    ]);
    expect(result.proposedMutations).toEqual([]);
  });

  it("does not resolve a thread until every review-bot comment in it is handled", async () => {
    const result = await syncPullRequestReview({
      repository: "owner/repo",
      pullRequestNumber: 7,
      policy: defaultWorkflowPolicies.assisted,
      adapter: fakeAdapter({
        ...baseContext,
        reviewThreads: [
          {
            id: "thread-3",
            isResolved: false,
            comments: [
              {
                id: "comment-4",
                threadId: "thread-3",
                source: "review-bot",
                author: "chatgpt-codex-connector[bot]",
                body: "This helper duplicates policy logic.",
                verification: {
                  status: "invalid",
                  evidence: "The helper calls the existing workflow policy decision function.",
                  rejectionReason: "Reply with the policy evidence."
                }
              },
              {
                id: "comment-5",
                threadId: "thread-3",
                source: "review-bot",
                author: "chatgpt-codex-connector[bot]",
                body: "This thread may still have another issue.",
                verification: {
                  status: "unresolved",
                  reason: "Needs follow-up verification.",
                  nextStep: "Inspect the whole thread before resolving it."
                }
              }
            ]
          }
        ]
      })
    });

    expect(result.rejectedComments.map((comment) => comment.comment.id)).toEqual(["comment-4"]);
    expect(result.unresolvedComments.map((comment) => comment.comment.id)).toEqual(["comment-5"]);
    expect(result.proposedMutations.map((mutation) => mutation.mutation)).toEqual(["comment-on-review"]);
  });

  it("does not resolve a thread with non-bot follow-up comments", async () => {
    const result = await syncPullRequestReview({
      repository: "owner/repo",
      pullRequestNumber: 7,
      policy: defaultWorkflowPolicies.assisted,
      adapter: fakeAdapter({
        ...baseContext,
        reviewThreads: [
          {
            id: "thread-4",
            isResolved: false,
            comments: [
              {
                id: "comment-6",
                threadId: "thread-4",
                source: "review-bot",
                author: "chatgpt-codex-connector[bot]",
                body: "This branch misses the expected policy gate.",
                verification: {
                  status: "valid",
                  evidence: "The policy decision is missing.",
                  fixPlan: "Add the missing policy decision before mutating GitHub."
                }
              },
              {
                id: "comment-7",
                threadId: "thread-4",
                source: "human",
                author: "octocat",
                body: "Please also confirm the related workflow step."
              }
            ]
          }
        ]
      })
    });

    expect(result.verifiedValidComments.map((comment) => comment.comment.id)).toEqual(["comment-6"]);
    expect(result.proposedMutations.map((mutation) => mutation.mutation)).toEqual(["comment-on-review"]);
  });
});
