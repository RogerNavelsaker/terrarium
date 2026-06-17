import type { Issue } from "./types.ts";

export interface GraphMetrics {
	pagerank: number;
	betweenness: number;
	criticalPathLength: number;
	hitsAuthority: number;
	hitsHub: number;
	eigenvector: number;
	inDegree: number;
	outDegree: number;
	score: number;
}

export type IssueMetrics = Map<string, GraphMetrics>;

export interface GraphAnalysis {
	metrics: IssueMetrics;
	density: number;
	cycles: string[][];
}

function buildAdjacency(issues: Issue[]): {
	blocksMap: Map<string, string[]>;
	blockedByMap: Map<string, string[]>;
	ids: string[];
} {
	const ids = issues.map((i) => i.id);
	const idSet = new Set(ids);
	const blocksMap = new Map<string, string[]>();
	const blockedByMap = new Map<string, string[]>();

	for (const id of ids) {
		blocksMap.set(id, []);
		blockedByMap.set(id, []);
	}

	for (const issue of issues) {
		for (const blocked of issue.blocks ?? []) {
			if (!idSet.has(blocked)) continue;
			blocksMap.get(issue.id)?.push(blocked);
			blockedByMap.get(blocked)?.push(issue.id);
		}
	}

	return { blocksMap, blockedByMap, ids };
}

function computePageRank(
	ids: string[],
	blocksMap: Map<string, string[]>,
	blockedByMap: Map<string, string[]>,
	iterations = 50,
	damping = 0.85,
): Map<string, number> {
	const n = ids.length;
	if (n === 0) return new Map();

	const rank = new Map<string, number>();
	const initial = 1 / n;
	for (const id of ids) rank.set(id, initial);

	for (let iter = 0; iter < iterations; iter++) {
		const next = new Map<string, number>();
		for (const id of ids) {
			let incoming = 0;
			for (const dep of blocksMap.get(id) ?? []) {
				const depReversedOut = blockedByMap.get(dep)?.length ?? 0;
				if (depReversedOut > 0) {
					incoming += (rank.get(dep) ?? 0) / depReversedOut;
				}
			}
			next.set(id, (1 - damping) / n + damping * incoming);
		}
		for (const [id, r] of next) rank.set(id, r);
	}

	return rank;
}

function computeBetweenness(ids: string[], blocksMap: Map<string, string[]>): Map<string, number> {
	const betweenness = new Map<string, number>();
	for (const id of ids) betweenness.set(id, 0);

	for (const source of ids) {
		const stack: string[] = [];
		const predecessors = new Map<string, string[]>();
		const sigma = new Map<string, number>();
		const dist = new Map<string, number>();

		for (const id of ids) {
			predecessors.set(id, []);
			sigma.set(id, 0);
			dist.set(id, -1);
		}

		sigma.set(source, 1);
		dist.set(source, 0);

		const queue: string[] = [source];
		while (queue.length > 0) {
			const v = queue.shift();
			if (v === undefined) break;
			stack.push(v);
			for (const w of blocksMap.get(v) ?? []) {
				if (dist.get(w) === -1) {
					queue.push(w);
					dist.set(w, (dist.get(v) ?? 0) + 1);
				}
				if (dist.get(w) === (dist.get(v) ?? 0) + 1) {
					sigma.set(w, (sigma.get(w) ?? 0) + (sigma.get(v) ?? 0));
					predecessors.get(w)?.push(v);
				}
			}
		}

		const delta = new Map<string, number>();
		for (const id of ids) delta.set(id, 0);

		while (stack.length > 0) {
			const w = stack.pop();
			if (w === undefined) break;
			for (const v of predecessors.get(w) ?? []) {
				const contribution =
					((sigma.get(v) ?? 0) / (sigma.get(w) ?? 1)) * (1 + (delta.get(w) ?? 0));
				delta.set(v, (delta.get(v) ?? 0) + contribution);
			}
			if (w !== source) {
				betweenness.set(w, (betweenness.get(w) ?? 0) + (delta.get(w) ?? 0));
			}
		}
	}

	const n = ids.length;
	const norm = n > 2 ? (n - 1) * (n - 2) : 1;
	for (const [id, b] of betweenness) {
		betweenness.set(id, b / norm);
	}

	return betweenness;
}

function computeCriticalPath(ids: string[], blocksMap: Map<string, string[]>): Map<string, number> {
	const memo = new Map<string, number>();

	const dfs = (id: string): number => {
		const cached = memo.get(id);
		if (cached !== undefined) return cached;
		const successors = blocksMap.get(id) ?? [];
		if (successors.length === 0) {
			memo.set(id, 0);
			return 0;
		}
		const max = Math.max(...successors.map(dfs));
		memo.set(id, max + 1);
		return max + 1;
	};

	for (const id of ids) dfs(id);
	return memo;
}

function computeHITS(
	ids: string[],
	blocksMap: Map<string, string[]>,
	blockedByMap: Map<string, string[]>,
	iterations = 50,
) {
	const hubs = new Map<string, number>();
	const auths = new Map<string, number>();
	for (const id of ids) {
		hubs.set(id, 1);
		auths.set(id, 1);
	}

	for (let i = 0; i < iterations; i++) {
		let normAuth = 0;
		for (const id of ids) {
			let auth = 0;
			for (const dependent of blocksMap.get(id) ?? []) {
				auth += hubs.get(dependent) ?? 0;
			}
			auths.set(id, auth);
			normAuth += auth * auth;
		}
		normAuth = Math.sqrt(normAuth) || 1;
		for (const id of ids) auths.set(id, (auths.get(id) ?? 0) / normAuth);

		let normHub = 0;
		for (const id of ids) {
			let hub = 0;
			for (const dependency of blockedByMap.get(id) ?? []) {
				hub += auths.get(dependency) ?? 0;
			}
			hubs.set(id, hub);
			normHub += hub * hub;
		}
		normHub = Math.sqrt(normHub) || 1;
		for (const id of ids) hubs.set(id, (hubs.get(id) ?? 0) / normHub);
	}
	return { hubs, auths };
}

function computeEigenvector(ids: string[], blocksMap: Map<string, string[]>, iterations = 50) {
	const ev = new Map<string, number>();
	for (const id of ids) ev.set(id, 1);

	for (let i = 0; i < iterations; i++) {
		const next = new Map<string, number>();
		let norm = 0;
		for (const id of ids) {
			let sum = 0;
			for (const dependent of blocksMap.get(id) ?? []) {
				sum += ev.get(dependent) ?? 0;
			}
			next.set(id, sum);
			norm += sum * sum;
		}
		norm = Math.sqrt(norm) || 1;
		for (const id of ids) ev.set(id, (next.get(id) ?? 0) / norm);
	}
	return ev;
}

function findCycles(ids: string[], blocksMap: Map<string, string[]>): string[][] {
	const cycles: string[][] = [];
	const visited = new Set<string>();
	const stack = new Set<string>();
	const path: string[] = [];

	const dfs = (node: string) => {
		if (stack.has(node)) {
			const idx = path.indexOf(node);
			cycles.push(path.slice(idx));
			return;
		}
		if (visited.has(node)) return;

		visited.add(node);
		stack.add(node);
		path.push(node);

		for (const neighbor of blocksMap.get(node) ?? []) {
			dfs(neighbor);
		}

		path.pop();
		stack.delete(node);
	};

	for (const id of ids) {
		if (!visited.has(id)) {
			dfs(id);
		}
	}

	const unique = new Set<string>();
	const result: string[][] = [];
	for (const c of cycles) {
		const sorted = [...c].sort().join(",");
		if (!unique.has(sorted)) {
			unique.add(sorted);
			result.push(c);
		}
	}

	return result;
}

export function computeMetrics(issues: Issue[]): GraphAnalysis {
	if (issues.length === 0) return { metrics: new Map(), density: 0, cycles: [] };

	const { blocksMap, blockedByMap, ids } = buildAdjacency(issues);

	const pagerank = computePageRank(ids, blocksMap, blockedByMap);
	const betweenness = computeBetweenness(ids, blocksMap);
	const criticalPath = computeCriticalPath(ids, blocksMap);
	const { hubs, auths } = computeHITS(ids, blocksMap, blockedByMap);
	const eigenvector = computeEigenvector(ids, blocksMap);
	const cycles = findCycles(ids, blocksMap);

	let edgeCount = 0;
	for (const deps of blocksMap.values()) edgeCount += deps.length;
	const density = ids.length > 1 ? edgeCount / (ids.length * (ids.length - 1)) : 0;

	const maxCp = Array.from(criticalPath.values()).reduce((a, b) => Math.max(a, b), 0) || 1;

	const prValues = Array.from(pagerank.values());
	const maxPr = prValues.reduce((a, b) => Math.max(a, b), 0) || 1;
	const minPr = Math.min(...prValues);
	const prRange = maxPr - minPr || 1;

	const bValues = Array.from(betweenness.values());
	const maxB = bValues.reduce((a, b) => Math.max(a, b), 0) || 1;

	const metrics: IssueMetrics = new Map();
	for (const id of ids) {
		const pr = ((pagerank.get(id) ?? 0) - minPr) / prRange;
		const b = (betweenness.get(id) ?? 0) / maxB;
		const cp = (criticalPath.get(id) ?? 0) / maxCp;
		const score = 0.5 * pr + 0.3 * b + 0.2 * cp;

		metrics.set(id, {
			pagerank: pagerank.get(id) ?? 0,
			betweenness: betweenness.get(id) ?? 0,
			criticalPathLength: criticalPath.get(id) ?? 0,
			hitsAuthority: auths.get(id) ?? 0,
			hitsHub: hubs.get(id) ?? 0,
			eigenvector: eigenvector.get(id) ?? 0,
			inDegree: blocksMap.get(id)?.length ?? 0,
			outDegree: blockedByMap.get(id)?.length ?? 0,
			score,
		});
	}

	return { metrics, density, cycles };
}
