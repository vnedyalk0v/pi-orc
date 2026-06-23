export const workflowModes = ["manual", "assisted", "auto"] as const;

export type WorkflowMode = (typeof workflowModes)[number];

export const workflowActionCategories = [
  "read-repository",
  "write-local-files",
  "run-local-command",
  "prepare-github-mutation",
  "create-github-repository",
  "edit-github-repository-settings",
  "create-github-project",
  "create-github-issue",
  "add-issue-to-project",
  "create-pull-request",
  "comment-on-review",
  "resolve-review-thread",
  "commit",
  "push",
  "force-push",
  "merge-pull-request",
  "delete-repository",
  "rewrite-history"
] as const;

export type WorkflowActionCategory = (typeof workflowActionCategories)[number];

export type WorkflowPolicyDecisionStatus = "allowed" | "requires-confirmation" | "blocked";

export interface WorkflowPolicy {
  mode: WorkflowMode;
  decisions: Record<WorkflowActionCategory, WorkflowPolicyDecisionStatus>;
}

export interface WorkflowPolicyDecision {
  mode: WorkflowMode;
  action: WorkflowActionCategory;
  status: WorkflowPolicyDecisionStatus;
  reason: string;
}

const defineDecisions = (decisions: Record<WorkflowActionCategory, WorkflowPolicyDecisionStatus>) => decisions;

export const defaultWorkflowPolicies = {
  manual: {
    mode: "manual",
    decisions: defineDecisions({
      "read-repository": "allowed",
      "write-local-files": "requires-confirmation",
      "run-local-command": "requires-confirmation",
      "prepare-github-mutation": "blocked",
      "create-github-repository": "blocked",
      "edit-github-repository-settings": "blocked",
      "create-github-project": "blocked",
      "create-github-issue": "blocked",
      "add-issue-to-project": "blocked",
      "create-pull-request": "blocked",
      "comment-on-review": "blocked",
      "resolve-review-thread": "blocked",
      commit: "blocked",
      push: "blocked",
      "force-push": "blocked",
      "merge-pull-request": "blocked",
      "delete-repository": "blocked",
      "rewrite-history": "blocked"
    })
  },
  assisted: {
    mode: "assisted",
    decisions: defineDecisions({
      "read-repository": "allowed",
      "write-local-files": "allowed",
      "run-local-command": "allowed",
      "prepare-github-mutation": "allowed",
      "create-github-repository": "requires-confirmation",
      "edit-github-repository-settings": "requires-confirmation",
      "create-github-project": "requires-confirmation",
      "create-github-issue": "requires-confirmation",
      "add-issue-to-project": "requires-confirmation",
      "create-pull-request": "requires-confirmation",
      "comment-on-review": "requires-confirmation",
      "resolve-review-thread": "requires-confirmation",
      commit: "requires-confirmation",
      push: "requires-confirmation",
      "force-push": "blocked",
      "merge-pull-request": "blocked",
      "delete-repository": "blocked",
      "rewrite-history": "blocked"
    })
  },
  auto: {
    mode: "auto",
    decisions: defineDecisions({
      "read-repository": "allowed",
      "write-local-files": "allowed",
      "run-local-command": "allowed",
      "prepare-github-mutation": "allowed",
      "create-github-repository": "requires-confirmation",
      "edit-github-repository-settings": "requires-confirmation",
      "create-github-project": "requires-confirmation",
      "create-github-issue": "requires-confirmation",
      "add-issue-to-project": "requires-confirmation",
      "create-pull-request": "requires-confirmation",
      "comment-on-review": "requires-confirmation",
      "resolve-review-thread": "requires-confirmation",
      commit: "requires-confirmation",
      push: "requires-confirmation",
      "force-push": "blocked",
      "merge-pull-request": "blocked",
      "delete-repository": "blocked",
      "rewrite-history": "blocked"
    })
  }
} satisfies Record<WorkflowMode, WorkflowPolicy>;

const reasons: Record<WorkflowPolicyDecisionStatus, string> = {
  allowed: "Action is allowed by the workflow policy.",
  "requires-confirmation": "Action needs explicit confirmation before execution.",
  blocked: "Action is blocked by the workflow policy."
};

export function decideWorkflowAction(
  policy: WorkflowPolicy,
  action: WorkflowActionCategory
): WorkflowPolicyDecision {
  const status = policy.decisions[action];

  return {
    mode: policy.mode,
    action,
    status,
    reason: reasons[status]
  };
}
