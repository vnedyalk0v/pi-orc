import { describe, expect, it } from "vitest";

import { defaultWorkflowPolicies, startIssueWorkflow } from "../src/index.js";
import type { IssueStartAdapter, IssueStartContext, IssueStartRef } from "../src/index.js";

const baseContext: IssueStartContext = {
  issue: {
    number: 95,
    title: "feat(cli): add issue start workflow",
    state: "open",
    url: "https://github.com/owner/repo/issues/95",
    labels: ["type:feature", "priority:p1", "status:ready", "source:manual"],
    assignees: ["vnedyalk0v"]
  },
  project: {
    id: "project-id",
    statusFieldId: "status-field-id",
    inProgressOptionId: "in-progress-option-id"
  },
  projectItem: {
    id: "item-id",
    status: "Todo",
    priority: "P1",
    type: "feature",
    area: "workflow",
    source: "manual"
  }
};

function fakeAdapter(context: IssueStartContext, calls: string[] = []): IssueStartAdapter {
  return {
    loadIssueStartContext: async () => context,
    addIssueAssignee: async (ref: IssueStartRef) => {
      calls.push(`assignee:${ref.assignee}`);
    },
    addIssueToProject: async () => {
      calls.push("project-item");
    },
    replaceIssueStatusLabels: async () => {
      calls.push("labels");
    },
    setIssueProjectStatus: async () => {
      calls.push("project-status");
    }
  };
}

function sequenceAdapter(contexts: readonly IssueStartContext[], calls: string[] = []): IssueStartAdapter {
  let index = 0;

  return {
    loadIssueStartContext: async () => contexts[Math.min(index++, contexts.length - 1)]!,
    addIssueAssignee: async (ref: IssueStartRef) => {
      calls.push(`assignee:${ref.assignee}`);
    },
    addIssueToProject: async () => {
      calls.push("project-item");
    },
    replaceIssueStatusLabels: async () => {
      calls.push("labels");
    },
    setIssueProjectStatus: async () => {
      calls.push("project-status");
    }
  };
}

function start(context: IssueStartContext, execute = false, calls: string[] = []) {
  return startIssueWorkflow({
    repository: "owner/repo",
    issueNumber: 95,
    projectOwner: "owner",
    projectNumber: 7,
    assignee: "vnedyalk0v",
    policy: defaultWorkflowPolicies.assisted,
    adapter: fakeAdapter(context, calls),
    execute
  });
}

describe("startIssueWorkflow", () => {
  it("plans issue tracking mutations and branch name without mutating by default", async () => {
    const calls: string[] = [];
    const result = await start(baseContext, false, calls);

    expect(result.status).toBe("planned");
    expect(result.blockers).toEqual([]);
    expect(result.branchName).toBe("feat/add-issue-start-workflow");
    expect(result.proposedMutations.map((mutation) => [mutation.mutation, mutation.decision.status])).toEqual([
      ["replace-status-label", "requires-confirmation"],
      ["set-project-status", "requires-confirmation"]
    ]);
    expect(calls).toEqual([]);
  });

  it("executes assisted label and Project Status updates in order when confirmed", async () => {
    const calls: string[] = [];
    const refreshedContext: IssueStartContext = {
      ...baseContext,
      issue: {
        ...baseContext.issue,
        labels: ["type:feature", "priority:p1", "status:in-progress", "source:manual"]
      },
      projectItem: {
        ...baseContext.projectItem!,
        status: "In Progress"
      }
    };

    const result = await startIssueWorkflow({
      repository: "owner/repo",
      issueNumber: 95,
      projectOwner: "owner",
      projectNumber: 7,
      assignee: "vnedyalk0v",
      policy: defaultWorkflowPolicies.assisted,
      adapter: sequenceAdapter([baseContext, refreshedContext], calls),
      execute: true
    });

    expect(result.status).toBe("executed");
    expect(calls).toEqual(["labels", "project-status"]);
    expect(result.proposedMutations.map((mutation) => mutation.executed)).toEqual([true, true]);
  });

  it("refreshes issue and Project state after executing tracking mutations", async () => {
    const calls: string[] = [];
    const refreshedContext: IssueStartContext = {
      ...baseContext,
      issue: {
        ...baseContext.issue,
        labels: ["type:feature", "priority:p1", "status:in-progress", "source:manual"]
      },
      projectItem: {
        ...baseContext.projectItem!,
        status: "In Progress"
      }
    };

    const result = await startIssueWorkflow({
      repository: "owner/repo",
      issueNumber: 95,
      projectOwner: "owner",
      projectNumber: 7,
      assignee: "vnedyalk0v",
      policy: defaultWorkflowPolicies.assisted,
      adapter: sequenceAdapter([baseContext, refreshedContext], calls),
      execute: true
    });

    expect(result.status).toBe("executed");
    expect(calls).toEqual(["labels", "project-status"]);
    expect(result.context.issue.labels).toContain("status:in-progress");
    expect(result.context.projectItem?.status).toBe("In Progress");
  });

  it("blocks branch proposal when executed tracking mutations do not read back", async () => {
    const calls: string[] = [];
    const result = await start(
      {
        ...baseContext,
        issue: {
          ...baseContext.issue,
          assignees: []
        }
      },
      true,
      calls
    );

    expect(result.status).toBe("blocked");
    expect(result.branchName).toBeUndefined();
    expect(calls).toEqual(["assignee:vnedyalk0v", "labels", "project-status"]);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "Issue #95 is not assigned to vnedyalk0v.",
        "Issue #95 does not have exactly status:in-progress.",
        "Project Status is not In Progress."
      ])
    );
  });

  it("blocks status:blocked issues before proposing a branch", async () => {
    const result = await start({
      ...baseContext,
      issue: {
        ...baseContext.issue,
        labels: ["type:feature", "status:blocked"]
      }
    });

    expect(result.status).toBe("blocked");
    expect(result.branchName).toBeUndefined();
    expect(result.blockers).toContain("Issue #95 has status:blocked.");
  });

  it("reports missing required Project fields before branch creation", async () => {
    const result = await start({
      ...baseContext,
      projectItem: {
        id: "item-id",
        status: "Todo",
        priority: "P1",
        type: "feature",
        source: "manual"
      }
    });

    expect(result.status).toBe("blocked");
    expect(result.branchName).toBeUndefined();
    expect(result.blockers).toContain("Project field Area is missing.");
  });

  it("plans adding missing Project items", async () => {
    const result = await start({
      ...baseContext,
      projectItem: undefined
    });

    expect(result.status).toBe("planned");
    expect(result.blockers).toEqual([]);
    expect(result.proposedMutations.map((mutation) => [mutation.mutation, mutation.decision.status])).toEqual([
      ["replace-status-label", "requires-confirmation"],
      ["add-project-item", "requires-confirmation"]
    ]);
  });

  it("executes missing Project item repair before setting Project Status", async () => {
    const calls: string[] = [];
    const missingProjectItem: IssueStartContext = {
      ...baseContext,
      projectItem: undefined
    };
    const addedProjectItem: IssueStartContext = {
      ...baseContext,
      issue: {
        ...baseContext.issue,
        labels: ["type:feature", "priority:p1", "status:in-progress", "source:manual"]
      }
    };
    const inProgressProjectItem: IssueStartContext = {
      ...addedProjectItem,
      projectItem: {
        ...baseContext.projectItem!,
        status: "In Progress"
      }
    };

    const result = await startIssueWorkflow({
      repository: "owner/repo",
      issueNumber: 95,
      projectOwner: "owner",
      projectNumber: 7,
      assignee: "vnedyalk0v",
      policy: defaultWorkflowPolicies.assisted,
      adapter: sequenceAdapter([missingProjectItem, addedProjectItem, inProgressProjectItem], calls),
      execute: true
    });

    expect(result.status).toBe("executed");
    expect(calls).toEqual(["labels", "project-item", "project-status"]);
    expect(result.context.projectItem?.status).toBe("In Progress");
  });

  it("does nothing when the issue is already in progress", async () => {
    const result = await start({
      ...baseContext,
      issue: {
        ...baseContext.issue,
        labels: ["type:feature", "priority:p1", "status:in-progress", "source:manual"]
      },
      projectItem: {
        id: "item-id",
        status: "In Progress",
        priority: "P1",
        type: "feature",
        area: "workflow",
        source: "manual"
      }
    });

    expect(result.status).toBe("planned");
    expect(result.proposedMutations).toEqual([]);
    expect(result.branchName).toBe("feat/add-issue-start-workflow");
  });
});
