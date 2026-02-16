# claude-scouter

Opinionated Claude Code project bootstrapper — generates CLAUDE.md, skills, hooks, agents, and PR/commit conventions for your project.

## Quick Start

```bash
npx claude-scouter init
```

This runs an interactive setup that:
1. Detects your framework (Next.js, React, Python, Go, etc.)
2. Asks for your PR/commit/branch conventions
3. Lets you choose which skills to install
4. Generates all configuration files

## What Gets Generated

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project rules and conventions for Claude Code |
| `.claude/settings.json` | Permissions and hooks |
| `.claude/skills/ultrawork.md` | Deep analysis problem-solving |
| `.claude/skills/verify.md` | Multi-step verification protocol |
| `.claude/skills/explore-first.md` | Codebase exploration before coding |
| `.claude/skills/deep-debug.md` | Systematic debugging methodology |
| `.claude/skills/code-review.md` | Independent code review checklist |
| `.claude/skills/pr-create.md` | Automated PR creation |
| `.claude/skills/commit.md` | Conventional commit enforcement |
| `.claude/agents/reviewer.md` | Code review agent |
| `.claude/agents/explorer.md` | Codebase exploration agent |
| `.github/pull_request_template.md` | PR template |
| `.claude-scouter.lock.json` | Version/hash tracking |

## Commands

### `init`
Interactive setup. Use `--yes` / `-y` to accept all defaults.

```bash
npx claude-scouter init
npx claude-scouter init -y
```

### `doctor`
Health check for your Claude Code configuration.

```bash
npx claude-scouter doctor
```

### `update`
Update generated files while preserving your manual modifications.

```bash
npx claude-scouter update
```

## Using Skills in Claude Code

After setup, use skills in Claude Code like:

- `/ultrawork` — Rigorous problem-solving with deep analysis
- `/verify` — Run verification protocol (typecheck + lint + test)
- `/explore-first` — Explore codebase before making changes
- `/deep-debug` — Systematic debugging for complex bugs
- `/code-review` — Independent code review checklist
- `/pr-create` — Create PR following your conventions
- `/commit` — Commit with enforced conventions

## Development

```bash
npm install
npm run dev -- init        # Run init command
npm run dev -- doctor      # Run doctor command
npm run typecheck          # Type check
npm run build              # Build for publishing
```

## Publishing

```bash
npm login
npm publish
```

## License

MIT
