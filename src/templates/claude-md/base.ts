import type { ProjectConfig } from "../../core/config.js";

export function baseTemplate(config: ProjectConfig): string {
  const commitFormatDesc =
    config.conventions.commitFormat === "custom" && config.conventions.customCommitFormat
      ? config.conventions.customCommitFormat
      : config.conventions.commitFormat === "angular"
        ? "type(scope): subject"
        : "type(scope): description";

  const branchPrefixList = config.conventions.branchPrefixes.map((p) => `\`${p}/\``).join(", ");

  return `# Project Rules

## Core Principles

1. **Explore before coding** — Always read and understand existing code before making changes.
2. **Verify after changes** — Run typecheck, lint, and tests after every significant change.
3. **Minimal diff** — Only change what's necessary. Avoid drive-by refactors or unrelated cleanups.
4. **Follow existing patterns** — Match the project's naming, structure, and style conventions.
5. **Think before acting** — Use extended thinking for complex problems. Plan before implementing.

## Workflow

### Before Starting
- Read relevant source files to understand context
- Check for existing patterns and utilities
- Identify the minimal set of changes needed

### While Working
- Make small, focused changes
- Run \`typecheck\` and \`lint\` after modifications
- Write or update tests for changed behavior
- Never commit secrets, credentials, or .env files

### Before Completing
- Run the full verification: typecheck → lint → test
- Review your own diff for unintended changes
- Ensure commit message follows the project convention

## Git Conventions

### Commit Messages
Format: \`${commitFormatDesc}\`

Allowed types: ${config.conventions.prTypes.map((t) => `\`${t}\``).join(", ")}

Rules:
- Use imperative mood in the subject line
- Keep the subject line under 72 characters
- Separate subject from body with a blank line
- Use the body to explain *why*, not *what*

### Branch Naming
Format: \`${config.conventions.branchFormat}\`

Allowed prefixes: ${branchPrefixList}

### Pull Requests
Title format: \`${config.conventions.prTitleFormat}\`
${config.conventions.issueRequired ? "- Issue link is **required** in every PR" : "- Issue link is optional"}
- Always include a summary and test plan
- Use the PR template when available

## Anti-Patterns (NEVER DO)

- Do NOT add comments to code you didn't change
- Do NOT refactor surrounding code unless explicitly asked
- Do NOT add type annotations to unchanged functions
- Do NOT introduce new abstractions for single-use cases
- Do NOT use \`any\` type — find the correct type
- Do NOT skip pre-commit hooks with \`--no-verify\`
- Do NOT force push unless explicitly asked
- Do NOT commit generated files, lock files you didn't change, or large binaries

## Verification Protocol

Before declaring any task complete, run:
1. **Typecheck**: Ensure no type errors
2. **Lint**: Ensure no linting violations
3. **Test**: Ensure all tests pass
4. **Diff review**: Check your changes are minimal and correct
`;
}
