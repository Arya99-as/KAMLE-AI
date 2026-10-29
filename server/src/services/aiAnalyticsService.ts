import AiLog from "../models/AiLog.js";
import { getAiConfig } from "./aiService.js";

export interface AnalyticsFilter {
  period?: "today" | "7d" | "30d" | "custom";
  from?: string;
  to?: string;
  feature?: string;
  provider?: string;
  model?: string;
  status?: string;
}

function buildDateMatch(filter: AnalyticsFilter): Record<string, unknown> {
  const match: Record<string, unknown> = {};
  const now = new Date();

  if (filter.period === "today") {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    match.createdAt = { $gte: startOfDay };
  } else if (filter.period === "7d") {
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    match.createdAt = { $gte: d7 };
  } else if (filter.period === "30d") {
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    match.createdAt = { $gte: d30 };
  } else if (filter.period === "custom" && (filter.from || filter.to)) {
    const dateRange: Record<string, Date> = {};
    if (filter.from) dateRange.$gte = new Date(filter.from);
    if (filter.to) dateRange.$lte = new Date(filter.to);
    match.createdAt = dateRange;
  } else {
    // Default 30 days
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    match.createdAt = { $gte: d30 };
  }

  if (filter.feature) match.feature = filter.feature;
  if (filter.provider) match.provider = filter.provider;
  if (filter.model) match.model = filter.model;
  if (filter.status) match.status = filter.status;

  return match;
}

export async function getOverviewStats(filter: AnalyticsFilter = {}) {
  const match = buildDateMatch(filter);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [aggregates, requestsToday, featureCountResult] = await Promise.all([
    AiLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          successfulRequests: {
            $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] },
          },
          failedRequests: {
            $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] },
          },
          fallbackRequests: {
            $sum: { $cond: [{ $eq: ["$fallbackUsed", true] }, 1, 0] },
          },
          totalDuration: { $sum: "$durationMs" },
          totalInputTokens: { $sum: "$inputTokens" },
          totalOutputTokens: { $sum: "$outputTokens" },
          totalTokens: { $sum: "$totalTokens" },
          totalEstimatedCost: { $sum: "$estimatedCost" },
        },
      },
    ]),
    AiLog.countDocuments({ createdAt: { $gte: startOfToday } }),
    AiLog.distinct("feature", match),
  ]);

  const agg = aggregates[0] || {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    fallbackRequests: 0,
    totalDuration: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalEstimatedCost: 0,
  };

  const total = agg.totalRequests;
  const successRate = total > 0 ? Number(((agg.successfulRequests / total) * 100).toFixed(1)) : 100;
  const avgDurationMs = total > 0 ? Math.round(agg.totalDuration / total) : 0;

  // Time-series aggregations grouped by date YYYY-MM-DD
  const timeline = await AiLog.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        total: { $sum: 1 },
        success: { $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] } },
        fallback: { $sum: { $cond: [{ $eq: ["$fallbackUsed", true] }, 1, 0] } },
        tokens: { $sum: "$totalTokens" },
        cost: { $sum: "$estimatedCost" },
        avgDuration: { $avg: "$durationMs" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Usage by feature
  const byFeature = await AiLog.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$feature",
        count: { $sum: 1 },
        tokens: { $sum: "$totalTokens" },
        cost: { $sum: "$estimatedCost" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return {
    metrics: {
      totalRequests: total,
      successfulRequests: agg.successfulRequests,
      failedRequests: agg.failedRequests,
      fallbackRequests: agg.fallbackRequests,
      successRate,
      avgResponseTimeMs: avgDurationMs,
      requestsToday,
      totalTokens: agg.totalTokens,
      totalInputTokens: agg.totalInputTokens,
      totalOutputTokens: agg.totalOutputTokens,
      totalCostUsd: Number(agg.totalEstimatedCost.toFixed(4)),
      activeFeatures: featureCountResult.length,
    },
    timeline: timeline.map((t) => ({
      date: t._id,
      total: t.total,
      success: t.success,
      failed: t.failed,
      fallback: t.fallback,
      tokens: t.tokens,
      cost: Number(t.cost.toFixed(4)),
      avgDurationMs: Math.round(t.avgDuration || 0),
    })),
    byFeature: byFeature.map((f) => ({
      feature: f._id,
      count: f.count,
      tokens: f.tokens,
      cost: Number(f.cost.toFixed(4)),
    })),
  };
}

export async function getUsageAnalytics(filter: AnalyticsFilter = {}) {
  const match = buildDateMatch(filter);

  const [byFeature, byProvider, byModel, latencyStats] = await Promise.all([
    AiLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$feature",
          totalRequests: { $sum: 1 },
          successCount: { $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] } },
          failedCount: { $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] } },
          fallbackCount: { $sum: { $cond: [{ $eq: ["$fallbackUsed", true] }, 1, 0] } },
          inputTokens: { $sum: "$inputTokens" },
          outputTokens: { $sum: "$outputTokens" },
          totalTokens: { $sum: "$totalTokens" },
          avgLatencyMs: { $avg: "$durationMs" },
          estimatedCost: { $sum: "$estimatedCost" },
        },
      },
      { $sort: { totalRequests: -1 } },
    ]),
    AiLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$provider",
          count: { $sum: 1 },
          success: { $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] } },
          tokens: { $sum: "$totalTokens" },
          cost: { $sum: "$estimatedCost" },
          avgLatency: { $avg: "$durationMs" },
        },
      },
      { $sort: { count: -1 } },
    ]),
    AiLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$model",
          provider: { $first: "$provider" },
          count: { $sum: 1 },
          tokens: { $sum: "$totalTokens" },
          cost: { $sum: "$estimatedCost" },
          avgLatency: { $avg: "$durationMs" },
        },
      },
      { $sort: { count: -1 } },
    ]),
    AiLog.find(match).select("durationMs").sort({ durationMs: 1 }).lean().exec(),
  ]);

  // Compute median & 95th percentile latency from sorted durations
  const durations = latencyStats.map((l) => l.durationMs);
  let medianLatencyMs = 0;
  let p95LatencyMs = 0;
  if (durations.length > 0) {
    const mid = Math.floor(durations.length / 2);
    medianLatencyMs = durations[mid] ?? 0;
    const p95Idx = Math.floor(durations.length * 0.95);
    p95LatencyMs = durations[Math.min(p95Idx, durations.length - 1)] ?? 0;
  }

  return {
    byFeature: byFeature.map((f) => ({
      feature: f._id,
      totalRequests: f.totalRequests,
      successCount: f.successCount,
      failedCount: f.failedCount,
      fallbackCount: f.fallbackCount,
      inputTokens: f.inputTokens,
      outputTokens: f.outputTokens,
      totalTokens: f.totalTokens,
      avgLatencyMs: Math.round(f.avgLatencyMs || 0),
      costUsd: Number(f.estimatedCost.toFixed(4)),
    })),
    byProvider: byProvider.map((p) => ({
      provider: p._id,
      count: p.count,
      successCount: p.success,
      tokens: p.tokens,
      costUsd: Number(p.cost.toFixed(4)),
      avgLatencyMs: Math.round(p.avgLatency || 0),
    })),
    byModel: byModel.map((m) => ({
      model: m._id,
      provider: m.provider,
      count: m.count,
      tokens: m.tokens,
      costUsd: Number(m.cost.toFixed(4)),
      avgLatencyMs: Math.round(m.avgLatency || 0),
    })),
    latencyPercentiles: {
      medianMs: medianLatencyMs,
      p95Ms: p95LatencyMs,
    },
  };
}

export async function getCostAnalytics() {
  const config = await getAiConfig();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [costTodayAgg, costWeekAgg, costMonthAgg, byFeature, byProvider, byModel, successfulTotalAgg] = await Promise.all([
    AiLog.aggregate([
      { $match: { createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: "$estimatedCost" } } },
    ]),
    AiLog.aggregate([
      { $match: { createdAt: { $gte: startOfWeek } } },
      { $group: { _id: null, total: { $sum: "$estimatedCost" } } },
    ]),
    AiLog.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$estimatedCost" } } },
    ]),
    AiLog.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      { $group: { _id: "$feature", cost: { $sum: "$estimatedCost" }, count: { $sum: 1 } } },
      { $sort: { cost: -1 } },
    ]),
    AiLog.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      { $group: { _id: "$provider", cost: { $sum: "$estimatedCost" }, count: { $sum: 1 } } },
      { $sort: { cost: -1 } },
    ]),
    AiLog.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      { $group: { _id: "$model", cost: { $sum: "$estimatedCost" }, count: { $sum: 1 } } },
      { $sort: { cost: -1 } },
    ]),
    AiLog.aggregate([
      { $match: { status: "SUCCESS" } },
      { $group: { _id: null, totalCost: { $sum: "$estimatedCost" }, count: { $sum: 1 } } },
    ]),
  ]);

  const costToday = Number((costTodayAgg[0]?.total || 0).toFixed(4));
  const costWeek = Number((costWeekAgg[0]?.total || 0).toFixed(4));
  const costMonth = Number((costMonthAgg[0]?.total || 0).toFixed(4));

  const successfulCount = successfulTotalAgg[0]?.count || 0;
  const successfulCost = successfulTotalAgg[0]?.totalCost || 0;
  const costPerSuccessfulRequest = successfulCount > 0 ? Number((successfulCost / successfulCount).toFixed(5)) : 0;

  const dailyBudget = config.budgets?.dailyLimitUsd ?? 10.0;
  const monthlyBudget = config.budgets?.monthlyLimitUsd ?? 150.0;
  const warningThresholdPercent = config.budgets?.warningThresholdPercent ?? 80;

  const dailyUsagePercent = dailyBudget > 0 ? Number(((costToday / dailyBudget) * 100).toFixed(1)) : 0;
  const monthlyUsagePercent = monthlyBudget > 0 ? Number(((costMonth / monthlyBudget) * 100).toFixed(1)) : 0;

  const dailyWarningExceeded = dailyUsagePercent >= warningThresholdPercent;
  const monthlyWarningExceeded = monthlyUsagePercent >= warningThresholdPercent;

  return {
    summary: {
      costTodayUsd: costToday,
      costThisWeekUsd: costWeek,
      costThisMonthUsd: costMonth,
      costPerSuccessfulRequestUsd: costPerSuccessfulRequest,
      pricingEffectiveDate: config.pricing?.[0]?.effectiveDate || new Date("2026-01-01"),
    },
    budgets: {
      dailyLimitUsd: dailyBudget,
      monthlyLimitUsd: monthlyBudget,
      dailyUsagePercent,
      monthlyUsagePercent,
      warningThresholdPercent,
      dailyWarningExceeded,
      monthlyWarningExceeded,
      actionOnLimit: config.budgets?.actionOnLimit || "warn",
    },
    byFeature: byFeature.map((f) => ({
      feature: f._id,
      costUsd: Number(f.cost.toFixed(4)),
      requests: f.count,
    })),
    byProvider: byProvider.map((p) => ({
      provider: p._id,
      costUsd: Number(p.cost.toFixed(4)),
      requests: p.count,
    })),
    byModel: byModel.map((m) => ({
      model: m._id,
      costUsd: Number(m.cost.toFixed(4)),
      requests: m.count,
    })),
  };
}

export async function getPerformanceAnalytics(filter: AnalyticsFilter = {}) {
  const match = buildDateMatch(filter);

  const [logs, timeoutCount, retryCountAgg, fallbackCount, providerFailures] = await Promise.all([
    AiLog.find(match).select("durationMs feature status").sort({ durationMs: 1 }).lean().exec(),
    AiLog.countDocuments({ ...match, errorCategory: "PROVIDER_TIMEOUT" }),
    AiLog.aggregate([
      { $match: match },
      { $group: { _id: null, totalRetries: { $sum: "$retryCount" } } },
    ]),
    AiLog.countDocuments({ ...match, fallbackUsed: true }),
    AiLog.countDocuments({ ...match, status: "FAILED" }),
  ]);

  const durations = logs.map((l) => l.durationMs);
  const total = durations.length;
  const avgLatencyMs = total > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / total) : 0;

  let p50 = 0;
  let p90 = 0;
  let p95 = 0;
  if (total > 0) {
    p50 = durations[Math.floor(total * 0.5)] ?? 0;
    p90 = durations[Math.min(Math.floor(total * 0.9), total - 1)] ?? 0;
    p95 = durations[Math.min(Math.floor(total * 0.95), total - 1)] ?? 0;
  }

  // Slowest features
  const featurePerformance = await AiLog.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$feature",
        requests: { $sum: 1 },
        avgDurationMs: { $avg: "$durationMs" },
        maxDurationMs: { $max: "$durationMs" },
        minDurationMs: { $min: "$durationMs" },
        failures: { $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] } },
      },
    },
    { $sort: { avgDurationMs: -1 } },
  ]);

  return {
    metrics: {
      totalRequests: total,
      avgLatencyMs,
      p50LatencyMs: p50,
      p90LatencyMs: p90,
      p95LatencyMs: p95,
      timeoutCount,
      retryCount: retryCountAgg[0]?.totalRetries || 0,
      fallbackCount,
      providerFailures,
    },
    slowestFeatures: featurePerformance.map((f) => ({
      feature: f._id,
      requests: f.requests,
      avgDurationMs: Math.round(f.avgDurationMs || 0),
      maxDurationMs: f.maxDurationMs || 0,
      minDurationMs: f.minDurationMs || 0,
      failures: f.failures,
    })),
  };
}

export async function getErrorAnalytics(filter: AnalyticsFilter = {}) {
  const match = buildDateMatch(filter);
  const errorMatch = {
    ...match,
    $or: [
      { status: "FAILED" },
      { errorCategory: { $exists: true, $ne: null } },
      { errorMessage: { $exists: true, $ne: null } },
    ],
  };

  const [categories, recentErrors] = await Promise.all([
    AiLog.aggregate([
      { $match: errorMatch },
      {
        $group: {
          _id: { $ifNull: ["$errorCategory", "UNCLASSIFIED_ERROR"] },
          count: { $sum: 1 },
          lastOccurred: { $max: "$createdAt" },
        },
      },
      { $sort: { count: -1 } },
    ]),
    AiLog.find(errorMatch)
      .sort({ createdAt: -1 })
      .limit(50)
      .select("requestId correlationId feature provider model status durationMs errorCategory errorCode errorMessage retryCount fallbackUsed createdAt")
      .lean()
      .exec(),
  ]);

  return {
    categories: categories.map((c) => ({
      category: c._id,
      count: c.count,
      lastOccurred: c.lastOccurred,
    })),
    recentErrors,
  };
}
