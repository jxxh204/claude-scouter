import type { ProjectConfig } from "../../core/config.js";

export function reactTemplate(_config: ProjectConfig): string {
  return `
## React Specific Rules

### Component Design
- Prefer function components with hooks
- Extract custom hooks for reusable stateful logic
- Keep components small and focused (single responsibility)
- Use composition over prop drilling

### State Management
- Start with local state (\`useState\`)
- Lift state up before introducing global state
- Use context for truly global state (theme, auth, locale)
- Avoid unnecessary re-renders — memoize with \`useMemo\` / \`useCallback\` only when measured

### Patterns
- Colocate related files (component, styles, tests, types)
- Use \`children\` prop for layout components
- Handle loading, error, and empty states in every data-fetching component
- Prefer controlled components over uncontrolled

### Testing
- Test behavior, not implementation details
- Use React Testing Library
- Test user interactions and rendered output
- Mock external dependencies, not internal modules

### Commands
- Dev: \`npm run dev\` or \`bun dev\`
- Build: \`npm run build\`
- Typecheck: \`npx tsc --noEmit\`
- Lint: \`npx eslint .\`
- Test: \`npm test\`
`;
}
