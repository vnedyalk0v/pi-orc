import { z } from "zod";

import { workflowModes } from "./WorkflowPolicy.js";

export const ProjectRepositoryVisibilitySchema = z.enum(["public", "private", "internal"]);
export const GitHubProjectOwnerTypeSchema = z.enum(["user", "organization"]);

export const defaultNewProjectIntakeOptions = {
  repositoryVisibility: "private",
  description: "",
  defaultBranch: "main",
  githubProjectOwnerType: "user",
  workflowMode: "assisted",
  stackProfile: "generic",
  verificationCommands: [],
  createDocsSkeleton: true,
  createGitHubProject: false,
  pushInitialCommit: false
} as const;

const GitHubOwnerNameSchema = z.string().regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/);
const GitHubRepositoryNameSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9._-]+$/)
  .refine((name) => name !== "." && name !== "..");
const GitBranchNameSchema = z
  .string()
  .min(1)
  .refine((name) => !/[\s\x00-\x1F\x7F~^:?*[\]\\]/.test(name))
  .refine((name) => !name.includes(".."))
  .refine((name) => !name.includes("//"))
  .refine((name) => !name.includes("@{"))
  .refine((name) => name !== "HEAD")
  .refine((name) => !name.startsWith("/"))
  .refine((name) => !name.startsWith("-"))
  .refine((name) => !name.endsWith("/"))
  .refine((name) => !name.endsWith("."))
  .refine((name) => !name.endsWith(".lock"))
  .refine((name) => name.split("/").every((part) => !part.startsWith(".") && !part.endsWith(".lock")));

const NewProjectIntakeBaseSchema = z
  .object({
    projectName: z.string().min(1),
    repositoryOwner: GitHubOwnerNameSchema,
    repositoryName: GitHubRepositoryNameSchema,
    repositoryVisibility: ProjectRepositoryVisibilitySchema.default(defaultNewProjectIntakeOptions.repositoryVisibility),
    description: z.string().default(defaultNewProjectIntakeOptions.description),
    defaultBranch: GitBranchNameSchema.default(defaultNewProjectIntakeOptions.defaultBranch),
    githubProjectOwnerType: GitHubProjectOwnerTypeSchema.default(defaultNewProjectIntakeOptions.githubProjectOwnerType),
    githubProjectOwner: GitHubOwnerNameSchema.optional(),
    workflowMode: z.enum(workflowModes).default(defaultNewProjectIntakeOptions.workflowMode),
    stackProfile: z.string().min(1).default(defaultNewProjectIntakeOptions.stackProfile),
    verificationCommands: z.array(z.string().min(1)).default(() => [...defaultNewProjectIntakeOptions.verificationCommands]),
    createDocsSkeleton: z.boolean().default(defaultNewProjectIntakeOptions.createDocsSkeleton),
    createGitHubProject: z.boolean().default(defaultNewProjectIntakeOptions.createGitHubProject),
    pushInitialCommit: z.boolean().default(defaultNewProjectIntakeOptions.pushInitialCommit)
  })
  .strict();

export const NewProjectIntakeSchema = NewProjectIntakeBaseSchema.transform((intake) => ({
  ...intake,
  githubProjectOwner: intake.githubProjectOwner ?? intake.repositoryOwner
}));

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

const ArtifactPathSchema = z.string().min(1);

export const WorkflowArtifactSchema = z.discriminatedUnion("kind", [
  z
    .object({
      path: ArtifactPathSchema,
      kind: z.literal("durable"),
      verified: z.boolean()
    })
    .strict(),
  z
    .object({
      path: ArtifactPathSchema,
      kind: z.literal("raw"),
      verified: z.literal(false)
    })
    .strict(),
  z
    .object({
      path: ArtifactPathSchema,
      kind: z.literal("transient"),
      verified: z.boolean()
    })
    .strict()
]);

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

const WorkerRunResultBaseSchema = z.object({
  runId: z.string().min(1),
  summary: z.string(),
  artifacts: z.array(WorkflowArtifactSchema),
  events: z.array(WorkerEventSchema)
});

export const WorkerRunResultSchema = z.discriminatedUnion("status", [
  WorkerRunResultBaseSchema.extend({
    status: z.literal("success"),
    errors: z.array(WorkerErrorSchema).length(0)
  }).strict(),
  WorkerRunResultBaseSchema.extend({
    status: z.literal("failure"),
    errors: z.array(WorkerErrorSchema)
  }).strict(),
  WorkerRunResultBaseSchema.extend({
    status: z.literal("blocked"),
    errors: z.array(WorkerErrorSchema)
  }).strict()
]);

export type WorkerContextPolicy = z.infer<typeof WorkerContextPolicySchema>;
export type ProjectRepositoryVisibility = z.infer<typeof ProjectRepositoryVisibilitySchema>;
export type GitHubProjectOwnerType = z.infer<typeof GitHubProjectOwnerTypeSchema>;
export type NewProjectIntake = z.infer<typeof NewProjectIntakeSchema>;
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
