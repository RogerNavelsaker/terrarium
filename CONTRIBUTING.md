# Contributing to Terrarium

Thanks for your interest in contributing to Terrarium! This guide covers everything you need to get started.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/terrarium.git
   cd terrarium
   ```
3. **Install** dependencies:
   ```bash
   bun install
   ```
4. **Link** the CLI for local development:
   ```bash
   bun link
   ```
5. **Create a branch** for your work:
   ```bash
   git checkout -b fix/description-of-change
   ```

## Branch Naming

Use descriptive branch names with a category prefix:

- `fix/` -- Bug fixes
- `feat/` -- New features
- `docs/` -- Documentation changes
- `refactor/` -- Code refactoring
- `test/` -- Test additions or fixes

## Build & Test Commands

```bash
bun test                                       # Run all tests
bun run lint                                   # Biome check
bun run lint:fix                               # Auto-fix lint + format issues
bun run typecheck                              # Type check (tsc --noEmit)
bun test && bun run lint && bun run typecheck  # All quality gates
```

Always run all quality gates before submitting a PR.

## TypeScript Conventions

Terrarium is a strict TypeScript project that runs directly on Bun (no build step).

### Strict Mode

- `noUncheckedIndexedAccess` is enabled -- always handle possible `undefined` from indexing
- `noExplicitAny` is an error -- use `unknown` and narrow, or define proper types
- `useConst` is enforced -- use `const` unless reassignment is needed
- `noNonNullAssertion` is a warning -- avoid `!` postfix, check for null/undefined instead

### Minimal Runtime Dependencies

The only allowed runtime dependencies are `commander` (CLI framework). Do not add new runtime npm packages — use Bun built-in APIs instead.

External tools (`seeds`, `mulch`, `git`) are invoked as subprocesses via `Bun.spawn`, never as npm imports.

### Formatting

- **Tab indentation** (enforced by Biome)
- **100 character line width** (enforced by Biome)
- Biome handles import organization automatically

## Testing Conventions

- **No mocks** unless absolutely necessary. Tests use real filesystems and real git repos.
- Create temp directories with `mkdtemp` for file I/O tests
- Clean up in `afterEach`

**Only mock when the real thing has unacceptable side effects.** When mocking is necessary, document WHY in a comment at the top of the test file.

## Commit Message Style

Use concise, descriptive commit messages:

```
fix: resolve graph cycle bug
feat: add new pagerank sorting algorithm
docs: update CLI reference with new flags
```

Prefix with `fix:`, `feat:`, or `docs:` when the category is clear. Plain descriptive messages are also fine.

## Pull Request Expectations

- **One concern per PR.** Keep changes focused -- a bug fix, a feature, a refactor. Not all three.
- **Tests required.** New features and bug fixes should include tests. See the testing conventions above.
- **Passing CI.** All PRs must pass CI checks (lint + typecheck + test) before merge.
- **Description.** Briefly explain what the PR does and why. Link to any relevant issues.

## Reporting Issues

Use [GitHub Issues](https://github.com/RogerNavelsaker/terrarium/issues) for bug reports and feature requests. For security vulnerabilities, please message the maintainers privately.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
