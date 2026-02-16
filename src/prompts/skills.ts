import * as p from "@clack/prompts";
import type { Skill } from "../core/config.js";

export async function promptSkills(): Promise<Skill[]> {
  const result = await p.multiselect({
    message: "Select skills to install:",
    options: [
      {
        value: "ultrawork",
        label: "/ultrawork",
        hint: "Rigorous problem-solving with deep analysis",
      },
      {
        value: "verify",
        label: "/verify",
        hint: "Multi-step verification protocol",
      },
      {
        value: "explore-first",
        label: "/explore-first",
        hint: "Explore codebase before making changes",
      },
      {
        value: "deep-debug",
        label: "/deep-debug",
        hint: "Systematic debugging methodology",
      },
      {
        value: "code-review",
        label: "/code-review",
        hint: "Independent code review checklist",
      },
      {
        value: "pr-create",
        label: "/pr-create",
        hint: "Automated PR creation with conventions",
      },
      {
        value: "commit",
        label: "/commit",
        hint: "Commit with enforced conventions",
      },
    ],
    initialValues: [
      "ultrawork",
      "verify",
      "explore-first",
      "deep-debug",
      "code-review",
      "pr-create",
      "commit",
    ] as Skill[],
    required: true,
  });

  if (p.isCancel(result)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  return result as Skill[];
}
