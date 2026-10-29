import { Download, Eye, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { fetchAiLogs, downloadLogsCsv } from "../../services/aiAdminApi";
import type { AiActivityLog } from "../../types/aiAdmin";
import { Badge, Button, Input, Modal, Select, Spinner } from "../../components/ui/primitives";
import { EmptyState } from "../../components/ui/states";

export function AiActivityLogsView() {
  const [logs, setLogs] = useState<AiActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [feature, setFeature] = useState("");
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("");

  // Inspect Modal
  const [selectedLog, setSelectedLog] = useState<AiActivityLog | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAiLogs({
        page,
        limit: 20,
        q: search,
        feature,
        provider,
        status,
      });
      setLogs(res.items);
      setTotalPages(res.pages);
      setTotalCount(res.total);
    } catch (err) {
      console.error("Failed to load logs", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, feature, provider, status]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  async function handleExport() {
    try {
      await downloadLogsCsv({ feature, provider, status });
    } catch (err) {
      alert("Failed to export logs CSV");
    }
  }

  return (
    <div className="space-y-4">
      {/* Search & Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl bg-white p-4 border border-line shadow-card">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search Request ID, Error, Correlation..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          <Select
            value={feature}
            onChange={(e) => {
              setFeature(e.target.value);
              setPage(1);
            }}
            className="h-9 text-xs font-semibold"
          >
            <option value="">All Features</option>
            <option value="problem_understanding">Problem Understanding</option>
            <option value="worker_matching">Worker Matching</option>
            <option value="ai_search">AI Search</option>
            <option value="evaluation">Model Benchmark</option>
          </Select>

          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 text-xs font-semibold"
          >
            <option value="">All Statuses</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FALLBACK">FALLBACK</option>
            <option value="FAILED">FAILED</option>
          </Select>

          <Select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setPage(1);
            }}
            className="h-9 text-xs font-semibold"
          >
            <option value="">All Providers</option>
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="groq">Groq</option>
            <option value="ollama">Ollama</option>
            <option value="heuristic">Heuristic Engine</option>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => loadLogs()} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download size={13} /> Export CSV
          </Button>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="py-20 text-center">
          <Spinner />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          title="No AI Activity Logs Found"
          message="No records matched your search query or filter criteria."
        />
      ) : (
        <div className="card overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-muted uppercase font-semibold border-b border-line">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Feature</th>
                  <th className="py-3 px-4">Provider / Model</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Tokens</th>
                  <th className="py-3 px-4">Est. Cost</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logs.map((log) => {
                  const isSuccess = log.status === "SUCCESS";
                  const isFallback = log.status === "FALLBACK";

                  return (
                    <tr key={log._id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 whitespace-nowrap text-muted font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleTimeString()}
                        <div className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-ink">
                        {log.feature.replace(/_/g, " ")}
                      </td>
                      <td className="py-3 px-4 text-muted">
                        <span className="font-semibold text-ink capitalize">{log.provider}</span>
                        <div className="text-[10px] font-mono text-slate-500 truncate max-w-[130px]">{log.model}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            isSuccess
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : isFallback
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {log.status}
                        </span>
                        {log.fallbackUsed && (
                          <div className="text-[10px] text-amber-600 font-medium mt-0.5">Fallback Active</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-ink">
                        {log.durationMs} ms
                      </td>
                      <td className="py-3 px-4 font-mono text-muted">
                        {log.totalTokens > 0 ? (
                          <div>
                            <span className="font-bold text-ink">{log.totalTokens}</span>
                            <div className="text-[10px]">
                              in: {log.inputTokens} / out: {log.outputTokens}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-ink">
                        ${log.estimatedCost}
                      </td>
                      <td className="py-3 px-4 text-muted">
                        <div className="font-semibold text-ink truncate max-w-[100px]">
                          {log.userId?.name || log.userRole || "guest"}
                        </div>
                        <div className="text-[10px] capitalize">{log.userRole}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="text-brand-600 hover:text-brand-700"
                        >
                          <Eye size={13} /> Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between p-4 border-t border-line text-xs text-muted">
            <span>
              Showing {logs.length} of {totalCount} records (Page {page} of {totalPages})
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

      {/* Detail Inspection Modal */}
      {selectedLog && (
        <Modal
          open={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title="AI Activity Log Inspection"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <span className="font-bold text-ink text-sm">Request: {selectedLog.requestId}</span>
                <p className="text-muted text-[11px]">Correlation ID: {selectedLog.correlationId}</p>
              </div>
              <Badge tone={selectedLog.status === "SUCCESS" ? "success" : selectedLog.status === "FALLBACK" ? "warning" : "danger"}>
                {selectedLog.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-slate-700">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-muted">AI Feature & Provider</span>
                <p className="font-semibold text-ink mt-0.5 capitalize">{selectedLog.feature.replace(/_/g, " ")}</p>
                <p className="text-muted">
                  Provider: <strong className="text-ink">{selectedLog.provider}</strong>
                </p>
                <p className="text-muted font-mono text-[11px]">Model: {selectedLog.model}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-muted">Execution Timings & Tokens</span>
                <p className="font-semibold text-ink mt-0.5">Duration: {selectedLog.durationMs} ms</p>
                <p className="text-muted">Tokens: {selectedLog.totalTokens} (in: {selectedLog.inputTokens}, out: {selectedLog.outputTokens})</p>
                <p className="text-muted">Cost: ${selectedLog.estimatedCost}</p>
              </div>
            </div>

            {selectedLog.fallbackUsed && (
              <div className="rounded-xl bg-amber-50 p-3 border border-amber-200 text-amber-900">
                <span className="font-bold text-xs">Fallback Engaged:</span>
                <p className="mt-0.5">{selectedLog.fallbackReason || "Heuristic deterministic parser substituted."}</p>
              </div>
            )}

            {selectedLog.errorMessage && (
              <div className="rounded-xl bg-red-50 p-3 border border-red-200 text-red-900">
                <span className="font-bold text-xs">Error Classified: {selectedLog.errorCategory || "ERROR"}</span>
                <p className="mt-0.5 font-mono text-[11px]">{selectedLog.errorMessage}</p>
                {selectedLog.errorCode && <p className="text-[10px] text-red-700 mt-1">Code: {selectedLog.errorCode}</p>}
              </div>
            )}

            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div className="space-y-1">
                <span className="font-bold text-ink">Sanitized Request Metadata</span>
                <pre className="rounded-xl bg-slate-900 text-slate-100 p-3 font-mono text-[11px] overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-line text-[11px] text-muted">
              <span className="flex items-center gap-1 text-emerald-700">
                <ShieldCheck size={14} /> Zero customer passwords or API secrets stored.
              </span>
              <Button variant="secondary" size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
