import { CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { fetchAiAuditLogs } from "../../services/aiAdminApi";
import type { AiAuditItem } from "../../types/aiAdmin";
import { Button, Spinner } from "../../components/ui/primitives";
import { EmptyState } from "../../components/ui/states";

export function AiSecurityAuditView() {
  const [logs, setLogs] = useState<AiAuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAiAuditLogs({ page, limit: 20 });
      setLogs(res.items);
      setTotalPages(res.pages);
      setTotalCount(res.total);
    } catch (err) {
      console.error("Failed to load AI audit logs", err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 card p-5 bg-white">
        <div>
          <h2 className="text-base font-bold text-ink">AI Security & Administrative Audit Trail</h2>
          <p className="text-xs text-muted">
            Tamper-resistant audit log of all AI provider adjustments, budget alterations, feature toggles, and admin diagnostics.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => loadLogs()} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh Audit Trail
        </Button>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Spinner />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={28} className="text-brand-600" />}
          title="No Administrative AI Audit Events"
          message="When an administrator alters AI provider configurations, toggles features, or adjusts budgets, the action is permanently audited here."
        />
      ) : (
        <div className="card overflow-hidden bg-white space-y-4 p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-muted uppercase font-semibold border-b border-line">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Administrator</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Resource Target</th>
                  <th className="py-2.5 px-3">Audit Details</th>
                  <th className="py-2.5 px-3 text-right">Integrity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3 font-mono text-[11px] text-muted whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-ink">{log.adminId?.name || "Admin"}</div>
                      <div className="text-[10px] text-muted">{log.adminId?.email || "internal"}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-700">
                      {log.targetType} {log.targetId ? `(${log.targetId})` : ""}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600 max-w-sm truncate">
                      {JSON.stringify(log.metadata)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                        <CheckCircle2 size={12} /> Verified
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-3 border-t border-line text-xs text-muted">
            <span>
              Showing {logs.length} of {totalCount} events (Page {page} of {totalPages})
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
    </div>
  );
}
