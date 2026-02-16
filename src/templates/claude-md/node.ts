import type { ProjectConfig } from "../../core/config.js";

export function nodeTemplate(_config: ProjectConfig): string {
  return `
## Node.js Specific Rules

### Architecture
- Separate route handlers from business logic
- Use middleware for cross-cutting concerns (auth, logging, validation)
- Keep controllers thin — delegate to service layer
- Use dependency injection where appropriate

### Error Handling
- Use centralized error handling middleware
- Define custom error classes for domain errors
- Never expose stack traces in production responses
- Log errors with context (request ID, user, operation)

### API Design
- Use consistent response formats
- Validate request bodies at the boundary (zod, joi, etc.)
- Use proper HTTP status codes
- Version APIs when breaking changes are needed

### Database
- Use parameterized queries — never interpolate user input
- Use migrations for schema changes
- Keep database access in repository/data layer
- Use connection pooling

### Commands
- Dev: \`npm run dev\` or \`bun run --watch\`
- Build: \`npm run build\`
- Typecheck: \`npx tsc --noEmit\`
- Lint: \`npx eslint .\`
- Test: \`npm test\`
`;
}
