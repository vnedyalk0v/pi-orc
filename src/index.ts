export const packageInfo = {
  name: "pi-orc",
  description: "Pi Orchestrator for verified AI development workflows."
} as const;

export { PiSdkWorkerRuntime, type PiSdkSessionFactory, type PiSdkWorkerRuntimeOptions } from "./runtime/index.js";
export type {
  WorkerHandoff,
  WorkerProfile,
  WorkerRunArtifact,
  WorkerRunError,
  WorkerRunEvent,
  WorkerRunResult,
  WorkerRuntime
} from "./runtime/index.js";
