#!/usr/bin/env bun
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Command } from "commander";
import { computeMetrics } from "./graph.ts";
import type { Issue } from "./types.ts";

const program = new Command();

program
	.name("terrarium")
	.version("0.1.0")
	.description("CLI tool for seeds graph analysis, designed for agents and tools.")
	.option("-d, --dir <path>", "Directory containing .seeds", ".");

async function loadIssues(dir: string): Promise<Issue[]> {
	const seedsDir = path.resolve(dir, ".seeds");
	const issuesFile = path.join(seedsDir, "issues.jsonl");

	let content: string;
	try {
		content = await fs.readFile(issuesFile, "utf-8");
	} catch (error) {
		console.error(`Error reading ${issuesFile}: ${(error as Error).message}`);
		process.exit(1);
	}

	const issues: Issue[] = [];
	for (const line of content.split("\n")) {
		if (!line.trim()) continue;
		try {
			issues.push(JSON.parse(line));
		} catch (_e) {
			console.error("Failed to parse line:", line);
		}
	}
	return issues;
}

program
	.command("triage")
	.description("Rank ready issues using graph algorithms (PageRank, betweenness, critical path)")
	.option("--json", "Output as JSON")
	.option("--limit <n>", "Return top N issues only")
	.action(async (opts) => {
		const issues = await loadIssues(program.opts().dir);

		const closedIds = new Set(issues.filter((i) => i.status === "closed").map((i) => i.id));
		const openIssues = issues.filter((i) => i.status !== "closed");

		const metrics = computeMetrics(openIssues);

		const ready = openIssues.filter((i) => (i.blockedBy ?? []).every((bid) => closedIds.has(bid)));

		const limit = opts.limit !== undefined ? Number(opts.limit) : 0;

		const ranked = ready
			.map((issue) => {
				const m = metrics.get(issue.id);
				return {
					id: issue.id,
					title: issue.title,
					status: issue.status,
					priority: issue.priority || 0,
					pagerank: m?.pagerank ?? 0,
					betweenness: m?.betweenness ?? 0,
					criticalPathLength: m?.criticalPathLength ?? 0,
					score: m?.score ?? 0,
				};
			})
			.sort((a, b) => b.score - a.score || a.priority - b.priority);

		const output = limit > 0 ? ranked.slice(0, limit) : ranked;

		if (opts.json) {
			console.log(
				JSON.stringify(
					{ success: true, command: "triage", issues: output, count: output.length },
					null,
					2,
				),
			);
			return;
		}

		if (output.length === 0) {
			console.log("No ready issues.");
			return;
		}

		for (const entry of output) {
			const scoreStr = `${(entry.score * 100).toFixed(0)}pts`;
			const cpStr = entry.criticalPathLength > 0 ? ` · cp:${entry.criticalPathLength}` : "";
			const bStr = entry.betweenness > 0.01 ? ` · btw:${entry.betweenness.toFixed(2)}` : "";
			console.log(`\x1b[1m${entry.id}\x1b[0m (${entry.status}) - ${entry.title}`);
			console.log(`    score: \x1b[36m${scoreStr}\x1b[0m${cpStr}${bStr}`);
		}
		console.log(`\n\x1b[32m${output.length} ready issue(s)\x1b[0m (ranked by graph score)`);
	});

program
	.command("graph")
	.description("Print a pretty tree of the dependency graph")
	.option("--json", "Output nodes and edges as JSON")
	.option("--dot", "Output in Graphviz DOT format")
	.option("--open-only", "Only include open issues")
	.action(async (opts) => {
		let issues = await loadIssues(program.opts().dir);

		if (opts.openOnly) {
			issues = issues.filter((i) => i.status !== "closed");
		}

		if (opts.json) {
			const nodes = issues.map((i) => ({ id: i.id, title: i.title, status: i.status }));
			const edges: { source: string; target: string }[] = [];
			const ids = new Set(issues.map((i) => i.id));
			for (const issue of issues) {
				for (const blocked of issue.blocks ?? []) {
					if (ids.has(blocked)) edges.push({ source: issue.id, target: blocked });
				}
			}
			console.log(JSON.stringify({ success: true, command: "graph", nodes, edges }, null, 2));
			return;
		}

		if (opts.dot) {
			console.log("digraph G {");
			console.log('  node [shape=box, style=rounded, fontname="sans-serif"];');
			console.log('  edge [fontname="sans-serif"];');
			console.log("  rankdir=LR;");

			const ids = new Set(issues.map((i) => i.id));
			for (const issue of issues) {
				const color = issue.status === "closed" ? "gray" : "black";
				const title = issue.title.replace(/"/g, '\\"');
				console.log(
					`  "${issue.id}" [label="${issue.id}\\n${title}", color="${color}", fontcolor="${color}"];`,
				);
			}

			for (const issue of issues) {
				for (const blocked of issue.blocks ?? []) {
					if (ids.has(blocked)) {
						console.log(`  "${issue.id}" -> "${blocked}";`);
					}
				}
			}
			console.log("}");
			return;
		}

		const blocksMap = new Map<string, string[]>();
		const issueMap = new Map<string, Issue>();

		for (const issue of issues) {
			blocksMap.set(issue.id, issue.blocks ?? []);
			issueMap.set(issue.id, issue);
		}

		// Find roots: issues that are not blocked by any other issue in our current set
		const blockedSet = new Set<string>();
		for (const issue of issues) {
			for (const blocked of issue.blocks ?? []) {
				blockedSet.add(blocked);
			}
		}
		const roots = issues.filter((i) => !blockedSet.has(i.id));

		function printTree(issueId: string, prefix: string, isLast: boolean, visited: Set<string>) {
			const issue = issueMap.get(issueId);
			if (!issue) return;

			const connector = isLast ? "└── " : "├── ";
			const hasVisited = visited.has(issueId);

			// Color open/closed status
			const statusColor = issue.status === "closed" ? "\x1b[90m" : "\x1b[32m";
			const statusStr = `${statusColor}(${issue.status})\x1b[0m`;

			console.log(
				`${prefix}${connector}\x1b[1m${issue.id}\x1b[0m ${statusStr} - ${issue.title}${hasVisited ? " \x1b[33m(already shown)\x1b[0m" : ""}`,
			);

			if (hasVisited) return;
			visited.add(issueId);

			const children = blocksMap.get(issueId) || [];
			// Filter to ensure children exist in map (in case of open-only filter)
			const validChildren = children.filter((c) => issueMap.has(c));

			for (let i = 0; i < validChildren.length; i++) {
				const newPrefix = prefix + (isLast ? "    " : "│   ");
				printTree(validChildren[i], newPrefix, i === validChildren.length - 1, visited);
			}
		}

		if (roots.length === 0 && issues.length > 0) {
			console.log("\x1b[31mGraph has cycles and no roots. Showing arbitrary nodes.\x1b[0m");
			roots.push(issues[0]);
		}

		const visited = new Set<string>();
		for (let i = 0; i < roots.length; i++) {
			printTree(roots[i].id, "", i === roots.length - 1, visited);
			if (i < roots.length - 1) console.log(""); // spacing
		}
	});

program.parse();
