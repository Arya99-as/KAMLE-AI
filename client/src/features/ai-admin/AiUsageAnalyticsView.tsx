import { useEffect, useState, useCallback } from "react";
import { fetchAiUsageAnalytics } from "../../services/aiAdminApi";
import type { AiUsageAnalytics } from "../../types/aiAdmin";
import { Button, Select, Spinner } from "../../components/ui/primitives";
import { EmptyState } from "../../components/ui/states";

export function AiUsageAnalyticsView() {
  const [analytics, setAnalytics] = useState<AiUsageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"today" | "7d" | "30d">("30d");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAiUsageAnalytics({ period });
      setAnalytics(res.analytics);
    } catch (err) {
      console.error("Failed to load usage analytics", err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading && !analytics) {
    return (
      <div className="py-20 text-center">
        <Spinner />
      </div>
    );
  }

  const byFeature = analytics?.byFeature || [];
  const byProvider = analytics?.byProvider || [];
  const byModel = analytics?.byModel || [];
  const percentiles = analytics?.latencyPercentiles || { medianMs: 0, p95Ms: 0 };

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="flex items-center justify-between card p-4 bg-white">
        <div>
          <h2 className="text-base font-bold text-ink">AI Usage Analytics</h2>
          <p className="text-xs text-muted">Feature breakdowns, token consumption, and latency distributions</p>
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
            Refresh
          </Button>
        </div>
      </div>

      {/* Latency Percentile Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-white">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Median Latency (p50)</span>
          <p className="text-2xl font-black text-ink mt-1">{percentiles.medianMs} ms</p>
          <p className="text-[11px] text-muted mt-1">50% of requests resolved faster</p>
        </div>
        <div className="card p-4 bg-white">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">95th Percentile (p95)</span>
          <p className="text-2xl font-black text-amber-700 mt-1">{percentiles.p95Ms} ms</p>
          <p className="text-[11px] text-muted mt-1">Tail latency across all features</p>
        </div>
        <div className="card p-4 bg-white">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Active Features</span>
          <p className="text-2xl font-black text-brand-700 mt-1">{byFeature.length}</p>
          <p className="text-[11px] text-muted mt-1">Marketplace AI operations</p>
        </div>
        <div className="card p-4 bg-white">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Active Providers</span>
          <p className="text-2xl font-black text-purple-700 mt-1">{byProvider.length}</p>
          <p className="text-[11px] text-muted mt-1">Including fallback engine</p>
        </div>
      </div>

      {byFeature.length === 0 ? (
        <EmptyState
          title="No Usage Data for Current Filter"
          message="Adjust the time window to inspect historical AI operations."
        />
      ) : (
        <div className="space-y-6">
          {/* By Feature Detailed Breakdown Table */}
          <div className="card p-5 bg-white space-y-4">
            <h3 className="text-sm font-bold text-ink">Usage Breakdown by AI Feature</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-muted uppercase font-semibold border-b border-line">
                  <tr>
                    <th className="py-2.5 px-3">Feature</th>
                    <th className="py-2.5 px-3">Total Requests</th>
                    <th className="py-2.5 px-3">Success</th>
                    <th className="py-2.5 px-3">Fallback</th>
                    <th className="py-2.5 px-3">Failed</th>
                    <th className="py-2.5 px-3">Total Tokens</th>
                    <th className="py-2.5 px-3">Avg Latency</th>
                    <th className="py-2.5 px-3 text-right">Cost (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {byFeature.map((f) => (
                    <tr key={f.feature} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 font-semibold text-ink capitalize">
                        {f.feature.replace(/_/g, " ")}
                      </td>
                      <td className="py-3 px-3 font-bold text-ink">{f.totalRequests}</td>
                      <td className="py-3 px-3 text-emerald-700 font-semibold">{f.successCount}</td>
                      <td className="py-3 px-3 text-amber-700 font-semibold">{f.fallbackCount}</td>
                      <td className="py-3 px-3 text-red-600 font-semibold">{f.failedCount}</td>
                      <td className="py-3 px-3 font-mono text-muted">
                        {f.totalTokens > 0 ? f.totalTokens.toLocaleString() : "—"}
                      </td>
                      <td className="py-3 px-3 font-mono text-ink">{f.avgLatencyMs} ms</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-700">
                        ${f.costUsd}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* By Provider & By Model Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="card p-5 bg-white space-y-3">
              <h3 className="text-sm font-bold text-ink">Requests by Provider</h3>
              <div className="space-y-3 pt-2">
                {byProvider.map((p) => (
                  <div key={p.provider} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200">
                    <div>
                      <span className="font-bold text-ink capitalize">{p.provider}</span>
                      <p className="text-[11px] text-muted font-mono">{p.tokens.toLocaleString()} tokens</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-ink">{p.count} requests</span>
                      <p className="text-[11px] text-emerald-700 font-semibold">${p.costUsd}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5 bg-white space-y-3">
              <h3 className="text-sm font-bold text-ink">Requests by Model</h3>
              <div className="space-y-3 pt-2">
                {byModel.map((m) => (
                  <div key={m.model} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200">
                    <div>
                      <span className="font-mono text-xs font-bold text-ink">{m.model}</span>
                      <p className="text-[11px] text-muted capitalize">Provider: {m.provider}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-ink">{m.count} requests</span>
                      <p className="text-[11px] text-muted font-mono">{m.avgLatencyMs} ms avg</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
