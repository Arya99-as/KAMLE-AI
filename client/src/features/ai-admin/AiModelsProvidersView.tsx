import { CheckCircle2, RefreshCw, XCircle, Zap } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { fetchAiProviders, testAiProvider } from "../../services/aiAdminApi";
import type { AiProviderInfo } from "../../types/aiAdmin";
import { Badge, Button, Spinner } from "../../components/ui/primitives";

export function AiModelsProvidersView() {
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ provider: string; reachable: boolean; latencyMs?: number; error?: string } | null>(null);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAiProviders();
      setProviders(res.providers);
    } catch (err) {
      console.error("Failed to load providers", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  async function handleTest(provider: string) {
    setTestingProvider(provider);
    setTestResult(null);
    try {
      const res = await testAiProvider(provider);
      setTestResult({
        provider,
        reachable: res.health?.reachable ?? false,
        latencyMs: res.health?.latencyMs,
        error: res.health?.error,
      });
    } catch (err) {
      setTestResult({
        provider,
        reachable: false,
        error: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setTestingProvider(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 card p-5 bg-white">
        <div>
          <h2 className="text-base font-bold text-ink">Configured AI Providers & Models</h2>
          <p className="text-xs text-muted">
            Live availability status, model latency benchmarks, and connectivity testing.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => loadProviders()} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh Statuses
        </Button>
      </div>

      {testResult && (
        <div
          className={`card p-4 text-xs flex items-center justify-between ${
            testResult.reachable
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.reachable ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <XCircle size={16} className="text-red-600 shrink-0" />
            )}
            <span>
              <strong>{testResult.provider.toUpperCase()} Diagnostic Ping:</strong>{" "}
              {testResult.reachable
                ? `Operational & Reachable (${testResult.latencyMs} ms)`
                : `Diagnostic probe failed: ${testResult.error || "Unreachable"}`}
            </span>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className="text-[11px] font-bold underline hover:opacity-75"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center">
          <Spinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {providers.map((p) => {
            const isConfigured = p.isConfigured;
            const isHeuristic = p.provider === "heuristic";

            return (
              <div
                key={p.provider}
                className={`card p-5 bg-white space-y-4 flex flex-col justify-between ${
                  p.isDefault ? "border-brand-400 ring-1 ring-brand-300" : ""
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-base text-ink">{p.name}</span>
                        {p.isDefault && (
                          <Badge tone="brand">Default Active</Badge>
                        )}
                      </div>
                      <p className="text-xs font-mono text-muted capitalize">{p.provider}</p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        isConfigured
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${isConfigured ? "bg-emerald-500" : "bg-slate-400"}`} />
                      {isConfigured ? "Configured" : "Not Set"}
                    </span>
                  </div>

                  {/* Benchmark & Latency Stats */}
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 border border-slate-200 text-center">
                    <div>
                      <span className="text-[10px] text-muted block font-semibold">Requests</span>
                      <strong className="text-xs text-ink">{p.totalRequests}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block font-semibold">Fail Rate</span>
                      <strong className={`text-xs ${p.failureRatePercent > 10 ? "text-red-600" : "text-emerald-700"}`}>
                        {p.failureRatePercent}%
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block font-semibold">Avg Latency</span>
                      <strong className="text-xs text-blue-700">{p.avgLatencyMs} ms</strong>
                    </div>
                  </div>

                  {/* Available Models */}
                  <div className="space-y-1 text-xs">
                    <span className="font-semibold text-muted text-[11px] uppercase tracking-wider">Configured Model</span>
                    <div className="font-mono text-ink text-xs font-semibold bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 truncate">
                      {p.configuredModel}
                    </div>

                    <span className="font-semibold text-muted text-[11px] uppercase tracking-wider block pt-2">
                      Available Models
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {p.availableModels.map((m) => (
                        <span key={m} className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-line flex items-center justify-between">
                  <span className="text-[11px] text-muted">
                    {p.lastSuccessfulAt
                      ? `Last ok: ${new Date(p.lastSuccessfulAt).toLocaleTimeString()}`
                      : isHeuristic
                      ? "Deterministic heuristic"
                      : "No recorded requests"}
                  </span>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleTest(p.provider)}
                    disabled={testingProvider === p.provider}
                  >
                    <Zap size={12} className={testingProvider === p.provider ? "animate-spin" : ""} />
                    {testingProvider === p.provider ? "Testing..." : "Test Health"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
