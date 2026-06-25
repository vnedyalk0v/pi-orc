import type { WorkerProfile } from "./schemas.js";

const noGitHubMutationPermissions = {
  mayRunGitHubMutation: false,
  mayCommit: false,
  mayPush: false,
  mayCreatePullRequest: false,
  mayResolveReviewThread: false
} as const;

export const defaultPlanningWorkerProfile = {
  id: "planning-worker",
  title: "Planning worker",
  purpose: "Create issue-scoped project and repository planning documents from a clean handoff.",
  contextPolicy: "issue-scoped",
  cleanContext: true,
  tools: {
    read: "allow",
    grep: "allow",
    find: "allow",
    edit: "allow",
    write: "allow",
    bash: "deny",
    github: "deny"
  },
  permissions: {
    mayEditFiles: true,
    mayRunBash: false,
    ...noGitHubMutationPermissions
  },
  outputContract: {
    requiredFiles: ["docs/implementation-plan.md"],
    format: "markdown"
  }
} satisfies WorkerProfile;

export const defaultVerificationWorkerProfile = {
  id: "verification-worker",
  title: "Verification worker",
  purpose: "Run read-only evidence checks and write verified reports from a clean handoff.",
  contextPolicy: "issue-scoped",
  cleanContext: true,
  tools: {
    read: "allow",
    grep: "allow",
    find: "allow",
    bash: "allow",
    edit: "allow",
    write: "allow",
    github: "deny"
  },
  permissions: {
    mayEditFiles: true,
    mayRunBash: true,
    ...noGitHubMutationPermissions
  },
  outputContract: {
    requiredFiles: ["docs/ai/verified-reports/verification-report.md"],
    format: "markdown"
  }
} satisfies WorkerProfile;

export const defaultWorkerProfiles = [defaultPlanningWorkerProfile, defaultVerificationWorkerProfile] as const;
