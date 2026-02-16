import type { ProjectConfig } from "../../core/config.js";

export function ultraworkTemplate(_config: ProjectConfig): string {
  return `---
description: "Rigorous, deep-analysis problem solving mode. Use when facing complex or ambiguous tasks."
---

# /ultrawork — Deep Analysis Mode

When this skill is invoked, follow this protocol:

## Phase 1: Understanding
1. **Restate the problem** in your own words to confirm understanding
2. **Identify constraints** — what must be true, what cannot change
3. **List unknowns** — what information is missing
4. **Define success criteria** — how will we know the task is complete

## Phase 2: Exploration
1. **Read all relevant source code** before proposing any changes
2. **Map dependencies** — what depends on the code being changed
3. **Identify risks** — what could break, what edge cases exist
4. **Check for existing solutions** — has this been solved elsewhere in the codebase

## Phase 3: Planning
1. **Design the minimal solution** that satisfies all constraints
2. **List every file** that needs to change
3. **Describe each change** before implementing
4. **Identify verification steps** — what tests/checks confirm correctness

## Phase 4: Implementation
1. **Make changes one file at a time**
2. **Run typecheck after each file** to catch issues early
3. **Write/update tests** for changed behavior
4. **Never combine unrelated changes** in a single step

## Phase 5: Verification
1. Run full verification suite: typecheck → lint → test
2. Review your diff — is every change necessary and correct?
3. Check for regressions in related functionality
4. Summarize what was done, why, and what to watch for

## Rules
- Use extended thinking for each phase
- Never skip a phase, even if the task seems simple
- If blocked, explain what's blocking and propose alternatives
- Prefer reversible changes over irreversible ones
`;
}
