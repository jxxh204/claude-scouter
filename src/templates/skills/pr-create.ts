import type { ProjectConfig } from "../../core/config.js";

export function prCreateTemplate(config: ProjectConfig): string {
  const prTypesStr = config.conventions.prTypes.map((t) => `\`${t}\``).join(", ");

  return `---
description: "Automated PR creation following project conventions. Creates branch, commits, and opens PR."
---

# /pr-create — Create Pull Request

When this skill is invoked, create a PR following the project conventions.

## Prerequisites
- All changes are saved and working
- Typecheck, lint, and tests pass
- You know the type of change and scope

## Step 1: Verify Changes
\`\`\`bash
# Check current state
git status
git diff --stat
\`\`\`

Run verification: typecheck → lint → test

## Step 2: Determine PR Details
Based on the changes, determine:
- **Type**: One of ${prTypesStr}
- **Scope**: The area of the codebase affected
- **Description**: One-line summary of the change
${config.conventions.issueRequired ? "- **Issue**: The related issue number (REQUIRED)" : "- **Issue**: The related issue number (if applicable)"}

## Step 3: Create Branch
Branch format: \`${config.conventions.branchFormat}\`
Allowed prefixes: ${config.conventions.branchPrefixes.map((p) => `\`${p}/\``).join(", ")}

\`\`\`bash
git checkout -b <type>/<issue-number>-<short-description>
\`\`\`

## Step 4: Commit Changes
Commit format: \`${
    config.conventions.commitFormat === "custom" && config.conventions.customCommitFormat
      ? config.conventions.customCommitFormat
      : config.conventions.commitFormat === "angular"
        ? "type(scope): subject"
        : "type(scope): description"
  }\`

Stage and commit changes with a properly formatted message.

## Step 5: Create PR
PR title format: \`${config.conventions.prTitleFormat}\`

\`\`\`bash
gh pr create --title "<title>" --body "<body>"
\`\`\`

PR body must include:
- Summary of changes (bullet points)
- Test plan
${config.conventions.issueRequired ? "- Issue link (e.g., Closes #123)" : ""}
- Use the PR template if available

## Step 6: Report
- Print the PR URL
- Summarize what was included
- Note any follow-up items

## Rules
- Never force push
- Never skip hooks (--no-verify)
- Always verify before creating PR
- Always use the PR template if one exists
`;
}
