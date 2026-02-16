import type { ProjectConfig } from "../core/config.js";
import { writeFile, writeFileMerged, type WriteResult } from "../core/file-writer.js";
import { mergeSettings } from "../core/merger.js";

function buildScouterSettings(_config: ProjectConfig): Record<string, unknown> {
  return {
    permissions: {
      allow: [
        "Bash(npx tsc --noEmit*)",
        "Bash(npx eslint*)",
        "Bash(npm test*)",
        "Bash(npx jest*)",
        "Bash(npx vitest*)",
        "Bash(bun test*)",
        "Bash(npm run lint*)",
        "Bash(npm run typecheck*)",
        "Bash(npm run build*)",
        "Bash(git status*)",
        "Bash(git diff*)",
        "Bash(git log*)",
        "Bash(git branch*)",
      ],
      deny: [
        "Bash(rm -rf /)*",
        "Bash(git push --force*)",
        "Bash(git reset --hard*)",
      ],
    },
    hooks: {
      PostToolUse: [
        {
          matcher: "Edit|Write",
          hooks: [
            {
              type: "command" as const,
              command: "echo '⚡ File modified — remember to verify (typecheck + lint + test)'",
            },
          ],
        },
      ],
    },
  };
}

/**
 * Generate settings.json from scratch.
 */
export function generateSettings(projectDir: string, config: ProjectConfig): WriteResult {
  const settings = buildScouterSettings(config);
  const content = JSON.stringify(settings, null, 2) + "\n";
  return writeFile(projectDir, ".claude/settings.json", content);
}

/**
 * Merge scouter settings into existing settings.json.
 */
export function generateSettingsMerged(
  projectDir: string,
  config: ProjectConfig,
  existingSettings: Record<string, unknown>
): WriteResult {
  const scouterSettings = buildScouterSettings(config);
  const merged = mergeSettings(existingSettings, scouterSettings);
  const content = JSON.stringify(merged, null, 2) + "\n";
  return writeFileMerged(projectDir, ".claude/settings.json", content);
}
