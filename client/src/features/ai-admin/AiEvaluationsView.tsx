import { Award, Eye, Play, RefreshCw } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { fetchAiEvaluations, runAiEvaluation } from "../../services/aiAdminApi";
import type { AiEvaluationRun } from "../../types/aiAdmin";
import { Button, Modal, Spinner } from "../../components/ui/primitives";
import { EmptyState } from "../../components/ui/states";

export function AiEvaluationsView() {
  const [evaluations, setEvaluations] = useState<AiEvaluationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedEval, setSelectedEval] = useState<AiEvaluationRun | null>(null);

  const loadEvaluations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAiEvaluations();
      setEvaluations(res.evaluations);
    } catch (err) {
      console.error("Failed to load evaluations", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvaluations();
  }, [loadEvaluations]);

  async function handleRunEvaluation() {
    setRunning(true);
    try {
      const res = await runAiEvaluation();
      alert(`Benchmark Completed! Overall Accuracy: ${res.evaluation.accuracyPercent}% (${res.evaluation.passedCases}/${res.evaluation.totalCases} passed)`);
      await loadEvaluations();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setRunning(false);
    }
  }

  if (loading && evaluations.length === 0) {
    return (
      <div className="py-20 text-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 card p-5 bg-white">
        <div>
          <h2 className="text-base font-bold text-ink">AI Model Quality & Benchmark Evaluations</h2>
          <p className="text-xs text-muted">
            Run standard golden test suites to benchmark category parsing, skill extraction, and JSON validity without using customer private data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => loadEvaluations()} disabled={loading || running}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleRunEvaluation}
            disabled={running}
            className="bg-brand-600 hover:bg-brand-700 text-white"
          >
            <Play size={13} className={running ? "animate-spin" : ""} />
            {running ? "Running Benchmark..." : "Run Golden Benchmark"}
          </Button>
        </div>
      </div>

      {evaluations.length === 0 ? (
        <EmptyState
          icon={<Award size={28} className="text-brand-600" />}
          title="No Evaluation Benchmark Runs Yet"
          message="Run the approved golden dataset to verify model accuracy, trade classification precision, and structured output adherence."
          action={
            <Button variant="primary" onClick={handleRunEvaluation} disabled={running}>
              <Play size={14} /> Run First Benchmark Evaluation
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="card overflow-hidden bg-white p-5 space-y-4">
            <h3 className="text-sm font-bold text-ink">Benchmark Evaluation History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-muted uppercase font-semibold border-b border-line">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Dataset Name</th>
                    <th className="py-2.5 px-3">Provider / Model</th>
                    <th className="py-2.5 px-3">Accuracy</th>
                    <th className="py-2.5 px-3">Passed / Total</th>
                    <th className="py-2.5 px-3">Avg Latency</th>
                    <th className="py-2.5 px-3">Valid JSON</th>
                    <th className="py-2.5 px-3 text-right">Inspection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {evaluations.map((ev) => (
                    <tr key={ev._id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 font-mono text-[11px] text-muted whitespace-nowrap">
                        {new Date(ev.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-semibold text-ink">
                        {ev.datasetName} <span className="text-[10px] text-muted font-mono">({ev.datasetVersion})</span>
                      </td>
                      <td className="py-3 px-3 text-muted">
                        <span className="font-semibold text-ink capitalize">{ev.provider}</span>
                        <div className="text-[10px] font-mono text-slate-500">{ev.model}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-black text-xs ${
                            ev.accuracyPercent >= 80 ? "text-emerald-700" : "text-amber-700"
                          }`}
                        >
                          {ev.accuracyPercent}%
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-ink">
                        {ev.passedCases} / {ev.totalCases}
                      </td>
                      <td className="py-3 px-3 font-mono text-ink">
                        {ev.avgDurationMs} ms
                      </td>
                      <td className="py-3 px-3 text-emerald-700 font-semibold font-mono">
                        {ev.validJsonRatePercent}%
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEval(ev)}
                          className="text-brand-600 hover:text-brand-700"
                        >
                          <Eye size={13} /> View Cases
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation Detail Modal */}
      {selectedEval && (
        <Modal
          open={Boolean(selectedEval)}
          onClose={() => setSelectedEval(null)}
          title="Evaluation Run Audit & Cases"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 border border-slate-200 text-center">
              <div>
                <span className="text-[10px] text-muted block uppercase font-bold">Accuracy</span>
                <span className="text-xl font-black text-emerald-700">{selectedEval.accuracyPercent}%</span>
              </div>
              <div>
                <span className="text-[10px] text-muted block uppercase font-bold">Passed Cases</span>
                <span className="text-xl font-black text-ink">{selectedEval.passedCases} / {selectedEval.totalCases}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted block uppercase font-bold">Avg Response</span>
                <span className="text-xl font-black text-blue-700">{selectedEval.avgDurationMs} ms</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-ink">Failed Cases ({selectedEval.failedCases.length})</span>
              {selectedEval.failedCases.length === 0 ? (
                <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200 text-emerald-900 text-center font-semibold">
                  100% Pass! All golden benchmark queries classified with perfect trade and skill accuracy.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedEval.failedCases.map((fc, i) => (
                    <div key={i} className="rounded-xl bg-red-50 p-3 border border-red-200 text-red-950 space-y-1">
                      <p className="font-semibold text-xs">Prompt: &quot;{fc.prompt}&quot;</p>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                        <div>Expected: <strong>{fc.expectedCategory}</strong></div>
                        <div>Actual: <strong className="text-red-700">{fc.actualCategory}</strong></div>
                      </div>
                      {fc.error && <p className="text-[10px] text-red-700">Reason: {fc.error}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-line">
              <Button variant="secondary" size="sm" onClick={() => setSelectedEval(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
