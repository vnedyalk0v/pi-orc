import type { WorkerHandoff } from "./WorkerHandoff.js";
import type { WorkerRunResult } from "./WorkerRunResult.js";

export interface WorkerRuntime {
  run(handoff: WorkerHandoff): Promise<WorkerRunResult>;
}
