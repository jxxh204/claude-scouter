import type { ProjectConfig } from "../../core/config.js";

export function codeReviewTemplate(_config: ProjectConfig): string {
  return `---
description: "Independent code review checklist. Use to review changes before committing."
---

# /code-review — Code Review Checklist

When this skill is invoked, perform a thorough code review of the current changes.

## Step 1: Gather Changes
\`\`\`bash
git diff --stat
git diff
\`\`\`

## Step 2: Correctness Review
For each changed file, check:
- [ ] Does the code do what it's supposed to do?
- [ ] Are edge cases handled?
- [ ] Are error conditions handled gracefully?
- [ ] Is the logic correct for all input types?
- [ ] Are there any off-by-one errors?
- [ ] Are null/undefined cases handled?

## Step 3: Security Review
- [ ] No hardcoded secrets or credentials
- [ ] User input is validated and sanitized
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] No path traversal vulnerabilities
- [ ] Authentication/authorization checks in place
- [ ] Sensitive data is not logged

## Step 4: Performance Review
- [ ] No unnecessary database queries (N+1 problem)
- [ ] No unnecessary re-renders (React)
- [ ] No memory leaks (event listeners, subscriptions)
- [ ] No blocking operations on the main thread
- [ ] Appropriate use of caching

## Step 5: Code Quality Review
- [ ] Follows existing project conventions
- [ ] No unnecessary complexity
- [ ] No code duplication that should be extracted
- [ ] Variable/function names are clear and descriptive
- [ ] No dead code or commented-out code
- [ ] No debug code (console.log, debugger)

## Step 6: Test Review
- [ ] New behavior has tests
- [ ] Changed behavior has updated tests
- [ ] Tests are meaningful (not just for coverage)
- [ ] Edge cases are tested

## Step 7: Report
Present review findings:
- **Critical**: Issues that must be fixed before merging
- **Suggestions**: Improvements that would be nice to have
- **Questions**: Areas that need clarification
- **Approved**: Ready to merge / Needs changes
`;
}
