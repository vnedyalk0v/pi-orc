import type { WorkerRunInput } from "./schemas.js";
import type { WorkerRunResult } from "./WorkerRunResult.js";

export interface WorkerRuntime {
  run(input: WorkerRunInput): Promise<WorkerRunResult>;
}
