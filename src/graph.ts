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
	slack: number;
	coreNumber: number;
	isArticulationPoint: boolean;
	score: number;
}

export type IssueMetrics = Map<string, GraphMetrics>;

export interface GraphAnalysis {
	metrics: IssueMetrics;
	density: number;
	cycles: string[][];
}

function buildAdjacency(issues: Issue[]) {
	const ids = issues.map((i) => i.id);
	const n = ids.length;
	const idToIndex = new Map<string, number>();
	for (let i = 0; i < n; i++) idToIndex.set(ids[i]!, i);

	const blocks = Array.from({ length: n }, () => [] as number[]);
	const blockedBy = Array.from({ length: n }, () => [] as number[]);

	for (let i = 0; i < n; i++) {
		const issue = issues[i]!;
		for (const blocked of issue.blocks ?? []) {
			const targetIdx = idToIndex.get(blocked);
			if (targetIdx !== undefined) {
				blocks[i]!.push(targetIdx);
				blockedBy[targetIdx]!.push(i);
			}
		}
	}
	return { blocks, blockedBy, ids, idToIndex };
}

function computePageRank(n: number, blocks: number[][], blockedBy: number[][], iterations = 50, damping = 0.85): Float64Array {
	if (n === 0) return new Float64Array(0);
	
	let rank = new Float64Array(n);
	let next = new Float64Array(n);
	const initial = 1 / n;
	rank.fill(initial);

	for (let iter = 0; iter < iterations; iter++) {
		for (let i = 0; i < n; i++) {
			let incoming = 0;
			const deps = blocks[i]!;
			for (let j = 0; j < deps.length; j++) {
				const dep = deps[j]!;
				const depReversedOut = blockedBy[dep]!.length;
				if (depReversedOut > 0) {
					incoming += rank[dep]! / depReversedOut;
				}
			}
			next[i] = (1 - damping) / n + damping * incoming;
		}
		const temp = rank;
		rank = next;
		next = temp;
	}
	return rank;
}

function computeBetweenness(n: number, blocks: number[][]): Float64Array {
	const betweenness = new Float64Array(n);
	const sigma = new Float64Array(n);
	const dist = new Int32Array(n);
	const delta = new Float64Array(n);
	
	const queue = new Int32Array(n);
	const stack = new Int32Array(n);
	const predecessors: number[][] = Array.from({ length: n }, () => []);

	for (let source = 0; source < n; source++) {
		sigma.fill(0);
		dist.fill(-1);
		for (let i = 0; i < n; i++) predecessors[i]!.length = 0;

		sigma[source] = 1;
		dist[source] = 0;

		let qHead = 0, qTail = 0;
		let sTop = 0;

		queue[qTail++] = source;

		while (qHead < qTail) {
			const v = queue[qHead++]!;
			stack[sTop++] = v;
			
			const neighbors = blocks[v]!;
			for (let i = 0; i < neighbors.length; i++) {
				const w = neighbors[i]!;
				if (dist[w] === -1) {
					queue[qTail++] = w;
					dist[w] = dist[v]! + 1;
				}
				if (dist[w] === dist[v]! + 1) {
					sigma[w]! += sigma[v]!;
					predecessors[w]!.push(v);
				}
			}
		}

		delta.fill(0);

		while (sTop > 0) {
			const w = stack[--sTop]!;
			const preds = predecessors[w]!;
			for (let i = 0; i < preds.length; i++) {
				const v = preds[i]!;
				delta[v]! += (sigma[v]! / (sigma[w] || 1)) * (1 + delta[w]!);
			}
			if (w !== source) {
				betweenness[w]! += delta[w]!;
			}
		}
	}

	const norm = n > 2 ? (n - 1) * (n - 2) : 1;
	for (let i = 0; i < n; i++) {
		betweenness[i]! /= norm;
	}

	return betweenness;
}

function computeCriticalPath(n: number, blocks: number[][]): Int32Array {
	const memo = new Int32Array(n).fill(-1);
	const visiting = new Uint8Array(n);

	const dfs = (i: number): number => {
		if (memo[i] !== -1) return memo[i]!;
		if (visiting[i]) return 0;

		visiting[i] = 1;
		let max = 0;
		const successors = blocks[i]!;
		for (let j = 0; j < successors.length; j++) {
			const d = dfs(successors[j]!);
			if (d > max) max = d;
		}
		visiting[i] = 0;

		const res = successors.length > 0 ? max + 1 : 0;
		memo[i] = res;
		return res;
	};

	for (let i = 0; i < n; i++) dfs(i);
	return memo;
}

function computeHITS(n: number, blocks: number[][], blockedBy: number[][], iterations = 50) {
	const hubs = new Float64Array(n).fill(1);
	const auths = new Float64Array(n).fill(1);
	const nextAuths = new Float64Array(n);
	const nextHubs = new Float64Array(n);

	for (let i = 0; i < iterations; i++) {
		let normAuth = 0;
		for (let j = 0; j < n; j++) {
			let auth = 0;
			const deps = blocks[j]!;
			for (let k = 0; k < deps.length; k++) auth += hubs[deps[k]!]!;
			nextAuths[j] = auth;
			normAuth += auth * auth;
		}
		normAuth = Math.sqrt(normAuth) || 1;
		for (let j = 0; j < n; j++) auths[j] = nextAuths[j]! / normAuth;

		let normHub = 0;
		for (let j = 0; j < n; j++) {
			let hub = 0;
			const preds = blockedBy[j]!;
			for (let k = 0; k < preds.length; k++) hub += auths[preds[k]!]!;
			nextHubs[j] = hub;
			normHub += hub * hub;
		}
		normHub = Math.sqrt(normHub) || 1;
		for (let j = 0; j < n; j++) hubs[j] = nextHubs[j]! / normHub;
	}
	return { hubs, auths };
}

function computeEigenvector(n: number, blocks: number[][], iterations = 50) {
	const ev = new Float64Array(n).fill(1);
	const next = new Float64Array(n);

	for (let i = 0; i < iterations; i++) {
		let norm = 0;
		for (let j = 0; j < n; j++) {
			let sum = 0;
			const deps = blocks[j]!;
			for (let k = 0; k < deps.length; k++) sum += ev[deps[k]!]!;
			next[j] = sum;
			norm += sum * sum;
		}
		norm = Math.sqrt(norm) || 1;
		for (let j = 0; j < n; j++) ev[j] = next[j]! / norm;
	}
	return ev;
}

function findCycles(n: number, blocks: number[][], ids: string[]): string[][] {
	const cycles: string[][] = [];
	const visited = new Uint8Array(n);
	const inStack = new Uint8Array(n);
	const path: number[] = [];

	const dfs = (node: number) => {
		if (inStack[node]) {
			const idx = path.indexOf(node);
			cycles.push(path.slice(idx).map(i => ids[i]!));
			return;
		}
		if (visited[node]) return;

		visited[node] = 1;
		inStack[node] = 1;
		path.push(node);

		const successors = blocks[node]!;
		for (let i = 0; i < successors.length; i++) {
			dfs(successors[i]!);
		}

		path.pop();
		inStack[node] = 0;
	};

	for (let i = 0; i < n; i++) {
		if (!visited[i]) dfs(i);
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

function computeSlack(n: number, blockedBy: number[][], criticalPath: Int32Array): Int32Array {
	const es = new Int32Array(n).fill(-1);
	const visiting = new Uint8Array(n);

	const dfsES = (i: number): number => {
		if (es[i] !== -1) return es[i]!;
		if (visiting[i]) return 0;
		visiting[i] = 1;

		const predecessors = blockedBy[i]!;
		let max = 0;
		for (let j = 0; j < predecessors.length; j++) {
			const d = dfsES(predecessors[j]!);
			if (d > max) max = d;
		}
		visiting[i] = 0;
		const res = predecessors.length > 0 ? max + 1 : 0;
		es[i] = res;
		return res;
	};

	for (let i = 0; i < n; i++) dfsES(i);

	let maxCp = 0;
	for (let i = 0; i < n; i++) {
		if (criticalPath[i]! > maxCp) maxCp = criticalPath[i]!;
	}
	if (maxCp === 0) maxCp = 1;

	const slack = new Int32Array(n);
	for (let i = 0; i < n; i++) {
		slack[i] = maxCp - es[i]! - criticalPath[i]!;
	}

	return slack;
}

function computeKCores(n: number, blocks: number[][], blockedBy: number[][]): Int32Array {
	const degree = new Int32Array(n);
	const adj = Array.from({ length: n }, () => new Set<number>());

	for (let i = 0; i < n; i++) {
		const neighbors = new Set<number>();
		for (const x of blocks[i]!) neighbors.add(x);
		for (const x of blockedBy[i]!) neighbors.add(x);
		adj[i] = neighbors;
		degree[i] = neighbors.size;
	}

	const coreNumber = new Int32Array(n);
	const remaining = new Set<number>();
	for (let i = 0; i < n; i++) remaining.add(i);

	let k = 0;
	while (remaining.size > 0) {
		let removed = false;
		do {
			removed = false;
			const toRemove: number[] = [];
			for (const id of remaining) {
				if (degree[id]! <= k) {
					toRemove.push(id);
				}
			}
			for (let i = 0; i < toRemove.length; i++) {
				const id = toRemove[i]!;
				remaining.delete(id);
				coreNumber[id] = k;
				for (const neighbor of adj[id]!) {
					degree[neighbor]!--;
				}
				removed = true;
			}
		} while (removed);
		k++;
	}

	return coreNumber;
}

function computeArticulationPoints(n: number, blocks: number[][], blockedBy: number[][]): Uint8Array {
	const adj: number[][] = Array.from({ length: n }, () => []);
	for (let i = 0; i < n; i++) {
		const neighbors = new Set<number>();
		for (const x of blocks[i]!) neighbors.add(x);
		for (const x of blockedBy[i]!) neighbors.add(x);
		adj[i] = Array.from(neighbors);
	}

	let time = 0;
	const discovery = new Int32Array(n).fill(-1);
	const low = new Int32Array(n).fill(-1);
	const parent = new Int32Array(n).fill(-1);
	const articulation = new Uint8Array(n);

	const dfs = (u: number) => {
		let children = 0;
		discovery[u] = ++time;
		low[u] = time;

		for (const v of adj[u]!) {
			if (discovery[v] === -1) {
				children++;
				parent[v] = u;
				dfs(v);

				low[u] = Math.min(low[u]!, low[v]!);

				if (parent[u] === -1 && children > 1) {
					articulation[u] = 1;
				}
				if (parent[u] !== -1 && low[v]! >= discovery[u]!) {
					articulation[u] = 1;
				}
			} else if (v !== parent[u]) {
				low[u] = Math.min(low[u]!, discovery[v]!);
			}
		}
	};

	for (let i = 0; i < n; i++) {
		if (discovery[i] === -1) {
			dfs(i);
		}
	}

	return articulation;
}

export function computeMetrics(issues: Issue[]): GraphAnalysis {
	if (issues.length === 0) return { metrics: new Map(), density: 0, cycles: [] };

	const { blocks, blockedBy, ids } = buildAdjacency(issues);
	const n = ids.length;

	const pagerank = computePageRank(n, blocks, blockedBy);
	const betweenness = computeBetweenness(n, blocks);
	const criticalPath = computeCriticalPath(n, blocks);
	const { hubs, auths } = computeHITS(n, blocks, blockedBy);
	const eigenvector = computeEigenvector(n, blocks);
	const cycles = findCycles(n, blocks, ids);
	const slack = computeSlack(n, blockedBy, criticalPath);
	const coreNumber = computeKCores(n, blocks, blockedBy);
	const articulation = computeArticulationPoints(n, blocks, blockedBy);

	let edgeCount = 0;
	for (let i = 0; i < n; i++) edgeCount += blocks[i]!.length;
	const density = n > 1 ? edgeCount / (n * (n - 1)) : 0;

	let maxCp = 0;
	for (let i = 0; i < n; i++) {
		if (criticalPath[i]! > maxCp) maxCp = criticalPath[i]!;
	}
	if (maxCp === 0) maxCp = 1;

	let maxPr = 0;
	let minPr = Number.POSITIVE_INFINITY;
	for (let i = 0; i < n; i++) {
		if (pagerank[i]! > maxPr) maxPr = pagerank[i]!;
		if (pagerank[i]! < minPr) minPr = pagerank[i]!;
	}
	if (maxPr === 0) maxPr = 1;
	if (minPr === Number.POSITIVE_INFINITY) minPr = 0;
	const prRange = maxPr > minPr ? maxPr - minPr : maxPr;
	const basePr = maxPr > minPr ? minPr : 0;

	let maxB = 0;
	for (let i = 0; i < n; i++) {
		if (betweenness[i]! > maxB) maxB = betweenness[i]!;
	}
	if (maxB === 0) maxB = 1;

	const metrics: IssueMetrics = new Map();
	for (let i = 0; i < n; i++) {
		const pr = (pagerank[i]! - basePr) / prRange;
		const b = betweenness[i]! / maxB;
		const cp = criticalPath[i]! / maxCp;
		const score = 0.5 * pr + 0.3 * b + 0.2 * cp;

		metrics.set(ids[i]!, {
			pagerank: pagerank[i]!,
			betweenness: betweenness[i]!,
			criticalPathLength: criticalPath[i]!,
			hitsAuthority: auths[i]!,
			hitsHub: hubs[i]!,
			eigenvector: eigenvector[i]!,
			inDegree: blockedBy[i]!.length,
			outDegree: blocks[i]!.length,
			slack: slack[i]!,
			coreNumber: coreNumber[i]!,
			isArticulationPoint: articulation[i] === 1,
			score,
		});
	}

	return { metrics, density, cycles };
}
