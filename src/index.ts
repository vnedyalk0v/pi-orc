export const packageInfo = {
  name: "pi-orc",
  description: "Pi Orchestrator for verified AI development workflows."
} as const;

export {
  PiSdkWorkerRuntime,
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
  WorkflowArtifactSchema,
  type PiSdkSessionFactory,
  type PiSdkWorkerRuntimeOptions
} from "./runtime/index.js";
export type {
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
  WorkerRuntime
} from "./runtime/index.js";
