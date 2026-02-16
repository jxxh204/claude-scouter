import type { ProjectConfig } from "../../core/config.js";

export function commitTemplate(config: ProjectConfig): string {
  const commitFormatStr =
    config.conventions.commitFormat === "custom" && config.conventions.customCommitFormat
      ? config.conventions.customCommitFormat
      : config.conventions.commitFormat === "angular"
        ? "type(scope): subject"
        : "type(scope): description";

  const prTypesStr = config.conventions.prTypes.map((t) => `\`${t}\``).join(", ");

  return `---
description: "Create a commit following project conventions. Enforces commit message format."
---

# /commit — Conventional Commit

When this skill is invoked, create a properly formatted commit.

## Commit Format
\`${commitFormatStr}\`

Allowed types: ${prTypesStr}

## Step 1: Review Changes
\`\`\`bash
git status
git diff --staged
git diff
\`\`\`

If nothing is staged, identify which files should be committed.

## Step 2: Verify Before Committing
1. Run typecheck: \`npx tsc --noEmit\`
2. Run lint: check for issues in changed files
3. Ensure no debug code, secrets, or unintended changes

## Step 3: Stage Files
Stage only the relevant files. Never use \`git add -A\` or \`git add .\` blindly.

\`\`\`bash
git add <specific-files>
\`\`\`

## Step 4: Compose Commit Message
- **type**: The type of change (${prTypesStr})
- **scope**: The area affected (optional but recommended)
- **description**: Imperative mood, under 72 chars, explains *what* and *why*

Example:
\`\`\`
feat(auth): add JWT token refresh mechanism

Implement automatic token refresh when the access token expires.
The refresh token is stored in httpOnly cookies for security.

Closes #42
\`\`\`

## Step 5: Commit
\`\`\`bash
git commit -m "type(scope): description"
\`\`\`

## Step 6: Confirm
\`\`\`bash
git log --oneline -1
\`\`\`

## Rules
- Never use \`--no-verify\`
- Never amend the previous commit unless explicitly asked
- Never commit .env, credentials, or secrets
- If pre-commit hook fails, fix the issue and create a NEW commit
- Keep commits atomic — one logical change per commit
`;
}
