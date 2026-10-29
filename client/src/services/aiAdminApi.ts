import { api, tokenStore } from "../lib/api";
import type {
  AiOverviewResponse,
  AiActivityLog,
  AiProviderInfo,
  AiUsageAnalytics,
  AiCostAnalytics,
  AiPerformanceAnalytics,
  AiErrorAnalytics,
  AiFeatureItem,
  AiEvaluationRun,
  AiAuditItem,
  AiSettings,
} from "../types/aiAdmin";

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export async function fetchAiOverview(filters: Record<string, string> = {}): Promise<AiOverviewResponse> {
  const params = new URLSearchParams(filters);
  return api<AiOverviewResponse>(`/admin/ai/overview?${params.toString()}`);
}

export async function fetchAiLogs(filters: Record<string, string | number> = {}): Promise<PaginatedResult<AiActivityLog>> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "") params.append(k, String(v));
  }
  return api<PaginatedResult<AiActivityLog>>(`/admin/ai/logs?${params.toString()}`);
}

export async function fetchAiLogDetail(id: string): Promise<{ success: boolean; log: AiActivityLog }> {
  return api<{ success: boolean; log: AiActivityLog }>(`/admin/ai/logs/${id}`);
}

export function getExportLogsCsvUrl(filters: Record<string, string> = {}): string {
  const params = new URLSearchParams(filters);
  return `/api/admin/ai/logs/export/csv?${params.toString()}`;
}

export async function downloadLogsCsv(filters: Record<string, string> = {}): Promise<void> {
  const token = tokenStore.get();
  const url = getExportLogsCsvUrl(filters);
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to export logs CSV");
  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = `murn-ai-logs-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function fetchAiProviders(): Promise<{ success: boolean; providers: AiProviderInfo[] }> {
  return api<{ success: boolean; providers: AiProviderInfo[] }>("/admin/ai/providers");
}

export async function testAiProvider(provider: string): Promise<any> {
  return api("/admin/ai/providers/test", { method: "POST", body: { provider } });
}

export async function fetchAiUsageAnalytics(filters: Record<string, string> = {}): Promise<{ success: boolean; analytics: AiUsageAnalytics }> {
  const params = new URLSearchParams(filters);
  return api<{ success: boolean; analytics: AiUsageAnalytics }>(`/admin/ai/analytics?${params.toString()}`);
}

export async function fetchAiCostAnalytics(): Promise<{ success: boolean; costs: AiCostAnalytics }> {
  return api<{ success: boolean; costs: AiCostAnalytics }>("/admin/ai/costs");
}

export async function fetchAiPerformanceAnalytics(filters: Record<string, string> = {}): Promise<{ success: boolean; performance: AiPerformanceAnalytics }> {
  const params = new URLSearchParams(filters);
  return api<{ success: boolean; performance: AiPerformanceAnalytics }>(`/admin/ai/performance?${params.toString()}`);
}

export async function fetchAiErrorAnalytics(filters: Record<string, string> = {}): Promise<{ success: boolean; errors: AiErrorAnalytics }> {
  const params = new URLSearchParams(filters);
  return api<{ success: boolean; errors: AiErrorAnalytics }>(`/admin/ai/errors?${params.toString()}`);
}

export async function retryAiError(logId: string): Promise<any> {
  return api(`/admin/ai/errors/${logId}/retry`, { method: "POST" });
}

export async function fetchAiFeatures(): Promise<{ success: boolean; features: AiFeatureItem[] }> {
  return api<{ success: boolean; features: AiFeatureItem[] }>("/admin/ai/features");
}

export async function updateAiFeature(key: string, data: Partial<AiFeatureItem>): Promise<any> {
  return api(`/admin/ai/features/${key}`, { method: "PATCH", body: data });
}

export async function fetchAiEvaluations(): Promise<{ success: boolean; evaluations: AiEvaluationRun[] }> {
  return api<{ success: boolean; evaluations: AiEvaluationRun[] }>("/admin/ai/evaluations");
}

export async function runAiEvaluation(): Promise<{ success: boolean; evaluation: AiEvaluationRun; message: string }> {
  return api<{ success: boolean; evaluation: AiEvaluationRun; message: string }>("/admin/ai/evaluations/run", { method: "POST" });
}

export async function fetchAiAuditLogs(filters: Record<string, string | number> = {}): Promise<PaginatedResult<AiAuditItem>> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "") params.append(k, String(v));
  }
  return api<PaginatedResult<AiAuditItem>>(`/admin/ai/audit?${params.toString()}`);
}

export async function fetchAiSettings(): Promise<{ success: boolean; settings: AiSettings }> {
  return api<{ success: boolean; settings: AiSettings }>("/admin/ai/settings");
}

export async function updateAiSettings(settings: Partial<AiSettings>): Promise<any> {
  return api("/admin/ai/settings", { method: "PUT", body: settings });
}
