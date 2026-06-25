import { decideWorkflowAction, type WorkflowPolicy, type WorkflowPolicyDecision } from "../runtime/index.js";

export type PullRequestReviewCommentSource = "review-bot" | "human" | "system";
export type PullRequestCheckState = "success" | "failure" | "pending" | "skipped";
export type PullRequestBotReaction = "eyes" | "thumbs-up" | "other";

export interface PullRequestReviewRef {
  repository: string;
  pullRequestNumber: number;
}

export interface PullRequestReviewComment {
  id: string;
  source: PullRequestReviewCommentSource;
  author: string;
  body: string;
  path?: string;
  line?: number;
  threadId?: string;
  verification?: PullRequestReviewCommentVerification;
}

export type PullRequestReviewCommentVerification =
  | {
      status: "valid";
      evidence: string;
      fixPlan: string;
    }
  | {
      status: "invalid";
      evidence: string;
      rejectionReason: string;
    }
  | {
      status: "unresolved";
      reason: string;
      nextStep: string;
    };

export interface PullRequestReviewThread {
  id: string;
  isResolved: boolean;
  comments: readonly PullRequestReviewComment[];
}

export interface PullRequestCheck {
  name: string;
  state: PullRequestCheckState;
  detailsUrl?: string;
}

export interface PullRequestReaction {
  actor: string;
  reaction: PullRequestBotReaction;
  createdAt: string;
}

export interface PullRequestReviewContext {
  repository: string;
  pullRequestNumber: number;
  headSha: string;
  comments: readonly PullRequestReviewComment[];
  reviewThreads: readonly PullRequestReviewThread[];
  checks: readonly PullRequestCheck[];
  botReactions: readonly PullRequestReaction[];
}

export interface PullRequestReviewContextAdapter {
  loadPullRequestReviewContext(ref: PullRequestReviewRef): Promise<PullRequestReviewContext>;
}

export interface PullRequestReviewSyncInput extends PullRequestReviewRef {
  adapter: PullRequestReviewContextAdapter;
  policy: WorkflowPolicy;
}

export interface PullRequestReviewItem {
  comment: PullRequestReviewComment;
  evidence: string;
  plan: string;
}

export interface PullRequestReviewMutationPlan {
  commentId: string;
  threadId?: string;
  mutation: "comment-on-review" | "resolve-review-thread";
  decision: WorkflowPolicyDecision;
  reason: string;
}

export interface PullRequestReviewVerificationStep {
  commentId: string;
  threadId?: string;
  action: string;
}

export interface PullRequestReviewSyncResult {
  context: PullRequestReviewContext;
  summary: string;
  verifiedValidComments: PullRequestReviewItem[];
  rejectedComments: PullRequestReviewItem[];
  unresolvedComments: PullRequestReviewItem[];
  verificationPlan: PullRequestReviewVerificationStep[];
  proposedMutations: PullRequestReviewMutationPlan[];
}

export async function syncPullRequestReview(input: PullRequestReviewSyncInput): Promise<PullRequestReviewSyncResult> {
  const context = await input.adapter.loadPullRequestReviewContext({
    repository: input.repository,
    pullRequestNumber: input.pullRequestNumber
  });
  const reviewBotComments = collectReviewBotComments(context);
  const verifiedValidComments: PullRequestReviewItem[] = [];
  const rejectedComments: PullRequestReviewItem[] = [];
  const unresolvedComments: PullRequestReviewItem[] = [];
  const verificationPlan: PullRequestReviewVerificationStep[] = [];
  const proposedMutations: PullRequestReviewMutationPlan[] = [];
  const resolvableThreadIds = collectResolvableThreadIds(context);
  const plannedThreadResolutions = new Set<string>();

  for (const comment of reviewBotComments) {
    switch (comment.verification?.status) {
      case "valid":
        verifiedValidComments.push({
          comment,
          evidence: comment.verification.evidence,
          plan: comment.verification.fixPlan
        });
        proposedMutations.push(
          ...threadMutationPlans(
            input.policy,
            comment,
            "after the verified fix is applied",
            canPlanThreadResolution(comment, resolvableThreadIds, plannedThreadResolutions)
          )
        );
        break;
      case "invalid":
        rejectedComments.push({
          comment,
          evidence: comment.verification.evidence,
          plan: comment.verification.rejectionReason
        });
        proposedMutations.push(
          ...threadMutationPlans(
            input.policy,
            comment,
            "after replying with rejection evidence",
            canPlanThreadResolution(comment, resolvableThreadIds, plannedThreadResolutions)
          )
        );
        break;
      default:
        unresolvedComments.push({
          comment,
          evidence: comment.verification?.reason ?? "Comment has not been verified against the current branch.",
          plan: comment.verification?.nextStep ?? "Verify the claim before proposing a fix or rejection."
        });
        verificationPlan.push({
          commentId: comment.id,
          threadId: comment.threadId,
          action: comment.verification?.nextStep ?? "Read the referenced code and decide whether the claim is valid."
        });
    }
  }

  return {
    context,
    summary: `${verifiedValidComments.length} valid, ${rejectedComments.length} rejected, ${unresolvedComments.length} unresolved review-bot comment(s).`,
    verifiedValidComments,
    rejectedComments,
    unresolvedComments,
    verificationPlan,
    proposedMutations
  };
}

function collectResolvableThreadIds(context: PullRequestReviewContext): Set<string> {
  return new Set(
    context.reviewThreads
      .filter((thread) => !thread.isResolved)
      .filter((thread) => {
        return (
          thread.comments.length > 0 &&
          thread.comments.every((comment) => isReviewBotComment(comment) && isHandled(comment.verification))
        );
      })
      .map((thread) => thread.id)
  );
}

function collectReviewBotComments(context: PullRequestReviewContext): PullRequestReviewComment[] {
  return [
    ...context.comments.filter(isReviewBotComment),
    ...context.reviewThreads
      .filter((thread) => !thread.isResolved)
      .flatMap((thread) => thread.comments.map((comment) => ({ ...comment, threadId: comment.threadId ?? thread.id })))
      .filter(isReviewBotComment)
  ];
}

function isReviewBotComment(comment: PullRequestReviewComment): boolean {
  return comment.source === "review-bot";
}

function threadMutationPlans(
  policy: WorkflowPolicy,
  comment: PullRequestReviewComment,
  reason: string,
  resolveThread: boolean
): PullRequestReviewMutationPlan[] {
  return [
    {
      commentId: comment.id,
      threadId: comment.threadId,
      mutation: "comment-on-review",
      decision: decideWorkflowAction(policy, "comment-on-review"),
      reason
    },
    ...(resolveThread && comment.threadId
      ? [
          {
            commentId: comment.id,
            threadId: comment.threadId,
            mutation: "resolve-review-thread" as const,
            decision: decideWorkflowAction(policy, "resolve-review-thread"),
            reason
          }
        ]
      : [])
  ];
}

function canPlanThreadResolution(
  comment: PullRequestReviewComment,
  resolvableThreadIds: ReadonlySet<string>,
  plannedThreadResolutions: Set<string>
): boolean {
  if (
    !comment.threadId ||
    !resolvableThreadIds.has(comment.threadId) ||
    plannedThreadResolutions.has(comment.threadId)
  ) {
    return false;
  }

  plannedThreadResolutions.add(comment.threadId);
  return true;
}

function isHandled(verification: PullRequestReviewCommentVerification | undefined): boolean {
  return verification?.status === "valid" || verification?.status === "invalid";
}
