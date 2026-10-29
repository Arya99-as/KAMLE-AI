import { CheckCircle2, Eye, RefreshCw } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { fetchAiErrorAnalytics, retryAiError } from "../../services/aiAdminApi";
import type { AiErrorAnalytics, AiActivityLog } from "../../types/aiAdmin";
import { Button, Modal, Select, Spinner } from "../../components/ui/primitives";
import { EmptyState } from "../../components/ui/states";

export function AiErrorsView() {
  const [errorData, setErrorData] = useState<AiErrorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"today" | "7d" | "30d">("30d");
  const [selectedError, setSelectedError] = useState<AiActivityLog | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAiErrorAnalytics({ period });
      setErrorData(res.errors);
    } catch (err) {
      console.error("Failed to load error analytics", err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleRetry(logId: string) {
    setRetryingId(logId);
    setRetryMessage(null);
    try {
      const res = await retryAiError(logId);
      setRetryMessage(res.message);
      await loadData();
    } catch (err) {
      setRetryMessage(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetryingId(null);
    }
  }

  if (loading && !errorData) {
    return (
      <div className="py-20 text-center">
        <Spinner />
      </div>
    );
  }

  const categories = errorData?.categories || [];
  const recentErrors = errorData?.recentErrors || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 card p-5 bg-white">
        <div>
          <h2 className="text-base font-bold text-ink">AI Error & Failure Monitoring Center</h2>
          <p className="text-xs text-muted">
            Categorized exceptions, sanitized error messages, and controlled diagnostic retries.
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

      {retryMessage && (
        <div className="card p-3 bg-brand-50 border-brand-200 text-brand-900 text-xs flex items-center justify-between">
          <span>{retryMessage}</span>
          <button onClick={() => setRetryMessage(null)} className="font-bold underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Category Breakdown Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.length === 0 ? (
          <div className="col-span-full card p-6 bg-emerald-50 border-emerald-200 text-emerald-900 text-center">
            <CheckCircle2 size={24} className="mx-auto text-emerald-600 mb-2" />
            <span className="font-bold text-sm">No Provider or Schema Errors Logged</span>
            <p className="text-xs text-emerald-800 mt-1">All AI operations have succeeded or handled via heuristic fallback.</p>
          </div>
        ) : (
          categories.map((c) => (
            <div key={c.category} className="card p-4 bg-white border-red-100">
              <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider block truncate">
                {c.category.replace(/_/g, " ")}
              </span>
              <p className="text-2xl font-black text-ink mt-1">{c.count}</p>
              <p className="text-[10px] text-muted mt-1">
                Last: {new Date(c.lastOccurred).toLocaleTimeString()}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Recent Errors Table */}
      {recentErrors.length === 0 ? (
        <EmptyState
          title="Clean Health Record"
          message="No active AI failures recorded in this timeframe."
        />
      ) : (
        <div className="card overflow-hidden bg-white space-y-4 p-5">
          <h3 className="text-sm font-bold text-ink">Recent Classified Error Events</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-muted uppercase font-semibold border-b border-line">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Feature</th>
                  <th className="py-2.5 px-3">Provider</th>
                  <th className="py-2.5 px-3">Error Category</th>
                  <th className="py-2.5 px-3">Safe Error Summary</th>
                  <th className="py-2.5 px-3">Fallback</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recentErrors.map((err) => (
                  <tr key={err._id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3 font-mono text-[11px] text-muted whitespace-nowrap">
                      {new Date(err.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-3 font-semibold text-ink capitalize">
                      {err.feature.replace(/_/g, " ")}
                    </td>
                    <td className="py-3 px-3 font-semibold text-ink capitalize">
                      {err.provider}
                    </td>
                    <td className="py-3 px-3">
                      <span className="rounded bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">
                        {err.errorCategory || "UNCLASSIFIED"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-mono text-[11px] max-w-xs truncate">
                      {err.errorMessage || "Operation error"}
                    </td>
                    <td className="py-3 px-3">
                      {err.fallbackUsed ? (
                        <span className="text-emerald-700 font-semibold text-[11px]">Succeeded (Heuristic)</span>
                      ) : (
                        <span className="text-red-600 font-semibold text-[11px]">No Fallback</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedError(err)}
                        className="text-brand-600 hover:text-brand-700"
                      >
                        <Eye size={13} />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRetry(err._id)}
                        disabled={retryingId === err._id}
                        className="text-[11px]"
                      >
                        <RefreshCw size={11} className={retryingId === err._id ? "animate-spin" : ""} />
                        Test Probe
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspect Error Modal */}
      {selectedError && (
        <Modal
          open={Boolean(selectedError)}
          onClose={() => setSelectedError(null)}
          title="Sanitized Error Incident Inspection"
        >
          <div className="space-y-4 text-xs">
            <div className="rounded-xl bg-red-50 p-4 border border-red-200 space-y-2 text-red-950">
              <div className="flex items-center justify-between">
                <span className="font-bold text-red-900">Category: {selectedError.errorCategory}</span>
                <span className="font-mono text-[11px]">{selectedError.errorCode || "N/A"}</span>
              </div>
              <p className="font-mono text-xs">{selectedError.errorMessage}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-slate-700">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                <span className="text-[10px] text-muted uppercase font-bold">Request Details</span>
                <p className="font-mono mt-1 font-semibold text-ink">{selectedError.requestId}</p>
                <p className="text-muted mt-0.5">Correlation: {selectedError.correlationId}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                <span className="text-[10px] text-muted uppercase font-bold">Telemetry</span>
                <p className="mt-1">Duration: <strong>{selectedError.durationMs} ms</strong></p>
                <p>Retries attempted: <strong>{selectedError.retryCount}</strong></p>
              </div>
            </div>

            {selectedError.fallbackUsed && (
              <div className="rounded-xl bg-amber-50 p-3 border border-amber-200 text-amber-900">
                <span className="font-bold">Recovery Mechanism:</span>
                <p className="mt-0.5">{selectedError.fallbackReason || "Heuristic deterministic parser fulfilled the user enquiry."}</p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-line">
              <Button variant="secondary" size="sm" onClick={() => setSelectedError(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
