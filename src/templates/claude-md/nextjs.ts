import type { ProjectConfig } from "../../core/config.js";

export function nextjsTemplate(_config: ProjectConfig): string {
  return `
## Next.js Specific Rules

### App Router
- Use Server Components by default
- Add \`"use client"\` only when the component needs client-side interactivity
- Prefer Server Actions over API routes for mutations
- Use \`loading.tsx\` and \`error.tsx\` for loading/error states

### Data Fetching
- Fetch data in Server Components whenever possible
- Use \`fetch\` with appropriate caching: \`{ cache: 'force-cache' | 'no-store' }\`
- Use \`revalidatePath\` / \`revalidateTag\` for cache invalidation
- Avoid client-side data fetching (useEffect + fetch) unless necessary

### File Conventions
- \`page.tsx\` — route page
- \`layout.tsx\` — shared layout
- \`loading.tsx\` — loading UI
- \`error.tsx\` — error boundary
- \`not-found.tsx\` — 404 page
- \`route.ts\` — API route handler

### Performance
- Use \`next/image\` for images with proper width/height
- Use \`next/font\` for font optimization
- Use dynamic imports (\`next/dynamic\`) for heavy client components
- Avoid importing server-only code in client components

### Commands
- Dev: \`npm run dev\` or \`bun dev\`
- Build: \`npm run build\`
- Typecheck: \`npx tsc --noEmit\`
- Lint: \`npx next lint\`
`;
}
