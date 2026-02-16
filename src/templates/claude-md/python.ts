import type { ProjectConfig } from "../../core/config.js";

export function pythonTemplate(_config: ProjectConfig): string {
  return `
## Python Specific Rules

### Code Style
- Follow PEP 8
- Use type hints for all function signatures
- Use \`dataclass\` or \`pydantic\` for structured data
- Prefer \`pathlib.Path\` over \`os.path\`

### Project Structure
- Use \`src/\` layout when applicable
- Keep \`__init__.py\` files minimal
- Separate business logic from I/O

### Dependencies
- Use virtual environments (venv / conda)
- Pin dependencies in \`requirements.txt\` or \`pyproject.toml\`
- Prefer \`pyproject.toml\` for modern projects

### Testing
- Use \`pytest\` for testing
- Use fixtures for test setup
- Mock external services, not internal functions
- Aim for high coverage on business logic

### Commands
- Lint: \`ruff check .\` or \`flake8\`
- Format: \`ruff format .\` or \`black .\`
- Typecheck: \`mypy .\` or \`pyright\`
- Test: \`pytest\`
`;
}
