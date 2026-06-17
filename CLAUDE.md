# Terrarium CLAUDE.md

Graph analysis and dependency tree tool for the `os-eco` stack (connects with `.seeds`).

## Quick Reference

```bash
terrarium triage              # Rank ready issues using graph algorithms
terrarium graph               # Print a pretty tree of the dependency graph
terrarium triage --limit 5    # Top 5 tasks
terrarium graph --open-only   # Tree with only open tasks
```

## Tech Stack

- **Runtime:** Bun (runs TypeScript directly, no build step)
- **Language:** TypeScript with strict mode (`noUncheckedIndexedAccess`, no `any`)
- **Linting:** Biome (formatter + linter in one tool)
- **Runtime dependencies:** `commander` (CLI framework)
- **Core I/O:** Bun built-in APIs, `node:fs/promises`

## Directory Structure

```text
terrarium/
  package.json
  tsconfig.json
  biome.json
  CLAUDE.md
  CHANGELOG.md
  README.md
  AGENTS.md
  CONTRIBUTING.md
  scripts/
    version-bump.ts            # Bump version in package.json + src/index.ts
  src/
    index.ts                   # CLI entry + commander config
    types.ts                   # Interfaces (Issue, GraphMetrics)
    graph.ts                   # PageRank, betweenness, critical path algorithms
```

## Conventions

- **Git-native:** Designed for CLI execution in Git workspaces.
- **Zero Daemon:** No background processes or servers. Pure CLI tool.
- **Strict TypeScript:** `noUncheckedIndexedAccess` enabled, no `any`, use `unknown`.
- **Minimal Dependencies:** Prefer Bun built-in APIs over npm packages.
- **Standardized Output:** Support for `--json` on all analytical output.

## Quality Gates

Before finishing a task:
```bash
bun test                           # Run all tests
bun run lint                       # Biome check
bun run typecheck                  # Type check (tsc --noEmit)
```

## Session Completion Protocol

When ending a work session:

1. **File Issues:** Create `sd` issues for remaining or blocked work.
2. **Quality Gates:** Run all quality gates (test + lint + typecheck).
3. **Commit & Push:** Ensure all changes are committed and pushed to remote.
   ```bash
   git pull --rebase
   sd sync
   git push
   ```
4. **Hand Off:** Provide a concise summary of current state and next steps.

<!-- mulch:start -->
<!-- mulch:end -->
