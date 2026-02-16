import type { ProjectConfig } from "../core/config.js";
import { writeFile, type WriteResult } from "../core/file-writer.js";
import { reviewerAgentTemplate } from "../templates/agents/reviewer.js";
import { explorerAgentTemplate } from "../templates/agents/explorer.js";

export function generateAgents(projectDir: string, config: ProjectConfig): WriteResult[] {
  const results: WriteResult[] = [];

  results.push(
    writeFile(projectDir, ".claude/agents/reviewer.md", reviewerAgentTemplate(config))
  );
  results.push(
    writeFile(projectDir, ".claude/agents/explorer.md", explorerAgentTemplate(config))
  );

  return results;
}
