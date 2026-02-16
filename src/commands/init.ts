import * as p from "@clack/prompts";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import pc from "picocolors";
import { promptFramework } from "../prompts/framework.js";
import { promptConventions } from "../prompts/conventions.js";
import { promptSkills } from "../prompts/skills.js";
import { generateClaudeMd, generateClaudeMdMerged } from "../generators/claude-md.js";
import { generateSettings, generateSettingsMerged } from "../generators/settings.js";
import { generateSkills } from "../generators/skills.js";
import { generateAgents } from "../generators/agents.js";
import { generatePrTemplate } from "../generators/pr-template.js";
import { generateLockFile } from "../generators/lock-file.js";
import { printResults, writeFile, type WriteResult } from "../core/file-writer.js";
import type { ProjectConfig, Skill } from "../core/config.js";
import { scanExistingFiles, hasExistingClaudeFiles, type ExistingFiles } from "../core/scanner.js";

type MergeStrategy = "merge" | "overwrite" | "cancel";

export async function initCommand(options: { yes?: boolean }) {
  const projectDir = resolve(process.cwd());

  p.intro(pc.bgCyan(pc.black(" claude-scouter ")));

  // Step 1: Scan existing files
  const scan = scanExistingFiles(projectDir);

  // Step 2: Determine strategy
  let strategy: MergeStrategy = "overwrite";

  if (scan.lockFile.exists) {
    // Existing scouter configuration found
    const overwrite = await confirmOrDefault(
      options.yes,
      "Existing scouter configuration found. Overwrite?",
      false
    );
    if (!overwrite) {
      p.cancel("Use `claude-scouter update` to update existing configuration.");
      process.exit(0);
    }
    strategy = "overwrite";
  } else if (hasExistingClaudeFiles(scan)) {
    // Existing Claude Code files found (no lock)
    strategy = await promptMergeStrategy(scan, options.yes);
    if (strategy === "cancel") {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }
  }
  // else: fresh project → default "overwrite" (generate from scratch)

  // Step 3: Interactive prompts (framework, conventions, skills)
  let config: ProjectConfig;

  if (options.yes) {
    const { detectFramework } = await import("../core/framework-detector.js");
    const detected = detectFramework(projectDir);
    config = {
      framework: detected.framework,
      conventions: {
        prTitleFormat: "<type>(<scope>): <description>",
        prTypes: ["feat", "fix", "docs", "refactor", "test", "chore"],
        issueRequired: true,
        commitFormat: "conventional",
        branchFormat: "<type>/<issue-number>-<short-description>",
        branchPrefixes: ["feat", "fix", "hotfix", "docs", "refactor", "test", "chore", "release"],
      },
      skills: ["ultrawork", "verify", "explore-first", "deep-debug", "code-review", "pr-create", "commit"],
      language: "ko",
    };
    p.log.info(`Framework: ${pc.cyan(config.framework)} (auto-detected)`);
  } else {
    const framework = await promptFramework(projectDir);
    const conventions = await promptConventions();
    const skills = await promptSkills();

    config = {
      framework,
      conventions,
      skills,
      language: "ko",
    };
  }

  // Step 4: Generate files (strategy-dependent)
  const s = p.spinner();
  s.start("Generating files...");

  const results: WriteResult[] = [];

  if (strategy === "merge") {
    // --- Merge path ---

    // CLAUDE.md
    if (scan.claudeMd.exists && scan.claudeMd.content !== null) {
      results.push(
        generateClaudeMdMerged(projectDir, config, scan.claudeMd.content, scan.claudeMd.hasSentinels)
      );
    } else {
      results.push(generateClaudeMd(projectDir, config));
    }

    // settings.json
    if (scan.settings.exists && scan.settings.parsed !== null) {
      results.push(generateSettingsMerged(projectDir, config, scan.settings.parsed));
    } else {
      results.push(generateSettings(projectDir, config));
    }

    // Skills — handle conflicts
    s.stop("Processing skills...");
    const skillResults = await generateSkillsWithConflictCheck(projectDir, config, scan, options.yes);
    results.push(...skillResults);
    s.start("Generating remaining files...");

    // Agents — handle conflicts
    const agentResults = await generateAgentsWithConflictCheck(projectDir, config, scan, options.yes);
    results.push(...agentResults);

    // PR template — always generate (won't overwrite existing due to writeFile default)
    results.push(generatePrTemplate(projectDir, config));
  } else {
    // --- Overwrite path (fresh generation) ---
    results.push(generateClaudeMd(projectDir, config));
    results.push(generateSettings(projectDir, config));
    results.push(...generateSkills(projectDir, config));
    results.push(...generateAgents(projectDir, config));
    results.push(generatePrTemplate(projectDir, config));
  }

  // Generate lock file
  generateLockFile(projectDir, config, results);

  s.stop("Files generated!");

  // Print results
  console.log();
  p.log.info(pc.bold("Generated files:"));
  printResults(results);

  // Print lock file separately
  console.log(`  ${pc.green("✓")} .claude-scouter.lock.json ${pc.dim("(created)")}`);

  // Usage guide
  console.log();
  p.log.info(pc.bold("Next steps:"));
  console.log(`  1. Review the generated ${pc.cyan("CLAUDE.md")} file`);
  console.log(`  2. Try skills in Claude Code: ${pc.cyan("/ultrawork")}, ${pc.cyan("/verify")}, ${pc.cyan("/commit")}`);
  console.log(`  3. Run ${pc.cyan("claude-scouter doctor")} to check your setup`);
  console.log(`  4. Commit the generated files to your repository`);

  p.outro(pc.green("Setup complete! Happy coding with Claude."));
}

// --- Helper functions ---

async function confirmOrDefault(
  yes: boolean | undefined,
  message: string,
  defaultValue: boolean
): Promise<boolean> {
  if (yes) return defaultValue;

  const result = await p.confirm({ message, initialValue: defaultValue });
  if (p.isCancel(result)) return false;
  return result;
}

async function promptMergeStrategy(
  scan: ExistingFiles,
  yes?: boolean
): Promise<MergeStrategy> {
  // Print detection report
  p.log.warn(pc.yellow("Existing Claude Code settings detected:"));

  if (scan.claudeMd.exists) {
    const extra = scan.claudeMd.hasSentinels ? " (has scouter sentinels)" : "";
    console.log(`  ${pc.green("✓")} CLAUDE.md${pc.dim(extra)}`);
  }
  if (scan.settings.exists) {
    console.log(`  ${pc.green("✓")} .claude/settings.json`);
  }

  for (const skill of scan.skills) {
    if (skill.isScouter) {
      console.log(`  ${pc.yellow("!")} .claude/skills/${skill.name}.md ${pc.dim("(scouter name conflict)")}`);
    } else {
      console.log(`  ${pc.green("✓")} .claude/skills/${skill.name}.md ${pc.dim("(preserved)")}`);
    }
  }

  for (const agent of scan.agents) {
    if (agent.isScouter) {
      console.log(`  ${pc.yellow("!")} .claude/agents/${agent.name}.md ${pc.dim("(scouter name conflict)")}`);
    } else {
      console.log(`  ${pc.green("✓")} .claude/agents/${agent.name}.md ${pc.dim("(preserved)")}`);
    }
  }

  console.log();

  // -y flag defaults to Merge (non-destructive)
  if (yes) {
    p.log.info(`Strategy: ${pc.cyan("Merge")} (default for -y)`);
    return "merge";
  }

  const result = await p.select({
    message: "How should we handle existing files?",
    options: [
      { value: "merge", label: "Merge (recommended)", hint: "Preserve existing content, add scouter settings" },
      { value: "overwrite", label: "Overwrite", hint: "Replace everything with fresh scouter settings" },
      { value: "cancel", label: "Cancel", hint: "Don't change anything" },
    ],
    initialValue: "merge" as MergeStrategy,
  });

  if (p.isCancel(result)) return "cancel";
  return result as MergeStrategy;
}

async function generateSkillsWithConflictCheck(
  projectDir: string,
  config: ProjectConfig,
  scan: ExistingFiles,
  yes?: boolean
): Promise<WriteResult[]> {
  const results: WriteResult[] = [];
  const existingSkillNames = new Set(scan.skills.map((s) => s.name));

  for (const skill of config.skills) {
    const relativePath = `.claude/skills/${skill}.md`;
    const hasConflict = existingSkillNames.has(skill);

    if (hasConflict) {
      const useScouterVersion = await resolveConflict(
        `Skill "${skill}.md" already exists.`,
        yes
      );
      if (useScouterVersion) {
        // Import the template dynamically
        const content = await getSkillContent(skill, config);
        if (content) {
          results.push(writeFile(projectDir, relativePath, content, true));
        }
      } else {
        // Keep user's version — record as adopted
        results.push({
          path: join(projectDir, relativePath),
          relativePath,
          hash: "",
          action: "skipped",
        });
      }
    } else {
      // No conflict: generate normally
      const content = await getSkillContent(skill, config);
      if (content) {
        results.push(writeFile(projectDir, relativePath, content));
      }
    }
  }

  return results;
}

async function generateAgentsWithConflictCheck(
  projectDir: string,
  config: ProjectConfig,
  scan: ExistingFiles,
  yes?: boolean
): Promise<WriteResult[]> {
  const { reviewerAgentTemplate } = await import("../templates/agents/reviewer.js");
  const { explorerAgentTemplate } = await import("../templates/agents/explorer.js");

  const agentDefs = [
    { name: "reviewer", fn: reviewerAgentTemplate },
    { name: "explorer", fn: explorerAgentTemplate },
  ];

  const results: WriteResult[] = [];
  const existingAgentNames = new Set(scan.agents.map((a) => a.name));

  for (const agent of agentDefs) {
    const relativePath = `.claude/agents/${agent.name}.md`;
    const hasConflict = existingAgentNames.has(agent.name);

    if (hasConflict) {
      const useScouterVersion = await resolveConflict(
        `Agent "${agent.name}.md" already exists.`,
        yes
      );
      if (useScouterVersion) {
        results.push(writeFile(projectDir, relativePath, agent.fn(config), true));
      } else {
        results.push({
          path: join(projectDir, relativePath),
          relativePath,
          hash: "",
          action: "skipped",
        });
      }
    } else {
      results.push(writeFile(projectDir, relativePath, agent.fn(config)));
    }
  }

  return results;
}

async function resolveConflict(message: string, yes?: boolean): Promise<boolean> {
  if (yes) return false; // -y defaults to keeping user's version

  const result = await p.select({
    message,
    options: [
      { value: "keep", label: "Keep yours", hint: "Preserve your existing file" },
      { value: "scouter", label: "Use scouter's", hint: "Replace with scouter version" },
    ],
    initialValue: "keep" as string,
  });

  if (p.isCancel(result)) return false;
  return result === "scouter";
}

async function getSkillContent(skill: Skill, config: ProjectConfig): Promise<string | null> {
  const templates: Record<string, () => Promise<{ default?: (c: ProjectConfig) => string } & Record<string, (c: ProjectConfig) => string>>> = {
    ultrawork: () => import("../templates/skills/ultrawork.js"),
    verify: () => import("../templates/skills/verify.js"),
    "explore-first": () => import("../templates/skills/explore-first.js"),
    "deep-debug": () => import("../templates/skills/deep-debug.js"),
    "code-review": () => import("../templates/skills/code-review.js"),
    "pr-create": () => import("../templates/skills/pr-create.js"),
    commit: () => import("../templates/skills/commit.js"),
  };

  const templateMap: Record<string, string> = {
    ultrawork: "ultraworkTemplate",
    verify: "verifyTemplate",
    "explore-first": "exploreFirstTemplate",
    "deep-debug": "deepDebugTemplate",
    "code-review": "codeReviewTemplate",
    "pr-create": "prCreateTemplate",
    commit: "commitTemplate",
  };

  const loader = templates[skill];
  if (!loader) return null;

  const mod = await loader();
  const fnName = templateMap[skill];
  const fn = (mod as Record<string, (c: ProjectConfig) => string>)[fnName];
  if (!fn) return null;

  return fn(config);
}
