import { AlertCircle, CheckCircle2, Clock, Cpu, DollarSign, Layers, Sparkles, TrendingUp, Zap } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { fetchAiOverview } from "../../services/aiAdminApi";
import type { AiOverviewResponse } from "../../types/aiAdmin";
import { Badge, Button, Select, Spinner } from "../../components/ui/primitives";
import { EmptyState } from "../../components/ui/states";

export function AiOverviewView() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"today" | "7d" | "30d" | "custom">("30d");
  const [featureFilter, setFeatureFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [overview, setOverview] = useState<AiOverviewResponse | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, string> = { period };
      if (featureFilter) filters.feature = featureFilter;
      if (statusFilter) filters.status = statusFilter;
      const res = await fetchAiOverview(filters);
      setOverview(res);
    } catch (err) {
      console.error("Failed to load AI overview", err);
    } finally {
      setLoading(false);
    }
  }, [period, featureFilter, statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading && !overview) {
    return (
      <div className="py-24 text-center">
        <Spinner />
      </div>
    );
  }

  const metrics = overview?.stats.metrics || {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    fallbackRequests: 0,
    successRate: 100,
    avgResponseTimeMs: 0,
    requestsToday: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    activeFeatures: 0,
  };

  const timeline = overview?.stats.timeline || [];
  const byFeature = overview?.stats.byFeature || [];
  const health = overview?.activeProviderHealth;

  const maxTimelineTotal = Math.max(...timeline.map((t) => t.total), 1);
  const maxTokens = Math.max(...timeline.map((t) => t.tokens), 1);

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 border border-line shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted uppercase tracking-wider">Filters:</span>
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="h-8 text-xs font-semibold"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </Select>

          <Select
            value={featureFilter}
            onChange={(e) => setFeatureFilter(e.target.value)}
            className="h-8 text-xs font-semibold"
          >
            <option value="">All AI Features</option>
            <option value="problem_understanding">Problem Understanding</option>
            <option value="worker_matching">Worker Matching</option>
            <option value="ai_search">Marketplace Search</option>
            <option value="evaluation">Model Benchmark</option>
          </Select>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 text-xs font-semibold"
          >
            <option value="">All Statuses</option>
            <option value="SUCCESS">Success Only</option>
            <option value="FAILED">Failed Only</option>
            <option value="FALLBACK">Fallback Only</option>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {health ? (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 border border-line text-xs">
              <span className="text-muted font-medium">Provider ({health.provider}):</span>
              <span
                className={`inline-flex items-center gap-1 font-bold ${
                  health.reachable ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    health.reachable ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                  }`}
                />
                {health.reachable ? "Operational" : "Degraded / Unreachable"}
              </span>
            </div>
          ) : null}

          <Button variant="secondary" size="sm" onClick={() => loadData()}>
            Apply
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        <div className="card p-4 bg-white">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Total AI Requests</span>
            <Sparkles size={16} className="text-brand-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-ink">{metrics.totalRequests.toLocaleString()}</p>
          <p className="text-[11px] text-muted mt-1">{metrics.requestsToday} requests today</p>
        </div>

        <div className="card p-4 bg-white border-emerald-100">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-semibold uppercase tracking-wider">Success Rate</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-700">{metrics.successRate}%</p>
          <p className="text-[11px] text-muted mt-1">{metrics.successfulRequests} successful</p>
        </div>

        <div className="card p-4 bg-white">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Failed / Fallback</span>
            <AlertCircle size={16} className="text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-700">
            {metrics.failedRequests} <span className="text-xs font-medium text-muted">/ {metrics.fallbackRequests} fb</span>
          </p>
          <p className="text-[11px] text-muted mt-1">Automatic heuristic safety fallback</p>
        </div>

        <div className="card p-4 bg-white">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Latency</span>
            <Clock size={16} className="text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-blue-700">{metrics.avgResponseTimeMs} ms</p>
          <p className="text-[11px] text-muted mt-1">Measured server processing time</p>
        </div>

        <div className="card p-4 bg-white">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Estimated Cost</span>
            <DollarSign size={16} className="text-purple-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-purple-700">${metrics.totalCostUsd}</p>
          <p className="text-[11px] text-muted mt-1">{metrics.totalTokens.toLocaleString()} tokens total</p>
        </div>
      </div>

      {metrics.totalRequests === 0 ? (
        <EmptyState
          icon={<Cpu size={28} className="text-brand-600" />}
          title="No AI Activity Recorded Yet"
          message="Once users interact with the assistant or marketplace search, live metrics, costs, and token consumption charts will populate here."
        />
      ) : (
        <>
          {/* Charts Row 1: Requests Over Time & Success vs Failures */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card p-5 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink">AI Requests Over Time</h3>
                  <p className="text-xs text-muted">Daily volume across active features</p>
                </div>
                <Badge tone="brand">
                  <TrendingUp size={12} /> Daily Trend
                </Badge>
              </div>

              {timeline.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted">No timeline data</div>
              ) : (
                <div className="h-44 flex items-end gap-2 pt-4 px-2 border-b border-line">
                  {timeline.map((point) => {
                    const heightPercent = Math.max(8, Math.round((point.total / maxTimelineTotal) * 100));
                    return (
                      <div key={point.date} className="group relative flex-1 flex flex-col items-center h-full justify-end">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full rounded-t bg-brand-500 hover:bg-brand-600 transition-all cursor-pointer"
                        />
                        <span className="text-[10px] text-muted mt-1 transform -rotate-45 origin-top-left truncate w-full">
                          {point.date.slice(5)}
                        </span>
                        {/* Hover Tooltip */}
                        <div className="pointer-events-none absolute bottom-full mb-2 hidden group-hover:flex flex-col rounded-lg bg-slate-900 text-white p-2 text-[11px] shadow-lift z-20 whitespace-nowrap">
                          <span className="font-bold">{point.date}</span>
                          <span>Total: {point.total}</span>
                          <span>Success: {point.success}</span>
                          <span>Fallback: {point.fallback}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card p-5 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink">Success vs. Failure vs. Fallback</h3>
                  <p className="text-xs text-muted">Reliability distribution over timeline</p>
                </div>
                <Badge tone="success">Health Monitor</Badge>
              </div>

              {timeline.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted">No timeline data</div>
              ) : (
                <div className="h-44 flex items-end gap-2 pt-4 px-2 border-b border-line">
                  {timeline.map((point) => {
                    const successPct = Math.round((point.success / maxTimelineTotal) * 100);
                    const fallbackPct = Math.round((point.fallback / maxTimelineTotal) * 100);
                    const failedPct = Math.round((point.failed / maxTimelineTotal) * 100);

                    return (
                      <div key={point.date} className="group relative flex-1 flex flex-col items-center h-full justify-end">
                        <div className="w-full flex flex-col justify-end h-full">
                          {failedPct > 0 && (
                            <div style={{ height: `${failedPct}%` }} className="w-full bg-red-500 rounded-t" />
                          )}
                          {fallbackPct > 0 && (
                            <div style={{ height: `${fallbackPct}%` }} className="w-full bg-amber-400" />
                          )}
                          {successPct > 0 && (
                            <div style={{ height: `${successPct}%` }} className="w-full bg-emerald-500 rounded-b" />
                          )}
                        </div>
                        <span className="text-[10px] text-muted mt-1 transform -rotate-45 origin-top-left truncate w-full">
                          {point.date.slice(5)}
                        </span>
                        <div className="pointer-events-none absolute bottom-full mb-2 hidden group-hover:flex flex-col rounded-lg bg-slate-900 text-white p-2 text-[11px] shadow-lift z-20 whitespace-nowrap">
                          <span className="font-bold">{point.date}</span>
                          <span className="text-emerald-400">Success: {point.success}</span>
                          <span className="text-amber-300">Fallback: {point.fallback}</span>
                          <span className="text-red-400">Failed: {point.failed}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Charts Row 2: Usage by Feature & Token Consumption */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card p-5 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink">AI Usage by Feature</h3>
                  <p className="text-xs text-muted">Feature share of total operations</p>
                </div>
                <Badge tone="brand">
                  <Layers size={12} /> Features
                </Badge>
              </div>

              <div className="space-y-3 pt-2">
                {byFeature.map((item) => {
                  const pct = metrics.totalRequests > 0 ? Math.round((item.count / metrics.totalRequests) * 100) : 0;
                  return (
                    <div key={item.feature} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-ink capitalize">{item.feature.replace(/_/g, " ")}</span>
                        <span className="text-muted">
                          {item.count} reqs ({pct}%) · ${item.cost}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div style={{ width: `${pct}%` }} className="bg-brand-600 h-full rounded-full" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card p-5 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink">Token & Cost Trends</h3>
                  <p className="text-xs text-muted">Prompt and generation consumption</p>
                </div>
                <Badge tone="ai">
                  <Zap size={12} /> Consumption
                </Badge>
              </div>

              {timeline.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted">No token data</div>
              ) : (
                <div className="h-44 flex items-end gap-2 pt-4 px-2 border-b border-line">
                  {timeline.map((point) => {
                    const heightPercent = Math.max(8, Math.round((point.tokens / maxTokens) * 100));
                    return (
                      <div key={point.date} className="group relative flex-1 flex flex-col items-center h-full justify-end">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full rounded-t bg-purple-500 hover:bg-purple-600 transition cursor-pointer"
                        />
                        <span className="text-[10px] text-muted mt-1 transform -rotate-45 origin-top-left truncate w-full">
                          {point.date.slice(5)}
                        </span>
                        <div className="pointer-events-none absolute bottom-full mb-2 hidden group-hover:flex flex-col rounded-lg bg-slate-900 text-white p-2 text-[11px] shadow-lift z-20 whitespace-nowrap">
                          <span className="font-bold">{point.date}</span>
                          <span>Tokens: {point.tokens.toLocaleString()}</span>
                          <span>Cost: ${point.cost}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
