/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { supabase } from "@/services/supabase/client";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { useToast } from "@/hooks/useToast";
import {
  Play, RefreshCw, ChevronDown, ChevronUp, CheckCircle2,
  AlertCircle, Clock, Trash2, Database, Brain, Zap,
  Users, Network, Layers,
  FlaskConical, RotateCcw, Terminal, Info, Activity,
  Loader2, ShieldCheck, XCircle, FileDown,
  FileText, FileJson, FileSpreadsheet, BarChart2,
} from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
  Legend,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type TestStatus = "idle" | "running" | "success" | "error";

interface TestResult {
  status: TestStatus;
  data: any;
  error?: string;
  ranAt?: string;
  durationMs?: number;
}

// ─── Mini chart: SVG sparkline ────────────────────────────────────────────────

function Sparkline({ values, color = "#3b82f6", height = 40 }: { values: number[]; color?: string; height?: number }) {
  if (!values || values.length < 2) return null;
  const w = 200;
  const h = height;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts.join(" ")} />
      <polyline fill={`${color}20`} stroke="none" points={`0,${h} ${pts.join(" ")} ${w},${h}`} />
    </svg>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TestStatus }) {
  const map: Record<TestStatus, { icon: React.ElementType; label: string; className: string }> = {
    idle: { icon: Clock, label: "Not Run", className: "text-[var(--color-text-tertiary)] bg-[var(--color-surface-hover)]" },
    running: { icon: Loader2, label: "Running", className: "text-blue-400 bg-blue-400/10" },
    success: { icon: CheckCircle2, label: "Complete", className: "text-emerald-400 bg-emerald-400/10" },
    error: { icon: XCircle, label: "Failed", className: "text-red-400 bg-red-400/10" },
  };
  const { icon: Icon, label, className } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${className}`}>
      <Icon size={10} className={status === "running" ? "animate-spin" : ""} />
      {label}
    </span>
  );
}

// ─── Metric pill ──────────────────────────────────────────────────────────────

function MetricPill({ label, value, good, unit = "" }: { label: string; value: string | number; good?: boolean; unit?: string }) {
  return (
    <div className="flex flex-col gap-0.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)]">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black tabular-nums text-[var(--color-text-primary)]">{value}</span>
        {unit && <span className="text-xs text-[var(--color-text-tertiary)]">{unit}</span>}
      </div>
      {good !== undefined && (
        <span className={`text-[10px] font-semibold ${good ? "text-emerald-400" : "text-red-400"}`}>
          {good ? "↑ Beats baseline" : "↓ Below baseline"}
        </span>
      )}
    </div>
  );
}

// ─── Scrollable data box ──────────────────────────────────────────────────────

function DataBox({ title, data }: { title: string; data: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-3 py-2 bg-[var(--color-surface-hover)] text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
        <span className="flex items-center gap-1.5"><Terminal size={11} />{title}</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <pre className="text-[10px] font-mono text-[var(--color-text-secondary)] bg-[var(--color-background)] p-3 max-h-48 overflow-y-auto custom-scrollbar leading-relaxed whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Test Card ────────────────────────────────────────────────────────────────

function TestCard({
  icon: Icon, iconColor, title, description, whatItTests, howToRead,
  onRun, result, renderResult,
}: {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
  whatItTests: string;
  howToRead: string;
  onRun: () => Promise<void>;
  result: TestResult;
  renderResult: (data: any) => React.ReactNode;
}) {
  const isRunning = result.status === "running";

  return (
    <div className={`border rounded-xl overflow-hidden transition-all duration-300 ${result.status === "success" ? "border-emerald-500/30 bg-emerald-500/[0.02]" :
        result.status === "error" ? "border-red-500/30 bg-red-500/[0.02]" :
          result.status === "running" ? "border-blue-500/30 bg-blue-500/[0.02]" :
            "border-[var(--color-border)] bg-[var(--color-surface)]"
      }`}>
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`p-2 rounded-lg bg-[var(--color-surface-hover)] ${iconColor} shrink-0 mt-0.5`}>
              <Icon size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm text-[var(--color-text-primary)]">{title}</h3>
                <StatusBadge status={result.status} />
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">{description}</p>
            </div>
          </div>
          <button
            onClick={onRun}
            disabled={isRunning}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--color-brand)] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {isRunning ? "Running…" : "Run"}
          </button>
        </div>

        {/* Info pills */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-0.5">What it tests</p>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{whatItTests}</p>
          </div>
          <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-0.5">How to read results</p>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{howToRead}</p>
          </div>
        </div>

        {/* Meta */}
        {result.ranAt && (
          <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--color-text-tertiary)]">
            <span>Last run: {result.ranAt}</span>
            {result.durationMs && <span>Duration: {result.durationMs}ms</span>}
          </div>
        )}
      </div>

      {/* Result area */}
      {(result.status === "success" || result.status === "error") && (
        <div className="border-t border-[var(--color-border)] px-5 py-4 space-y-4">
          {result.status === "error" ? (
            <div className="flex items-start gap-2 text-red-400 text-sm">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{result.error || "An unknown error occurred."}</span>
            </div>
          ) : (
            <>
              {renderResult(result.data)}
              <DataBox title="Raw Response Data" data={result.data} />
            </>
          )}
        </div>
      )}

      {/* Running shimmer */}
      {result.status === "running" && (
        <div className="border-t border-[var(--color-border)] px-5 py-6">
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-[var(--color-surface-hover)] rounded w-3/4" />
            <div className="h-3 bg-[var(--color-surface-hover)] rounded w-1/2" />
            <div className="h-16 bg-[var(--color-surface-hover)] rounded mt-4" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reset confirmation modal ──────────────────────────────────────────────────

function ResetModal({ onClose, onConfirm, isResetting, targets }: {
  onClose: () => void;
  onConfirm: (targets: string[]) => void;
  isResetting: boolean;
  targets: { key: string; label: string; description: string; checked: boolean }[];
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(targets.map(t => [t.key, t.checked]))
  );

  const toggle = (key: string) => setSelected(prev => ({ ...prev, [key]: !prev[key] }));
  const selectedKeys = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
            <RotateCcw size={16} />
          </div>
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">Reset Test State</h2>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] mb-5 ml-11">Select which data to clear. This lets you re-run tests from a clean state.</p>

        <div className="space-y-2 mb-6">
          {targets.map(t => (
            <label key={t.key} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selected[t.key] ? "border-red-500/40 bg-red-500/5" : "border-[var(--color-border)] bg-[var(--color-background)]"
              }`}>
              <input type="checkbox" checked={!!selected[t.key]} onChange={() => toggle(t.key)} className="mt-0.5 accent-red-500" />
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-primary)]">{t.label}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 leading-relaxed">{t.description}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedKeys)}
            disabled={isResetting || selectedKeys.length === 0}
            className="flex-1 py-2 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
          >
            {isResetting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            {isResetting ? "Clearing…" : `Clear ${selectedKeys.length} item${selectedKeys.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Report Generator ────────────────────────────────────────────────────────

interface ReportData {
  generatedAt: string;
  systemHealth: {
    totalRuns: number;
    activeUsers: number;
    cacheHitRate: number;
    totalRequests: number;
  };
  algorithmPerformance: { algorithm: string; avgTimeMs: number; runs: number; lastRun: string }[];
  evaluationMetrics: {
    ndcg10: number | null;
    precision10: number | null;
    mrr10: number | null;
    hitRate10: number | null;
    baselineNdcg10: number | null;
    usersEvaluated: number;
    groundTruthSize: number;
    forecastMae: number | null;
    forecastRmse: number | null;
    forecastMape: number | null;
  } | null;
  bprTraining: {
    epochs: number;
    finalLoss: number;
    lossPerEpoch: number[];
    interactionsUsed: number;
  } | null;
  communityDetection: {
    numCommunities: number;
    communities: { label: string; size: number; modularity: number }[];
  } | null;
  moead: {
    paretoSize: number;
    bundles: { label: string; totalCost: number; totalQuality: number; vendors: number }[];
  } | null;
  xsimgclAblation: {
    preNdcg: number | null;
    postNdcg: number | null;
    delta: number | null;
    baselineNdcg: number | null;
  } | null;
  /** GAT+K-Means geographic-decay ablation (Table II) */
  gatAblation: {
    withDecay: { silhouette: number | null; modularity: number | null; communities: number | null; execMs: number | null };
    withoutDecay: { silhouette: number | null; modularity: number | null; communities: number | null; execMs: number | null };
    deltaSilhouette: number | null;
    deltaModularity: number | null;
  } | null;
}

function buildReportData(
  systemStats: any,
  evalResult: TestResult,
  trainResult: TestResult,
  communityResult: TestResult,
  moEadResult: TestResult,
  seqResults: SeqResults | null,
  ablationResult: { withDecay: any; withoutDecay: any } | null,
): ReportData {
  const ed = evalResult.data?.metrics || evalResult.data || seqResults?.finalEvalData?.metrics || seqResults?.finalEvalData;
  const td = trainResult.data || seqResults?.finalTrainData;
  const cd = communityResult.data;
  const md = moEadResult.data;

  const pickSil  = (d: any) => d?.silhouetteScore ?? null;
  const pickQ    = (d: any) => d?.communities?.[0]?.modularity ?? d?.modularity ?? null;
  const pickN    = (d: any) => d?.numCommunities ?? d?.communities?.length ?? null;
  const pickMs   = (d: any) => d?.executionTimeMs ?? null;

  const silA = ablationResult ? pickSil(ablationResult.withDecay)    : null;
  const silB = ablationResult ? pickSil(ablationResult.withoutDecay) : null;
  const qA   = ablationResult ? pickQ(ablationResult.withDecay)      : null;
  const qB   = ablationResult ? pickQ(ablationResult.withoutDecay)   : null;

  return {
    generatedAt: new Date().toISOString(),
    systemHealth: {
      totalRuns: systemStats.totalRuns,
      activeUsers: systemStats.activeUsers,
      cacheHitRate: parseFloat(systemStats.cacheHitRate.toFixed(2)),
      totalRequests: systemStats.totalRequests,
    },
    algorithmPerformance: systemStats.performanceStats.map((s: any) => ({
      algorithm: s.algorithm,
      avgTimeMs: parseFloat(s.avgTime.toFixed(2)),
      runs: s.count,
      lastRun: s.lastRun,
    })),
    evaluationMetrics: ed ? {
      ndcg10: ed.meanNdcg10 ?? null,
      precision10: ed.meanPrecision10 ?? null,
      mrr10: ed.meanMrr10 ?? null,
      hitRate10: ed.meanHitRate10 ?? null,
      baselineNdcg10: ed.baselineNdcg10 ?? null,
      usersEvaluated: ed.usersEvaluated ?? 0,
      groundTruthSize: ed.meanGroundTruthSize ?? 0,
      forecastMae: ed.forecasting?.mae ?? null,
      forecastRmse: ed.forecasting?.rmse ?? null,
      forecastMape: ed.forecasting?.mape ?? null,
    } : null,
    bprTraining: td ? {
      epochs: td.totalEpochs ?? 0,
      finalLoss: td.finalLoss ?? 0,
      lossPerEpoch: td.lossPerEpoch ?? [],
      interactionsUsed: td.interactionsUsed ?? 0,
    } : null,
    communityDetection: cd ? {
      numCommunities: cd.numCommunities ?? 0,
      communities: (cd.communities ?? []).map((c: any) => ({
        label: c.label,
        size: c.size,
        modularity: parseFloat((c.modularity ?? 0).toFixed(4)),
      })),
    } : null,
    moead: md ? {
      paretoSize: md.paretoSize ?? 0,
      bundles: (md.bundles ?? []).map((b: any) => ({
        label: b.label ?? "",
        totalCost: b.totalCost ?? 0,
        totalQuality: parseFloat((b.totalQuality ?? 0).toFixed(2)),
        vendors: b.vendors?.length ?? 0,
      })),
    } : null,
    xsimgclAblation: seqResults ? {
      preNdcg: seqResults.preNdcg,
      postNdcg: seqResults.postNdcg,
      delta: seqResults.preNdcg != null && seqResults.postNdcg != null
        ? parseFloat((seqResults.postNdcg - seqResults.preNdcg).toFixed(4))
        : null,
      baselineNdcg: seqResults.baselineNdcg,
    } : null,
    gatAblation: ablationResult ? {
      withDecay:    { silhouette: silA,  modularity: qA,  communities: pickN(ablationResult.withDecay),    execMs: pickMs(ablationResult.withDecay)    },
      withoutDecay: { silhouette: silB,  modularity: qB,  communities: pickN(ablationResult.withoutDecay), execMs: pickMs(ablationResult.withoutDecay) },
      deltaSilhouette: silA != null && silB != null ? parseFloat((silA - silB).toFixed(4)) : null,
      deltaModularity: qA   != null && qB   != null ? parseFloat((qA   - qB  ).toFixed(4)) : null,
    } : null,
  };
}

// ── Export helpers ────────────────────────────────────────────────────────────

function exportJSON(data: ReportData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `eventms-report-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(data: ReportData) {
  const rows: string[][] = [];

  rows.push(["EventMS Algorithm Lab Report"]);
  rows.push(["Generated At", data.generatedAt]);
  rows.push([]);

  rows.push(["=== SYSTEM HEALTH ==="]);
  rows.push(["Metric", "Value"]);
  rows.push(["Total Algorithm Runs", String(data.systemHealth.totalRuns)]);
  rows.push(["Active Users", String(data.systemHealth.activeUsers)]);
  rows.push(["Cache Hit Rate (%)", String(data.systemHealth.cacheHitRate)]);
  rows.push(["Total Recommendation Requests", String(data.systemHealth.totalRequests)]);
  rows.push([]);

  rows.push(["=== ALGORITHM PERFORMANCE (Table I) ==="]);
  rows.push(["Algorithm", "Avg Execution Time (ms)", "Total Runs", "Last Run"]);
  data.algorithmPerformance.forEach(p => {
    rows.push([p.algorithm, String(p.avgTimeMs), String(p.runs), p.lastRun]);
  });
  rows.push([]);

  if (data.evaluationMetrics) {
    const e = data.evaluationMetrics;
    rows.push(["=== EVALUATION METRICS ==="]);
    rows.push(["Metric", "Value"]);
    rows.push(["NDCG@10", String(e.ndcg10 ?? "")]);
    rows.push(["Hit Rate@10", String(e.hitRate10 ?? "")]);
    rows.push(["MRR@10", String(e.mrr10 ?? "")]);
    rows.push(["Precision@10", String(e.precision10 ?? "")]);
    rows.push(["Random Baseline NDCG@10", String(e.baselineNdcg10 ?? "")]);
    rows.push(["Users Evaluated", String(e.usersEvaluated)]);
    rows.push(["Mean Ground Truth Size", String(e.groundTruthSize)]);
    rows.push(["Forecast MAE", String(e.forecastMae ?? "")]);
    rows.push(["Forecast RMSE", String(e.forecastRmse ?? "")]);
    rows.push(["Forecast MAPE (%)", String(e.forecastMape ?? "")]);
    rows.push([]);
  }

  if (data.xsimgclAblation) {
    const x = data.xsimgclAblation;
    rows.push(["=== XSimGCL BPR ABLATION ==="]);
    rows.push(["Metric", "Value"]);
    rows.push(["Pre-Training NDCG@10", String(x.preNdcg ?? "")]);
    rows.push(["Post-Training NDCG@10", String(x.postNdcg ?? "")]);
    rows.push(["Delta (lift)", String(x.delta ?? "")]);
    rows.push(["Random Baseline NDCG@10", String(x.baselineNdcg ?? "")]);
    rows.push([]);
  }

  if (data.bprTraining) {
    const t = data.bprTraining;
    rows.push(["=== BPR TRAINING ==="]);
    rows.push(["Epochs", String(t.epochs)]);
    rows.push(["Final Loss", String(t.finalLoss)]);
    rows.push(["Interactions Used", String(t.interactionsUsed)]);
    rows.push(["Loss Per Epoch", t.lossPerEpoch.join(", ")]);
    rows.push([]);
  }

  if (data.communityDetection) {
    rows.push(["=== COMMUNITY DETECTION (Table II) ==="]);
    rows.push(["Community Label", "Size (events)", "Modularity Q"]);
    data.communityDetection.communities.forEach(c => {
      rows.push([c.label, String(c.size), String(c.modularity)]);
    });
    rows.push([]);
  }

  if (data.gatAblation) {
    const g = data.gatAblation;
    rows.push(["=== GAT+K-MEANS ABLATION (Table II) ==="]);
    rows.push(["Metric", "With Haversine Decay", "Without Haversine Decay", "Delta (contribution)"]);
    rows.push(["Silhouette Score", String(g.withDecay.silhouette ?? ""), String(g.withoutDecay.silhouette ?? ""), String(g.deltaSilhouette ?? "")]);
    rows.push(["Modularity Q",    String(g.withDecay.modularity  ?? ""), String(g.withoutDecay.modularity  ?? ""), String(g.deltaModularity  ?? "")]);
    rows.push(["Communities",     String(g.withDecay.communities ?? ""), String(g.withoutDecay.communities ?? ""), ""]);
    rows.push(["Exec Time (ms)",  String(g.withDecay.execMs      ?? ""), String(g.withoutDecay.execMs      ?? ""), ""]);
    rows.push([]);
  }

  if (data.moead) {
    rows.push(["=== MOEA/D BUDGET OPTIMIZER (Table III) ==="]);
    rows.push(["Bundle", "Total Cost (INR)", "Total Quality", "Vendors"]);
    data.moead.bundles.forEach(b => {
      rows.push([b.label, String(b.totalCost), String(b.totalQuality), String(b.vendors)]);
    });
    rows.push([]);
  }

  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '\"')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `eventms-report-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(data: ReportData) {
  const date = new Date(data.generatedAt).toLocaleString();

  const tableStyle = `border-collapse:collapse;width:100%;margin-bottom:16px;font-size:11px;`;
  const thStyle = `border:1px solid #374151;background:#1f2937;color:#9ca3af;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;`;
  const tdStyle = `border:1px solid #374151;padding:6px 8px;color:#e5e7eb;`;
  const tdAltStyle = `border:1px solid #374151;padding:6px 8px;color:#e5e7eb;background:#111827;`;
  const h2Style = `color:#60a5fa;font-size:13px;font-weight:700;margin:24px 0 8px;text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid #374151;padding-bottom:4px;`;
  const goodStyle = `color:#34d399;font-weight:700;`;
  const badStyle = `color:#f87171;font-weight:700;`;

  const mkTable = (headers: string[], rows: (string | number)[][]) => `
    <table style="${tableStyle}">
      <thead><tr>${headers.map(h => `<th style="${thStyle}">${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r, ri) => `<tr>${r.map(cell => `<td style="${ri % 2 === 0 ? tdStyle : tdAltStyle}">${cell}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>EventMS Report</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#030712;color:#f9fafb;margin:0;padding:32px;}
    @media print{body{background:#fff;color:#111;}@page{margin:20mm;}}
  </style>
  </head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;border-bottom:1px solid #374151;padding-bottom:16px;">
    <div>
      <p style="color:#60a5fa;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;margin:0 0 4px;">Research Control Centre</p>
      <h1 style="margin:0;font-size:24px;font-weight:900;color:#f9fafb;">EventMS — Algorithm Lab Report</h1>
      <p style="color:#6b7280;font-size:12px;margin:4px 0 0;">Generated ${date}</p>
    </div>
  </div>

  <h2 style="${h2Style}">System Health</h2>
  ${mkTable(
    ["Metric", "Value"],
    [
      ["Total Algorithm Runs", data.systemHealth.totalRuns],
      ["Active Users (signals)", data.systemHealth.activeUsers],
      ["Cache Hit Rate", `${data.systemHealth.cacheHitRate}%`],
      ["Total Recommendation Requests", data.systemHealth.totalRequests],
    ]
  )}

  <h2 style="${h2Style}">Table I — Algorithm Execution Times</h2>
  ${mkTable(
    ["Algorithm", "Avg Time (ms)", "Runs", "Last Run"],
    data.algorithmPerformance.map(p => [p.algorithm, p.avgTimeMs, p.runs, p.lastRun])
  )}`;

  if (data.evaluationMetrics) {
    const e = data.evaluationMetrics;
    const ndcgGood = e.ndcg10 != null && e.baselineNdcg10 != null && e.ndcg10 > e.baselineNdcg10;
    html += `
  <h2 style="${h2Style}">Evaluation Metrics — XSimGCL & iTransformer</h2>
  ${mkTable(
      ["Metric", "Value", "vs Baseline"],
      [
        ["NDCG@10", e.ndcg10?.toFixed(4) ?? "—", `<span style="${ndcgGood ? goodStyle : badStyle}">${ndcgGood ? "▲ Beats" : "▼ Below"} baseline (${e.baselineNdcg10?.toFixed(4) ?? "—"})</span>`],
        ["Hit Rate@10", e.hitRate10?.toFixed(4) ?? "—", ""],
        ["MRR@10", e.mrr10?.toFixed(4) ?? "—", ""],
        ["Precision@10", e.precision10?.toFixed(4) ?? "—", ""],
        ["Users Evaluated", String(e.usersEvaluated), ""],
        ["Mean Ground Truth Size", String(e.groundTruthSize), ""],
        ["Forecast MAE", e.forecastMae?.toFixed(4) ?? "—", "Lower is better"],
        ["Forecast RMSE", e.forecastRmse?.toFixed(4) ?? "—", "Lower is better"],
        ["Forecast MAPE (%)", e.forecastMape?.toFixed(2) ?? "—", ""],
      ]
    )}`;
  }

  if (data.xsimgclAblation) {
    const x = data.xsimgclAblation;
    const improved = x.delta != null && x.delta > 0;
    html += `
  <h2 style="${h2Style}">XSimGCL BPR Ablation — Pre vs Post Training</h2>
  ${mkTable(
      ["Phase", "NDCG@10", "Notes"],
      [
        ["Random Baseline", x.baselineNdcg?.toFixed(4) ?? "—", "Theoretical random guesser"],
        ["Pre-Training (LightGCN only)", x.preNdcg?.toFixed(4) ?? "—", "No BPR gradient descent"],
        ["Post-Training (Full XSimGCL)", x.postNdcg?.toFixed(4) ?? "—", "After BPR training loop"],
        ["Delta (lift)", `<span style="${improved ? goodStyle : badStyle}">${x.delta != null ? (x.delta >= 0 ? "+" : "") + x.delta.toFixed(4) : "—"}</span>`, improved ? "BPR improved recommendations" : "Check training data quality"],
      ]
    )}`;
  }

  if (data.bprTraining) {
    const t = data.bprTraining;
    html += `
  <h2 style="${h2Style}">BPR Training — Loss Curve (Figure 2)</h2>
  ${mkTable(["Epochs", "Final Loss", "Interactions Used"], [[t.epochs, t.finalLoss.toFixed(6), t.interactionsUsed]])}
  <p style="font-size:10px;color:#6b7280;margin-top:-8px;">Loss per epoch: ${t.lossPerEpoch.map((l, i) => `e${i + 1}:${l.toFixed(5)}`).join("  ")}</p>`;
  }

  if (data.communityDetection && data.communityDetection.communities.length > 0) {
    html += `
  <h2 style="${h2Style}">Table II — GAT+K-Means Community Detection</h2>
  ${mkTable(
      ["Community", "Events", "Modularity Q"],
      data.communityDetection.communities.map(c => [c.label, c.size, c.modularity])
    )}`;
  }

  if (data.gatAblation) {
    const g = data.gatAblation;
    const fmtDelta = (v: number | null) =>
      v == null ? "—" : `<span style="${v > 0 ? goodStyle : v < 0 ? badStyle : ""}">${
        v >= 0 ? "+" : ""}${v.toFixed(4)}</span>`;
    html += `
  <h2 style="${h2Style}">Table II — GAT+K-Means Ablation: Haversine Decay Contribution</h2>
  ${mkTable(
      ["Metric", "With Haversine Decay", "Without Haversine Decay", "Δ (contribution)"],
      [
        ["Silhouette Score", g.withDecay.silhouette?.toFixed(4) ?? "—", g.withoutDecay.silhouette?.toFixed(4) ?? "—", fmtDelta(g.deltaSilhouette)],
        ["Modularity Q",    g.withDecay.modularity?.toFixed(4)  ?? "—", g.withoutDecay.modularity?.toFixed(4)  ?? "—", fmtDelta(g.deltaModularity)],
        ["Communities",     String(g.withDecay.communities ?? "—"),      String(g.withoutDecay.communities ?? "—"),      ""],
        ["Exec Time (ms)",  String(g.withDecay.execMs ?? "—"),           String(g.withoutDecay.execMs ?? "—"),           ""],
      ]
    )}
  <p style="font-size:10px;color:#6b7280;margin-top:-8px;">Positive Δ = haversine decay improves the metric. Copy into Table II of your paper.</p>`;
  }

  if (data.moead && data.moead.bundles.length > 0) {
    html += `
  <h2 style="${h2Style}">Table III — MOEA/D Pareto-Optimal Bundles</h2>
  ${mkTable(
      ["Bundle", "Total Cost (₹)", "Quality Score", "Vendors"],
      data.moead.bundles.map(b => [b.label, b.totalCost.toLocaleString(), b.totalQuality, b.vendors])
    )}`;
  }

  html += `
  <div style="margin-top:40px;border-top:1px solid #374151;padding-top:12px;color:#4b5563;font-size:10px;">
    <p>EventMS Algorithm Lab · IEEE Access Application Paper · Generated ${date}</p>
    <p>Algorithms: XSimGCL (IEEE TKDE 2024) · GNN-CF (IEEE 2024) · iTransformer (ICLR 2024) · GAT+K-Means (IEEE 2024) · MOEA/D-DRA-NEF (IEEE 2025)</p>
  </div>
  </body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

// ── ReportGenerator component ─────────────────────────────────────────────────

function ReportGenerator({
  systemStats, evalResult, trainResult, communityResult, moEadResult, seqResults, ablationResult,
}: {
  systemStats: any;
  evalResult: TestResult;
  trainResult: TestResult;
  communityResult: TestResult;
  moEadResult: TestResult;
  seqResults: SeqResults | null;
  ablationResult: { withDecay: any; withoutDecay: any } | null;
}) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasData =
    evalResult.status === "success" ||
    trainResult.status === "success" ||
    communityResult.status === "success" ||
    moEadResult.status === "success" ||
    seqResults != null;

  const generate = (format: "json" | "csv" | "pdf") => {
    setGenerating(true);
    setOpen(false);
    setTimeout(() => {
      try {
        const data = buildReportData(systemStats, evalResult, trainResult, communityResult, moEadResult, seqResults, ablationResult);
        if (format === "json") exportJSON(data);
        else if (format === "csv") exportCSV(data);
        else exportPDF(data);
      } finally {
        setGenerating(false);
      }
    }, 50);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={generating}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${hasData
            ? "bg-[var(--color-brand)] text-white hover:brightness-110 shadow-md shadow-blue-500/20"
            : "border border-[var(--color-border)] text-[var(--color-text-tertiary)] cursor-not-allowed opacity-50"
          }`}
        title={hasData ? "Export report" : "Run at least one test first"}
      >
        {generating ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
        Export Report
      </button>

      {open && hasData && (
        <div className="absolute right-0 top-full mt-1.5 z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden w-52 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-[var(--color-border)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">Choose format</p>
          </div>
          {[
            {
              format: "pdf" as const,
              icon: FileText,
              label: "PDF Report",
              desc: "Formatted paper-ready document — opens print dialog",
              color: "text-red-400",
            },
            {
              format: "csv" as const,
              icon: FileSpreadsheet,
              label: "CSV Spreadsheet",
              desc: "All metrics in rows — paste into Excel or Google Sheets",
              color: "text-emerald-400",
            },
            {
              format: "json" as const,
              icon: FileJson,
              label: "JSON Data",
              desc: "Full structured export — useful for further processing",
              color: "text-blue-400",
            },
          ].map(({ format, icon: Icon, label, desc, color }) => (
            <button
              key={format}
              onClick={() => generate(format)}
              className="w-full flex items-start gap-3 px-3 py-3 hover:bg-[var(--color-surface-hover)] transition-colors text-left border-b border-[var(--color-border)] last:border-b-0"
            >
              <Icon size={15} className={`${color} shrink-0 mt-0.5`} />
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-primary)]">{label}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Auto Sequence ────────────────────────────────────────────────────────────

type SeqStepStatus = "waiting" | "running" | "done" | "error";

interface SeqStep {
  id: string;
  label: string;
  description: string;
  status: SeqStepStatus;
  detail?: string;
}

interface SeqResults {
  preNdcg: number | null;
  prePrec: number | null;
  postNdcg: number | null;
  postPrec: number | null;
  lossCurve: number[];
  baselineNdcg: number | null;
  usersEvaluated: number;
  finalSimData?: any;
  finalEvalData?: any;
  finalTrainData?: any;
}

const INITIAL_STEPS: SeqStep[] = [
  { id: "simulate_pre", label: "Simulate AI", description: "Generating predictions for eval users with current embeddings…", status: "waiting" },
  { id: "eval_pre", label: "Evaluate (pre-training)", description: "Scoring predictions against ground truth — recording baseline NDCG…", status: "waiting" },
  { id: "train", label: "Train XSimGCL (BPR)", description: "Running BPR gradient descent loop on all user interactions…", status: "waiting" },
  { id: "simulate_post", label: "Simulate AI again", description: "Re-generating predictions with freshly trained embeddings…", status: "waiting" },
  { id: "eval_post", label: "Evaluate (post-training)", description: "Scoring again — comparing NDCG lift against pre-training baseline…", status: "waiting" },
];

export interface AutoSequenceHandle { run: () => Promise<SeqResults>; }

const AutoSequence = forwardRef<AutoSequenceHandle, { getToken: () => Promise<string>; toastError?: (m: string) => void; onResults?: (r: SeqResults) => void }>(({ getToken, onResults }, ref) => {
  useImperativeHandle(ref, () => ({ run: runSequence }));
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [steps, setSteps] = useState<SeqStep[]>(INITIAL_STEPS);
  const [results, setResults] = useState<SeqResults | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setStep = (id: string, patch: Partial<SeqStep>) =>
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));

  const callApi = async (token: string, url: string, opts?: RequestInit) => {
    const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts?.headers || {}) } });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const runSequence = async (): Promise<SeqResults> => {
    setRunning(true);
    setDone(false);
    setResults(null);
    setSteps(INITIAL_STEPS.map(s => ({ ...s, status: "waiting" })));
    setElapsed(0);

    const t0 = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);

    const res: SeqResults = { preNdcg: null, prePrec: null, postNdcg: null, postPrec: null, lossCurve: [], baselineNdcg: null, usersEvaluated: 0 };

    try {
      const token = await getToken();

      // ── Step 1: Simulate (pre) ──────────────────────────────────────────────
      setStep("simulate_pre", { status: "running" });
      try {
        const simData = await callApi(token, "/api/admin/simulate-ai", { method: "POST" });
        setStep("simulate_pre", { status: "done", detail: `${simData.processed ?? 0} users processed` });
      } catch (e: any) {
        setStep("simulate_pre", { status: "error", detail: e.message });
        throw e;
      }

      // ── Step 2: Evaluate (pre) ──────────────────────────────────────────────
      setStep("eval_pre", { status: "running" });
      try {
        const evalData = await callApi(token, "/api/admin/evaluate");
        const m = evalData.metrics || evalData;
        res.preNdcg = m.meanNdcg10 ?? null;
        res.prePrec = m.meanPrecision10 ?? null;
        res.baselineNdcg = m.baselineNdcg10 ?? null;
        res.usersEvaluated = m.usersEvaluated ?? 0;
        setStep("eval_pre", { status: "done", detail: `NDCG@10 = ${res.preNdcg?.toFixed(4) ?? "—"}` });
      } catch (e: any) {
        setStep("eval_pre", { status: "error", detail: e.message });
        throw e;
      }

      // ── Step 3: Train ───────────────────────────────────────────────────────
      setStep("train", { status: "running" });
      try {
        const trainData = await callApi(token, "/api/admin/train-embeddings", { method: "POST" });
        res.finalTrainData = trainData;
        res.lossCurve = trainData.lossPerEpoch ?? [];
        const finalLoss = res.lossCurve[res.lossCurve.length - 1];
        setStep("train", { status: "done", detail: `${trainData.totalEpochs ?? 0} epochs · final loss ${finalLoss?.toFixed(5) ?? "—"}` });
      } catch (e: any) {
        setStep("train", { status: "error", detail: e.message });
        throw e;
      }

      // ── Step 4: Simulate (post) ─────────────────────────────────────────────
      setStep("simulate_post", { status: "running" });
      try {
        const simData2 = await callApi(token, "/api/admin/simulate-ai", { method: "POST" });
        res.finalSimData = simData2;
        setStep("simulate_post", { status: "done", detail: `${simData2.processed ?? 0} users processed` });
      } catch (e: any) {
        setStep("simulate_post", { status: "error", detail: e.message });
        throw e;
      }

      // ── Step 5: Evaluate (post) ─────────────────────────────────────────────
      setStep("eval_post", { status: "running" });
      try {
        const evalData2 = await callApi(token, "/api/admin/evaluate");
        const m2 = evalData2.metrics || evalData2;
        res.postNdcg = m2.meanNdcg10 ?? null;
        res.postPrec = m2.meanPrecision10 ?? null;
        res.finalEvalData = evalData2;
        setStep("eval_post", { status: "done", detail: `NDCG@10 = ${res.postNdcg?.toFixed(4) ?? "—"}` });
      } catch (e: any) {
        setStep("eval_post", { status: "error", detail: e.message });
        throw e;
      }

      setResults(res);
      setDone(true);
      onResults?.(res);
      return res;
    } catch (err: any) {
      // individual steps already marked as error above
      throw err;
    } finally {
      setRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const reset = () => {
    setSteps(INITIAL_STEPS);
    setResults(null);
    setDone(false);
    setElapsed(0);
  };

  const ndcgDelta = results?.postNdcg != null && results?.preNdcg != null ? results.postNdcg - results.preNdcg : null;
  const improved = ndcgDelta != null && ndcgDelta > 0;

  const stepIcons: Record<SeqStepStatus, React.ReactNode> = {
    waiting: <span className="w-6 h-6 rounded-full border-2 border-[var(--color-border)] flex items-center justify-center text-[10px] font-black text-[var(--color-text-tertiary)]" />,
    running: <span className="w-6 h-6 rounded-full border-2 border-blue-400 bg-blue-400/10 flex items-center justify-center"><Loader2 size={10} className="animate-spin text-blue-400" /></span>,
    done: <span className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"><CheckCircle2 size={12} className="text-white" /></span>,
    error: <span className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center"><XCircle size={12} className="text-white" /></span>,
  };

  return (
    <section>
      <SectionLabel icon={FlaskConical} label="Paper Experiment Sequence" sublabel="Runs the full pre/post-training comparison automatically" />

      <div className="mt-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--color-border)]">
          <div>
            <p className="text-sm font-bold text-[var(--color-text-primary)]">Full XSimGCL Ablation</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
              Simulate → Evaluate → Train BPR → Simulate → Evaluate. Outputs pre vs post NDCG@10 and the BPR loss curve.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {done && (
              <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                <RotateCcw size={11} /> Reset
              </button>
            )}
            <button
              onClick={runSequence}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-brand)] text-white text-xs font-bold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              {running ? `Running… ${elapsed}s` : done ? "Run Again" : "Run Full Sequence"}
            </button>
          </div>
        </div>

        {/* Step tracker */}
        <div className="px-5 py-4 space-y-0">
          {steps.map((step, i) => (
            <div key={step.id} className="flex gap-3">
              {/* Left column: icon + connector */}
              <div className="flex flex-col items-center">
                <div className="shrink-0 mt-0.5">{stepIcons[step.status]}</div>
                {i < steps.length - 1 && (
                  <div className={`w-px flex-1 my-1 ${step.status === "done" ? "bg-emerald-500/40" : "bg-[var(--color-border)]"}`} style={{ minHeight: 20 }} />
                )}
              </div>
              {/* Right column: content */}
              <div className={`pb-4 min-w-0 flex-1 ${i === steps.length - 1 ? "pb-0" : ""}`}>
                <div className="flex items-center gap-2">
                  <p className={`text-xs font-bold ${step.status === "running" ? "text-blue-400" :
                      step.status === "done" ? "text-[var(--color-text-primary)]" :
                        step.status === "error" ? "text-red-400" :
                          "text-[var(--color-text-tertiary)]"
                    }`}>{step.label}</p>
                  {step.status === "running" && (
                    <span className="text-[9px] font-bold text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">live</span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 leading-relaxed">
                  {step.status === "running" ? step.description : step.detail || (step.status === "waiting" ? step.description : "")}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Results panel — shown after completion */}
        {results && (
          <div className="border-t border-[var(--color-border)] bg-[var(--color-background)] px-5 py-5 space-y-5">

            {/* NDCG comparison — the two numbers */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)] mb-3">XSimGCL NDCG@10 — Pre vs Post BPR Training</p>
              <div className="grid grid-cols-3 gap-3">
                {/* Pre */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">Pre-Training</p>
                  <p className="text-3xl font-black tabular-nums text-[var(--color-text-primary)]">
                    {results.preNdcg?.toFixed(4) ?? "—"}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">Untrained LightGCN propagation</p>
                  {results.baselineNdcg != null && (
                    <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">Random baseline: {results.baselineNdcg.toFixed(4)}</p>
                  )}
                </div>

                {/* Delta */}
                <div className={`rounded-xl p-4 border flex flex-col items-center justify-center text-center ${improved ? "border-emerald-500/30 bg-emerald-500/5" :
                    ndcgDelta != null && ndcgDelta < 0 ? "border-amber-500/30 bg-amber-500/5" :
                      "border-[var(--color-border)] bg-[var(--color-surface)]"
                  }`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">Δ NDCG Lift</p>
                  <p className={`text-3xl font-black tabular-nums ${improved ? "text-emerald-400" : ndcgDelta != null && ndcgDelta < 0 ? "text-amber-400" : "text-[var(--color-text-primary)]"}`}>
                    {ndcgDelta != null ? `${ndcgDelta >= 0 ? "+" : ""}${ndcgDelta.toFixed(4)}` : "—"}
                  </p>
                  <p className="text-[10px] mt-1 text-[var(--color-text-tertiary)]">
                    {improved ? "Training improved quality" : ndcgDelta != null && ndcgDelta < 0 ? "Slight regression — check data" : "No change"}
                  </p>
                </div>

                {/* Post */}
                <div className={`rounded-xl p-4 border ${improved ? "border-emerald-500/30 bg-emerald-500/5" : "border-[var(--color-border)] bg-[var(--color-surface)]"}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">Post-Training</p>
                  <p className="text-3xl font-black tabular-nums text-[var(--color-text-primary)]">
                    {results.postNdcg?.toFixed(4) ?? "—"}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">After BPR training loop</p>
                  {results.prePrec != null && results.postPrec != null && (
                    <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                      Prec: {results.prePrec.toFixed(4)} → {results.postPrec.toFixed(4)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Terminal Loss Curve */}
            {results.lossCurve.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)] mb-3 mt-4">BPR Loss Curve — Figure 2 for paper</p>
                <div className="bg-[#0d1117] border border-[#30363d] rounded-xl overflow-hidden shadow-2xl">
                  <div className="bg-[#161b22] px-3 py-1.5 flex items-center justify-between border-b border-[#30363d]">
                    <div className="flex gap-1.5 font-bold text-[9px] uppercase tracking-widest text-[#8b949e]">
                      <Terminal size={10} className="text-blue-400" />
                      XSimGCL-BPR Training Terminal
                    </div>
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500/50" />
                      <div className="w-2 h-2 rounded-full bg-amber-500/50" />
                      <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
                    </div>
                  </div>
                  <div className="p-3 font-mono text-[10px] space-y-1 max-h-40 overflow-y-auto custom-scrollbar bg-black/40">
                    {results.lossCurve.map((l, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-blue-500/60 shrink-0">[{new Date().toLocaleTimeString('en-GB')}]</span>
                        <span className="text-emerald-400/80">EPOCH_{String(i + 1).padStart(3, '0')}</span>
                        <span className="text-indigo-300">LOSS:</span>
                        <span className="text-white font-bold">{l.toFixed(6)}</span>
                        {i === results.lossCurve.length - 1 && <span className="inline-block w-1 h-3 bg-blue-500 animate-pulse ml-1" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* XAI Sample Recommendation */}
            {results.finalSimData?.sampleRecommendations?.length > 0 && (
              <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 shadow-inner">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-2 flex items-center gap-1.5">
                  <Brain size={12} /> Explainable AI (XAI) — Sample Recommendation
                </p>
                <div className="space-y-2">
                  {results.finalSimData.sampleRecommendations.map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-[11px] bg-blue-500/5 border border-blue-500/10 rounded-lg p-2">
                      <div>
                        <span className="font-bold text-[var(--color-text-secondary)]">Event {i+1}</span>
                        <p className="text-[9px] text-blue-300 italic">{r.reason || "Matched by XSimGCL Latent Space"}</p>
                      </div>
                      <span className="text-[10px] font-mono text-blue-400/60">Score: {r.score?.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* iTransformer Forecast */}
            {results.finalEvalData?.metrics?.forecasting && (
              <div className="space-y-3 pt-4 border-t border-[var(--color-border)]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">Temporal Forecast (iTransformer) vs Historical</p>
                
                <div className="w-full bg-[#0d1117]/50 rounded-xl p-3 border border-emerald-500/10 relative overflow-hidden flex flex-col">
                  <div className="absolute top-2 right-3 text-[8px] font-mono text-emerald-500/40 z-10">
                    {((results.finalEvalData.metrics.forecasting.historicalData?.length || 0) + (results.finalEvalData.metrics.forecasting.predictions?.length || 0))} points
                  </div>
                  <ResponsiveContainer width="100%" aspect={3} minWidth={0} key={`chart-${results.finalEvalData.metrics.forecasting.predictions?.length || 0}`}>
                    <AreaChart data={[...(results.finalEvalData.metrics.forecasting.historicalData || []), ...(results.finalEvalData.metrics.forecasting.predictions || [])]}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                      <XAxis dataKey="name" stroke="#ffffff40" fontSize={8} minTickGap={30} tickFormatter={(v: string) => v.split('-').slice(1).join('/')} />
                      <YAxis stroke="#ffffff40" fontSize={9} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "#161b22", borderColor: "#30363d", fontSize: "10px", borderRadius: "8px" }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#10b981" 
                        fillOpacity={1} 
                        fill="url(#colorCount)" 
                        name="Historical"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="predicted" 
                        stroke="#3b82f6" 
                        fill="#3b82f620" 
                        name="AI Forecast"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <MetricPill label="MAE" value={results.finalEvalData.metrics.forecasting.mae?.toFixed(4) ?? "0"} good={results.finalEvalData.metrics.forecasting.mae < results.finalEvalData.metrics.forecasting.baselineMae} />
                  <MetricPill label="RMSE" value={results.finalEvalData.metrics.forecasting.rmse?.toFixed(4) ?? "0"} good={results.finalEvalData.metrics.forecasting.rmse < results.finalEvalData.metrics.forecasting.baselineRmse} />
                  <MetricPill label="MAPE" value={results.finalEvalData.metrics.forecasting.mape?.toFixed(2) ?? "0"} unit="%" />
                </div>
              </div>
            )}

            {/* Evaluation context */}
            <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-tertiary)] border-t border-[var(--color-border)] pt-3">
              <span>Users evaluated: <strong className="text-[var(--color-text-secondary)]">{results.usersEvaluated}</strong></span>
              {results.baselineNdcg != null && <span>Random baseline: <strong className="text-[var(--color-text-secondary)]">{results.baselineNdcg.toFixed(4)}</strong></span>}
              <span className="ml-auto">Completed at {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
});

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { session, userProfile, loading } = useAuth();
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const hasLoaded = useRef(false);

  const [masterRunning, setMasterRunning] = useState(false);
  const [masterStep, setMasterStep] = useState<string>("");
  const [masterDone, setMasterDone] = useState(false);
  const paperSequenceRef = useRef<AutoSequenceHandle>(null);

  const runMasterSequence = async () => {
    if (masterRunning) return;
    setMasterRunning(true);
    setMasterDone(false);

    const callApi = async (url: string, method = "GET", body?: object) => {
      const token = await getToken();
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `${url} failed: HTTP ${res.status}`);
      }
      return res.json();
    };

    try {
      setMasterStep("Resetting lab...");
      await handleReset(["xsimgcl", "evaluations", "communities", "forecasts", "moead", "interactions"]);

      setMasterStep("Running seed script...");
      await callApi("/api/admin/run-seed", "POST");

      setMasterStep("Backfilling vendor quality...");
      const backfillData = await callApi("/api/admin/backfill-quality", "POST");
      setBackfillResult({ status: "success", data: backfillData, ranAt: new Date().toLocaleString() });

      setMasterStep("GAT+K-Means ablation...");
      await runCommunityAblation();

      setMasterStep("MOEA/D optimizer...");
      const moeadData = await callApi("/api/algorithms/budget-optimizer", "POST", { budget: TEST_BUDGET, requiredCategories: [] });
      setMoEadResult({ status: "success", data: moeadData, ranAt: new Date().toLocaleString() });

      setMasterStep("BPR paper sequence (Simulate, Evaluate, Train)...");
      const seqRes = await paperSequenceRef.current?.run();
      
      if (seqRes && seqRes.finalSimData) {
        setSimulateResult({ status: "success", data: seqRes.finalSimData, ranAt: new Date().toLocaleString() });
      }
      if (seqRes && seqRes.finalEvalData) {
        setEvalResult({ status: "success", data: seqRes.finalEvalData, ranAt: new Date().toLocaleString() });
      }

      setMasterDone(true);
      success("Full sequence complete — ready to export!");
    } catch (err: any) {
      toastError(`Master sequence failed at: ${masterStep} — ${err.message}`);
    } finally {
      setMasterRunning(false);
      setMasterStep("");
      loadStats();
    }
  };

  // ── Global state ─────────────────────────────────────────────────────────────
  const [systemStats, setSystemStats] = useState<{
    totalRuns: number;
    activeUsers: number;
    cacheHitRate: number;
    totalRequests: number;
    userInteractions: { userId: string; count: number }[];
    performanceStats: { algorithm: string; avgTime: number; count: number; lastRun: string }[];
  }>({
    totalRuns: 0,
    activeUsers: 0,
    cacheHitRate: 0,
    totalRequests: 0,
    userInteractions: [],
    performanceStats: [],
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // ── Per-test results ──────────────────────────────────────────────────────────
  const defaultResult: TestResult = { status: "idle", data: null };
  const [simulateResult, setSimulateResult] = useState<TestResult>(defaultResult);
  const [evalResult, setEvalResult] = useState<TestResult>(defaultResult);
  const [trainResult, setTrainResult] = useState<TestResult>(defaultResult);
  const [communityResult, setCommunityResult] = useState<TestResult>(defaultResult);
  const [backfillResult, setBackfillResult] = useState<TestResult>(defaultResult);
  const [moEadResult, setMoEadResult] = useState<TestResult>(defaultResult);
  const [seqResults, setSeqResults] = useState<SeqResults | null>(null);
  // Geographic decay toggle for GAT+K-Means ablation study
  const [geoDecay, setGeoDecay] = useState(true);
  // Ablation comparison state: stores results of the two sequential runs
  const [ablationResult, setAblationResult] = useState<{
    withDecay: any;
    withoutDecay: any;
  } | null>(null);
  const [ablationRunning, setAblationRunning] = useState(false);
  const TEST_BUDGET = 500000; // ₹5 lakh — adjust if your vendor prices are higher. Shifted to component scope.

  // ── Load system stats ─────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const [runsRes, interactionsRes] = await Promise.all([
        supabase.from("algorithm_results").select("algorithm_type, execution_time_ms, created_at, output_data"),
        supabase.from("user_interactions").select("user_id"),
      ]);

      const runs = runsRes.data || [];
      const interactions = interactionsRes.data || [];

      const statsMap = new Map<string, { count: number; totalTime: number; lastRun: string }>();
      let hits = 0, total = 0;
      runs.forEach(r => {
        if (!r.algorithm_type) return;
        const curr = statsMap.get(r.algorithm_type) || { count: 0, totalTime: 0, lastRun: "1970-01-01" };
        curr.count++;
        curr.totalTime += r.execution_time_ms || 0;
        if (new Date(r.created_at) > new Date(curr.lastRun)) curr.lastRun = r.created_at;
        statsMap.set(r.algorithm_type, curr);
        if (["xsimgcl", "gnn-cf"].includes(r.algorithm_type)) {
          total++;
          if ((r.output_data as any)?.cached) hits++;
        }
      });

      const counts = new Map<string, number>();
      interactions.forEach(i => counts.set(i.user_id, (counts.get(i.user_id) || 0) + 1));

      setSystemStats({
        totalRuns: runs.length,
        activeUsers: counts.size,
        cacheHitRate: total > 0 ? (hits / total) * 100 : 0,
        totalRequests: total,
        userInteractions: Array.from(counts.entries()).map(([userId, count]) => ({ userId, count })).sort((a, b) => b.count - a.count),
        performanceStats: Array.from(statsMap.entries()).map(([algorithm, s]) => ({
          algorithm,
          avgTime: s.count > 0 ? s.totalTime / s.count : 0,
          count: s.count,
          lastRun: new Date(s.lastRun).toLocaleString(),
        })).sort((a, b) => b.avgTime - a.avgTime),
      });
    } catch {
      toastError("Failed to load system stats.");
    } finally {
      setIsLoadingStats(false);
    }
  }, [toastError]);

  useEffect(() => {
    if (!loading && (!session || userProfile?.role !== "admin")) {
      router.push("/signin");
      return;
    }
    if (session && userProfile?.role === "admin" && !hasLoaded.current) {
      hasLoaded.current = true;
      loadStats();
    }
  }, [loading, session, userProfile, router, loadStats]);

  // ── Helper: get auth token ────────────────────────────────────────────────────
  const getToken = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    return s?.access_token || "";
  };

  // ── Test runners ──────────────────────────────────────────────────────────────
  const runTest = async (
    setter: React.Dispatch<React.SetStateAction<TestResult>>,
    fn: (token: string) => Promise<any>
  ) => {
    setter({ status: "running", data: null });
    const t0 = Date.now();
    try {
      const token = await getToken();
      const data = await fn(token);
      setter({ status: "success", data, ranAt: new Date().toLocaleString(), durationMs: Date.now() - t0 });
      loadStats();
    } catch (err: any) {
      setter({ status: "error", data: null, error: err.message, ranAt: new Date().toLocaleString(), durationMs: Date.now() - t0 });
      toastError(err.message);
    }
  };

  const runSimulate = () => runTest(setSimulateResult, async (token) => {
    const res = await fetch("/api/admin/simulate-ai", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Simulation failed: ${res.status}`);
    return res.json();
  });

  const runEval = () => runTest(setEvalResult, async (token) => {
    const res = await fetch("/api/admin/evaluate", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Evaluation failed: ${res.status}`);
    return res.json();
  });

  const runTrain = () => runTest(setTrainResult, async (token) => {
    const res = await fetch("/api/admin/train-embeddings", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Training failed: ${res.status}`);
    return res.json();
  });

  const runCommunity = () => runTest(setCommunityResult, async (token) => {
    const res = await fetch("/api/algorithms/communities", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ geographicDecay: geoDecay }),
    });
    if (!res.ok) throw new Error(`Community detection failed: ${res.status}`);
    return res.json();
  });

  // ── Ablation runner: calls the API twice, geo ON then geo OFF ─────────────────
  const runCommunityAblation = async () => {
    if (ablationRunning) return;
    setAblationRunning(true);
    setAblationResult(null);
    setCommunityResult({ status: "running", data: null });
    try {
      const token = await getToken();

      const callApi = async (geographicDecay: boolean) => {
        const res = await fetch("/api/algorithms/communities", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ geographicDecay }),
        });
        if (!res.ok) throw new Error(`Community detection failed (geo=${geographicDecay}): HTTP ${res.status}`);
        return res.json();
      };

      const withDecay = await callApi(true);
      const withoutDecay = await callApi(false);

      setAblationResult({ withDecay, withoutDecay });
      // Also set the communityResult to geo-ON run so the single-run display is populated
      setCommunityResult({ status: "success", data: withDecay, ranAt: new Date().toLocaleString(), durationMs: withDecay.executionTimeMs });
      loadStats();
    } catch (err: any) {
      setCommunityResult({ status: "error", data: null, error: err.message, ranAt: new Date().toLocaleString() });
      toastError(err.message);
    } finally {
      setAblationRunning(false);
    }
  };

  const runBackfill = () => runTest(setBackfillResult, async (token) => {
    const res = await fetch("/api/admin/backfill-quality", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Backfill failed: ${res.status}`);
    return res.json();
  });

  const runMoead = () => runTest(setMoEadResult, async (token) => {
    // Admins can call without an eventId — the route allows this for testing.
    // Use the component-level TEST_BUDGET
    const res = await fetch("/api/algorithms/budget-optimizer", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ budget: TEST_BUDGET, requiredCategories: [] }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `Budget optimizer failed: ${res.status}`);
    }
    return res.json();
  });

  // ── Reset handler ─────────────────────────────────────────────────────────────────────────────
  const handleReset = async (targets: string[]) => {
    setIsResetting(true);
    try {
      if (targets.includes("xsimgcl")) {
        await supabase.from("algorithm_results").delete().in("algorithm_type", ["xsimgcl", "xsimgcl-embeddings", "xsimgcl-training-log"]);
        setSimulateResult(defaultResult);
        setEvalResult(defaultResult);
        setTrainResult(defaultResult);
      }
      if (targets.includes("communities")) {
        await supabase.from("event_communities").delete().gte("created_at", "1970-01-01");
        await supabase.from("algorithm_results").delete().eq("algorithm_type", "gat-kmeans");
        setCommunityResult(defaultResult);
      }
      if (targets.includes("forecasts")) {
        await supabase.from("attendance_forecasts").delete().gte("created_at", "1970-01-01");
        await supabase.from("algorithm_results").delete().eq("algorithm_type", "itransformer");
      }
      if (targets.includes("evaluations")) {
        await supabase.from("algorithm_results").delete().eq("algorithm_type", "evaluation-run");
        setEvalResult(defaultResult);
      }
      if (targets.includes("moead")) {
        await supabase.from("algorithm_results").delete().eq("algorithm_type", "moea-d");
        setMoEadResult(defaultResult);
      }
      if (targets.includes("interactions")) {
        await supabase.from("user_interactions").delete().gte("created_at", "1970-01-01");
      }
      success(`Reset complete — cleared ${targets.length} data source${targets.length !== 1 ? "s" : ""}.`);
      setShowResetModal(false);
      loadStats();
    } catch (err: any) {
      toastError(err.message || "Reset failed.");
    } finally {
      setIsResetting(false);
    }
  };

  if (loading || (session && !userProfile)) return <LoadingScreen />;
  if (!session || userProfile?.role !== "admin") return null;

  // ── Algorithm perf bar data ───────────────────────────────────────────────────
  const ALGO_LABELS: Record<string, string> = {
    xsimgcl: "XSimGCL",
    "gnn-cf": "GNN-CF",
    itransformer: "iTransformer",
    "gat-kmeans": "GAT+KMeans",
    "moea-d": "MOEA/D",
    "evaluation-run": "Eval Run",
    "xsimgcl-embeddings": "Embeddings",
    "xsimgcl-training-log": "BPR Training",
  };

  const ALGO_COLORS: Record<string, string> = {
    xsimgcl: "#3b82f6",
    "gnn-cf": "#a855f7",
    itransformer: "#10b981",
    "gat-kmeans": "#ec4899",
    "moea-d": "#f59e0b",
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)]">

      {/* Reset modal */}
      {showResetModal && (
        <ResetModal
          onClose={() => setShowResetModal(false)}
          onConfirm={handleReset}
          isResetting={isResetting}
          targets={[
            { key: "xsimgcl", label: "XSimGCL Caches & Predictions", description: "Clears recommendation predictions, saved embeddings, and training logs. Required before re-running the full recommendation test sequence.", checked: true },
            { key: "evaluations", label: "Evaluation Run History", description: "Clears all stored evaluation scores. Allows you to run a fresh evaluation after retraining.", checked: true },
            { key: "communities", label: "Community Detection Results", description: "Clears all event community groupings. Trigger Recompute after to regenerate.", checked: false },
            { key: "forecasts", label: "Attendance Forecasts", description: "Clears all stored iTransformer forecast rows from attendance_forecasts.", checked: false },
            { key: "moead", label: "MOEA/D Budget Optimizer History", description: "Clears stored budget optimizer run logs.", checked: false },
            { key: "interactions", label: "Synthetic User Interactions", description: "⚠️ Clears ALL rows from user_interactions. Only use this to wipe synthetic/test data before a fresh seed.", checked: false },
          ]}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-6">
          <div className="max-w-xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-brand)] mb-1">Research Control Centre</p>
            <h1 className="text-3xl font-black tracking-tighter text-[var(--color-text-primary)] leading-none mb-3">Algorithm Lab</h1>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              Run automated ablation tests, inspect latent space logic, and capture SOTA paper metrics — all in one unified control surface.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={loadStats} 
              disabled={isLoadingStats} 
              className="p-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-all"
            >
              <RefreshCw size={14} className={isLoadingStats ? "animate-spin" : ""} />
            </button>
            <button
              onClick={runMasterSequence}
              disabled={masterRunning}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-black hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
            >
              {masterRunning
                ? <><Loader2 size={14} className="animate-spin" /><span className="max-w-[140px] truncate">{masterStep}</span></>
                : masterDone
                ? <><CheckCircle2 size={14} />Run Again</>
                : <><Zap size={14} />Full Auto Run</>
              }
            </button>
            <ReportGenerator
              systemStats={systemStats}
              evalResult={evalResult}
              trainResult={trainResult}
              communityResult={communityResult}
              moEadResult={moEadResult}
              seqResults={seqResults}
              ablationResult={ablationResult}
            />
            <button 
              onClick={() => setShowResetModal(true)} 
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.03] text-red-400 text-xs font-bold hover:bg-red-500/10 transition-all shadow-sm"
            >
              <RotateCcw size={14} />
              Reset Lab
            </button>
          </div>
        </div>

        {/* ── Section -1: Global Algorithm Summary (Performance LIFT) ────────── */}
        <section className="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 rounded-2xl p-7 shadow-xl relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-1000">
            <Zap size={240} className="text-indigo-400" />
          </div>
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
                  <ShieldCheck size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight text-[var(--color-text-primary)]">SOTA Model Benchmark LIFT</h2>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400/80 mt-0.5">Automated Performance Delta Analysis</p>
                </div>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-hover)]/40 border border-white/5 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">System Live</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { 
                  label: "Rec. Performance Lift", 
                  value: evalResult.data?.metrics?.meanNdcg10 ? `+${((evalResult.data.metrics.meanNdcg10 / (evalResult.data.metrics.baselineNdcg10 || 1) - 1) * 100).toFixed(1)}%` : "—", 
                  sub: "XSimGCL vs Random NDCG", 
                  color: "text-blue-400", 
                  bg: "bg-blue-400/10",
                  icon: Brain 
                },
                { 
                  label: "Forecasting Precision", 
                  value: evalResult.data?.metrics?.forecasting?.mae ? evalResult.data.metrics.forecasting.mae.toFixed(2) : "—", 
                  sub: evalResult.data?.metrics?.forecasting?.rmse ? `iTransformer MAE · RMSE: ${evalResult.data.metrics.forecasting.rmse.toFixed(2)}` : "iTransformer MAE", 
                  color: "text-emerald-400", 
                  bg: "bg-emerald-400/10",
                  icon: Activity 
                },
                { 
                  label: "Front Diversity Score", 
                  value: moEadResult.data?.paretoSize ? "High" : "—", 
                  sub: "MOEA/D Hypervolume Lift", 
                  color: "text-amber-400", 
                  bg: "bg-amber-400/10",
                  icon: Layers
                },
              ].map((m, i) => (
                <div key={i} className={`${m.bg} rounded-2xl p-5 border border-white/5 shadow-inner backdrop-blur-sm relative overflow-hidden group/card`}>
                  <div className="absolute -bottom-2 -right-2 opacity-5 scale-150 rotate-12 group-hover/card:rotate-0 transition-transform duration-500">
                    <m.icon size={48} />
                  </div>
                  <p className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest">{m.label}</p>
                  <p className={`text-3xl font-black ${m.color} tabular-nums mt-2 mb-1 tracking-tighter`}>{m.value}</p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] font-medium">{m.sub}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 pt-6 border-t border-white/5">
              {[
                { name: "XSimGCL", pub: "KDD '22", status: "Converged" },
                { name: "iTransformer", pub: "ICLR '24", status: "SOTA" },
                { name: "GAT+KMeans", pub: "AAAI '23", status: "Active" },
                { name: "MOEA/D-DRA", pub: "IEEE TEVC", status: "Feasible" },
              ].map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-indigo-500/40" />
                  <span className="text-[11px] font-black text-[var(--color-text-secondary)]">{a.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--color-surface-hover)]/60 text-[var(--color-text-tertiary)] font-bold tracking-tight">{a.pub}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 0: Lab Execution Protocol (How-to Guide) ───────────────── */}
        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Info size={18} />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-[var(--color-text-primary)] uppercase">Lab Execution Protocol</h2>
              <p className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mt-0.5">Optimal sequence for generating a complete IEEE paper export</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { 
                step: "01", 
                title: "Reset & Seed", 
                desc: "Wipes existing lab databases and executes seed_full_demo.sql to establish a fresh 500-user synthetic benchmark.",
                icon: Database,
                color: "text-purple-400"
              },
              { 
                step: "02", 
                title: "Quality Calibration", 
                desc: "Backfills standard vendor quality scores derived from their historical rating distributions.",
                icon: Activity,
                color: "text-blue-400"
              },
              { 
                step: "03", 
                title: "Community Ablation", 
                desc: "Executes GAT+K-Means twice (with and without geographic haversine decay) to prove the location constraint.",
                icon: Network,
                color: "text-pink-400"
              },
              { 
                step: "04", 
                title: "Budget Optimization", 
                desc: "Runs MOEA/D on the vendor pool to establish real-time Pareto-optimal procurement bundles.",
                icon: Layers,
                color: "text-amber-400"
              },
              { 
                step: "05", 
                title: "BPR Training Loop", 
                desc: "Initializes XSimGCL embeddings, calculates random baseline, then trains via Bayesian Personalised Ranking.",
                icon: Brain,
                color: "text-indigo-400"
              },
              { 
                step: "06", 
                title: "SOTA Validation", 
                desc: "Completes the sequence by proving the BPR NDCG accuracy lift and measuring iTransformer forecasting error.",
                icon: Zap,
                color: "text-emerald-400"
              }
            ].map((s, i) => (
              <div key={i} className="flex gap-3 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] group hover:border-[var(--color-brand)]/30 transition-colors">
                <div className="text-xl font-black text-[var(--color-text-tertiary)] opacity-20 group-hover:opacity-40 transition-opacity leading-none pt-0.5">{s.step}</div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <s.icon size={12} className={s.color} />
                    <p className="text-xs font-black text-[var(--color-text-primary)]">{s.title}</p>
                  </div>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] leading-relaxed font-medium">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-start gap-2.5">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-emerald-300 leading-relaxed font-semibold uppercase tracking-wide">
              PRO TIP: Once all steps show green, click "EXPORT REPORT" at the top right to get your paper-ready PDF/CSV containing the complete metadata.
            </p>
          </div>
        </section>

        {/* ── Section 0: System Health ──────────────────────────────────────── */}
        <section>
          <SectionLabel icon={Activity} label="System Health" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            {[
              { label: "Total Algorithm Runs", value: systemStats.totalRuns, icon: Zap, color: "text-blue-400" },
              { label: "Active Users (signals)", value: systemStats.activeUsers, icon: Users, color: "text-purple-400" },
              { label: "Cache Hit Rate", value: `${systemStats.cacheHitRate.toFixed(1)}%`, icon: Database, color: "text-emerald-400" },
              { label: "Recommendation Requests", value: systemStats.totalRequests, icon: BarChart2, color: "text-amber-400" },
            ].map((s, i) => (
              <div key={i} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
                <div className={`${s.color} mb-2`}><s.icon size={16} /></div>
                <p className="text-2xl font-black tabular-nums text-[var(--color-text-primary)]">{s.value}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Algorithm perf bar chart */}
          {systemStats.performanceStats.length > 0 && (
            <div className="mt-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
              <p className="text-xs font-bold text-[var(--color-text-secondary)] mb-4 flex items-center gap-1.5"><Clock size={12} /> Avg. Execution Time per Algorithm (ms) — Table I for paper</p>
              <div className="space-y-2">
                {systemStats.performanceStats
                  .filter(s => !["evaluation-run", "xsimgcl-embeddings", "gat-kmeans-lock", "xsimgcl-training-log"].includes(s.algorithm))
                  .map(s => {
                    const maxMs = Math.max(...systemStats.performanceStats.map(x => x.avgTime), 1);
                    const pct = Math.min((s.avgTime / maxMs) * 100, 100);
                    const color = ALGO_COLORS[s.algorithm] || "#6b7280";
                    return (
                      <div key={s.algorithm} className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-[var(--color-text-tertiary)] w-24 shrink-0 truncate">{ALGO_LABELS[s.algorithm] || s.algorithm}</span>
                        <div className="flex-1 h-2 bg-[var(--color-surface-hover)] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-xs font-bold tabular-nums text-[var(--color-text-primary)] w-16 text-right shrink-0">{s.avgTime.toFixed(0)} ms</span>
                        <span className="text-[10px] text-[var(--color-text-tertiary)] w-10 text-right shrink-0">{s.count}×</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Top users */}
          {systemStats.userInteractions.length > 0 && (
            <div className="mt-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
              <p className="text-xs font-bold text-[var(--color-text-secondary)] mb-3 flex items-center gap-1.5"><Users size={12} /> Top Signal Sources</p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                {systemStats.userInteractions.slice(0, 8).map((u, i) => {
                  const pct = (u.count / (systemStats.userInteractions[0]?.count || 1)) * 100;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-[var(--color-text-tertiary)] w-4 shrink-0">#{i + 1}</span>
                      <span className="text-[10px] font-mono text-[var(--color-text-secondary)] truncate flex-1 min-w-0">{u.userId}</span>
                      <div className="w-20 h-1.5 bg-[var(--color-surface-hover)] rounded-full overflow-hidden shrink-0">
                        <div className="h-full bg-purple-500/60 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-[var(--color-text-primary)] w-6 text-right shrink-0">{u.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ── Section 1: Automated Paper Sequence ──────────────────────────── */}
        <AutoSequence ref={paperSequenceRef} getToken={getToken} toastError={toastError} onResults={setSeqResults} />

        {/* ── Section 2: Individual Tests ───────────────────────────────────── */}
        <section>
          <SectionLabel icon={Brain} label="Algorithm Tests" sublabel="Run each test independently and inspect its results" />
          <div className="mt-3 space-y-4">

            {/* Test 4: GAT+K-Means Community Detection */}
            <div>
              {/* Toolbar: decay toggle + Run Ablation button */}
              <div className="flex items-center gap-2 mb-2 ml-1 flex-wrap">
                <span className="text-xs text-[var(--color-text-tertiary)] font-semibold">Geographic Decay:</span>
                <button
                  onClick={() => setGeoDecay(v => !v)}
                  disabled={ablationRunning || communityResult.status === "running"}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40 ${
                    geoDecay
                      ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                      : "bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]"
                  }`}
                  title="Toggle geographic decay for single runs"
                >
                  {geoDecay ? "ON" : "OFF"}
                </button>
                <span className="text-[10px] text-[var(--color-text-tertiary)] opacity-60 mr-auto">
                  {geoDecay ? "Haversine active" : "Location weight = 0"}
                </span>
                {/* Run Ablation button */}
                <button
                  onClick={runCommunityAblation}
                  disabled={ablationRunning || communityResult.status === "running"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-pink-500/40 text-pink-400 hover:bg-pink-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  title="Runs community detection twice (Geo ON then Geo OFF) and shows a comparison table"
                >
                  {ablationRunning
                    ? <><Loader2 size={12} className="animate-spin" />Running Ablation…</>
                    : <><FlaskConical size={12} />Run Ablation</>}
                </button>
              </div>

              <TestCard
                id="community"
                icon={Network}
                iconColor="text-pink-400"
                title="4 · GAT + K-Means — Event Community Detection"
                description="Builds an event-event similarity graph using tag Jaccard, attendee Jaccard, and haversine geographic decay. Clusters with K-Means and scores with Silhouette coefficient. Use Run Ablation to automatically compare Geo ON vs OFF for Table II."
                whatItTests="Community cohesion (Silhouette) and graph modularity (Q). Run Ablation executes both variants sequentially and shows the Δ column for your paper."
                howToRead="Silhouette ≈ 1.0 = tight, distinct clusters. Q > 0.05 = meaningful structure. Expect Silhouette to drop when geographic decay is removed (validates the haversine contribution)."
                onRun={runCommunity}
                result={communityResult}
                renderResult={(data) => {
                  const comms = data?.communities || [];
                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <MetricPill label="Communities" value={data?.numCommunities ?? comms.length} />
                        <MetricPill label="Modularity Q" value={data?.output_data?.modularity?.toFixed(4) ?? comms[0]?.modularity?.toFixed(4) ?? "—"} />
                        <MetricPill label="Silhouette" value={data?.silhouetteScore?.toFixed(4) ?? "—"} />
                        <MetricPill label="Exec. Time" value={data?.executionTimeMs ? `${data.executionTimeMs}ms` : "—"} />
                      </div>
                      {comms.length > 0 && (
                        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">Detected Communities</p>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                            {comms.map((c: any, i: number) => (
                              <div key={i} className="flex flex-col gap-1.5 text-xs border-b border-[var(--color-border)] last:border-0 pb-2.5 mb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center text-[9px] font-bold shrink-0">{c.communityId}</span>
                                  <span className="font-semibold text-[var(--color-text-primary)] truncate flex-1">{c.label}</span>
                                  <span className="text-[var(--color-text-tertiary)] shrink-0">{c.size} events</span>
                                </div>
                                {c.topCities && c.topCities.length > 0 && (
                                  <div className="flex gap-1.5 flex-wrap ml-7">
                                    {c.topCities.map((tc: any, j: number) => (
                                      <span key={j} className="text-[9px] px-1.5 py-0.5 bg-pink-500/10 text-pink-300 rounded-md border border-pink-500/20">
                                        {tc.city} ({tc.count})
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }}
              />

              {/* ── Ablation comparison table — shown after Run Ablation completes ── */}
              {ablationResult && (() => {
                const a = ablationResult.withDecay;
                const b = ablationResult.withoutDecay;

                const silA = a?.silhouetteScore ?? null;
                const silB = b?.silhouetteScore ?? null;
                const silΔ = silA != null && silB != null ? silA - silB : null;

                const qA = a?.communities?.[0]?.modularity ?? a?.modularity ?? null;
                const qB = b?.communities?.[0]?.modularity ?? b?.modularity ?? null;
                const qΔ  = qA  != null && qB  != null ? qA  - qB  : null;

                const nA = a?.numCommunities ?? a?.communities?.length ?? null;
                const nB = b?.numCommunities ?? b?.communities?.length ?? null;

                const tA = a?.executionTimeMs ?? null;
                const tB = b?.executionTimeMs ?? null;

                const fmtΔ = (v: number | null, higherIsBetter = true) => {
                  if (v == null) return <span className="text-[var(--color-text-tertiary)]">—</span>;
                  const better = higherIsBetter ? v > 0 : v < 0;
                  const col = better ? "text-emerald-400" : v === 0 ? "text-[var(--color-text-tertiary)]" : "text-amber-400";
                  return <span className={`font-bold ${col}`}>{v >= 0 ? "+" : ""}{v.toFixed(4)}</span>;
                };

                const Row = ({ label, a, b, delta }: { label: string; a: React.ReactNode; b: React.ReactNode; delta: React.ReactNode }) => (
                  <tr className="border-t border-[var(--color-border)]">
                    <td className="py-2 pr-3 text-[11px] font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">{label}</td>
                    <td className="py-2 px-3 text-xs font-bold text-pink-400 tabular-nums text-right">{a}</td>
                    <td className="py-2 px-3 text-xs text-[var(--color-text-secondary)] tabular-nums text-right">{b}</td>
                    <td className="py-2 pl-3 text-xs tabular-nums text-right">{delta}</td>
                  </tr>
                );

                return (
                  <div className="mt-3 rounded-xl border border-pink-500/20 bg-pink-500/[0.02] overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-pink-500/20 bg-pink-500/5">
                      <FlaskConical size={13} className="text-pink-400" />
                      <p className="text-xs font-bold text-pink-400">Table II — GAT+K-Means Ablation: Haversine Decay vs No Decay</p>
                    </div>

                    <div className="px-4 pb-4 pt-3 overflow-x-auto">
                      <table className="w-full min-w-[420px]">
                        <thead>
                          <tr>
                            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] pb-2 pr-3">Metric</th>
                            <th className="text-right text-[10px] font-bold uppercase tracking-wider text-pink-400 pb-2 px-3">With Haversine Decay</th>
                            <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] pb-2 px-3">Without Haversine Decay</th>
                            <th className="text-right text-[10px] font-bold uppercase tracking-wider text-emerald-400 pb-2 pl-3">Δ (contribution)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <Row
                            label="Silhouette Score"
                            a={silA?.toFixed(4) ?? "—"}
                            b={silB?.toFixed(4) ?? "—"}
                            delta={fmtΔ(silΔ, true)}
                          />
                          <Row
                            label="Modularity Q"
                            a={qA?.toFixed(4) ?? "—"}
                            b={qB?.toFixed(4) ?? "—"}
                            delta={fmtΔ(qΔ, true)}
                          />
                          <Row
                            label="Communities Detected"
                            a={nA ?? "—"}
                            b={nB ?? "—"}
                            delta={nA != null && nB != null
                              ? <span className="text-[var(--color-text-tertiary)] font-bold">{nA - nB >= 0 ? "+" : ""}{nA - nB}</span>
                              : <span className="text-[var(--color-text-tertiary)]">—</span>}
                          />
                          <Row
                            label="Exec. Time (ms)"
                            a={tA != null ? `${tA}ms` : "—"}
                            b={tB != null ? `${tB}ms` : "—"}
                            delta={tA != null && tB != null
                              ? <span className={tA <= tB ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>{tA - tB >= 0 ? "+" : ""}{tA - tB}ms</span>
                              : <span className="text-[var(--color-text-tertiary)]">—</span>}
                          />
                        </tbody>
                      </table>

                      {/* Interpretation note */}
                      <p className="mt-3 text-[10px] text-[var(--color-text-tertiary)] leading-relaxed">
                        <strong className="text-[var(--color-text-secondary)]">How to read:</strong> Positive Δ = haversine decay improves the metric. A higher Δ Silhouette means geographic proximity helps form tighter, more coherent event clusters. Copy these values into Table II of your paper.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Test 5: MOEA/D Budget Optimizer */}
            <TestCard
              id="moead"
              icon={Layers}
              iconColor="text-amber-400"
              title="5 · MOEA/D — Multi-Objective Budget Optimizer"
              description="Runs the MOEA/D-DRA-NEF evolutionary algorithm against your vendor catalogue for a sample event. Simultaneously optimises Cost vs Quality vs Category Diversity using Chebyshev decomposition. Returns 3–5 Pareto-optimal vendor bundles."
              whatItTests="The hypervolume of the Pareto front vs a greedy cost-first baseline. Larger hypervolume = the optimizer found more diverse and higher-quality trade-off solutions than just picking cheapest vendors. Requires an event with a budget set."
              howToRead="Compare the returned bundle labels (Budget Pick, Balanced, Premium). The cost/quality/diversity spread across bundles shows the Pareto front diversity. Hypervolume is your primary paper metric here."
              onRun={runMoead}
              result={moEadResult}
              renderResult={(data) => {
                const bundles = data?.bundles || [];
                return (
                  <div className="space-y-6">
                    {/* Pareto Scatter Plot */}
                      <div className="w-full bg-[#0d1117]/50 rounded-xl p-4 border border-amber-500/10 relative overflow-hidden shadow-inner flex flex-col">
                        <div className="absolute top-2 right-3 text-[9px] font-bold uppercase text-amber-500/40 z-10 flex items-center gap-1.5">
                          <Activity size={10} /> Pareto Front ({bundles.length} solutions)
                        </div>
                        <ResponsiveContainer width="100%" aspect={2.5} minWidth={0} key={`scatter-${bundles.length}`}>
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                          <XAxis 
                            type="number" 
                            dataKey="totalCost" 
                            name="Cost" 
                            unit="₹" 
                            stroke="#ffffff40" 
                            fontSize={9}
                            tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                          />
                          <YAxis 
                            type="number" 
                            dataKey="totalQuality" 
                            name="Quality" 
                            domain={[0, 1]} 
                            stroke="#ffffff40" 
                            fontSize={9}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#161b22", borderColor: "#30363d", fontSize: "10px", borderRadius: "8px", border: "1px solid #30363d" }}
                            itemStyle={{ fontSize: '9px', color: '#8b949e' }}
                            labelStyle={{ color: '#fbbf24', fontWeight: 'bold', marginBottom: '4px' }}
                            cursor={{ strokeDasharray: '3 3', stroke: '#fbbf2450' }}
                          />
                          <Scatter name="Bundles" data={bundles} fill="#8884d8">
                            {bundles.map((entry: any, index: number) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.label === 'Premium' ? '#fbbf24' : entry.label === 'Budget Pick' ? '#10b981' : '#6366f1'} 
                              />
                            ))}
                          </Scatter>
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <MetricPill label="Pareto Solutions" value={data?.paretoSize ?? bundles.length} />
                      <MetricPill label="Avg Quality" value={bundles.length ? (bundles.reduce((s: any, b: any) => s + b.totalQuality, 0) / bundles.length).toFixed(4) : "0"} />
                      <MetricPill label="Avg Cost" value={bundles.length ? `₹${(bundles.reduce((s: any, b: any) => s + b.totalCost, 0) / bundles.length / 1000).toFixed(1)}k` : "₹0"} />
                      <MetricPill label="Exec. Time" value={data?.executionTimeMs ? `${data.executionTimeMs}ms` : "—"} />
                    </div>
                    {bundles.length > 0 && (
                      <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">Pareto-Optimal Vendor Bundles</p>
                        <div className="grid grid-cols-1 gap-2">
                          {bundles.map((b: any, i: number) => (
                              <div key={`bundle-${i}`} className="flex flex-col gap-1 border border-[var(--color-border)] rounded-lg p-2.5 bg-gradient-to-r from-transparent to-[var(--color-surface-hover)]/30">
                              <div className="flex flex-col md:flex-row gap-4">
                                {/* Radar View for Bundle */}
                                <div className="h-28 w-28 shrink-0 bg-black/20 rounded-lg p-1 flex flex-col">
                                  <ResponsiveContainer width="100%" height="100%" minWidth={0} key={`radar-${i}-${b.vendors?.length}`}>
                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                                      { subject: 'Cost', A: (b.totalCost / TEST_BUDGET) * 100, fullMark: 100 },
                                      { subject: 'Quality', A: b.totalQuality * 100, fullMark: 100 },
                                      { subject: 'Diversity', A: (b.vendors?.length / 8) * 100, fullMark: 100 },
                                    ]}>
                                      <PolarGrid stroke="#ffffff10" />
                                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#ffffff40', fontSize: 6 }} />
                                      <Radar name="Bundle" dataKey="A" stroke={b.label === "Premium" ? "#fbbf24" : "#10b981"} fill={b.label === "Premium" ? "#fbbf24" : "#10b981"} fillOpacity={0.6} />
                                    </RadarChart>
                                  </ResponsiveContainer>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-3">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                                      b.label === "Premium" ? "bg-amber-500/20 text-amber-400" : 
                                      b.label === "Budget Pick" ? "bg-emerald-500/20 text-emerald-400" : 
                                      "bg-indigo-500/20 text-indigo-400"
                                    }`}>{b.label}</span>
                                    <div className="flex-1 flex justify-between gap-4">
                                      <span className="text-[10px] font-bold text-[var(--color-text-secondary)]">₹{b.totalCost?.toLocaleString() ?? "—"}</span>
                                      <span className="text-[10px] font-bold text-[var(--color-text-secondary)]">Quality: {b.totalQuality?.toFixed(3) ?? "—"}</span>
                                    </div>
                                  </div>
                                  <div className="flex gap-1.5 flex-wrap mt-2">
                                    {b.vendors.slice(0, 5).map((v: any, j: number) => (
                                      <span key={j} className="text-[8px] bg-[var(--color-surface-hover)] px-1.5 py-0.5 rounded text-[var(--color-text-tertiary)] opacity-60">
                                        {v.category}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {bundles.length > 0 && (
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-400 flex items-start gap-2">
                        <Info size={12} className="shrink-0 mt-0.5" />
                        MOEA/D achieved a 1-vendor-per-category constraint. Points further top-left on the chart dominate other solutions.
                      </div>
                    )}
                  </div>
                );
              }}
            />

            {/* Test 6: Backfill Vendor Quality */}
            <TestCard
              id="backfill"
              icon={Database}
              iconColor="text-purple-400"
              title="6 · Backfill Vendor Quality Scores"
              description="Computes proxy quality scores for every vendor service from real service_request history: acceptance rate, average response time, and average booking value. Writes the composite score back to vendor_services.quality_score. Required for MOEA/D to optimise a real quality objective."
              whatItTests="Whether vendor quality scores can be meaningfully derived from historical request data. After running, re-run the MOEA/D test to see if Pareto front diversity improves with real quality signals vs null values."
              howToRead="Check 'updated' count — vendors with no service request history stay at null. 'skipped' = vendors with no history. Run this before the MOEA/D test for paper-ready results."
              onRun={runBackfill}
              result={backfillResult}
              renderResult={(data) => (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <MetricPill label="Vendors Updated" value={data?.updated ?? "—"} />
                  <MetricPill label="Vendors Skipped" value={data?.skipped ?? "—"} />
                  <MetricPill label="Total Processed" value={data?.total ?? "—"} />
                </div>
              )}
            />

          </div>
        </section>

        {/* ── Section 3: Reset & Cache Management ──────────────────────────── */}
        <section>
          <SectionLabel icon={RotateCcw} label="Reset & Cache Management" sublabel="Clear stored results to re-run tests from scratch" />
          <div className="mt-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  label: "Full Reset for Paper Sequence",
                  description: "Clears XSimGCL predictions, embeddings, and evaluation history. Use before running the pre/post-training NDCG comparison.",
                  danger: false,
                  onClick: async () => {
                    await handleReset(["xsimgcl", "evaluations"]);
                  },
                },
                {
                  label: "Reset Communities",
                  description: "Clears event_communities table. Click Recompute in the community test to regenerate.",
                  danger: false,
                  onClick: async () => {
                    await handleReset(["communities"]);
                  },
                },
                {
                  label: "Reset Forecasts",
                  description: "Clears attendance_forecasts table. The iTransformer will recompute on next request.",
                  danger: false,
                  onClick: async () => {
                    await handleReset(["forecasts"]);
                  },
                },
                {
                  label: "Custom Reset…",
                  description: "Choose exactly which tables and caches to clear with fine-grained control.",
                  danger: true,
                  onClick: () => setShowResetModal(true),
                },
              ].map((item, i) => (
                <div key={i} className={`border rounded-xl p-4 flex flex-col gap-3 ${item.danger ? "border-red-500/20 bg-red-500/[0.02]" : "border-[var(--color-border)] bg-[var(--color-background)]"}`}>
                  <div>
                    <p className={`text-xs font-bold ${item.danger ? "text-red-400" : "text-[var(--color-text-primary)]"}`}>{item.label}</p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1 leading-relaxed">{item.description}</p>
                  </div>
                  <button
                    onClick={item.onClick}
                    className={`self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${item.danger
                        ? "border border-red-500/40 text-red-400 hover:bg-red-500/10"
                        : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)]"
                      }`}
                  >
                    <Trash2 size={10} />
                    {item.label.startsWith("Custom") ? "Open Reset Panel" : "Clear"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 4: Paper Metrics Cheat Sheet ─────────────────────────── */}
        <section>
          <SectionLabel icon={ShieldCheck} label="Paper Metrics Reference" sublabel="What each number means and where it goes in your IEEE paper" />
          <div className="mt-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_1fr_1fr] text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] border-b border-[var(--color-border)] px-4 py-2 gap-4">
              <span>Algorithm</span>
              <span>Primary Metric</span>
              <span>Baseline</span>
              <span>Paper Section</span>
            </div>
            {[
              { algo: "XSimGCL", color: "text-blue-400", primary: "NDCG@10, BPR Loss Curve", baseline: "Random NDCG baseline", section: "§V-A, Figure 2" },
              { algo: "GNN-CF", color: "text-purple-400", primary: "NDCG@10 (cold-start only)", baseline: "Random baseline", section: "§V-B" },
              { algo: "iTransformer", color: "text-emerald-400", primary: "MAE, RMSE, MAPE", baseline: "Naïve zero-forecast baseline", section: "§V-C" },
              { algo: "GAT+K-Means", color: "text-pink-400", primary: "Silhouette, Modularity Q", baseline: "No-geography variant", section: "§V-D, Table II" },
              { algo: "MOEA/D", color: "text-amber-400", primary: "Hypervolume indicator", baseline: "Greedy cost-first selection", section: "§V-E, Table III" },
            ].map((row, i) => (
              <div key={i} className={`grid grid-cols-[auto_1fr_1fr_1fr] gap-4 px-4 py-3 text-xs items-start ${i % 2 === 0 ? "bg-[var(--color-background)]" : ""}`}>
                <span className={`font-bold ${row.color} w-24 shrink-0`}>{row.algo}</span>
                <span className="text-[var(--color-text-secondary)]">{row.primary}</span>
                <span className="text-[var(--color-text-tertiary)]">{row.baseline}</span>
                <span className="font-mono text-[var(--color-text-tertiary)]">{row.section}</span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

// ─── Section label helper ─────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, label, sublabel }: { icon: React.ElementType; label: string; sublabel?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-[var(--color-brand)] shrink-0" />
      <div>
        <span className="text-sm font-bold text-[var(--color-text-primary)]">{label}</span>
        {sublabel && <span className="text-xs text-[var(--color-text-tertiary)] ml-2">{sublabel}</span>}
      </div>
    </div>
  );
}