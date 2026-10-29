import { AlertTriangle, Info } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { fetchAiCostAnalytics } from "../../services/aiAdminApi";
import type { AiCostAnalytics } from "../../types/aiAdmin";
import { Button, Spinner } from "../../components/ui/primitives";

export function AiCostsView() {
  const [costs, setCosts] = useState<AiCostAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAiCostAnalytics();
      setCosts(res.costs);
    } catch (err) {
      console.error("Failed to load cost analytics", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading && !costs) {
    return (
      <div className="py-20 text-center">
        <Spinner />
      </div>
    );
  }

  const summary = costs?.summary || {
    costTodayUsd: 0,
    costThisWeekUsd: 0,
    costThisMonthUsd: 0,
    costPerSuccessfulRequestUsd: 0,
    pricingEffectiveDate: "",
  };

  const budgets = costs?.budgets || {
    dailyLimitUsd: 10,
    monthlyLimitUsd: 150,
    dailyUsagePercent: 0,
    monthlyUsagePercent: 0,
    warningThresholdPercent: 80,
    dailyWarningExceeded: false,
    monthlyWarningExceeded: false,
    actionOnLimit: "warn",
  };

  const byFeature = costs?.byFeature || [];
  const byProvider = costs?.byProvider || [];
  const byModel = costs?.byModel || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 card p-5 bg-white">
        <div>
          <h2 className="text-base font-bold text-ink">AI Cost Monitoring & Budget Management</h2>
          <p className="text-xs text-muted">
            Token-based expense estimation according to active provider pricing configurations.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => loadData()}>
          Refresh Costs
        </Button>
      </div>

      {/* Budget Warning Banner if Exceeded */}
      {(budgets.dailyWarningExceeded || budgets.monthlyWarningExceeded) && (
        <div className="card p-4 bg-amber-50 border-amber-300 text-amber-900 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold">Budget Warning Threshold Exceeded</span>
            <p>
              AI expenditure has reached or exceeded the {budgets.warningThresholdPercent}% threshold.
              {budgets.dailyWarningExceeded && ` Today's spend is at ${budgets.dailyUsagePercent}% of the daily limit.`}
              {budgets.monthlyWarningExceeded && ` Monthly spend is at ${budgets.monthlyUsagePercent}% of the monthly limit.`}
            </p>
            <p className="text-[11px] font-semibold text-amber-800">
              Configured platform policy: <span className="uppercase underline">{budgets.actionOnLimit}</span> (Core features like auth & payments remain fully operational).
            </p>
          </div>
        </div>
      )}

      {/* Cost KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-white">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Spend Today</span>
          <p className="text-2xl font-black text-ink mt-1">${summary.costTodayUsd}</p>
          <p className="text-[11px] text-muted mt-1 font-medium">
            Daily Budget: ${budgets.dailyLimitUsd} ({budgets.dailyUsagePercent}%)
          </p>
        </div>

        <div className="card p-4 bg-white">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Spend This Week</span>
          <p className="text-2xl font-black text-brand-700 mt-1">${summary.costThisWeekUsd}</p>
          <p className="text-[11px] text-muted mt-1">Rolling 7-day total</p>
        </div>

        <div className="card p-4 bg-white">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Spend This Month</span>
          <p className="text-2xl font-black text-purple-700 mt-1">${summary.costThisMonthUsd}</p>
          <p className="text-[11px] text-muted mt-1 font-medium">
            Monthly Budget: ${budgets.monthlyLimitUsd} ({budgets.monthlyUsagePercent}%)
          </p>
        </div>

        <div className="card p-4 bg-white">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Cost / Success Req</span>
          <p className="text-2xl font-black text-emerald-700 mt-1">${summary.costPerSuccessfulRequestUsd}</p>
          <p className="text-[11px] text-muted mt-1">Average per customer resolution</p>
        </div>
      </div>

      {/* Budget Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card p-5 bg-white space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-ink">Daily Budget Usage</span>
            <span className="font-mono font-semibold text-muted">
              ${summary.costTodayUsd} / ${budgets.dailyLimitUsd} ({budgets.dailyUsagePercent}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
            <div
              style={{ width: `${Math.min(100, budgets.dailyUsagePercent)}%` }}
              className={`h-full rounded-full transition-all ${
                budgets.dailyWarningExceeded ? "bg-amber-500" : "bg-emerald-500"
              }`}
            />
          </div>
          <p className="text-[11px] text-muted">
            Alert triggers at {budgets.warningThresholdPercent}% (${(budgets.dailyLimitUsd * budgets.warningThresholdPercent) / 100})
          </p>
        </div>

        <div className="card p-5 bg-white space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-ink">Monthly Budget Usage</span>
            <span className="font-mono font-semibold text-muted">
              ${summary.costThisMonthUsd} / ${budgets.monthlyLimitUsd} ({budgets.monthlyUsagePercent}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
            <div
              style={{ width: `${Math.min(100, budgets.monthlyUsagePercent)}%` }}
              className={`h-full rounded-full transition-all ${
                budgets.monthlyWarningExceeded ? "bg-amber-500" : "bg-brand-500"
              }`}
            />
          </div>
          <p className="text-[11px] text-muted">
            Alert triggers at {budgets.warningThresholdPercent}% (${(budgets.monthlyLimitUsd * budgets.warningThresholdPercent) / 100})
          </p>
        </div>
      </div>

      {/* Costs by Feature & Provider Tables */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="card p-5 bg-white space-y-3">
          <h3 className="text-sm font-bold text-ink">Cost by Feature</h3>
          <div className="space-y-2 pt-2">
            {byFeature.length === 0 ? (
              <p className="text-xs text-muted py-4 text-center">No feature costs logged</p>
            ) : (
              byFeature.map((f) => (
                <div key={f.feature} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <span className="font-semibold text-ink capitalize">{f.feature.replace(/_/g, " ")}</span>
                    <p className="text-[10px] text-muted">{f.requests} requests</p>
                  </div>
                  <strong className="font-mono text-emerald-700">${f.costUsd}</strong>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-5 bg-white space-y-3">
          <h3 className="text-sm font-bold text-ink">Cost by Provider</h3>
          <div className="space-y-2 pt-2">
            {byProvider.length === 0 ? (
              <p className="text-xs text-muted py-4 text-center">No provider costs logged</p>
            ) : (
              byProvider.map((p) => (
                <div key={p.provider} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <span className="font-semibold text-ink capitalize">{p.provider}</span>
                    <p className="text-[10px] text-muted">{p.requests} requests</p>
                  </div>
                  <strong className="font-mono text-brand-700">${p.costUsd}</strong>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-5 bg-white space-y-3">
          <h3 className="text-sm font-bold text-ink">Cost by Model</h3>
          <div className="space-y-2 pt-2">
            {byModel.length === 0 ? (
              <p className="text-xs text-muted py-4 text-center">No model costs logged</p>
            ) : (
              byModel.map((m) => (
                <div key={m.model} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <span className="font-mono font-semibold text-ink">{m.model}</span>
                    <p className="text-[10px] text-muted">{m.requests} requests</p>
                  </div>
                  <strong className="font-mono text-purple-700">${m.costUsd}</strong>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs text-muted flex items-start gap-2">
        <Info size={16} className="text-brand-600 shrink-0 mt-0.5" />
        <span>
          Cost estimates are computed using provider rate tables (Gemini Flash-Lite: $0.075 / 1M prompt, $0.30 / 1M response).
          Actual external billing statements from Google Cloud or OpenAI may differ slightly due to taxes or rounding.
        </span>
      </div>
    </div>
  );
}
