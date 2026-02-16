import type { ProjectConfig } from "../core/config.js";
import { writeFile, type WriteResult } from "../core/file-writer.js";
import { prTemplateTemplate } from "../templates/pr-template.js";

export function generatePrTemplate(projectDir: string, config: ProjectConfig): WriteResult {
  const content = prTemplateTemplate(config);
  return writeFile(projectDir, ".github/pull_request_template.md", content);
}
