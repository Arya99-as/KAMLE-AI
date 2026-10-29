import { Eye, Sparkles } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { fetchAiLogs } from "../../services/aiAdminApi";
import type { AiActivityLog } from "../../types/aiAdmin";
import { Badge, Button, Modal, Select, Spinner } from "../../components/ui/primitives";
import { EmptyState } from "../../components/ui/states";

export function AiRequestsView() {
  const [logs, setLogs] = useState<AiActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [feature, setFeature] = useState("");
  const [status, setStatus] = useState("");
  const [selectedReq, setSelectedReq] = useState<AiActivityLog | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAiLogs({
        page,
        limit: 15,
        feature,
        status,
      });
      setLogs(res.items);
      setTotalPages(res.pages);
      setTotalCount(res.total);
    } catch (err) {
      console.error("Failed to load requests", err);
    } finally {
      setLoading(false);
    }
  }, [page, feature, status]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 border border-line shadow-card">
        <div className="flex items-center gap-2">
          <Select
            value={feature}
            onChange={(e) => {
              setFeature(e.target.value);
              setPage(1);
            }}
            className="h-8 text-xs font-semibold"
          >
            <option value="">All Features</option>
            <option value="problem_understanding">Problem Understanding</option>
            <option value="worker_matching">Worker Matching</option>
            <option value="ai_search">Marketplace Search</option>
            <option value="evaluation">Evaluation Run</option>
          </Select>

          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-8 text-xs font-semibold"
          >
            <option value="">All Statuses</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FALLBACK">FALLBACK</option>
            <option value="FAILED">FAILED</option>
          </Select>
        </div>

        <div className="text-xs text-muted">
          Total AI Requests Logged: <strong className="text-ink">{totalCount}</strong>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Spinner />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={26} className="text-brand-600" />}
          title="No AI Request Records Found"
          message="Every time a customer chats, searches, or matches workers, the request lifecycle is tracked here."
        />
      ) : (
        <div className="space-y-3">
          {logs.map((req) => (
            <div
              key={req._id}
              className="card p-4 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-brand-200 transition"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-ink">{req.requestId}</span>
                  <Badge tone="brand">{req.feature.replace(/_/g, " ")}</Badge>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      req.status === "SUCCESS"
                        ? "bg-emerald-50 text-emerald-700"
                        : req.status === "FALLBACK"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {req.status}
                  </span>
                  {req.fallbackUsed && (
                    <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-medium">
                      Fallback
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                  <span>
                    Provider: <strong className="text-ink capitalize">{req.provider}</strong> ({req.model})
                  </span>
                  <span>•</span>
                  <span>Duration: <strong className="text-ink font-mono">{req.durationMs}ms</strong></span>
                  <span>•</span>
                  <span>Tokens: <strong className="text-ink font-mono">{req.totalTokens}</strong></span>
                  <span>•</span>
                  <span>Cost: <strong className="text-ink font-mono">${req.estimatedCost}</strong></span>
                </div>

                <p className="text-[11px] text-muted">
                  Actor: <strong className="text-slate-700">{req.userId?.name || req.userRole || "Guest"}</strong> ({req.userRole}) · {new Date(req.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="shrink-0">
                <Button variant="secondary" size="sm" onClick={() => setSelectedReq(req)}>
                  <Eye size={13} /> Inspect Lifecycle
                </Button>
              </div>
            </div>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between p-3 card bg-white text-xs text-muted">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Lifecycle Drawer/Modal */}
      {selectedReq && (
        <Modal
          open={Boolean(selectedReq)}
          onClose={() => setSelectedReq(null)}
          title="AI Request Detailed Breakdown"
        >
          <div className="space-y-4 text-xs">
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink">Request ID: {selectedReq.requestId}</span>
                <span className="text-[11px] font-mono text-muted">{new Date(selectedReq.createdAt).toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <div>Operation: <strong className="text-ink font-mono">{selectedReq.operation}</strong></div>
                <div>Status: <strong className="text-ink font-mono">{selectedReq.status}</strong></div>
                <div>Provider: <strong className="text-ink">{selectedReq.provider}</strong></div>
                <div>Model: <strong className="text-ink font-mono">{selectedReq.model}</strong></div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-2">
              <span className="font-bold text-ink">Latency & Token Metrics</span>
              <div className="grid grid-cols-3 gap-2 text-slate-700">
                <div>
                  <span className="text-muted block text-[10px] uppercase font-bold">Duration</span>
                  <span className="text-base font-black text-ink">{selectedReq.durationMs} ms</span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase font-bold">Total Tokens</span>
                  <span className="text-base font-black text-purple-700">{selectedReq.totalTokens}</span>
                  <span className="text-[10px] text-muted block">in: {selectedReq.inputTokens} / out: {selectedReq.outputTokens}</span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase font-bold">Cost Estimate</span>
                  <span className="text-base font-black text-emerald-700">${selectedReq.estimatedCost}</span>
                </div>
              </div>
            </div>

            {selectedReq.fallbackUsed && (
              <div className="rounded-xl bg-amber-50 p-3 border border-amber-200 text-amber-900">
                <span className="font-bold">Fallback Trace:</span>
                <p className="mt-1">{selectedReq.fallbackReason || "Heuristic parser executed safely."}</p>
              </div>
            )}

            {selectedReq.metadata && Object.keys(selectedReq.metadata).length > 0 && (
              <div className="space-y-1">
                <span className="font-bold text-ink">Operation Metadata & Sanitized Output</span>
                <pre className="rounded-xl bg-slate-900 text-slate-100 p-3 font-mono text-[11px] overflow-x-auto max-h-48">
                  {JSON.stringify(selectedReq.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-line">
              <Button variant="secondary" size="sm" onClick={() => setSelectedReq(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
