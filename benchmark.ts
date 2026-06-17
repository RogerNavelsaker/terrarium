import { computeMetrics } from "./src/graph.ts";
import type { Issue } from "./src/types.ts";

const numNodes = 2000;
const issues: Issue[] = [];
for (let i = 0; i < numNodes; i++) {
  issues.push({ id: `i-${i}`, title: "x", status: "open", priority: 5, blocks: [] });
}
// Generate DAG to avoid cycles
for (let i = 0; i < numNodes; i++) {
  const numEdges = Math.floor(Math.random() * 5);
  for (let e = 0; e < numEdges; e++) {
    const target = i + 1 + Math.floor(Math.random() * (numNodes - i - 1));
    if (target < numNodes && target !== i) {
      issues[i]!.blocks!.push(`i-${target}`);
    }
  }
}

const start = performance.now();
const res = computeMetrics(issues);
const end = performance.now();
console.log(`Analyzed ${numNodes} nodes in ${end - start}ms`);
