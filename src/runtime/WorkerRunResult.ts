export interface WorkerRunArtifact {
  id: string;
  path?: string;
  kind: "durable" | "transient";
  verified: boolean;
}

export interface WorkerRunEvent {
  type: string;
  message: string;
  timestamp: string;
}

export interface WorkerRunError {
  code: string;
  message: string;
}

export type WorkerRunResult =
  | {
      status: "success";
      artifacts: WorkerRunArtifact[];
      events: WorkerRunEvent[];
    }
  | {
      status: "failure";
      artifacts: WorkerRunArtifact[];
      events: WorkerRunEvent[];
      errors: WorkerRunError[];
    };
