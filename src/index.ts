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

		const { metrics } = computeMetrics(openIssues);

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
	.description("Print a pretty tree of the dependency graph or specific graph insights")
	.option("--json", "Output nodes and edges as JSON")
	.option("--dot", "Output in Graphviz DOT format")
	.option("--open-only", "Only include open issues")
	.option("--critical-path", "Show the longest dependency chain")
	.option("--bottlenecks", "Show issues with highest betweenness centrality")
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

		if (opts.bottlenecks) {
			const { metrics } = computeMetrics(issues);
			const ranked = issues
				.map((i) => ({ ...i, betweenness: metrics.get(i.id)?.betweenness ?? 0 }))
				.filter((i) => i.betweenness > 0)
				.sort((a, b) => b.betweenness - a.betweenness);
			console.log("\x1b[1mTop Bottlenecks (Betweenness Centrality)\x1b[0m\n");
			for (const issue of ranked.slice(0, 10)) {
				console.log(
					`\x1b[36m${issue.betweenness.toFixed(4)}\x1b[0m - \x1b[1m${issue.id}\x1b[0m ${issue.title}`,
				);
			}
			if (ranked.length === 0) console.log("No significant bottlenecks found.");
			return;
		}

		if (opts.criticalPath) {
			const { metrics } = computeMetrics(issues);
			let startNode = issues[0]?.id;
			let maxLen = -1;
			for (const issue of issues) {
				const len = metrics.get(issue.id)?.criticalPathLength ?? 0;
				if (len > maxLen) {
					maxLen = len;
					startNode = issue.id;
				}
			}
			if (!startNode || maxLen === 0) {
				console.log("No critical path found.");
				return;
			}
			console.log(`\x1b[1mCritical Path (Length: ${maxLen})\x1b[0m\n`);
			const blocksMap = new Map<string, string[]>();
			for (const issue of issues) blocksMap.set(issue.id, issue.blocks ?? []);

			let curr: string | undefined = startNode;
			while (curr) {
				const issue = issues.find((i) => i.id === curr);
				if (!issue) break;
				console.log(`\x1b[32m↓\x1b[0m \x1b[1m${issue.id}\x1b[0m ${issue.title}`);
				const children = blocksMap.get(curr) ?? [];
				if (children.length === 0) break;

				let nextNode = children[0];
				let maxChildLen = -1;
				for (const child of children) {
					const l = metrics.get(child)?.criticalPathLength ?? 0;
					if (l > maxChildLen) {
						maxChildLen = l;
						nextNode = child;
					}
				}
				curr = nextNode;
			}
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

program
	.command("kanban")
	.description("Print a kanban-style board of issues by status")
	.option("--json", "Output as JSON")
	.action(async (opts) => {
		const issues = await loadIssues(program.opts().dir);

		const columns = new Map<string, typeof issues>();
		for (const issue of issues) {
			const status = issue.status || "open";
			if (!columns.has(status)) columns.set(status, []);
			columns.get(status)?.push(issue);
		}

		// Standard order: open, in_progress, blocked, closed
		const standardStatuses = ["open", "in_progress", "blocked", "closed"];
		const allStatuses = Array.from(columns.keys());
		const sortedStatuses = [...new Set([...standardStatuses, ...allStatuses])].filter((s) =>
			columns.has(s),
		);

		if (opts.json) {
			const jsonOutput: Record<string, typeof issues> = {};
			for (const status of sortedStatuses) {
				jsonOutput[status] = columns.get(status) ?? [];
			}
			console.log(
				JSON.stringify({ success: true, command: "kanban", columns: jsonOutput }, null, 2),
			);
			return;
		}

		for (const status of sortedStatuses) {
			const colIssues = columns.get(status) ?? [];
			const title = status.replace(/_/g, " ").toUpperCase();
			console.log(`\x1b[1m\x1b[35m${title} (${colIssues.length})\x1b[0m`);
			for (const issue of colIssues) {
				const prioStr = issue.priority ? ` \x1b[33m[P${issue.priority}]\x1b[0m` : "";
				console.log(`  \x1b[1m${issue.id}\x1b[0m${prioStr} - ${issue.title}`);
			}
			console.log("");
		}
	});

program
	.command("plan")
	.description("Generate an execution plan dividing work into parallel tracks")
	.option("--json", "Output as JSON")
	.action(async (opts) => {
		const issues = await loadIssues(program.opts().dir);
		const closedIds = new Set(issues.filter((i) => i.status === "closed").map((i) => i.id));
		const openIssues = issues.filter((i) => i.status !== "closed");

		const tracks: (typeof issues)[] = [];
		const resolved = new Set(closedIds);
		let remaining = [...openIssues];

		while (remaining.length > 0) {
			const currentTrack = remaining.filter((i) =>
				(i.blockedBy ?? []).every((bid) => resolved.has(bid)),
			);
			if (currentTrack.length === 0) {
				// Cycle detected, the rest cannot be planned
				tracks.push(remaining); // Push remaining as the final blocked track
				break;
			}
			tracks.push(currentTrack);
			for (const i of currentTrack) resolved.add(i.id);
			remaining = remaining.filter((i) => !resolved.has(i.id));
		}

		if (opts.json) {
			const jsonTracks = tracks.map((track) =>
				track.map((i) => ({
					id: i.id,
					title: i.title,
					unblocks: i.blocks ?? [],
				})),
			);
			console.log(
				JSON.stringify({ success: true, command: "plan", plan: { tracks: jsonTracks } }, null, 2),
			);
			return;
		}

		console.log("\x1b[1mExecution Plan (Topological Tracks)\x1b[0m\n");
		for (let i = 0; i < tracks.length; i++) {
			console.log(`\x1b[35mTrack ${i}\x1b[0m (Parallelizable)`);
			for (const issue of tracks[i]) {
				console.log(`  \x1b[1m${issue.id}\x1b[0m - ${issue.title}`);
			}
			console.log("");
		}
	});

program
	.command("insights")
	.description("Output comprehensive graph metrics (agent-friendly)")
	.option("--json", "Output as JSON")
	.action(async (opts) => {
		const issues = await loadIssues(program.opts().dir);
		const openIssues = issues.filter((i) => i.status !== "closed");
		const analysis = computeMetrics(openIssues);

		if (opts.json) {
			const jsonMetrics: Record<string, unknown> = {};
			for (const [id, m] of analysis.metrics) {
				jsonMetrics[id] = m;
			}
			console.log(
				JSON.stringify(
					{
						success: true,
						command: "insights",
						status: "computed",
						density: analysis.density,
						cycles: analysis.cycles,
						metrics: jsonMetrics,
					},
					null,
					2,
				),
			);
			return;
		}

		console.log(
			"Insights are best consumed via --json by agents. For human-readable insights, use:\n  tr graph --bottlenecks\n  tr graph --critical-path",
		);
	});

program.parse();
