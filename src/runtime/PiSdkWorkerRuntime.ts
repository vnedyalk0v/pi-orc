import type { WorkerHandoff } from "./WorkerHandoff.js";
import type { WorkerRunResult } from "./WorkerRunResult.js";
import type { WorkerRuntime } from "./WorkerRuntime.js";

export type PiSdkSessionFactory = (options?: unknown) => Promise<unknown>;

export interface PiSdkWorkerRuntimeOptions {
  createAgentSession?: PiSdkSessionFactory;
}

export class PiSdkWorkerRuntime implements WorkerRuntime {
  readonly createAgentSession?: PiSdkSessionFactory;

  constructor(options: PiSdkWorkerRuntimeOptions = {}) {
    this.createAgentSession = options.createAgentSession;
  }

  async run(handoff: WorkerHandoff): Promise<WorkerRunResult> {
    return {
      status: "failure",
      artifacts: [],
      events: [
        {
          type: "runtime.not_implemented",
          message: `SDK worker execution is not implemented for ${handoff.profile.id}.`,
          timestamp: new Date().toISOString()
        }
      ],
      errors: [
        {
          code: "not_implemented",
          message: "PiSdkWorkerRuntime is the SDK runtime boundary; real session execution belongs to a later issue."
        }
      ]
    };
  }
}
