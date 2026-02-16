import type { ProjectConfig, Skill } from "../core/config.js";
import { writeFile, type WriteResult } from "../core/file-writer.js";
import { ultraworkTemplate } from "../templates/skills/ultrawork.js";
import { verifyTemplate } from "../templates/skills/verify.js";
import { exploreFirstTemplate } from "../templates/skills/explore-first.js";
import { deepDebugTemplate } from "../templates/skills/deep-debug.js";
import { codeReviewTemplate } from "../templates/skills/code-review.js";
import { prCreateTemplate } from "../templates/skills/pr-create.js";
import { commitTemplate } from "../templates/skills/commit.js";

const skillTemplates: Record<Skill, (config: ProjectConfig) => string> = {
  ultrawork: ultraworkTemplate,
  verify: verifyTemplate,
  "explore-first": exploreFirstTemplate,
  "deep-debug": deepDebugTemplate,
  "code-review": codeReviewTemplate,
  "pr-create": prCreateTemplate,
  commit: commitTemplate,
};

export function generateSkills(projectDir: string, config: ProjectConfig): WriteResult[] {
  const results: WriteResult[] = [];

  for (const skill of config.skills) {
    const templateFn = skillTemplates[skill];
    if (templateFn) {
      const content = templateFn(config);
      const result = writeFile(projectDir, `.claude/skills/${skill}.md`, content);
      results.push(result);
    }
  }

  return results;
}
