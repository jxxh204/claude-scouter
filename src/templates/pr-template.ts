import type { ProjectConfig } from "../core/config.js";

export function prTemplateTemplate(config: ProjectConfig): string {
  const typeOptions = config.conventions.prTypes.map((t) => `- [ ] \`${t}\``).join("\n");

  return `## Type of Change

${typeOptions}

## Summary

<!-- Describe the changes in 1-3 bullet points -->
-

## Changes Made

<!-- List the specific changes made -->
-

${
  config.conventions.issueRequired
    ? `## Related Issue

<!-- Link the related issue (REQUIRED) -->
Closes #

`
    : `## Related Issue

<!-- Link the related issue (if applicable) -->

`
}
## Test Plan

<!-- Describe how these changes were tested -->
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist

- [ ] Code follows project conventions
- [ ] Self-review performed
- [ ] Tests pass locally
- [ ] No new warnings introduced
- [ ] Documentation updated (if applicable)

## Screenshots (if applicable)

<!-- Add screenshots for UI changes -->
`;
}
