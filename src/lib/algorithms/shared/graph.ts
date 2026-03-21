// src/lib/algorithms/shared/graph.ts
// Adjacency list, edge weights, BFS, and graph metrics
// Used by XSimGCL, GNN-CF, and GAT+K-Means

import { SparseMatrix, jaccardSimilarity } from "./matrix";

// Haversine distance in km between two lat/lng points
function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ─── Graph Types ───────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  index: number;        // 0-based integer index for matrix operations
  type: "user" | "event" | "vendor";
  features?: number[];  // optional feature vector
}

export interface GraphEdge {
  source: number;       // source node index
  target: number;       // target node index
  weight: number;       // similarity or interaction score
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  adjacency: SparseMatrix;
  nodeIndex: Map<string, number>;  // id → index lookup
}

// ─── Bipartite Graph Builder ───────────────────────────────────────────────────
// Used by XSimGCL and GNN-CF to build user-event interaction graphs

export interface InteractionRecord {
  userId: string;
  targetId: string;   // eventId or vendorId
  weight: number;     // implicit score (0.3 / 0.7 / 0.9 / 1.0)
}

export function buildBipartiteGraph(
  userIds: string[],
  targetIds: string[],
  interactions: InteractionRecord[],
  targetType: "event" | "vendor"
): Graph {
  // Build node list — users first, then targets
  const nodes: GraphNode[] = [
    ...userIds.map((id, index) => ({ id, index, type: "user" as const })),
    ...targetIds.map((id, index) => ({
      id,
      index: userIds.length + index,
      type: targetType,
    })),
  ];

  const nodeIndex = new Map<string, number>(nodes.map(n => [n.id, n.index]));
  const totalNodes = nodes.length;
  const adjacency = new SparseMatrix(totalNodes, totalNodes);

  const edges: GraphEdge[] = [];

  for (const { userId, targetId, weight } of interactions) {
    const u = nodeIndex.get(userId);
    const t = nodeIndex.get(targetId);
    if (u === undefined || t === undefined) continue;

    // Undirected — set both directions
    adjacency.set(u, t, weight);
    adjacency.set(t, u, weight);
    edges.push({ source: u, target: t, weight });
  }

  return { nodes, edges, adjacency, nodeIndex };
}

// ─── Event Similarity Graph Builder ───────────────────────────────────────────
// Used by GAT+K-Means for community detection

export interface EventNode {
  id: string;
  tags: string[];
  venueCity: string | null;
  latitude?: number | null;
  longitude?: number | null;
  attendeeIds: string[];
}

export function buildEventSimilarityGraph(
  events: EventNode[],
  threshold: number = 0.1,
  weights = { tag: 0.4, attendee: 0.4, location: 0.2 }
): Graph {
  const nodes: GraphNode[] = events.map((e, index) => ({
    id: e.id,
    index,
    type: "event" as const,
  }));

  const nodeIndex = new Map<string, number>(nodes.map(n => [n.id, n.index]));
  const n = events.length;
  const adjacency = new SparseMatrix(n, n);
  const edges: GraphEdge[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const ei = events[i];
      const ej = events[j];

      // Tag Jaccard similarity
      const tagSim = jaccardSimilarity(ei.tags, ej.tags);

      // Attendee overlap (Jaccard on attendee ID sets)
      const attendeeSim = jaccardSimilarity(ei.attendeeIds, ej.attendeeIds);

      // Location similarity — Haversine decay or binary city match fallback
      let locationSim = 0;
      if (
        ei.latitude != null && ei.longitude != null &&
        ej.latitude != null && ej.longitude != null
      ) {
        const distKm = haversineKm(
          ei.latitude, ei.longitude,
          ej.latitude, ej.longitude
        );
        locationSim = Math.exp(-distKm / 50); // 50km decay constant
      } else if (
        ei.venueCity && ej.venueCity && ei.venueCity === ej.venueCity
      ) {
        locationSim = 1;
      }

      const w =
        weights.tag * tagSim +
        weights.attendee * attendeeSim +
        weights.location * locationSim;

      if (w >= threshold) {
        adjacency.set(i, j, w);
        adjacency.set(j, i, w);
        edges.push({ source: i, target: j, weight: w });
      }
    }
  }

  return { nodes, edges, adjacency, nodeIndex };
}

// ─── BFS ───────────────────────────────────────────────────────────────────────
// Finds all nodes reachable from a start node — used for connected components

export function bfs(graph: Graph, startIndex: number): number[] {
  const visited = new Set<number>();
  const queue = [startIndex];
  visited.add(startIndex);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const { col: neighbor } of graph.adjacency.getNonZeroCols(current)) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return [...visited];
}

// ─── Graph Metrics ─────────────────────────────────────────────────────────────

// Node degree: number of connected edges
export function nodeDegree(graph: Graph, nodeIndex: number): number {
  return graph.adjacency.getNonZeroCols(nodeIndex).length;
}

// Graph density: actual edges / possible edges
export function graphDensity(graph: Graph): number {
  const n = graph.nodes.length;
  if (n <= 1) return 0;
  const maxEdges = (n * (n - 1)) / 2;
  return maxEdges === 0 ? 0 : graph.edges.length / maxEdges;
}

// Modularity Q: measures quality of community structure
// Q = (1/2m) Σ_ij [A_ij - k_i*k_j/2m] δ(c_i, c_j)
// where m = total edge weight, k_i = degree of node i, c_i = community of node i
export function computeModularity(
  graph: Graph,
  communities: Map<number, number>  // nodeIndex → communityId
): number {
  const totalWeight = graph.edges.reduce((sum, e) => sum + e.weight, 0);
  if (totalWeight === 0) return 0;

  const m2 = 2 * totalWeight;

  // Compute degree per node
  const degrees = new Array(graph.nodes.length).fill(0);
  for (const edge of graph.edges) {
    degrees[edge.source] += edge.weight;
    degrees[edge.target] += edge.weight;
  }

  let Q = 0;
  for (const edge of graph.edges) {
    const ci = communities.get(edge.source);
    const cj = communities.get(edge.target);
    if (ci === cj) {
      Q += edge.weight - (degrees[edge.source] * degrees[edge.target]) / m2;
    }
  }

  // Handle self-loops within communities (nodes with no cross-community edges)
  for (let i = 0; i < graph.nodes.length; i++) {
    const ci = communities.get(i);
    const neighbors = graph.adjacency.getNonZeroCols(i);
    if (neighbors.length === 0 && ci !== undefined) {
      // Isolated node counts neutral
    }
  }

  return Q / totalWeight;
}

// ─── K-Nearest Neighbours in Embedding Space ──────────────────────────────────
// Used after GAT to find similar events for the "Similar Events" sidebar

export function kNearestNeighbours(
  queryEmbedding: number[],
  allEmbeddings: Array<{ id: string; embedding: number[] }>,
  k: number,
  excludeIds: string[] = []
): Array<{ id: string; similarity: number }> {
  const excludeSet = new Set(excludeIds);

  const scored = allEmbeddings
    .filter(e => !excludeSet.has(e.id))
    .map(e => {
      // Cosine similarity via dot product of normalised vectors
      const normQ = Math.sqrt(queryEmbedding.reduce((s, x) => s + x * x, 0));
      const normE = Math.sqrt(e.embedding.reduce((s, x) => s + x * x, 0));
      if (normQ === 0 || normE === 0) return { id: e.id, similarity: 0 };
      const dot = queryEmbedding.reduce((s, x, i) => s + x * e.embedding[i], 0);
      return { id: e.id, similarity: dot / (normQ * normE) };
    });

  return scored
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}
