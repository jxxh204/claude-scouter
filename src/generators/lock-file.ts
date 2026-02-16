import type { ProjectConfig, LockFile } from "../core/config.js";
import { writeLockFile, type WriteResult } from "../core/file-writer.js";

export function generateLockFile(
  projectDir: string,
  config: ProjectConfig,
  fileResults: WriteResult[]
): void {
  const now = new Date().toISOString();
  const files: LockFile["files"] = {};

  for (const r of fileResults) {
    if (r.action !== "skipped") {
      files[r.relativePath] = {
        hash: r.hash,
        generatedAt: now,
        origin: r.origin ?? (r.action === "merged" ? "merged" : "generated"),
      };
    }
  }

  const lockFile: LockFile = {
    version: "0.1.0",
    createdAt: now,
    updatedAt: now,
    config,
    files,
  };

  writeLockFile(projectDir, lockFile);
}
