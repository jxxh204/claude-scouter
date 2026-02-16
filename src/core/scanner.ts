import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SkillEnum } from "./config.js";

const SENTINEL_START = "<!-- claude-scouter:start -->";
const SENTINEL_END = "<!-- claude-scouter:end -->";

const SCOUTER_SKILL_NAMES: Set<string> = new Set(SkillEnum.options);
const SCOUTER_AGENT_NAMES: Set<string> = new Set(["reviewer", "explorer"]);

export interface ExistingFiles {
  claudeMd: { exists: boolean; hasSentinels: boolean; content: string | null };
  settings: { exists: boolean; parsed: Record<string, unknown> | null };
  skills: Array<{ name: string; isScouter: boolean }>;
  agents: Array<{ name: string; isScouter: boolean }>;
  prTemplate: { exists: boolean };
  lockFile: { exists: boolean };
}

export function scanExistingFiles(projectDir: string): ExistingFiles {
  const result: ExistingFiles = {
    claudeMd: { exists: false, hasSentinels: false, content: null },
    settings: { exists: false, parsed: null },
    skills: [],
    agents: [],
    prTemplate: { exists: false },
    lockFile: { exists: false },
  };

  // Check CLAUDE.md
  const claudeMdPath = join(projectDir, "CLAUDE.md");
  if (existsSync(claudeMdPath)) {
    const content = readFileSync(claudeMdPath, "utf-8");
    result.claudeMd = {
      exists: true,
      hasSentinels: content.includes(SENTINEL_START) && content.includes(SENTINEL_END),
      content,
    };
  }

  // Check .claude/settings.json
  const settingsPath = join(projectDir, ".claude/settings.json");
  if (existsSync(settingsPath)) {
    try {
      const parsed = JSON.parse(readFileSync(settingsPath, "utf-8"));
      result.settings = { exists: true, parsed };
    } catch {
      result.settings = { exists: true, parsed: null };
    }
  }

  // Check .claude/skills/*.md
  const skillsDir = join(projectDir, ".claude/skills");
  if (existsSync(skillsDir)) {
    try {
      const files = readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
      result.skills = files.map((f) => {
        const name = f.replace(/\.md$/, "");
        return { name, isScouter: SCOUTER_SKILL_NAMES.has(name) };
      });
    } catch {
      // ignore read errors
    }
  }

  // Check .claude/agents/*.md
  const agentsDir = join(projectDir, ".claude/agents");
  if (existsSync(agentsDir)) {
    try {
      const files = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
      result.agents = files.map((f) => {
        const name = f.replace(/\.md$/, "");
        return { name, isScouter: SCOUTER_AGENT_NAMES.has(name) };
      });
    } catch {
      // ignore read errors
    }
  }

  // Check PR template
  result.prTemplate = {
    exists: existsSync(join(projectDir, ".github/pull_request_template.md")),
  };

  // Check lock file
  result.lockFile = {
    exists: existsSync(join(projectDir, ".claude-scouter.lock.json")),
  };

  return result;
}

export function hasExistingClaudeFiles(scan: ExistingFiles): boolean {
  return (
    scan.claudeMd.exists ||
    scan.settings.exists ||
    scan.skills.length > 0 ||
    scan.agents.length > 0
  );
}
