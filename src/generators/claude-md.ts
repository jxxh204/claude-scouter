import type { ProjectConfig } from "../core/config.js";
import { writeFile, writeFileMerged, type WriteResult } from "../core/file-writer.js";
import { wrapWithSentinels, mergeClaudeMd } from "../core/merger.js";
import { baseTemplate } from "../templates/claude-md/base.js";
import { nextjsTemplate } from "../templates/claude-md/nextjs.js";
import { reactTemplate } from "../templates/claude-md/react.js";
import { pythonTemplate } from "../templates/claude-md/python.js";
import { nodeTemplate } from "../templates/claude-md/node.js";

const frameworkTemplates: Record<string, (config: ProjectConfig) => string> = {
  nextjs: nextjsTemplate,
  react: reactTemplate,
  python: pythonTemplate,
  node: nodeTemplate,
};

function buildScouterContent(config: ProjectConfig): string {
  let content = baseTemplate(config);

  const frameworkFn = frameworkTemplates[config.framework];
  if (frameworkFn) {
    content += frameworkFn(config);
  }

  return content;
}

/**
 * Generate CLAUDE.md from scratch (wrapped with sentinels).
 */
export function generateClaudeMd(projectDir: string, config: ProjectConfig): WriteResult {
  const scouterContent = buildScouterContent(config);
  const content = wrapWithSentinels(scouterContent);

  return writeFile(projectDir, "CLAUDE.md", content);
}

/**
 * Merge scouter content into existing CLAUDE.md.
 */
export function generateClaudeMdMerged(
  projectDir: string,
  config: ProjectConfig,
  existingContent: string,
  hasSentinels: boolean
): WriteResult {
  const scouterContent = buildScouterContent(config);
  const merged = mergeClaudeMd(existingContent, scouterContent, hasSentinels);

  return writeFileMerged(projectDir, "CLAUDE.md", merged);
}
