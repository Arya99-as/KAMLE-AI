import type { Request, Response } from "express";
import mongoose from "mongoose";
import AiLog from "../models/AiLog.js";
import AiConfig from "../models/AiConfig.js";
import AiEvaluation from "../models/AiEvaluation.js";
import AuditLog from "../models/AuditLog.js";
import ApiError from "../utils/ApiError.js";
import { buildPaginated, getPagination } from "../utils/pagination.js";
import { recordAudit } from "../services/auditService.js";
import { checkAiProvider, getAiConfig, invalidateAiConfigCache } from "../services/aiService.js";
import {
  getOverviewStats,
  getUsageAnalytics,
  getCostAnalytics,
  getPerformanceAnalytics,
  getErrorAnalytics,
} from "../services/aiAnalyticsService.js";
import { runAiEvaluation } from "../services/aiEvaluationService.js";
import env from "../config/env.js";

function maskSecret(val?: string): string {
  if (!val || val.length < 8) return val ? "••••••••" : "";
  return `${val.slice(0, 4)}••••••••${val.slice(-3)}`;
}

export async function overview(req: Request, res: Response) {
  const filter = {
    period: req.query.period as any,
    from: req.query.from as string,
    to: req.query.to as string,
    feature: req.query.feature as string,
    provider: req.query.provider as string,
    model: req.query.model as string,
    status: req.query.status as string,
  };

  const [stats, health] = await Promise.all([
    getOverviewStats(filter),
    checkAiProvider().catch(() => null),
  ]);

  res.json({
    success: true,
    stats,
    activeProviderHealth: health,
  });
}

export async function listLogs(req: Request, res: Response) {
  const page = getPagination(req.query as Record<string, unknown>, 25);
  const filter: Record<string, unknown> = {};

  if (req.query.feature) filter.feature = req.query.feature;
  if (req.query.provider) filter.provider = req.query.provider;
  if (req.query.model) filter.model = req.query.model;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from || req.query.to) {
    const dateRange: Record<string, Date> = {};
    if (req.query.from) dateRange.$gte = new Date(String(req.query.from));
    if (req.query.to) dateRange.$lte = new Date(String(req.query.to));
    filter.createdAt = dateRange;
  }
  if (req.query.q) {
    const q = String(req.query.q);
    filter.$or = [
      { requestId: { $regex: q, $options: "i" } },
      { correlationId: { $regex: q, $options: "i" } },
      { errorMessage: { $regex: q, $options: "i" } },
      { errorCategory: { $regex: q, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    AiLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("userId", "name phone email role")
      .lean()
      .exec(),
    AiLog.countDocuments(filter),
  ]);

  res.json(buildPaginated(items, total, page));
}

export async function getLogDetail(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params;
  const isObjectId = mongoose.isValidObjectId(id);
  const query = isObjectId ? { _id: id } : { requestId: id };

  const log = await AiLog.findOne(query).populate("userId", "name email phone role").lean().exec();
  if (!log) throw ApiError.notFound("AI activity log record not found");

  res.json({ success: true, log });
}

export async function exportLogsCsv(req: Request, res: Response) {
  const filter: Record<string, unknown> = {};
  if (req.query.feature) filter.feature = req.query.feature;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.provider) filter.provider = req.query.provider;

  // Maximum export of 2000 rows for performance and memory safety
  const logs = await AiLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(2000)
    .lean()
    .exec();

  const headers = [
    "LogId",
    "Timestamp",
    "Feature",
    "Provider",
    "Model",
    "Status",
    "DurationMs",
    "InputTokens",
    "OutputTokens",
    "TotalTokens",
    "EstimatedCostUsd",
    "RetryCount",
    "FallbackUsed",
    "ErrorCategory",
    "ErrorMessage",
    "RequestId",
  ];

  const rows = logs.map((l) => [
    String(l._id),
    new Date(l.createdAt).toISOString(),
    `"${l.feature}"`,
    `"${l.provider}"`,
    `"${l.model}"`,
    `"${l.status}"`,
    l.durationMs,
    l.inputTokens,
    l.outputTokens,
    l.totalTokens,
    l.estimatedCost,
    l.retryCount,
    l.fallbackUsed ? "true" : "false",
    `"${l.errorCategory || ""}"`,
    `"${(l.errorMessage || "").replace(/"/g, '""')}"`,
    `"${l.requestId}"`,
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="murn-ai-logs-${Date.now()}.csv"`);
  res.status(200).send(csv);
}

export async function listProviders(_req: Request, res: Response) {
  const config = await getAiConfig();
  const providersList = [
    {
      provider: "gemini",
      name: "Google Gemini",
      isDefault: (config.defaultProvider || env.ai.provider) === "gemini",
      isConfigured: Boolean(env.ai.apiKey && env.ai.baseUrl && env.ai.provider === "gemini"),
      configuredModel: config.defaultModel || env.ai.model,
      availableModels: ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.6-flash"],
    },
    {
      provider: "openai",
      name: "OpenAI API",
      isDefault: (config.defaultProvider || env.ai.provider) === "openai",
      isConfigured: Boolean(env.ai.apiKey && env.ai.baseUrl && env.ai.provider === "openai"),
      configuredModel: "gpt-4o-mini",
      availableModels: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
    },
    {
      provider: "groq",
      name: "Groq Cloud LPU",
      isDefault: (config.defaultProvider || env.ai.provider) === "groq",
      isConfigured: Boolean(env.ai.apiKey && env.ai.baseUrl && env.ai.provider === "groq"),
      configuredModel: "llama-3.3-70b-versatile",
      availableModels: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    },
    {
      provider: "ollama",
      name: "Local Ollama Instance",
      isDefault: (config.defaultProvider || env.ai.provider) === "ollama",
      isConfigured: Boolean(env.ai.baseUrl && env.ai.provider === "ollama"),
      configuredModel: "llama3.2",
      availableModels: ["llama3.2", "mistral", "qwen2.5"],
    },
    {
      provider: "heuristic",
      name: "Deterministic Fallback Engine",
      isDefault: (config.defaultProvider || env.ai.provider) === "heuristic",
      isConfigured: true,
      configuredModel: "heuristic-deterministic",
      availableModels: ["heuristic-deterministic"],
    },
  ];

  // Enrich with stats from AiLog for each provider
  const enriched = await Promise.all(
    providersList.map(async (p) => {
      const [totalRequests, successCount, lastSuccess, avgDurationAgg] = await Promise.all([
        AiLog.countDocuments({ provider: p.provider }),
        AiLog.countDocuments({ provider: p.provider, status: "SUCCESS" }),
        AiLog.findOne({ provider: p.provider, status: "SUCCESS" }).sort({ createdAt: -1 }).select("createdAt").lean().exec(),
        AiLog.aggregate([
          { $match: { provider: p.provider } },
          { $group: { _id: null, avgDur: { $avg: "$durationMs" } } },
        ]),
      ]);

      const failureRate =
        totalRequests > 0
          ? Number((((totalRequests - successCount) / totalRequests) * 100).toFixed(1))
          : 0;

      return {
        ...p,
        totalRequests,
        failureRatePercent: failureRate,
        lastSuccessfulAt: lastSuccess?.createdAt || null,
        avgLatencyMs: Math.round(avgDurationAgg[0]?.avgDur || 0),
        status: p.isConfigured ? "configured" : "unconfigured",
      };
    }),
  );

  res.json({ success: true, providers: enriched });
}

export async function testProvider(req: Request, res: Response) {
  const target = (req.body.provider as string) || env.ai.provider;
  const result = await checkAiProvider(target);
  res.json({ success: true, health: result });
}

export async function usageAnalytics(req: Request, res: Response) {
  const filter = {
    period: req.query.period as any,
    from: req.query.from as string,
    to: req.query.to as string,
    feature: req.query.feature as string,
    provider: req.query.provider as string,
    model: req.query.model as string,
  };
  const data = await getUsageAnalytics(filter);
  res.json({ success: true, analytics: data });
}

export async function costAnalytics(_req: Request, res: Response) {
  const data = await getCostAnalytics();
  res.json({ success: true, costs: data });
}

export async function performanceAnalytics(req: Request, res: Response) {
  const filter = {
    period: req.query.period as any,
    from: req.query.from as string,
    to: req.query.to as string,
    feature: req.query.feature as string,
  };
  const data = await getPerformanceAnalytics(filter);
  res.json({ success: true, performance: data });
}

export async function errorAnalytics(req: Request, res: Response) {
  const filter = {
    period: req.query.period as any,
    from: req.query.from as string,
    to: req.query.to as string,
    feature: req.query.feature as string,
  };
  const data = await getErrorAnalytics(filter);
  res.json({ success: true, errors: data });
}

export async function retryOperation(req: Request<{ id: string }>, res: Response) {
  const log = await AiLog.findById(req.params.id);
  if (!log) throw ApiError.notFound("Log record not found");

  // Controlled test health check retry to verify current provider state
  const probe = await checkAiProvider(log.provider);

  await recordAudit({
    adminId: req.user!.id,
    action: "ai.retry_test_probe",
    targetType: "AiLog",
    targetId: String(log._id),
    metadata: { provider: log.provider, model: log.model, probeResult: probe.reachable },
  });

  res.json({
    success: true,
    message: probe.reachable
      ? `Provider ${log.provider} is currently healthy & reachable.`
      : `Provider ${log.provider} probe failed: ${probe.error || "unreachable"}`,
    probe,
  });
}

export async function listFeatures(_req: Request, res: Response) {
  const config = await getAiConfig();
  const featuresMap = config.features || {};

  const knownFeatures = [
    {
      key: "problem_understanding",
      name: "Problem Understanding & Requirement Extraction",
      description: "Interprets conversational customer requests, classifies trade categories, and detects urgency and location",
    },
    {
      key: "worker_matching",
      name: "Intelligent Worker Matching Engine",
      description: "Ranks verified local workers based on multi-factor skill compatibility, ratings, distance, and urgency",
    },
    {
      key: "ai_search",
      name: "Marketplace Search Query Parsing",
      description: "Extracts trade categories and required skills from search bar queries with instant heuristic mapping",
    },
  ];

  const enriched = await Promise.all(
    knownFeatures.map(async (feat) => {
      const customConf = (featuresMap as any)[feat.key] || { enabled: true };
      const [totalUsage, successCount, lastSuccess, avgDurAgg] = await Promise.all([
        AiLog.countDocuments({ feature: feat.key }),
        AiLog.countDocuments({ feature: feat.key, status: "SUCCESS" }),
        AiLog.findOne({ feature: feat.key, status: "SUCCESS" }).sort({ createdAt: -1 }).select("createdAt").lean().exec(),
        AiLog.aggregate([
          { $match: { feature: feat.key } },
          { $group: { _id: null, avgDur: { $avg: "$durationMs" } } },
        ]),
      ]);

      const successRate = totalUsage > 0 ? Number(((successCount / totalUsage) * 100).toFixed(1)) : 100;

      return {
        key: feat.key,
        name: feat.name,
        description: feat.description,
        enabled: customConf.enabled !== false,
        configuredProvider: customConf.provider || config.defaultProvider || env.ai.provider,
        configuredModel: customConf.model || config.defaultModel || env.ai.model,
        usageCount: totalUsage,
        successRatePercent: successRate,
        avgDurationMs: Math.round(avgDurAgg[0]?.avgDur || 0),
        lastSuccessfulAt: lastSuccess?.createdAt || null,
      };
    }),
  );

  res.json({ success: true, features: enriched });
}

export async function updateFeature(req: Request<{ key: string }>, res: Response) {
  const { key } = req.params;
  const { enabled, provider, model } = req.body;

  let config = await AiConfig.findOne({ key: "global" });
  if (!config) config = new AiConfig({ key: "global" });

  if (!config.features) config.features = {} as any;
  const current = (config.features as any)[key] || { enabled: true, description: key };

  const prev = { ...current };
  if (enabled !== undefined) current.enabled = Boolean(enabled);
  if (provider !== undefined) current.provider = provider;
  if (model !== undefined) current.model = model;

  (config.features as any)[key] = current;
  config.updatedBy = new mongoose.Types.ObjectId(req.user!.id);
  config.markModified("features");
  await config.save();
  invalidateAiConfigCache();

  await recordAudit({
    adminId: req.user!.id,
    action: "ai.feature_update",
    targetType: "AiConfig.features",
    targetId: key,
    metadata: { featureKey: key, before: prev, after: current },
  });

  res.json({ success: true, feature: current, message: `Feature ${key} updated successfully` });
}

export async function listEvaluations(_req: Request, res: Response) {
  const runs = await AiEvaluation.find().sort({ createdAt: -1 }).limit(30).populate("runBy", "name email").lean().exec();
  res.json({ success: true, evaluations: runs });
}

export async function runEvaluation(req: Request, res: Response) {
  const evalResult = await runAiEvaluation(req.user?.id);

  await recordAudit({
    adminId: req.user!.id,
    action: "ai.evaluation_run",
    targetType: "AiEvaluation",
    targetId: String(evalResult._id),
    metadata: {
      evaluationId: evalResult.evaluationId,
      accuracy: evalResult.accuracyPercent,
      totalCases: evalResult.totalCases,
    },
  });

  res.json({ success: true, evaluation: evalResult, message: "Evaluation run completed successfully" });
}

export async function getAuditLogs(req: Request, res: Response) {
  const page = getPagination(req.query as Record<string, unknown>, 25);
  const filter: Record<string, unknown> = {
    action: { $regex: /^ai\./ },
  };

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("adminId", "name email role")
      .lean()
      .exec(),
    AuditLog.countDocuments(filter),
  ]);

  res.json(buildPaginated(items, total, page));
}

export async function getSettings(_req: Request, res: Response) {
  const config = await getAiConfig();
  // Safe response masking secrets
  res.json({
    success: true,
    settings: {
      defaultProvider: config.defaultProvider || env.ai.provider,
      defaultModel: config.defaultModel || env.ai.model,
      fallbackModels: config.fallbackModels || env.ai.fallbackModels,
      timeoutMs: config.timeoutMs || env.ai.timeoutMs,
      retryLimit: config.retryLimit ?? 2,
      fallbackEnabled: config.fallbackEnabled ?? true,
      budgets: config.budgets || {
        dailyLimitUsd: 10.0,
        monthlyLimitUsd: 150.0,
        warningThresholdPercent: 80,
        actionOnLimit: "warn",
      },
      logging: config.logging || {
        logMetadata: true,
        retentionDays: 30,
        retentionLevel: "sanitized",
      },
      pricing: config.pricing || [],
      maskedApiKey: maskSecret(env.ai.apiKey),
      baseUrl: env.ai.baseUrl,
    },
  });
}

export async function updateSettings(req: Request, res: Response) {
  const body = req.body;
  let config = await AiConfig.findOne({ key: "global" });
  if (!config) config = new AiConfig({ key: "global" });

  const beforeSnapshot = {
    defaultProvider: config.defaultProvider,
    defaultModel: config.defaultModel,
    fallbackModels: config.fallbackModels,
    timeoutMs: config.timeoutMs,
    retryLimit: config.retryLimit,
    budgets: config.budgets,
    logging: config.logging,
  };

  if (body.defaultProvider) config.defaultProvider = body.defaultProvider;
  if (body.defaultModel) config.defaultModel = body.defaultModel;
  if (Array.isArray(body.fallbackModels)) config.fallbackModels = body.fallbackModels;
  if (typeof body.timeoutMs === "number" && body.timeoutMs >= 1000) config.timeoutMs = body.timeoutMs;
  if (typeof body.retryLimit === "number") config.retryLimit = Math.max(0, Math.min(5, body.retryLimit));
  if (typeof body.fallbackEnabled === "boolean") config.fallbackEnabled = body.fallbackEnabled;

  if (body.budgets) {
    if (typeof body.budgets.dailyLimitUsd === "number") config.budgets.dailyLimitUsd = Math.max(0, body.budgets.dailyLimitUsd);
    if (typeof body.budgets.monthlyLimitUsd === "number") config.budgets.monthlyLimitUsd = Math.max(0, body.budgets.monthlyLimitUsd);
    if (typeof body.budgets.warningThresholdPercent === "number") {
      config.budgets.warningThresholdPercent = Math.max(1, Math.min(100, body.budgets.warningThresholdPercent));
    }
    if (["warn", "rate_limit", "disable_noncritical"].includes(body.budgets.actionOnLimit)) {
      config.budgets.actionOnLimit = body.budgets.actionOnLimit;
    }
  }

  if (body.logging) {
    if (typeof body.logging.logMetadata === "boolean") config.logging.logMetadata = body.logging.logMetadata;
    if (typeof body.logging.retentionDays === "number") config.logging.retentionDays = Math.max(1, body.logging.retentionDays);
    if (["metadata_only", "sanitized", "full"].includes(body.logging.retentionLevel)) {
      config.logging.retentionLevel = body.logging.retentionLevel;
    }
  }

  config.updatedBy = new mongoose.Types.ObjectId(req.user!.id);
  await config.save();
  invalidateAiConfigCache();

  await recordAudit({
    adminId: req.user!.id,
    action: "ai.settings_update",
    targetType: "AiConfig",
    targetId: String(config._id),
    metadata: { before: beforeSnapshot, after: body },
  });

  res.json({
    success: true,
    message: "AI settings saved successfully",
    settings: {
      defaultProvider: config.defaultProvider,
      defaultModel: config.defaultModel,
      fallbackModels: config.fallbackModels,
      timeoutMs: config.timeoutMs,
      retryLimit: config.retryLimit,
      fallbackEnabled: config.fallbackEnabled,
      budgets: config.budgets,
      logging: config.logging,
    },
  });
}
