import * as p from "@clack/prompts";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import pc from "picocolors";
import { readLockFile } from "../core/file-writer.js";

interface CheckResult {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export async function doctorCommand() {
  const projectDir = resolve(process.cwd());

  p.intro(pc.bgCyan(pc.black(" claude-scouter doctor ")));

  const results: CheckResult[] = [];

  // 1. CLAUDE.md exists
  const claudeMdPath = join(projectDir, "CLAUDE.md");
  results.push({
    name: "CLAUDE.md",
    status: existsSync(claudeMdPath) ? "pass" : "fail",
    message: existsSync(claudeMdPath)
      ? "CLAUDE.md exists"
      : "CLAUDE.md not found — run `claude-scouter init`",
  });

  // 2. .claude/settings.json exists and is valid JSON
  const settingsPath = join(projectDir, ".claude/settings.json");
  if (existsSync(settingsPath)) {
    try {
      JSON.parse(readFileSync(settingsPath, "utf-8"));
      results.push({ name: "Settings", status: "pass", message: ".claude/settings.json is valid" });
    } catch {
      results.push({ name: "Settings", status: "fail", message: ".claude/settings.json is invalid JSON" });
    }
  } else {
    results.push({ name: "Settings", status: "fail", message: ".claude/settings.json not found" });
  }

  // 3. Lock file exists
  const lockFile = readLockFile(projectDir);
  if (lockFile) {
    results.push({ name: "Lock file", status: "pass", message: ".claude-scouter.lock.json exists" });

    // 4. Check skill files from lock
    const skills = lockFile.config.skills || [];
    for (const skill of skills) {
      const skillPath = join(projectDir, `.claude/skills/${skill}.md`);
      results.push({
        name: `Skill: ${skill}`,
        status: existsSync(skillPath) ? "pass" : "warn",
        message: existsSync(skillPath)
          ? `${skill}.md exists`
          : `${skill}.md missing — run \`claude-scouter update\``,
      });
    }
  } else {
    results.push({
      name: "Lock file",
      status: "fail",
      message: ".claude-scouter.lock.json not found — run `claude-scouter init`",
    });
  }

  // 5. Agent files
  for (const agent of ["reviewer", "explorer"]) {
    const agentPath = join(projectDir, `.claude/agents/${agent}.md`);
    results.push({
      name: `Agent: ${agent}`,
      status: existsSync(agentPath) ? "pass" : "warn",
      message: existsSync(agentPath) ? `${agent}.md exists` : `${agent}.md missing`,
    });
  }

  // 6. Git repository
  const gitDir = join(projectDir, ".git");
  results.push({
    name: "Git",
    status: existsSync(gitDir) ? "pass" : "warn",
    message: existsSync(gitDir) ? "Git repository detected" : "Not a git repository",
  });

  // 7. PR template
  const prTemplatePath = join(projectDir, ".github/pull_request_template.md");
  results.push({
    name: "PR template",
    status: existsSync(prTemplatePath) ? "pass" : "warn",
    message: existsSync(prTemplatePath) ? "PR template exists" : "PR template missing",
  });

  // 8. package.json scripts
  const pkgPath = join(projectDir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const scripts = pkg.scripts || {};
      for (const script of ["typecheck", "lint", "test"]) {
        results.push({
          name: `Script: ${script}`,
          status: scripts[script] ? "pass" : "warn",
          message: scripts[script]
            ? `"${script}" script found`
            : `No "${script}" script in package.json`,
        });
      }
    } catch {
      results.push({ name: "package.json", status: "warn", message: "Could not parse package.json" });
    }
  }

  // Print results
  console.log();
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  for (const r of results) {
    const icon =
      r.status === "pass"
        ? pc.green("✓")
        : r.status === "warn"
          ? pc.yellow("⚠")
          : pc.red("✗");
    const color =
      r.status === "pass"
        ? pc.green
        : r.status === "warn"
          ? pc.yellow
          : pc.red;
    console.log(`  ${icon} ${pc.bold(r.name)}: ${color(r.message)}`);

    if (r.status === "pass") passCount++;
    else if (r.status === "warn") warnCount++;
    else failCount++;
  }

  console.log();
  const summary = `${pc.green(`${passCount} passed`)}, ${pc.yellow(`${warnCount} warnings`)}, ${pc.red(`${failCount} failed`)}`;

  if (failCount > 0) {
    p.outro(pc.red(`Health check: ${summary}`));
    process.exit(1);
  } else if (warnCount > 0) {
    p.outro(pc.yellow(`Health check: ${summary}`));
  } else {
    p.outro(pc.green(`Health check: ${summary} — All good!`));
  }
}
