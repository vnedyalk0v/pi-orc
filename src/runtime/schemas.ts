import { z } from "zod";

export const WorkerContextPolicySchema = z.enum([
  "project-intake-only",
  "docs-only",
  "finding-scoped",
  "issue-scoped",
  "pr-comment-scoped"
]);

export const WorkerToolPolicySchema = z.enum(["allow", "deny"]);

export const WorkerPermissionSetSchema = z
  .object({
    mayEditFiles: z.boolean(),
    mayRunBash: z.boolean(),
    mayRunGitHubMutation: z.boolean(),
    mayCommit: z.boolean(),
    mayPush: z.boolean(),
    mayCreatePullRequest: z.boolean(),
    mayResolveReviewThread: z.boolean()
  })
  .strict();

export const WorkerOutputContractSchema = z
  .object({
    requiredFiles: z.array(z.string().min(1)),
    format: z.enum(["markdown", "json", "markdown+json"])
  })
  .strict();

export const WorkerProfileSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    purpose: z.string().min(1),
    contextPolicy: WorkerContextPolicySchema,
    cleanContext: z.literal(true),
    tools: z.record(z.string().min(1), WorkerToolPolicySchema),
    permissions: WorkerPermissionSetSchema,
    outputContract: WorkerOutputContractSchema
  })
  .strict();

export const WorkerHandoffSchema = z
  .object({
    version: z.literal("1"),
    runId: z.string().min(1),
    workerId: z.string().min(1),
    objective: z.string().min(1),
    relevantFiles: z.array(z.string().min(1)),
    constraints: z.array(z.string().min(1)),
    decisions: z.array(z.string().min(1)),
    risks: z.array(z.string().min(1)),
    expectedOutput: WorkerOutputContractSchema,
    forbiddenActions: z.array(z.string().min(1))
  })
  .strict();

export const WorkerRunInputSchema = z
  .object({
    profile: WorkerProfileSchema,
    handoff: WorkerHandoffSchema
  })
  .strict();

export const WorkflowArtifactSchema = z
  .object({
    path: z.string().min(1),
    kind: z.enum(["durable", "raw", "transient"]),
    verified: z.boolean()
  })
  .strict();

export const WorkerEventSchema = z
  .object({
    type: z.string().min(1),
    message: z.string().min(1),
    timestamp: z.string().datetime()
  })
  .strict();

export const WorkerErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1)
  })
  .strict();

export const WorkerRunResultSchema = z
  .object({
    runId: z.string().min(1),
    status: z.enum(["success", "failure", "blocked"]),
    summary: z.string(),
    artifacts: z.array(WorkflowArtifactSchema),
    events: z.array(WorkerEventSchema),
    errors: z.array(WorkerErrorSchema)
  })
  .strict();

export type WorkerContextPolicy = z.infer<typeof WorkerContextPolicySchema>;
export type WorkerToolPolicy = z.infer<typeof WorkerToolPolicySchema>;
export type WorkerPermissionSet = z.infer<typeof WorkerPermissionSetSchema>;
export type WorkerOutputContract = z.infer<typeof WorkerOutputContractSchema>;
export type WorkerProfile = z.infer<typeof WorkerProfileSchema>;
export type WorkerHandoff = z.infer<typeof WorkerHandoffSchema>;
export type WorkerRunInput = z.infer<typeof WorkerRunInputSchema>;
export type WorkflowArtifact = z.infer<typeof WorkflowArtifactSchema>;
export type WorkerRunArtifact = WorkflowArtifact;
export type WorkerRunEvent = z.infer<typeof WorkerEventSchema>;
export type WorkerRunError = z.infer<typeof WorkerErrorSchema>;
export type WorkerRunResult = z.infer<typeof WorkerRunResultSchema>;
