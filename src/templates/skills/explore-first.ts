import type { ProjectConfig } from "../../core/config.js";

export function exploreFirstTemplate(_config: ProjectConfig): string {
  return `---
description: "Thorough codebase exploration before making any changes. Use for unfamiliar areas."
---

# /explore-first — Codebase Exploration

When this skill is invoked, explore the codebase systematically before writing any code.

## Phase 1: Project Overview
1. Read the project README and documentation
2. Understand the directory structure
3. Identify the tech stack and key dependencies
4. Note build/test/lint commands

## Phase 2: Architecture Mapping
1. Identify entry points (main files, route definitions, etc.)
2. Map the module dependency graph for the relevant area
3. Understand data flow: where data enters, transforms, and exits
4. Identify shared utilities, types, and constants

## Phase 3: Pattern Recognition
1. How are similar features implemented?
2. What naming conventions are used?
3. What patterns are used for error handling?
4. How is state managed?
5. What testing patterns are used?

## Phase 4: Targeted Deep-Dive
1. Read every file related to the task at hand
2. Understand the interfaces between modules
3. Check test files for intended behavior
4. Look at recent git history for context on recent changes

## Phase 5: Report
Present findings:
- **Architecture**: How the relevant parts connect
- **Patterns**: Conventions to follow
- **Key files**: Files that will need to change
- **Risks**: What could break
- **Approach**: Recommended implementation strategy

## Rules
- Do NOT write any code during exploration
- Read at least 5-10 related files before forming an opinion
- Look at tests to understand intended behavior
- Check git blame/log for recent changes and their reasons
- Only after the report is complete should you proceed to implementation
`;
}
