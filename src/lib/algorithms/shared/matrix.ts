// src/lib/algorithms/shared/matrix.ts
// Sparse matrix, cosine similarity, dot product, and normalisation
// Used by XSimGCL, GNN-CF, GAT+K-Means
import { Matrix } from 'ml-matrix';

// ─── Sparse Matrix ─────────────────────────────────────────────────────────────
// Stores only non-zero entries — critical for user-event graphs where
// most users haven't interacted with most events

export class SparseMatrix {
  private rowIndex = new Map<number, Map<number, number>>();
  private colIndex = new Map<number, Map<number, number>>();
  private _nnz = 0;
  readonly rows: number;
  readonly cols: number;

  constructor(rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
  }

  set(row: number, col: number, value: number): void {
    if (value === 0) {
      if (this.rowIndex.get(row)?.has(col)) {
        this.rowIndex.get(row)!.delete(col);
        this.colIndex.get(col)!.delete(row);
        this._nnz--;
      }
    } else {
      if (!this.rowIndex.has(row)) this.rowIndex.set(row, new Map());
      if (!this.colIndex.has(col)) this.colIndex.set(col, new Map());

      if (!this.rowIndex.get(row)!.has(col)) {
        this._nnz++;
      }
      this.rowIndex.get(row)!.set(col, value);
      this.colIndex.get(col)!.set(row, value);
    }
  }

  get(row: number, col: number): number {
    return this.rowIndex.get(row)?.get(col) ?? 0;
  }

  getNonZeroCols(row: number): Array<{ col: number; value: number }> {
    return [...(this.rowIndex.get(row)?.entries() ?? [])].map(([col, value]) => ({ col, value }));
  }

  getNonZeroRows(col: number): Array<{ row: number; value: number }> {
    return [...(this.colIndex.get(col)?.entries() ?? [])].map(([row, value]) => ({ row, value }));
  }

  get nnz(): number {
    return this._nnz;
  }

  toDenseRow(row: number): number[] {
    const dense = new Array(this.cols).fill(0);
    for (const { col, value } of this.getNonZeroCols(row)) {
      dense[col] = value;
    }
    return dense;
  }

  normalizeRows(): void {
    for (const [r, rowMap] of this.rowIndex.entries()) {
      let sum = 0;
      for (const val of rowMap.values()) sum += val;
      if (sum > 0) {
        for (const [c, val] of rowMap.entries()) {
          this.set(r, c, val / sum);
        }
      }
    }
  }
}

// ─── Dense Vector Operations ───────────────────────────────────────────────────

export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export function l2Norm(v: number[]): number {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

export function normalizeVector(v: number[]): number[] {
  const norm = l2Norm(v);
  if (norm === 0) return v.map(() => 0);
  return v.map(x => x / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const normA = l2Norm(a);
  const normB = l2Norm(b);
  if (normA === 0 || normB === 0) return 0;
  return dotProduct(a, b) / (normA * normB);
}

// Add two vectors element-wise
export function addVectors(a: number[], b: number[]): number[] {
  if (a.length !== b.length) throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  return a.map((x, i) => x + b[i]);
}

// Scale a vector by a scalar
export function scaleVector(v: number[], scalar: number): number[] {
  return v.map(x => x * scalar);
}

// Mean of multiple vectors (used for aggregating embeddings)
export function meanVectors(vectors: number[][]): number[] {
  if (vectors.length === 0) throw new Error("Cannot compute mean of empty array");
  const dim = vectors[0].length;
  const sum = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) sum[i] += v[i];
  }
  return sum.map(x => x / vectors.length);
}

// ─── Matrix Operations ─────────────────────────────────────────────────────────

// Dense matrix multiply: A (m×k) × B (k×n) → C (m×n)
export function matMul(A: number[][], B: number[][]): number[][] {
  const A_matrix = new Matrix(A);
  const B_matrix = new Matrix(B);
  return A_matrix.mmul(B_matrix).to2DArray();
}

// Transpose a dense matrix
export function transpose(A: number[][]): number[][] {
  const m = A.length;
  const n = A[0].length;
  const T: number[][] = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      T[j][i] = A[i][j];
    }
  }
  return T;
}

// ─── Initialisation Utilities ──────────────────────────────────────────────────

// Xavier uniform initialisation for embedding matrices
// Keeps gradients stable across layers
export function xavierInit(rows: number, cols: number): number[][] {
  const limit = Math.sqrt(6 / (rows + cols));
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => (Math.random() * 2 - 1) * limit)
  );
}

// Uniform noise for XSimGCL augmentation: ε ~ Uniform(-alpha, alpha)
export function uniformNoise(v: number[], alpha: number = 0.1): number[] {
  return v.map(x => x + (Math.random() * 2 - 1) * alpha);
}

// ─── Degree Matrix Utilities (for GCN normalisation) ──────────────────────────

// Compute D^(-1/2) A D^(-1/2) normalised adjacency
// Used in LightGCN propagation inside XSimGCL and GNN-CF
export function normalizedAdjacency(adj: SparseMatrix, numNodes: number): SparseMatrix {
  // Compute degree of each node
  const degree = new Array(numNodes).fill(0);
  for (let i = 0; i < numNodes; i++) {
    for (const { value } of adj.getNonZeroCols(i)) {
      degree[i] += value;
    }
  }

  // D^(-1/2)
  const invSqrtDeg = degree.map(d => (d > 0 ? 1 / Math.sqrt(d) : 0));

  // Normalised: Â_ij = D^(-1/2)_ii * A_ij * D^(-1/2)_jj
  const normalised = new SparseMatrix(numNodes, numNodes);
  for (let i = 0; i < numNodes; i++) {
    for (const { col: j, value } of adj.getNonZeroCols(i)) {
      normalised.set(i, j, invSqrtDeg[i] * value * invSqrtDeg[j]);
    }
  }
  return normalised;
}

// ─── Jaccard Similarity ────────────────────────────────────────────────────────
// Used in GAT+K-Means for tag similarity between events

export function jaccardSimilarity(setA: string[], setB: string[]): number {
  if (setA.length === 0 && setB.length === 0) return 0;
  const a = new Set(setA);
  const b = new Set(setB);
  const intersection = [...a].filter(x => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

// ─── Shannon Entropy ───────────────────────────────────────────────────────────
// Used in MOEA/D for category diversity objective

export function shannonEntropy(categories: string[]): number {
  if (categories.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const c of categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  const total = categories.length;
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}
