import type { WorkerRunResult } from "./WorkerRunResult.js";
import type { WorkerRuntime } from "./WorkerRuntime.js";
import { WorkerRunInputSchema, type WorkerRunInput } from "./schemas.js";

export type PiSdkSessionFactory = (options?: unknown) => Promise<unknown>;

export interface PiSdkWorkerRuntimeOptions {
  createAgentSession?: PiSdkSessionFactory;
}

export class PiSdkWorkerRuntime implements WorkerRuntime {
  readonly createAgentSession?: PiSdkSessionFactory;

  constructor(options: PiSdkWorkerRuntimeOptions = {}) {
    this.createAgentSession = options.createAgentSession;
  }

  async run(input: WorkerRunInput): Promise<WorkerRunResult> {
    const validInput = WorkerRunInputSchema.parse(input);
    const { handoff, profile } = validInput;

    if (profile.id !== handoff.workerId) {
      return {
        runId: handoff.runId,
        status: "failure",
        summary: "Worker profile does not match handoff worker id.",
        artifacts: [],
        events: [
          {
            type: "runtime.profile_mismatch",
            message: `Worker profile ${profile.id} does not match handoff worker ${handoff.workerId}.`,
            timestamp: new Date().toISOString()
          }
        ],
        errors: [
          {
            code: "profile_mismatch",
            message: "Worker profile id must match handoff workerId before execution."
          }
        ]
      };
    }

    return {
      runId: handoff.runId,
      status: "failure",
      summary: "SDK worker execution is not implemented.",
      artifacts: [],
      events: [
        {
          type: "runtime.not_implemented",
          message: `SDK worker execution is not implemented for ${profile.id}.`,
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
