import type { WorkerRunResult } from "./WorkerRunResult.js";
import type { WorkerRuntime } from "./WorkerRuntime.js";
import {
  WorkerRunInputSchema,
  WorkerRunResultSchema,
  type WorkerHandoff,
  type WorkerProfile,
  type WorkerRunInput
} from "./schemas.js";

export interface PiSdkAgentSession {
  prompt(text: string, options?: { expandPromptTemplates?: boolean; source?: string }): Promise<void>;
  getLastAssistantText(): string | undefined;
  dispose?: () => void | Promise<void>;
}

export interface PiSdkSessionFactoryOptions {
  profile: WorkerProfile;
  handoff: WorkerHandoff;
  prompt: string;
}

export type PiSdkSessionFactory = (
  options: PiSdkSessionFactoryOptions
) => Promise<PiSdkAgentSession | { session: PiSdkAgentSession }>;

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

    if (!this.createAgentSession) {
      return runtimeResult(
        handoff.runId,
        "blocked",
        "SDK session factory is required.",
        "runtime.missing_session_factory",
        "missing_session_factory",
        "PiSdkWorkerRuntime needs an injected SDK session factory before execution."
      );
    }

    const prompt = renderWorkerPrompt(profile, handoff);
    let session: PiSdkAgentSession | undefined;

    try {
      session = unwrapSession(
        await this.createAgentSession({
          profile,
          handoff,
          prompt
        })
      );
      await session.prompt(prompt, {
        expandPromptTemplates: false,
        source: "sdk"
      });

      const output = session.getLastAssistantText();

      if (!output) {
        return runtimeResult(
          handoff.runId,
          "failure",
          "SDK worker produced no output.",
          "runtime.missing_worker_output",
          "missing_worker_output",
          "Worker session ended without assistant output."
        );
      }

      return parseWorkerOutput(handoff, output);
    } catch (error) {
      return runtimeResult(
        handoff.runId,
        "failure",
        "SDK worker execution failed.",
        "runtime.sdk_failure",
        "sdk_execution_failed",
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      await disposeSession(session);
    }
  }
}

function renderWorkerPrompt(profile: WorkerProfile, handoff: WorkerHandoff): string {
  return [
    "You are a clean-context pi-orc workflow worker.",
    "Use only this worker profile and handoff. Do not assume parent chat history.",
    "Return only JSON matching WorkerRunResultSchema.",
    "The JSON runId must equal the handoff runId.",
    "Shape: { runId, status, summary, artifacts, events, errors }.",
    "status is one of success, failure, blocked. success requires errors: [].",
    "events require type, message, timestamp. errors require code and message.",
    "",
    "Worker profile:",
    JSON.stringify(profile, null, 2),
    "",
    "Worker handoff:",
    JSON.stringify(handoff, null, 2)
  ].join("\n");
}

function unwrapSession(result: PiSdkAgentSession | { session: PiSdkAgentSession }): PiSdkAgentSession {
  return "session" in result ? result.session : result;
}

function parseWorkerOutput(handoff: WorkerHandoff, output: string): WorkerRunResult {
  try {
    const result = WorkerRunResultSchema.safeParse(JSON.parse(output));

    if (!result.success) {
      return runtimeResult(
        handoff.runId,
        "failure",
        "SDK worker output failed validation.",
        "runtime.invalid_worker_output",
        "invalid_worker_output",
        result.error.issues[0]?.message ?? "Worker output does not match WorkerRunResultSchema."
      );
    }

    if (result.data.runId !== handoff.runId) {
      return runtimeResult(
        handoff.runId,
        "failure",
        "SDK worker output used the wrong run id.",
        "runtime.invalid_worker_output",
        "invalid_worker_output",
        "Worker output runId must match the handoff runId."
      );
    }

    if (result.data.status === "success") {
      const missingFiles = handoff.expectedOutput.requiredFiles.filter(
        (path) => !result.data.artifacts.some((artifact) => artifact.kind === "durable" && artifact.path === path)
      );

      if (missingFiles.length > 0) {
        return runtimeResult(
          handoff.runId,
          "failure",
          "SDK worker output missed required files.",
          "runtime.output_contract_mismatch",
          "output_contract_mismatch",
          `Worker success is missing required durable artifact(s): ${missingFiles.join(", ")}`
        );
      }
    }

    return result.data;
  } catch (error) {
    return runtimeResult(
      handoff.runId,
      "failure",
      "SDK worker output was not valid JSON.",
      "runtime.invalid_worker_output",
      "invalid_worker_output",
      error instanceof Error ? error.message : String(error)
    );
  }
}

function runtimeResult(
  runId: string,
  status: "failure" | "blocked",
  summary: string,
  eventType: string,
  errorCode: string,
  errorMessage: string
): WorkerRunResult {
  return {
    runId,
    status,
    summary,
    artifacts: [],
    events: [
      {
        type: eventType,
        message: summary,
        timestamp: new Date().toISOString()
      }
    ],
    errors: [
      {
        code: errorCode,
        message: errorMessage
      }
    ]
  };
}

async function disposeSession(session: PiSdkAgentSession | undefined): Promise<void> {
  try {
    await session?.dispose?.();
  } catch {
    // Session disposal must not turn a validated worker result into failure.
  }
}
