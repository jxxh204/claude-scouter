import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";
import pc from "picocolors";
import type { FileOrigin, LockFile } from "./config.js";

export function computeHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export interface WriteResult {
  path: string;
  relativePath: string;
  hash: string;
  action: "created" | "updated" | "skipped" | "merged";
  origin?: FileOrigin;
}

export function writeFile(
  projectDir: string,
  relativePath: string,
  content: string,
  force = false
): WriteResult {
  const fullPath = join(projectDir, relativePath);
  const hash = computeHash(content);
  const dir = dirname(fullPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (existsSync(fullPath) && !force) {
    return { path: fullPath, relativePath, hash, action: "skipped" };
  }

  writeFileSync(fullPath, content, "utf-8");
  const action = existsSync(fullPath) ? "updated" : "created";
  return { path: fullPath, relativePath, hash, action: "created" };
}

export function writeFileForUpdate(
  projectDir: string,
  relativePath: string,
  content: string,
  lockFile: LockFile | null
): WriteResult {
  const fullPath = join(projectDir, relativePath);
  const newHash = computeHash(content);

  if (existsSync(fullPath) && lockFile) {
    const fileRecord = lockFile.files[relativePath];
    if (fileRecord) {
      const currentContent = readFileSync(fullPath, "utf-8");
      const currentHash = computeHash(currentContent);

      if (currentHash !== fileRecord.hash) {
        // User has modified this file
        return { path: fullPath, relativePath, hash: currentHash, action: "skipped" };
      }
    }
  }

  const dir = dirname(fullPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(fullPath, content, "utf-8");
  return { path: fullPath, relativePath, hash: newHash, action: existsSync(fullPath) ? "updated" : "created" };
}

export function writeFileMerged(
  projectDir: string,
  relativePath: string,
  content: string
): WriteResult {
  const fullPath = join(projectDir, relativePath);
  const hash = computeHash(content);
  const dir = dirname(fullPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(fullPath, content, "utf-8");
  return { path: fullPath, relativePath, hash, action: "merged", origin: "merged" };
}

export function readLockFile(projectDir: string): LockFile | null {
  const lockPath = join(projectDir, ".claude-scouter.lock.json");
  if (!existsSync(lockPath)) return null;
  try {
    return JSON.parse(readFileSync(lockPath, "utf-8"));
  } catch {
    return null;
  }
}

export function writeLockFile(projectDir: string, lockFile: LockFile): void {
  const lockPath = join(projectDir, ".claude-scouter.lock.json");
  writeFileSync(lockPath, JSON.stringify(lockFile, null, 2), "utf-8");
}

export function printResults(results: WriteResult[]): void {
  for (const r of results) {
    const icon =
      r.action === "created"
        ? pc.green("✓")
        : r.action === "updated"
          ? pc.yellow("↻")
          : r.action === "merged"
            ? pc.cyan("⊕")
            : pc.dim("–");
    const label =
      r.action === "created"
        ? pc.green("created")
        : r.action === "updated"
          ? pc.yellow("updated")
          : r.action === "merged"
            ? pc.cyan("merged")
            : pc.dim("skipped");
    console.log(`  ${icon} ${r.relativePath} ${pc.dim(`(${label})`)}`);
  }
}
