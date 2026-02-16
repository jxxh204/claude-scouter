import { z } from "zod";

export const FrameworkEnum = z.enum([
  "nextjs",
  "react",
  "vue",
  "angular",
  "svelte",
  "node",
  "python",
  "go",
  "rust",
  "generic",
]);
export type Framework = z.infer<typeof FrameworkEnum>;

export const CommitFormatEnum = z.enum(["conventional", "angular", "custom"]);
export type CommitFormat = z.infer<typeof CommitFormatEnum>;

export const PrTypeEnum = z.enum([
  "feat",
  "fix",
  "docs",
  "refactor",
  "test",
  "chore",
  "style",
  "perf",
  "ci",
]);
export type PrType = z.infer<typeof PrTypeEnum>;

export const BranchPrefixEnum = z.enum([
  "feat",
  "fix",
  "hotfix",
  "docs",
  "refactor",
  "test",
  "chore",
  "release",
]);
export type BranchPrefix = z.infer<typeof BranchPrefixEnum>;

export const SkillEnum = z.enum([
  "ultrawork",
  "verify",
  "explore-first",
  "deep-debug",
  "code-review",
  "pr-create",
  "commit",
]);
export type Skill = z.infer<typeof SkillEnum>;

export const ConventionsSchema = z.object({
  prTitleFormat: z.string().default("<type>(<scope>): <description>"),
  prTypes: z.array(PrTypeEnum).default(["feat", "fix", "docs", "refactor", "test", "chore"]),
  issueRequired: z.boolean().default(true),
  commitFormat: CommitFormatEnum.default("conventional"),
  customCommitFormat: z.string().optional(),
  branchFormat: z.string().default("<type>/<issue-number>-<short-description>"),
  branchPrefixes: z
    .array(BranchPrefixEnum)
    .default(["feat", "fix", "hotfix", "docs", "refactor", "test", "chore", "release"]),
});
export type Conventions = z.infer<typeof ConventionsSchema>;

export const ProjectConfigSchema = z.object({
  framework: FrameworkEnum.default("generic"),
  conventions: ConventionsSchema.default({}),
  skills: z
    .array(SkillEnum)
    .default(["ultrawork", "verify", "explore-first", "deep-debug", "code-review", "pr-create", "commit"]),
  language: z.string().default("ko"),
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

export const FileOriginEnum = z.enum(["generated", "merged", "adopted"]);
export type FileOrigin = z.infer<typeof FileOriginEnum>;

export const LockFileSchema = z.object({
  version: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  config: ProjectConfigSchema,
  files: z.record(
    z.string(),
    z.object({
      hash: z.string(),
      generatedAt: z.string(),
      origin: FileOriginEnum.default("generated"),
    })
  ),
});
export type LockFile = z.infer<typeof LockFileSchema>;
