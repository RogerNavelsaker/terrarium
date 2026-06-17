# Agent Instructions

This project uses **sd** (seeds) for issue tracking. Run `sd prime` to get started.

## Quick Reference

```bash
sd ready              # Find available work
sd show <id>          # View issue details
sd update <id> --status in_progress  # Claim work
sd close <id>         # Complete work
sd sync               # Sync with git
```

## Terrarium Domain

Terrarium is the **seeds graph analysis tool** for the `os-eco` stack.

- **Graph:** Visualizes issue dependency trees, cycles, and relationships.
- **Triage:** Graph algorithm ranking (PageRank, betweenness, critical path) to find optimal next tasks.

## Agent Guidelines

- **Git-native:** Code must be diffable and mergeable.
- **Strict Mode:** Adhere to the strict TypeScript conventions in `CLAUDE.md`.
