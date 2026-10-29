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
  badge?: string;
}

const AI_NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "AI Overview", icon: Sparkles },
  { id: "activity_logs", label: "AI Activity Logs", icon: FileText },
  { id: "requests", label: "AI Requests", icon: Clock },
  { id: "models_providers", label: "AI Models & Providers", icon: Cpu },
  { id: "usage_analytics", label: "AI Usage Analytics", icon: BarChart3 },
  { id: "costs", label: "AI Costs", icon: DollarSign },
  { id: "performance", label: "AI Performance", icon: Gauge },
  { id: "errors", label: "AI Errors", icon: AlertOctagon },
  { id: "features", label: "AI Features", icon: Layers },
  { id: "evaluations", label: "AI Evaluations", icon: Award },
  { id: "security_audit", label: "AI Security & Audit", icon: Shield },
  { id: "settings", label: "AI Settings", icon: Settings },
];

export function AiControlCenter() {
  const [activeTab, setActiveTab] = useState<AiNavTab>("overview");

  return (
    <div className="space-y-6">
      {/* AI Control Center Header */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 p-6 text-white shadow-lift border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold text-brand-300 border border-brand-500/30">
              <Sparkles size={13} className="text-brand-400" /> MURN STACK • Centralized Intelligence Hub
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">MURN AI CONTROL CENTER</h1>
            <p className="text-xs text-slate-300 max-w-xl">
              Unified governance, real-time activity telemetry, model health diagnostics, cost budgeting, and benchmark evaluations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/5 p-3 border border-white/10 text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Governance</span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 justify-end">
                <CheckCircle2 size={13} /> Admin Authorized
              </span>
            </div>
          </div>
        </div>

        {/* Sub-Nav Pill Scroller */}
        <div className="mt-6 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-t border-white/10 pt-4">
          {AI_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  isActive
                    ? "bg-brand-500 text-white shadow-sm ring-1 ring-brand-400"
                    : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={14} className={isActive ? "text-white" : "text-brand-400"} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic View Mount */}
      <div className="transition-all">
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
      </div>
    </div>
  );
}
