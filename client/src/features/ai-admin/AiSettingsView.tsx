import { Check, Lock, Save, ShieldAlert, Sliders } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { fetchAiSettings, updateAiSettings } from "../../services/aiAdminApi";
import type { AiSettings } from "../../types/aiAdmin";
import { Button, Field, Input, Select, Spinner } from "../../components/ui/primitives";

export function AiSettingsView() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states
  const [defaultProvider, setDefaultProvider] = useState("gemini");
  const [defaultModel, setDefaultModel] = useState("gemini-3.5-flash-lite");
  const [timeoutMs, setTimeoutMs] = useState(8000);
  const [retryLimit, setRetryLimit] = useState(2);
  const [fallbackEnabled, setFallbackEnabled] = useState(true);

  // Budgets
  const [dailyBudget, setDailyBudget] = useState(10.0);
  const [monthlyBudget, setMonthlyBudget] = useState(150.0);
  const [warningThreshold, setWarningThreshold] = useState(80);
  const [actionOnLimit, setActionOnLimit] = useState<"warn" | "rate_limit" | "disable_noncritical">("warn");

  // Logging
  const [logMetadata, setLogMetadata] = useState(true);
  const [retentionDays, setRetentionDays] = useState(30);
  const [retentionLevel, setRetentionLevel] = useState<"metadata_only" | "sanitized" | "full">("sanitized");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetchAiSettings();
        setSettings(res.settings);
        setDefaultProvider(res.settings.defaultProvider || "gemini");
        setDefaultModel(res.settings.defaultModel || "gemini-3.5-flash-lite");
        setTimeoutMs(res.settings.timeoutMs || 8000);
        setRetryLimit(res.settings.retryLimit ?? 2);
        setFallbackEnabled(res.settings.fallbackEnabled ?? true);

        if (res.settings.budgets) {
          setDailyBudget(res.settings.budgets.dailyLimitUsd);
          setMonthlyBudget(res.settings.budgets.monthlyLimitUsd);
          setWarningThreshold(res.settings.budgets.warningThresholdPercent);
          setActionOnLimit(res.settings.budgets.actionOnLimit);
        }

        if (res.settings.logging) {
          setLogMetadata(res.settings.logging.logMetadata);
          setRetentionDays(res.settings.logging.retentionDays);
          setRetentionLevel(res.settings.logging.retentionLevel);
        }
      } catch (err) {
        console.error("Failed to load AI settings", err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await updateAiSettings({
        defaultProvider,
        defaultModel,
        timeoutMs,
        retryLimit,
        fallbackEnabled,
        budgets: {
          dailyLimitUsd: dailyBudget,
          monthlyLimitUsd: monthlyBudget,
          warningThresholdPercent: warningThreshold,
          actionOnLimit,
        },
        logging: {
          logMetadata,
          retentionDays,
          retentionLevel,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save AI settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !settings) {
    return (
      <div className="py-20 text-center">
        <Spinner />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <div className="card p-5 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-ink">Centralized AI Platform Settings</h2>
          <p className="text-xs text-muted">
            Configure default engines, timeout tolerances, strict cost thresholds, and data retention rules.
          </p>
        </div>

        <Button variant="primary" type="submit" disabled={saving}>
          <Save size={14} className={saving ? "animate-spin" : ""} />
          {saving ? "Saving Changes..." : "Save AI Settings"}
        </Button>
      </div>

      {saveSuccess && (
        <div className="card p-3.5 bg-emerald-50 border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <Check size={16} className="text-emerald-600" />
          Settings successfully persisted to database and AI engine cache refreshed.
        </div>
      )}

      {/* General Settings */}
      <div className="card p-5 bg-white space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-line">
          <Sliders size={16} className="text-brand-600" />
          <h3 className="text-sm font-bold text-ink">General AI Engine Settings</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Default Active AI Provider">
            <Select value={defaultProvider} onChange={(e) => setDefaultProvider(e.target.value)}>
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI API</option>
              <option value="groq">Groq Cloud LPU</option>
              <option value="ollama">Local Ollama</option>
              <option value="heuristic">Heuristic Engine (Deterministic)</option>
            </Select>
          </Field>

          <Field label="Default Production Model Identifier">
            <Input
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              placeholder="e.g. gemini-3.5-flash-lite or gpt-4o-mini"
              required
            />
          </Field>

          <Field label="Provider Request Timeout (Milliseconds)" hint="Threshold before aborting external AI call (min 1000ms)">
            <Input
              type="number"
              min={1000}
              max={60000}
              step={500}
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value) || 8000)}
              required
            />
          </Field>

          <Field label="Model Fallback Retry Attempts" hint="Max retries with fallback models before engaging heuristic parser">
            <Input
              type="number"
              min={0}
              max={5}
              value={retryLimit}
              onChange={(e) => setRetryLimit(Number(e.target.value) || 0)}
              required
            />
          </Field>
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={fallbackEnabled}
              onChange={(e) => setFallbackEnabled(e.target.checked)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
            />
            <span>Enable Automatic Heuristic Fallback on Provider Outage / Rate Limit</span>
          </label>
        </div>
      </div>

      {/* Budget & Cost Limits */}
      <div className="card p-5 bg-white space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-line">
          <ShieldAlert size={16} className="text-amber-600" />
          <h3 className="text-sm font-bold text-ink">Usage Limits & Cost Guardrails</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Daily AI Budget (USD)" hint="Maximum desired spending threshold per day">
            <Input
              type="number"
              min={1}
              max={1000}
              step={0.5}
              value={dailyBudget}
              onChange={(e) => setDailyBudget(Number(e.target.value) || 0)}
              required
            />
          </Field>

          <Field label="Monthly AI Budget (USD)" hint="Maximum desired spending threshold per calendar month">
            <Input
              type="number"
              min={5}
              max={10000}
              step={1}
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(Number(e.target.value) || 0)}
              required
            />
          </Field>

          <Field label="Budget Warning Alert Threshold (%)" hint="Percentage of budget reached before triggering warning banner">
            <Input
              type="number"
              min={10}
              max={100}
              value={warningThreshold}
              onChange={(e) => setWarningThreshold(Number(e.target.value) || 80)}
              required
            />
          </Field>

          <Field label="Action When Budget Limit Exceeded" hint="Safety behavior applied to AI features">
            <Select value={actionOnLimit} onChange={(e) => setActionOnLimit(e.target.value as any)}>
              <option value="warn">Warn Only (Dashboard notification banner)</option>
              <option value="disable_noncritical">Temporarily Switch to Heuristic Parser</option>
              <option value="rate_limit">Strict Rate Limiting for Chat Sessions</option>
            </Select>
          </Field>
        </div>
      </div>

      {/* Logging & Privacy */}
      <div className="card p-5 bg-white space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-line">
          <Lock size={16} className="text-brand-600" />
          <h3 className="text-sm font-bold text-ink">Telemetry, Logging & Privacy Policies</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Log Retention Window (Days)" hint="Automatically purge activity logs older than this duration">
            <Input
              type="number"
              min={1}
              max={365}
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value) || 30)}
              required
            />
          </Field>

          <Field label="Data Retention Privacy Level" hint="Protection applied before storing request metadata">
            <Select value={retentionLevel} onChange={(e) => setRetentionLevel(e.target.value as any)}>
              <option value="sanitized">Sanitized (Redact emails, phone numbers & payment tokens)</option>
              <option value="metadata_only">Metadata Only (Only token counts & timing, no text)</option>
              <option value="full">Debug Mode (Internal testing only)</option>
            </Select>
          </Field>
        </div>

        <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs text-muted flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-slate-600" />
            <span>Configured Provider API Key:</span>
            <span className="font-mono font-bold text-ink bg-slate-200 px-2 py-0.5 rounded">
              {settings?.maskedApiKey || "••••••••"}
            </span>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold">
            Stored securely on backend environment
          </span>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" type="submit" disabled={saving}>
          <Save size={14} />
          {saving ? "Saving Changes..." : "Save AI Settings"}
        </Button>
      </div>
    </form>
  );
}
