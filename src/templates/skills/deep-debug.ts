import type { ProjectConfig } from "../../core/config.js";

export function deepDebugTemplate(_config: ProjectConfig): string {
  return `---
description: "Systematic debugging methodology for complex bugs. Use when standard debugging fails."
---

# /deep-debug — Systematic Debugging

When this skill is invoked, follow this systematic debugging protocol:

## Step 1: Reproduce
1. Understand the expected behavior vs actual behavior
2. Find the minimal reproduction steps
3. Confirm the bug is reproducible
4. Note the environment (OS, runtime version, dependencies)

## Step 2: Isolate
1. Identify the earliest point where behavior diverges from expectation
2. Add strategic logging/breakpoints to narrow down the location
3. Binary search through the code path to find the exact failure point
4. Check: is this a data problem, logic problem, or timing problem?

## Step 3: Hypothesize
Generate at least 3 hypotheses for the root cause:
1. Hypothesis A: [description] — test by [method]
2. Hypothesis B: [description] — test by [method]
3. Hypothesis C: [description] — test by [method]

## Step 4: Test Hypotheses
- Test each hypothesis systematically
- Start with the most likely hypothesis
- Collect evidence for/against each
- If all hypotheses fail, go back to Step 2 with new information

## Step 5: Fix
1. Implement the minimal fix that addresses the root cause
2. Do NOT fix symptoms — fix the underlying issue
3. Consider edge cases the fix might introduce
4. Add a test that would have caught this bug

## Step 6: Verify
1. Confirm the original bug is fixed
2. Run the full test suite to check for regressions
3. Review the fix for unintended side effects
4. Document what caused the bug and why the fix works

## Rules
- Never guess — always verify with evidence
- Remove all debug logging before completing
- Write a regression test for every bug fixed
- If stuck for more than 3 attempts, step back and re-examine assumptions
`;
}
