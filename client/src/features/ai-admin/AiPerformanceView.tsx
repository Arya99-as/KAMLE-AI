import { Clock, Flame, Gauge, RefreshCw, Timer } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { fetchAiPerformanceAnalytics } from "../../services/aiAdminApi";
import type { AiPerformanceAnalytics } from "../../types/aiAdmin";
import { Badge, Button, Select, Spinner } from "../../components/ui/primitives";
import { EmptyState } from "../../components/ui/states";

export function AiPerformanceView() {
  const [performance, setPerformance] = useState<AiPerformanceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"today" | "7d" | "30d">("30d");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAiPerformanceAnalytics({ period });
      setPerformance(res.performance);
    } catch (err) {
      console.error("Failed to load performance metrics", err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading && !performance) {
    return (
      <div className="py-20 text-center">
        <Spinner />
      </div>
    );
  }

  const metrics = performance?.metrics || {
    totalRequests: 0,
    avgLatencyMs: 0,
    p50LatencyMs: 0,
    p90LatencyMs: 0,
    p95LatencyMs: 0,
    timeoutCount: 0,
    retryCount: 0,
    fallbackCount: 0,
    providerFailures: 0,
  };

  const slowestFeatures = performance?.slowestFeatures || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 card p-5 bg-white">
        <div>
          <h2 className="text-base font-bold text-ink">AI Performance & Latency Metrics</h2>
          <p className="text-xs text-muted">
            Measured execution durations, latency percentiles, and provider failure telemetry.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="h-8 text-xs font-semibold"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </Select>
          <Button variant="secondary" size="sm" onClick={() => loadData()}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </div>

      {/* Latency Percentiles Card Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-white">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Latency</span>
            <Clock size={16} className="text-blue-600" />
          </div>
          <p className="text-2xl font-black text-ink mt-2">{metrics.avgLatencyMs} ms</p>
          <p className="text-[11px] text-muted mt-1">Mean duration across {metrics.totalRequests} operations</p>
        </div>

        <div className="card p-4 bg-white">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Median (p50)</span>
            <Timer size={16} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-2">{metrics.p50LatencyMs} ms</p>
          <p className="text-[11px] text-muted mt-1">50% faster than this threshold</p>
        </div>

        <div className="card p-4 bg-white">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">90th Percentile (p90)</span>
            <Gauge size={16} className="text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-700 mt-2">{metrics.p90LatencyMs} ms</p>
          <p className="text-[11px] text-muted mt-1">Standard SLA target metric</p>
        </div>

        <div className="card p-4 bg-white">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">95th Percentile (p95)</span>
            <Flame size={16} className="text-red-600" />
          </div>
          <p className="text-2xl font-black text-red-700 mt-2">{metrics.p95LatencyMs} ms</p>
          <p className="text-[11px] text-muted mt-1">Tail latency upper bound</p>
        </div>
      </div>

      {/* Reliability & Failure Telemetry Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-slate-50 border-slate-200">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Timeout Count</span>
          <p className="text-xl font-bold text-ink mt-1">{metrics.timeoutCount}</p>
          <p className="text-[11px] text-muted mt-0.5">Threshold: 8,000 ms</p>
        </div>

        <div className="card p-4 bg-slate-50 border-slate-200">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Retry Attempts</span>
          <p className="text-xl font-bold text-ink mt-1">{metrics.retryCount}</p>
          <p className="text-[11px] text-muted mt-0.5">Model fallback retries</p>
        </div>

        <div className="card p-4 bg-slate-50 border-slate-200">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Fallbacks Used</span>
          <p className="text-xl font-bold text-amber-700 mt-1">{metrics.fallbackCount}</p>
          <p className="text-[11px] text-muted mt-0.5">Heuristic engine substitutions</p>
        </div>

        <div className="card p-4 bg-slate-50 border-slate-200">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Provider Failures</span>
          <p className="text-xl font-bold text-red-700 mt-1">{metrics.providerFailures}</p>
          <p className="text-[11px] text-muted mt-0.5">Unrecovered network/5xx events</p>
        </div>
      </div>

      {/* Slowest AI Features Ranking */}
      <div className="card p-5 bg-white space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">AI Features Ranked by Execution Time</h3>
          <Badge tone="brand">Latency Benchmark</Badge>
        </div>

        {slowestFeatures.length === 0 ? (
          <EmptyState
            title="No Performance Telemetry"
            message="No feature executions recorded in this timeframe."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-muted uppercase font-semibold border-b border-line">
                <tr>
                  <th className="py-2.5 px-3">Feature Name</th>
                  <th className="py-2.5 px-3">Total Requests</th>
                  <th className="py-2.5 px-3">Average Latency</th>
                  <th className="py-2.5 px-3">Min Latency</th>
                  <th className="py-2.5 px-3">Max Latency</th>
                  <th className="py-2.5 px-3 text-right">Failures</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {slowestFeatures.map((f, i) => (
                  <tr key={f.feature} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3 font-semibold text-ink capitalize flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 font-bold">
                        {i + 1}
                      </span>
                      {f.feature.replace(/_/g, " ")}
                    </td>
                    <td className="py-3 px-3 text-ink font-semibold">{f.requests}</td>
                    <td className="py-3 px-3 font-mono font-bold text-blue-700">{f.avgDurationMs} ms</td>
                    <td className="py-3 px-3 font-mono text-muted">{f.minDurationMs} ms</td>
                    <td className="py-3 px-3 font-mono text-muted">{f.maxDurationMs} ms</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-red-600">{f.failures}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
