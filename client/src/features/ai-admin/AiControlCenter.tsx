import {
  AlertOctagon,
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  Cpu,
  DollarSign,
  FileText,
  Gauge,
  Layers,
  Settings,
  Shield,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { AiOverviewView } from "./AiOverviewView";
import { AiActivityLogsView } from "./AiActivityLogsView";
import { AiRequestsView } from "./AiRequestsView";
import { AiModelsProvidersView } from "./AiModelsProvidersView";
import { AiUsageAnalyticsView } from "./AiUsageAnalyticsView";
import { AiCostsView } from "./AiCostsView";
import { AiPerformanceView } from "./AiPerformanceView";
import { AiErrorsView } from "./AiErrorsView";
import { AiFeaturesView } from "./AiFeaturesView";
import { AiEvaluationsView } from "./AiEvaluationsView";
import { AiSecurityAuditView } from "./AiSecurityAuditView";
import { AiSettingsView } from "./AiSettingsView";

export type AiNavTab =
  | "overview"
  | "activity_logs"
  | "requests"
  | "models_providers"
  | "usage_analytics"
  | "costs"
  | "performance"
  | "errors"
  | "features"
  | "evaluations"
  | "security_audit"
  | "settings";

interface NavItem {
  id: AiNavTab;
  label: string;
  icon: typeof Sparkles;
  group: "observability" | "governance" | "config";
}

const AI_NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Executive Overview", icon: Sparkles, group: "observability" },
  { id: "usage_analytics", label: "Usage Analytics", icon: BarChart3, group: "observability" },
  { id: "requests", label: "Request Stream", icon: Clock, group: "observability" },
  { id: "activity_logs", label: "Audit Trail", icon: FileText, group: "observability" },
  { id: "performance", label: "Latency & Performance", icon: Gauge, group: "observability" },
  { id: "errors", label: "Errors & Incidents", icon: AlertOctagon, group: "observability" },
  { id: "costs", label: "Cost Analytics", icon: DollarSign, group: "governance" },
  { id: "models_providers", label: "Models & Providers", icon: Cpu, group: "governance" },
  { id: "features", label: "Feature Flags", icon: Layers, group: "governance" },
  { id: "evaluations", label: "Evaluations & Benchmarks", icon: Award, group: "governance" },
  { id: "security_audit", label: "Security & Compliance", icon: Shield, group: "governance" },
  { id: "settings", label: "System Settings", icon: Settings, group: "config" },
];

export function AiControlCenter() {
  const [activeTab, setActiveTab] = useState<AiNavTab>("overview");

  const observability = AI_NAV_ITEMS.filter((i) => i.group === "observability");
  const governance = AI_NAV_ITEMS.filter((i) => i.group === "governance");
  const config = AI_NAV_ITEMS.filter((i) => i.group === "config");

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 text-white shadow-lg">
        <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold text-brand-300">
              <Sparkles size={13} /> AI Intelligence Operations
            </div>
            <h1 className="text-2xl font-black tracking-tight">AI Control Center</h1>
            <p className="max-w-2xl text-sm text-slate-300">
              Real-time telemetry, cost governance, model performance, security auditing, and evaluation tracking across all Kamle AI usage.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span className="font-semibold">Admin Authorized</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border border-line bg-white shadow-sm">
          <div className="border-b border-line px-5 py-4">
            <p className="text-sm font-bold text-ink">Analytics Console</p>
            <p className="mt-1 text-xs text-muted">Monitor, govern, and optimize</p>
          </div>
          <nav className="space-y-4 p-3">
            <div>
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted">Observability</p>
              <div className="mt-2 space-y-1">
                {observability.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold transition ${
                        isActive ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-slate-50 hover:text-ink"
                      }`}
                    >
                      <Icon size={16} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted">Governance</p>
              <div className="mt-2 space-y-1">
                {governance.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold transition ${
                        isActive ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-slate-50 hover:text-ink"
                      }`}
                    >
                      <Icon size={16} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted">Configuration</p>
              <div className="mt-2 space-y-1">
                {config.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold transition ${
                        isActive ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-slate-50 hover:text-ink"
                      }`}
                    >
                      <Icon size={16} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>
        </aside>

        <main className="space-y-6">
          {activeTab === "overview" && <AiOverviewView />}
          {activeTab === "activity_logs" && <AiActivityLogsView />}
          {activeTab === "requests" && <AiRequestsView />}
          {activeTab === "models_providers" && <AiModelsProvidersView />}
          {activeTab === "usage_analytics" && <AiUsageAnalyticsView />}
          {activeTab === "costs" && <AiCostsView />}
          {activeTab === "performance" && <AiPerformanceView />}
          {activeTab === "errors" && <AiErrorsView />}
          {activeTab === "features" && <AiFeaturesView />}
          {activeTab === "evaluations" && <AiEvaluationsView />}
          {activeTab === "security_audit" && <AiSecurityAuditView />}
          {activeTab === "settings" && <AiSettingsView />}
        </main>
      </div>
    </div>
  );
}
