import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Framework } from "./config.js";

interface DetectionResult {
  framework: Framework;
  confidence: "high" | "medium" | "low";
  reason: string;
}

export function detectFramework(projectDir: string): DetectionResult {
  const pkgPath = join(projectDir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      if (allDeps["next"]) {
        return { framework: "nextjs", confidence: "high", reason: "next in dependencies" };
      }
      if (allDeps["@angular/core"]) {
        return { framework: "angular", confidence: "high", reason: "@angular/core in dependencies" };
      }
      if (allDeps["vue"]) {
        return { framework: "vue", confidence: "high", reason: "vue in dependencies" };
      }
      if (allDeps["svelte"]) {
        return { framework: "svelte", confidence: "high", reason: "svelte in dependencies" };
      }
      if (allDeps["react"]) {
        return { framework: "react", confidence: "high", reason: "react in dependencies" };
      }
      if (allDeps["express"] || allDeps["fastify"] || allDeps["koa"] || allDeps["hono"]) {
        return { framework: "node", confidence: "medium", reason: "Node.js server framework detected" };
      }

      return { framework: "node", confidence: "low", reason: "package.json exists but no framework detected" };
    } catch {
      // invalid package.json
    }
  }

  if (existsSync(join(projectDir, "requirements.txt")) || existsSync(join(projectDir, "pyproject.toml"))) {
    return { framework: "python", confidence: "high", reason: "Python project files detected" };
  }

  if (existsSync(join(projectDir, "go.mod"))) {
    return { framework: "go", confidence: "high", reason: "go.mod detected" };
  }

  if (existsSync(join(projectDir, "Cargo.toml"))) {
    return { framework: "rust", confidence: "high", reason: "Cargo.toml detected" };
  }

  return { framework: "generic", confidence: "low", reason: "No specific framework detected" };
}
