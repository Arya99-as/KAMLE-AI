import { Power, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { fetchAiFeatures, updateAiFeature } from "../../services/aiAdminApi";
import type { AiFeatureItem } from "../../types/aiAdmin";
import { Badge, Button, Spinner } from "../../components/ui/primitives";

export function AiFeaturesView() {
  const [features, setFeatures] = useState<AiFeatureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const loadFeatures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAiFeatures();
      setFeatures(res.features);
    } catch (err) {
      console.error("Failed to load features", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeatures();
  }, [loadFeatures]);

  async function handleToggle(key: string, current: boolean) {
    setUpdatingKey(key);
    try {
      await updateAiFeature(key, { enabled: !current });
      await loadFeatures();
    } catch (err) {
      alert("Failed to toggle feature");
    } finally {
      setUpdatingKey(null);
    }
  }

  if (loading && features.length === 0) {
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
          <h2 className="text-base font-bold text-ink">AI Feature Lifecycle Management</h2>
          <p className="text-xs text-muted">
            Inspect implemented AI capabilities, view real-time success telemetry, and toggle features on/off safely.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => loadFeatures()} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      <div className="space-y-4">
        {features.map((feat) => {
          const isEnabled = feat.enabled;

          return (
            <div
              key={feat.key}
              className={`card p-5 bg-white transition border ${
                isEnabled ? "border-line" : "border-slate-300 bg-slate-50/50"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-ink">{feat.name}</span>
                    <Badge tone={isEnabled ? "success" : "muted"}>
                      {isEnabled ? "ENABLED" : "DISABLED"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted max-w-2xl">{feat.description}</p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 text-xs">
                      <span className="text-[10px] text-muted block font-semibold uppercase">Configured Engine</span>
                      <strong className="text-ink capitalize">{feat.configuredProvider}</strong>
                      <div className="text-[10px] font-mono text-muted truncate">{feat.configuredModel}</div>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 text-xs">
                      <span className="text-[10px] text-muted block font-semibold uppercase">Total Invocations</span>
                      <strong className="text-ink">{feat.usageCount}</strong>
                      <div className="text-[10px] text-muted">Operations</div>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 text-xs">
                      <span className="text-[10px] text-muted block font-semibold uppercase">Success Rate</span>
                      <strong className="text-emerald-700">{feat.successRatePercent}%</strong>
                      <div className="text-[10px] text-muted">Reliability</div>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 text-xs">
                      <span className="text-[10px] text-muted block font-semibold uppercase">Avg Response</span>
                      <strong className="text-blue-700">{feat.avgDurationMs} ms</strong>
                      <div className="text-[10px] text-muted">Processing speed</div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center sm:flex-col justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-line">
                  <Button
                    variant={isEnabled ? "secondary" : "primary"}
                    size="sm"
                    onClick={() => handleToggle(feat.key, isEnabled)}
                    disabled={updatingKey === feat.key}
                    className={isEnabled ? "text-red-600 hover:bg-red-50" : "bg-emerald-600 hover:bg-emerald-700"}
                  >
                    <Power size={13} />
                    {updatingKey === feat.key
                      ? "Updating..."
                      : isEnabled
                      ? "Disable Feature"
                      : "Enable Feature"}
                  </Button>
                  <span className="text-[11px] text-muted">
                    {isEnabled ? "Live in production" : "Graceful fallback active"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl bg-brand-50/60 p-4 border border-brand-200 text-xs text-brand-950 flex items-start gap-3">
        <ShieldCheck size={18} className="text-brand-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Architectural Resilience Guarantee:</span>
          <p className="mt-0.5 text-brand-900">
            Disabling any AI feature never interrupts core business operations. User authentication, worker onboarding, manual worker directory browsing, service requests, dispute resolutions, and bank payouts continue to work seamlessly with deterministic fallback engines.
          </p>
        </div>
      </div>
    </div>
  );
}
