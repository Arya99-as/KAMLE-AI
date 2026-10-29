export interface AiMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  fallbackRequests: number;
  successRate: number;
  avgResponseTimeMs: number;
  requestsToday: number;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  activeFeatures: number;
}

export interface AiTimelinePoint {
  date: string;
  total: number;
  success: number;
  failed: number;
  fallback: number;
  tokens: number;
  cost: number;
  avgDurationMs: number;
}

export interface AiFeatureBreakdown {
  feature: string;
  count: number;
  tokens: number;
  cost: number;
}

export interface AiProviderHealth {
  provider: string;
  configured: boolean;
  model: string | null;
  baseUrl: string | null;
  apiKeySet: boolean;
  reachable: boolean;
  latencyMs: number | null;
  models: string[];
  error: string | null;
}

export interface AiOverviewResponse {
  success: boolean;
  stats: {
    metrics: AiMetrics;
    timeline: AiTimelinePoint[];
    byFeature: AiFeatureBreakdown[];
  };
  activeProviderHealth: AiProviderHealth | null;
}

export interface AiActivityLog {
  _id: string;
  requestId: string;
  correlationId: string;
  feature: string;
  provider: string;
  model: string;
  operation: string;
  status: "SUCCESS" | "FAILED" | "FALLBACK";
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  tokensEstimated: boolean;
  estimatedCost: number;
  retryCount: number;
  fallbackUsed: boolean;
  fallbackReason?: string;
  errorCategory?: string;
  errorCode?: string;
  errorMessage?: string;
  userId?: {
    _id?: string;
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
  };
  userRole?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AiProviderInfo {
  provider: string;
  name: string;
  isDefault: boolean;
  isConfigured: boolean;
  configuredModel: string;
  availableModels: string[];
  totalRequests: number;
  failureRatePercent: number;
  lastSuccessfulAt: string | null;
  avgLatencyMs: number;
  status: "configured" | "unconfigured";
}

export interface AiUsageAnalytics {
  byFeature: {
    feature: string;
    totalRequests: number;
    successCount: number;
    failedCount: number;
    fallbackCount: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    avgLatencyMs: number;
    costUsd: number;
  }[];
  byProvider: {
    provider: string;
    count: number;
    successCount: number;
    tokens: number;
    costUsd: number;
    avgLatencyMs: number;
  }[];
  byModel: {
    model: string;
    provider: string;
    count: number;
    tokens: number;
    costUsd: number;
    avgLatencyMs: number;
  }[];
  latencyPercentiles: {
    medianMs: number;
    p95Ms: number;
  };
}

export interface AiCostAnalytics {
  summary: {
    costTodayUsd: number;
    costThisWeekUsd: number;
    costThisMonthUsd: number;
    costPerSuccessfulRequestUsd: number;
    pricingEffectiveDate: string;
  };
  budgets: {
    dailyLimitUsd: number;
    monthlyLimitUsd: number;
    dailyUsagePercent: number;
    monthlyUsagePercent: number;
    warningThresholdPercent: number;
    dailyWarningExceeded: boolean;
    monthlyWarningExceeded: boolean;
    actionOnLimit: "warn" | "rate_limit" | "disable_noncritical";
  };
  byFeature: { feature: string; costUsd: number; requests: number }[];
  byProvider: { provider: string; costUsd: number; requests: number }[];
  byModel: { model: string; costUsd: number; requests: number }[];
}

export interface AiPerformanceAnalytics {
  metrics: {
    totalRequests: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
    p90LatencyMs: number;
    p95LatencyMs: number;
    timeoutCount: number;
    retryCount: number;
    fallbackCount: number;
    providerFailures: number;
  };
  slowestFeatures: {
    feature: string;
    requests: number;
    avgDurationMs: number;
    maxDurationMs: number;
    minDurationMs: number;
    failures: number;
  }[];
}

export interface AiErrorAnalytics {
  categories: {
    category: string;
    count: number;
    lastOccurred: string;
  }[];
  recentErrors: AiActivityLog[];
}

export interface AiFeatureItem {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  configuredProvider: string;
  configuredModel: string;
  usageCount: number;
  successRatePercent: number;
  avgDurationMs: number;
  lastSuccessfulAt: string | null;
}

export interface AiEvaluationRun {
  _id: string;
  evaluationId: string;
  datasetName: string;
  datasetVersion: string;
  feature: string;
  provider: string;
  model: string;
  totalCases: number;
  passedCases: number;
  accuracyPercent: number;
  avgDurationMs: number;
  validJsonRatePercent: number;
  failedCases: {
    prompt: string;
    expectedCategory?: string;
    actualCategory?: string;
    expectedSkills?: string[];
    actualSkills?: string[];
    error?: string;
  }[];
  runBy?: { name?: string; email?: string };
  createdAt: string;
}

export interface AiAuditItem {
  _id: string;
  adminId?: { name?: string; email?: string; role?: string };
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AiSettings {
  defaultProvider: string;
  defaultModel: string;
  fallbackModels: string[];
  timeoutMs: number;
  retryLimit: number;
  fallbackEnabled: boolean;
  budgets: {
    dailyLimitUsd: number;
    monthlyLimitUsd: number;
    warningThresholdPercent: number;
    actionOnLimit: "warn" | "rate_limit" | "disable_noncritical";
  };
  logging: {
    logMetadata: boolean;
    retentionDays: number;
    retentionLevel: "metadata_only" | "sanitized" | "full";
  };
  pricing?: {
    model: string;
    provider: string;
    inputPer1M: number;
    outputPer1M: number;
    effectiveDate: string;
  }[];
  maskedApiKey?: string;
  baseUrl?: string;
}
