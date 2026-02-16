import * as p from "@clack/prompts";
import type { BranchPrefix, CommitFormat, Conventions, PrType } from "../core/config.js";

export async function promptConventions(): Promise<Conventions> {
  // PR Title Format
  const prTitleFormat = await p.text({
    message: "PR title format:",
    placeholder: "<type>(<scope>): <description>",
    defaultValue: "<type>(<scope>): <description>",
    validate: (v) => (v.length === 0 ? "Format is required" : undefined),
  });
  if (p.isCancel(prTitleFormat)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  // PR Types
  const prTypes = await p.multiselect({
    message: "Select PR types to use:",
    options: [
      { value: "feat", label: "feat", hint: "New feature" },
      { value: "fix", label: "fix", hint: "Bug fix" },
      { value: "docs", label: "docs", hint: "Documentation" },
      { value: "refactor", label: "refactor", hint: "Refactoring" },
      { value: "test", label: "test", hint: "Tests" },
      { value: "chore", label: "chore", hint: "Maintenance" },
      { value: "style", label: "style", hint: "Code style" },
      { value: "perf", label: "perf", hint: "Performance" },
      { value: "ci", label: "ci", hint: "CI/CD" },
    ],
    initialValues: ["feat", "fix", "docs", "refactor", "test", "chore"],
    required: true,
  });
  if (p.isCancel(prTypes)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  // Issue link required?
  const issueRequired = await p.confirm({
    message: "Require issue link in PRs?",
    initialValue: true,
  });
  if (p.isCancel(issueRequired)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  // Commit format
  const commitFormat = await p.select({
    message: "Commit message format:",
    options: [
      { value: "conventional", label: "Conventional Commits", hint: "type(scope): description" },
      { value: "angular", label: "Angular", hint: "type(scope): subject" },
      { value: "custom", label: "Custom", hint: "Define your own format" },
    ],
    initialValue: "conventional" as CommitFormat,
  });
  if (p.isCancel(commitFormat)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  let customCommitFormat: string | undefined;
  if (commitFormat === "custom") {
    const custom = await p.text({
      message: "Enter custom commit format:",
      placeholder: "<type>: <description>",
      validate: (v) => (v.length === 0 ? "Format is required" : undefined),
    });
    if (p.isCancel(custom)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }
    customCommitFormat = custom;
  }

  // Branch naming format
  const branchFormat = await p.text({
    message: "Branch naming format:",
    placeholder: "<type>/<issue-number>-<short-description>",
    defaultValue: "<type>/<issue-number>-<short-description>",
    validate: (v) => (v.length === 0 ? "Format is required" : undefined),
  });
  if (p.isCancel(branchFormat)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  // Branch prefixes
  const branchPrefixes = await p.multiselect({
    message: "Select branch prefixes to use:",
    options: [
      { value: "feat", label: "feat/" },
      { value: "fix", label: "fix/" },
      { value: "hotfix", label: "hotfix/" },
      { value: "docs", label: "docs/" },
      { value: "refactor", label: "refactor/" },
      { value: "test", label: "test/" },
      { value: "chore", label: "chore/" },
      { value: "release", label: "release/" },
    ],
    initialValues: ["feat", "fix", "hotfix", "docs", "refactor", "test", "chore", "release"],
    required: true,
  });
  if (p.isCancel(branchPrefixes)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  return {
    prTitleFormat: prTitleFormat as string,
    prTypes: prTypes as PrType[],
    issueRequired: issueRequired as boolean,
    commitFormat: commitFormat as CommitFormat,
    customCommitFormat,
    branchFormat: branchFormat as string,
    branchPrefixes: branchPrefixes as BranchPrefix[],
  };
}
