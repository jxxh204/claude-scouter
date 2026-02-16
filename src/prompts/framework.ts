import * as p from "@clack/prompts";
import type { Framework } from "../core/config.js";
import { detectFramework } from "../core/framework-detector.js";

const FRAMEWORK_OPTIONS: { value: Framework; label: string }[] = [
  { value: "nextjs", label: "Next.js" },
  { value: "react", label: "React (CRA / Vite)" },
  { value: "vue", label: "Vue" },
  { value: "angular", label: "Angular" },
  { value: "svelte", label: "Svelte / SvelteKit" },
  { value: "node", label: "Node.js (Express / Fastify / Hono)" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "generic", label: "Generic / Other" },
];

export async function promptFramework(projectDir: string): Promise<Framework> {
  const detected = detectFramework(projectDir);

  const options = FRAMEWORK_OPTIONS.map((opt) => ({
    ...opt,
    hint: opt.value === detected.framework ? `auto-detected (${detected.confidence})` : undefined,
  }));

  // Move detected framework to the top
  const sortedOptions = [
    ...options.filter((o) => o.value === detected.framework),
    ...options.filter((o) => o.value !== detected.framework),
  ];

  const result = await p.select({
    message: "Which framework does this project use?",
    options: sortedOptions,
    initialValue: detected.framework,
  });

  if (p.isCancel(result)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  return result as Framework;
}
