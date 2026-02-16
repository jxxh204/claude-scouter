import type { ProjectConfig } from "../../core/config.js";

export function verifyTemplate(_config: ProjectConfig): string {
  return `---
description: "Multi-step verification protocol. Run after completing any task to ensure quality."
---

# /verify — Verification Protocol

When this skill is invoked, execute the following verification steps in order:

## Step 1: Type Safety
\`\`\`bash
# Run typecheck
npx tsc --noEmit 2>&1 | head -50
\`\`\`
- If errors exist, fix them before proceeding
- Report: number of errors found and fixed

## Step 2: Lint Check
\`\`\`bash
# Run linter
npx eslint . --max-warnings=0 2>&1 | head -50
\`\`\`
- Fix auto-fixable issues
- Report: number of warnings/errors

## Step 3: Test Suite
\`\`\`bash
# Run tests
npm test 2>&1 | tail -30
\`\`\`
- If tests fail, investigate and fix
- Report: pass/fail counts

## Step 4: Diff Review
1. Run \`git diff\` to review all changes
2. Check each change for:
   - Unintended modifications
   - Debug code (console.log, debugger, TODO)
   - Security issues (hardcoded secrets, SQL injection, XSS)
   - Performance concerns (N+1 queries, unnecessary re-renders)
3. Report: list of files changed with summary

## Step 5: Summary Report
Present a final report:
- ✓ Typecheck: PASS/FAIL (N errors)
- ✓ Lint: PASS/FAIL (N issues)
- ✓ Tests: PASS/FAIL (N/M passed)
- ✓ Diff: N files changed, M insertions, K deletions
- ✓ Overall: READY / NEEDS ATTENTION

## Rules
- Never skip a step
- If any step fails, fix the issue and re-run from that step
- Do not modify test expectations to make tests pass (fix the code instead)
- Report honestly — never hide failures
`;
}
