import { decideWorkflowAction, type WorkflowPolicy, type WorkflowPolicyDecision } from "../runtime/index.js";

export interface IssueStartRef {
  repository: string;
  issueNumber: number;
  projectOwner: string;
  projectNumber: number;
  assignee: string;
}

export interface IssueStartInput extends IssueStartRef {
  adapter: IssueStartAdapter;
  policy: WorkflowPolicy;
  execute?: boolean;
}

export interface IssueStartIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  url: string;
  labels: readonly string[];
  assignees: readonly string[];
}

export interface IssueStartProject {
  id: string;
  statusFieldId: string;
  inProgressOptionId: string;
}

export interface IssueStartProjectItem {
  id: string;
  status?: string;
  priority?: string;
  type?: string;
  area?: string;
  source?: string;
}

export interface IssueStartContext {
  issue: IssueStartIssue;
  project?: IssueStartProject;
  projectItem?: IssueStartProjectItem;
}

export interface IssueStartAdapter {
  loadIssueStartContext(ref: IssueStartRef): Promise<IssueStartContext>;
  addIssueAssignee(ref: IssueStartRef): Promise<void>;
  addIssueToProject(ref: IssueStartRef, issueUrl: string): Promise<void>;
  replaceIssueStatusLabels(ref: IssueStartRef, currentLabels: readonly string[]): Promise<void>;
  setIssueProjectStatus(ref: IssueStartRef, project: IssueStartProject, item: IssueStartProjectItem): Promise<void>;
}

export type IssueStartMutationKind =
  | "add-assignee"
  | "add-project-item"
  | "replace-status-label"
  | "set-project-status";

export interface IssueStartMutationPlan {
  mutation: IssueStartMutationKind;
  decision: WorkflowPolicyDecision;
  reason: string;
  executed: boolean;
}

export interface IssueStartResult {
  context: IssueStartContext;
  status: "planned" | "executed" | "blocked";
  blockers: string[];
  branchName?: string;
  proposedMutations: IssueStartMutationPlan[];
}

const statusLabelPrefix = "status:";
const inProgressLabel = "status:in-progress";
const requiredProjectFields = ["priority", "type", "area", "source"] as const;

export async function startIssueWorkflow(input: IssueStartInput): Promise<IssueStartResult> {
  const ref = {
    repository: input.repository,
    issueNumber: input.issueNumber,
    projectOwner: input.projectOwner,
    projectNumber: input.projectNumber,
    assignee: input.assignee
  };
  let context = await input.adapter.loadIssueStartContext(ref);
  const blockers = issueStartBlockers(context, { allowMissingProjectItem: true });

  if (blockers.length > 0) {
    return {
      context,
      status: "blocked",
      blockers,
      proposedMutations: []
    };
  }

  const mutations = issueStartMutations(input.policy, context, input.assignee);

  if (input.execute) {
    for (const mutation of mutations) {
      if (mutation.decision.status === "blocked") {
        continue;
      }

      await executeIssueStartMutation(input.adapter, ref, context, mutation);
      mutation.executed = true;
    }

    if (mutations.some((mutation) => mutation.mutation === "add-project-item" && mutation.executed)) {
      context = await input.adapter.loadIssueStartContext(ref);
      const postAddBlockers = issueStartBlockers(context);

      if (postAddBlockers.length === 0) {
        const executedKinds = new Set(
          mutations.filter((mutation) => mutation.executed).map((mutation) => mutation.mutation)
        );
        const followUpMutations = issueStartMutations(input.policy, context, input.assignee).filter(
          (mutation) => !executedKinds.has(mutation.mutation)
        );

        for (const mutation of followUpMutations) {
          if (mutation.decision.status === "blocked") {
            continue;
          }

          await executeIssueStartMutation(input.adapter, ref, context, mutation);
          mutation.executed = true;
        }

        mutations.push(...followUpMutations);
      }
    }
  }

  const executed = input.execute && mutations.some((mutation) => mutation.executed);
  const resultContext = executed ? await input.adapter.loadIssueStartContext(ref) : context;
  const resultBlockers = executed ? issueStartBlockers(resultContext) : [];

  if (resultBlockers.length > 0) {
    return {
      context: resultContext,
      status: "blocked",
      blockers: resultBlockers,
      proposedMutations: mutations
    };
  }

  return {
    context: resultContext,
    status: executed ? "executed" : "planned",
    blockers: [],
    branchName: issueBranchName(resultContext.issue),
    proposedMutations: mutations
  };
}

function issueStartBlockers(context: IssueStartContext, options: { allowMissingProjectItem?: boolean } = {}): string[] {
  const blockers: string[] = [];

  if (context.issue.state !== "open") {
    blockers.push(`Issue #${context.issue.number} is not open.`);
  }

  if (context.issue.labels.includes("status:blocked")) {
    blockers.push(`Issue #${context.issue.number} has status:blocked.`);
  }

  if (!context.projectItem && !options.allowMissingProjectItem) {
    blockers.push(`Issue #${context.issue.number} is missing from the GitHub Project.`);
  }

  if (!context.project) {
    blockers.push("GitHub Project Status field or In Progress option is missing.");
  }

  if (context.projectItem) {
    for (const field of requiredProjectFields) {
      if (!context.projectItem[field]) {
        blockers.push(`Project field ${fieldName(field)} is missing.`);
      }
    }
  }

  return blockers;
}

function issueStartMutations(
  policy: WorkflowPolicy,
  context: IssueStartContext,
  assignee: string
): IssueStartMutationPlan[] {
  const mutations: IssueStartMutationPlan[] = [];
  const statusLabels = context.issue.labels.filter((label) => label.startsWith(statusLabelPrefix));

  if (!context.issue.assignees.includes(assignee)) {
    mutations.push({
      mutation: "add-assignee",
      decision: decideWorkflowAction(policy, "edit-github-issue"),
      reason: `assign issue to ${assignee}`,
      executed: false
    });
  }

  if (statusLabels.length !== 1 || statusLabels[0] !== inProgressLabel) {
    mutations.push({
      mutation: "replace-status-label",
      decision: decideWorkflowAction(policy, "edit-github-issue"),
      reason: `replace status labels with ${inProgressLabel}`,
      executed: false
    });
  }

  if (!context.projectItem) {
    mutations.push({
      mutation: "add-project-item",
      decision: decideWorkflowAction(policy, "add-issue-to-project"),
      reason: "add issue to GitHub Project",
      executed: false
    });
  }

  if (context.projectItem && context.projectItem.status !== "In Progress") {
    mutations.push({
      mutation: "set-project-status",
      decision: decideWorkflowAction(policy, "edit-github-project-item"),
      reason: "set Project Status to In Progress",
      executed: false
    });
  }

  return mutations;
}

async function executeIssueStartMutation(
  adapter: IssueStartAdapter,
  ref: IssueStartRef,
  context: IssueStartContext,
  mutation: IssueStartMutationPlan
): Promise<void> {
  switch (mutation.mutation) {
    case "add-assignee":
      await adapter.addIssueAssignee(ref);
      return;
    case "add-project-item":
      await adapter.addIssueToProject(ref, context.issue.url);
      return;
    case "replace-status-label":
      await adapter.replaceIssueStatusLabels(ref, context.issue.labels);
      return;
    case "set-project-status":
      if (!context.project || !context.projectItem) {
        throw new Error("Cannot set Project Status without project and item ids.");
      }

      await adapter.setIssueProjectStatus(ref, context.project, context.projectItem);
      return;
  }
}

function issueBranchName(issue: IssueStartIssue): string {
  const prefixMatch = /^([a-z]+)(?:\([^)]+\))?:\s+/i.exec(issue.title);
  const prefix = prefixMatch?.[1]?.toLowerCase() ?? "issue";
  const title = issue.title.replace(/^[a-z]+(?:\([^)]+\))?:\s+/i, "");
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 6)
    .join("-");

  return `${prefix}/${slug || `issue-${issue.number}`}`;
}

function fieldName(field: (typeof requiredProjectFields)[number]): string {
  switch (field) {
    case "priority":
      return "Priority";
    case "type":
      return "Type";
    case "area":
      return "Area";
    case "source":
      return "Source";
  }
}
