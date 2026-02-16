import * as p from "@clack/prompts";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import pc from "picocolors";
import {
  readLockFile,
  computeHash,
  writeFile,
  printResults,
  type WriteResult,
} from "../core/file-writer.js";
import { generateLockFile } from "../generators/lock-file.js";
import { generateClaudeMd, generateClaudeMdMerged } from "../generators/claude-md.js";
import { generateSettings, generateSettingsMerged } from "../generators/settings.js";
import { generateSkills } from "../generators/skills.js";
import { generateAgents } from "../generators/agents.js";
import { generatePrTemplate } from "../generators/pr-template.js";
import { ultraworkTemplate } from "../templates/skills/ultrawork.js";
import { verifyTemplate } from "../templates/skills/verify.js";
import { exploreFirstTemplate } from "../templates/skills/explore-first.js";
import { deepDebugTemplate } from "../templates/skills/deep-debug.js";
import { codeReviewTemplate } from "../templates/skills/code-review.js";
import { prCreateTemplate } from "../templates/skills/pr-create.js";
import { commitTemplate } from "../templates/skills/commit.js";
import { reviewerAgentTemplate } from "../templates/agents/reviewer.js";
import { explorerAgentTemplate } from "../templates/agents/explorer.js";
import { SENTINEL_START, SENTINEL_END } from "../core/merger.js";
import type { ProjectConfig, Skill } from "../core/config.js";

const skillTemplateMap: Record<string, (c: ProjectConfig) => string> = {
  ultrawork: ultraworkTemplate,
  verify: verifyTemplate,
  "explore-first": exploreFirstTemplate,
  "deep-debug": deepDebugTemplate,
  "code-review": codeReviewTemplate,
  "pr-create": prCreateTemplate,
  commit: commitTemplate,
};

const agentTemplateMap: Array<{ name: string; fn: (c: ProjectConfig) => string }> = [
  { name: "reviewer", fn: reviewerAgentTemplate },
  { name: "explorer", fn: explorerAgentTemplate },
];

export async function updateCommand() {
  const projectDir = resolve(process.cwd());

  p.intro(pc.bgCyan(pc.black(" claude-scouter update ")));

  const lockFile = readLockFile(projectDir);
  if (!lockFile) {
    p.cancel("No lock file found. Run `claude-scouter init` first.");
    process.exit(1);
  }

  const config = lockFile.config;
  const results: WriteResult[] = [];
  const userModified: string[] = [];

  // Check each tracked file for modifications
  for (const [relativePath, record] of Object.entries(lockFile.files)) {
    const fullPath = join(projectDir, relativePath);
    if (!existsSync(fullPath)) {
      continue;
    }

    // For merged files, skip hash comparison on the whole file
    // (user content outside sentinels is expected to change)
    if (record.origin === "merged") {
      continue;
    }

    const currentContent = readFileSync(fullPath, "utf-8");
    const currentHash = computeHash(currentContent);

    if (currentHash !== record.hash) {
      userModified.push(relativePath);
    }
  }

  if (userModified.length > 0) {
    p.log.warn(pc.yellow("The following files have been modified by you:"));
    for (const f of userModified) {
      console.log(`  ${pc.yellow("→")} ${f}`);
    }
    console.log();

    const action = await p.select({
      message: "How should modified files be handled?",
      options: [
        { value: "skip", label: "Skip modified files", hint: "Only update unmodified files" },
        { value: "overwrite", label: "Overwrite all", hint: "Regenerate everything" },
        { value: "cancel", label: "Cancel", hint: "Don't update anything" },
      ],
      initialValue: "skip",
    });

    if (p.isCancel(action) || action === "cancel") {
      p.cancel("Update cancelled.");
      process.exit(0);
    }

    const force = action === "overwrite";
    const s = p.spinner();
    s.start("Updating files...");

    // CLAUDE.md
    results.push(updateClaudeMd(projectDir, config, lockFile, force, userModified));

    // settings.json
    results.push(updateSettings(projectDir, config, lockFile, force, userModified));

    // Skills
    results.push(...generateSkillsSelective(projectDir, config, force, userModified));

    // Agents
    results.push(...generateAgentsSelective(projectDir, config, force, userModified));

    // PR template
    results.push(
      shouldUpdate(".github/pull_request_template.md", force, userModified)
        ? generatePrTemplate(projectDir, config)
        : skipResult(projectDir, ".github/pull_request_template.md")
    );

    s.stop("Update complete!");
  } else {
    const s = p.spinner();
    s.start("Updating files...");

    // CLAUDE.md — respect merged origin
    results.push(updateClaudeMd(projectDir, config, lockFile, true, []));

    // settings.json — respect merged origin
    results.push(updateSettings(projectDir, config, lockFile, true, []));

    // Skills & Agents — standard regeneration
    results.push(...generateSkills(projectDir, config));
    results.push(...generateAgents(projectDir, config));
    results.push(generatePrTemplate(projectDir, config));

    s.stop("Update complete!");
  }

  generateLockFile(projectDir, config, results);

  console.log();
  p.log.info(pc.bold("Updated files:"));
  printResults(results);

  p.outro(pc.green("Update complete!"));
}

function updateClaudeMd(
  projectDir: string,
  config: ProjectConfig,
  lockFile: { files: Record<string, { origin?: string }> },
  force: boolean,
  userModified: string[]
): WriteResult {
  const relativePath = "CLAUDE.md";
  const record = lockFile.files[relativePath];

  // If origin is "merged", re-merge using sentinel
  if (record?.origin === "merged") {
    const fullPath = join(projectDir, relativePath);
    if (existsSync(fullPath)) {
      const currentContent = readFileSync(fullPath, "utf-8");
      const hasSentinels =
        currentContent.includes(SENTINEL_START) && currentContent.includes(SENTINEL_END);
      return generateClaudeMdMerged(projectDir, config, currentContent, hasSentinels);
    }
  }

  // Standard path: check modification and regenerate
  if (shouldUpdate(relativePath, force, userModified)) {
    return generateClaudeMd(projectDir, config);
  }
  return skipResult(projectDir, relativePath);
}

function updateSettings(
  projectDir: string,
  config: ProjectConfig,
  lockFile: { files: Record<string, { origin?: string }> },
  force: boolean,
  userModified: string[]
): WriteResult {
  const relativePath = ".claude/settings.json";
  const record = lockFile.files[relativePath];

  // If origin is "merged", re-merge with current disk content
  if (record?.origin === "merged") {
    const fullPath = join(projectDir, relativePath);
    if (existsSync(fullPath)) {
      try {
        const currentSettings = JSON.parse(readFileSync(fullPath, "utf-8"));
        return generateSettingsMerged(projectDir, config, currentSettings);
      } catch {
        // If JSON is broken, fall through to full regeneration
      }
    }
  }

  // Standard path
  if (shouldUpdate(relativePath, force, userModified)) {
    return generateSettings(projectDir, config);
  }
  return skipResult(projectDir, relativePath);
}

function shouldUpdate(relativePath: string, force: boolean, userModified: string[]): boolean {
  return force || !userModified.includes(relativePath);
}

function skipResult(projectDir: string, relativePath: string): WriteResult {
  const fullPath = join(projectDir, relativePath);
  const hash = existsSync(fullPath)
    ? computeHash(readFileSync(fullPath, "utf-8"))
    : "";
  return { path: fullPath, relativePath, hash, action: "skipped" };
}

function generateSkillsSelective(
  projectDir: string,
  config: ProjectConfig,
  force: boolean,
  userModified: string[]
): WriteResult[] {
  const results: WriteResult[] = [];
  for (const skill of config.skills) {
    const relativePath = `.claude/skills/${skill}.md`;
    if (shouldUpdate(relativePath, force, userModified)) {
      const fn = skillTemplateMap[skill];
      if (fn) {
        results.push(writeFile(projectDir, relativePath, fn(config), true));
      }
    } else {
      results.push(skipResult(projectDir, relativePath));
    }
  }
  return results;
}

function generateAgentsSelective(
  projectDir: string,
  config: ProjectConfig,
  force: boolean,
  userModified: string[]
): WriteResult[] {
  const results: WriteResult[] = [];
  for (const agent of agentTemplateMap) {
    const relativePath = `.claude/agents/${agent.name}.md`;
    if (shouldUpdate(relativePath, force, userModified)) {
      results.push(writeFile(projectDir, relativePath, agent.fn(config), true));
    } else {
      results.push(skipResult(projectDir, relativePath));
    }
  }
  return results;
}
