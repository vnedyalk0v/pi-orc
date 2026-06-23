export const packageInfo = {
  name: "pi-orc",
  description: "Pi Orchestrator for verified AI development workflows."
} as const;

export { GhGitHubAdapter } from "./github/index.js";
export { createBootstrapPlanDryRun, generateBootstrapPlan, renderBootstrapPlanMarkdown } from "./repo-bootstrap/index.js";
export {
  decideWorkflowAction,
  defaultNewProjectIntakeOptions,
  defaultWorkflowPolicies,
  GitHubProjectOwnerTypeSchema,
  NewProjectIntakeSchema,
  PiSdkWorkerRuntime,
  ProjectRepositoryVisibilitySchema,
  WorkerContextPolicySchema,
  WorkerErrorSchema,
  WorkerEventSchema,
  WorkerHandoffSchema,
  WorkerOutputContractSchema,
  WorkerPermissionSetSchema,
  WorkerProfileSchema,
  WorkerRunInputSchema,
  WorkerRunResultSchema,
  WorkerToolPolicySchema,
  workflowActionCategories,
  WorkflowArtifactSchema,
  workflowModes,
  type PiSdkSessionFactory,
  type PiSdkWorkerRuntimeOptions
} from "./runtime/index.js";
export type {
  GitHubProjectOwnerType,
  NewProjectIntake,
  ProjectRepositoryVisibility,
  WorkflowActionCategory,
  WorkerContextPolicy,
  WorkerHandoff,
  WorkerOutputContract,
  WorkerPermissionSet,
  WorkerProfile,
  WorkerRunArtifact,
  WorkerRunError,
  WorkerRunEvent,
  WorkerRunInput,
  WorkerRunResult,
  WorkerToolPolicy,
  WorkflowArtifact,
  WorkflowMode,
  WorkflowPolicy,
  WorkflowPolicyDecision,
  WorkflowPolicyDecisionStatus,
  WorkerRuntime
} from "./runtime/index.js";
export type {
  BootstrapDirectoryAction,
  BootstrapFileAction,
  BootstrapGitAction,
  BootstrapGitHubAction,
  BootstrapPlan,
  BootstrapPlanDryRun,
  BootstrapPolicyGate
} from "./repo-bootstrap/index.js";
export type {
  AddProjectItemAction,
  CreateIssueAction,
  CreateLabelAction,
  CreateProjectAction,
  CreateRepositoryAction,
  GitHubAction,
  GitHubActionResult,
  GitHubAdapter,
  GitHubAuthCheck,
  GitHubCommandOutput,
  GitHubCommandPlan,
  GitHubCommandRunner,
  GitHubExecuteOptions,
  GitHubRepositoryVisibility,
  LinkProjectAction
} from "./github/index.js";
