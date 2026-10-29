import crypto from "node:crypto";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import type { AiParseResult, ExtractedRequirements, ChatMessage, Urgency } from "../types/ai.js";
import { requirementsSchema } from "../validators/chat.js";
import AiLog, { type AiStatus } from "../models/AiLog.js";
import AiConfig, { type IAiConfig } from "../models/AiConfig.js";

export interface ParseInput {
  messages: ChatMessage[];
  previous?: Partial<ExtractedRequirements>;
  userId?: string;
  userRole?: string;
  requestId?: string;
  correlationId?: string;
  feature?: string;
}

export interface ParseOutput extends AiParseResult {
  degraded: boolean;
  requestId?: string;
}

/* -------------------------------------------------------------------------- */
/* Deterministic fallback ("heuristic") parser                                 */
/* Used when no AI key is configured or when the provider call fails.          */
/* -------------------------------------------------------------------------- */

interface CategoryRule {
  category: string;
  keywords: string[];
  skills: Record<string, string>;
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "Plumbing",
    keywords: ["plumb", "tap", "leak", "leaking", "pipe", "drain", "sink", "toilet", "faucet", "shower", "water line", "seepage"],
    skills: {
      leak: "Leak Repair",
      leaking: "Leak Repair",
      seepage: "Leak Repair",
      tap: "Tap & Faucet Repair",
      faucet: "Tap & Faucet Repair",
      pipe: "Pipe Fitting",
      drain: "Drainage Cleaning",
      toilet: "Toilet Repair",
      sink: "Sink Installation",
      shower: "Shower Fitting",
    },
  },
  {
    category: "Electrical",
    keywords: ["electric", "electrician", "wiring", "switch", "socket", "fan", "light", "bulb", "fuse", "circuit", "inverter", "mcb", "short circuit"],
    skills: {
      wiring: "Wiring & Rewiring",
      switch: "Switch & Socket Repair",
      socket: "Switch & Socket Repair",
      fan: "Fan Repair",
      light: "Light Installation",
      bulb: "Light Installation",
      fuse: "Fuse & MCB Repair",
      circuit: "Circuit Troubleshooting",
      inverter: "Inverter Repair",
    },
  },
  {
    category: "Appliance Repair",
    keywords: ["refrigerator", "fridge", "washing machine", "ac ", "air conditioner", "microwave", "oven", "geyser", "appliance", "dishwasher", "cooling", "not cooling"],
    skills: {
      refrigerator: "Refrigerator Repair",
      fridge: "Refrigerator Repair",
      cooling: "Cooling System Troubleshooting",
      washing: "Washing Machine Repair",
      air: "Air Conditioner Service",
      microwave: "Microwave Repair",
      oven: "Oven Repair",
      geyser: "Geyser Repair",
      dishwasher: "Dishwasher Repair",
    },
  },
  {
    category: "Carpentry",
    keywords: ["carpenter", "carpentry", "wood", "door", "furniture", "cabinet", "wardrobe", "shelf", "table", "bed", "window frame"],
    skills: {
      door: "Door Repair",
      furniture: "Furniture Repair",
      cabinet: "Cabinet Making",
      wardrobe: "Wardrobe Fitting",
      shelf: "Shelf Installation",
      table: "Furniture Assembly",
      wood: "Woodwork",
    },
  },
  {
    category: "Painting",
    keywords: ["paint", "painting", "whitewash", "primer", "wall"],
    skills: {
      paint: "Interior Painting",
      painting: "Interior Painting",
      whitewash: "Whitewash",
      primer: "Wall Priming",
    },
  },
  {
    category: "Cleaning",
    keywords: ["clean", "cleaning", "housekeeping", "mop", "sweep", "dust", "sanitize", "deep clean", "maid"],
    skills: {
      clean: "Home Cleaning",
      cleaning: "Home Cleaning",
      deep: "Deep Cleaning",
      sanitize: "Sanitization",
    },
  },
  {
    category: "Vehicle Repair",
    keywords: ["bike", "motorcycle", "scooter", "car", "vehicle", "mechanic", "tyre", "engine", "brake"],
    skills: {
      bike: "Two-Wheeler Repair",
      motorcycle: "Two-Wheeler Repair",
      scooter: "Two-Wheeler Repair",
      car: "Car Servicing",
      tyre: "Tyre Service",
      engine: "Engine Diagnostics",
      brake: "Brake Repair",
    },
  },
  {
    category: "Computer Repair",
    keywords: ["computer", "laptop", "pc", "printer", "software", "virus", "windows", "hardware", "wifi", "network", "technician"],
    skills: {
      computer: "Computer Repair",
      laptop: "Laptop Repair",
      printer: "Printer Repair",
      software: "Software Installation",
      virus: "Virus Removal",
      windows: "Operating System Setup",
      wifi: "Network & WiFi Setup",
      hardware: "Hardware Diagnostics",
    },
  },
];

const KNOWN_CITIES = [
  "Kolhapur", "Pune", "Mumbai", "Delhi", "Bengaluru", "Bangalore", "Hyderabad", "Chennai",
  "Kolkata", "Ahmedabad", "Surat", "Jaipur", "Lucknow", "Nagpur", "Nashik", "Indore",
  "Bhopal", "Thane", "Navi Mumbai", "Sangli", "Satara", "Solapur", "Belgaum", "Belagavi",
];

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function detectCategory(text: string): { category: string | null; matchedSkills: string[] } {
  const lower = text.toLowerCase();
  let best: { category: string; hits: number; skills: Set<string> } | null = null;

  for (const rule of CATEGORY_RULES) {
    const hits = rule.keywords.filter((k) => lower.includes(k));
    if (hits.length === 0) continue;
    const skills = new Set<string>();
    for (const [kw, skill] of Object.entries(rule.skills)) {
      if (lower.includes(kw)) skills.add(skill);
    }
    if (!best || hits.length > best.hits) {
      best = { category: rule.category, hits: hits.length, skills };
    } else if (best && hits.length === best.hits) {
      for (const s of skills) best.skills.add(s);
    }
  }

  if (!best) return { category: null, matchedSkills: [] };
  return { category: best.category, matchedSkills: Array.from(best.skills).slice(0, 5) };
}

export function detectLocation(text: string): string | null {
  const lower = text.toLowerCase();
  for (const city of KNOWN_CITIES) {
    if (lower.includes(city.toLowerCase())) return city;
  }
  const patterns = [
    /\b(?:in|at|near|around|area of|service in|located in)\s+([a-zA-Z][a-zA-Z\s]{1,40})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim().replace(/\b(please|today|tomorrow|now)\b/gi, "").trim();
      const words = candidate.split(/\s+/).slice(0, 3);
      if (words.length > 0 && words[0]!.length >= 2) return titleCase(words.join(" "));
    }
  }
  return null;
}

export function detectBudget(text: string): number | null {
  const lower = text.toLowerCase();
  const patterns = [
    /(?:under|below|upto|up to|less than|budget of|budget is|around|max)\s*₹?\s*([\d,]+)/i,
    /₹\s*([\d,]+)/,
    /([\d,]+)\s*(?:rupees|rs|inr)/i,
  ];
  for (const pattern of patterns) {
    const m = lower.match(pattern);
    if (m && m[1]) {
      const n = Number(m[1].replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

export function detectUrgency(text: string): Urgency {
  const lower = text.toLowerCase();
  if (/(emergency|asap|immediately|right now|urgent|very urgent)/.test(lower)) return "emergency";
  if (/(today|tonight|soon|urgently)/.test(lower)) return "high";
  if (/(no rush|whenever|not urgent|flexible)/.test(lower)) return "low";
  return "normal";
}

export function heuristicParse(input: ParseInput): AiParseResult {
  const userText = input.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" , ");
  const allText = input.messages.map((m) => m.content).join(" ");

  const { category, matchedSkills } = detectCategory(userText);
  const location = detectLocation(userText) ?? (input.previous?.location ?? null);
  const budget = detectBudget(userText) ?? (input.previous?.budget ?? null);
  const urgency = detectUrgency(userText);

  const prevSkills = input.previous?.required_skills ?? [];
  const requiredSkills = Array.from(new Set([...prevSkills, ...matchedSkills]));

  const resolvedCategory = category ?? input.previous?.service_category ?? null;

  const missing: string[] = [];
  if (!resolvedCategory) missing.push("service category");
  if (!location) missing.push("service area");

  const searchReady = Boolean(resolvedCategory && location);

  let reply: string;
  if (!resolvedCategory) {
    reply =
      "I'd be happy to help you find a worker. Could you tell me what kind of service you need — for example plumbing, electrical, appliance repair, carpentry, or cleaning?";
  } else if (!location) {
    reply = `I can help you find a ${resolvedCategory.toLowerCase()} professional. Which area do you need service in?`;
  } else {
    const skillText = requiredSkills.length ? ` They should handle: ${requiredSkills.slice(0, 3).join(", ")}.` : "";
    reply = `Thanks! I'll look for approved ${resolvedCategory.toLowerCase()} professionals serving ${location}.${skillText}`;
  }

  if (/\b\d{10}\b/.test(allText) && !resolvedCategory) {
    reply += " Please avoid sharing personal phone numbers in the chat.";
  }

  return {
    reply,
    requirements: {
      service_category: resolvedCategory,
      required_skills: requiredSkills,
      location,
      budget,
      urgency,
      missing_information: missing,
      search_ready: searchReady,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Dynamic AI Configuration & Pricing Utilities                               */
/* -------------------------------------------------------------------------- */

let cachedConfig: IAiConfig | null = null;
let lastConfigFetch = 0;
const CONFIG_CACHE_TTL = 10000; // 10 seconds

export async function getAiConfig(): Promise<IAiConfig> {
  const now = Date.now();
  if (cachedConfig && now - lastConfigFetch < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }
  try {
    let conf = await AiConfig.findOne({ key: "global" }).exec();
    if (!conf) {
      conf = await AiConfig.create({
        key: "global",
        defaultProvider: env.ai.provider,
        defaultModel: env.ai.model,
        fallbackModels: env.ai.fallbackModels,
        timeoutMs: env.ai.timeoutMs,
      });
    }
    cachedConfig = conf;
    lastConfigFetch = now;
    return conf;
  } catch {
    // If DB isn't ready or during tests before connect, provide safe in-memory fallback
    return {
      key: "global",
      defaultProvider: env.ai.provider,
      defaultModel: env.ai.model,
      fallbackModels: env.ai.fallbackModels,
      timeoutMs: env.ai.timeoutMs,
      retryLimit: 2,
      fallbackEnabled: true,
      budgets: {
        dailyLimitUsd: 10.0,
        monthlyLimitUsd: 150.0,
        warningThresholdPercent: 80,
        actionOnLimit: "warn",
      },
      logging: {
        logMetadata: true,
        retentionDays: 30,
        retentionLevel: "sanitized",
      },
      features: {
        problem_understanding: { enabled: true, description: "Problem interpretation" },
        worker_matching: { enabled: true, description: "Worker ranking" },
        ai_search: { enabled: true, description: "Search query parsing" },
      },
      pricing: [
        { model: "gemini-3.5-flash-lite", provider: "gemini", inputPer1M: 0.075, outputPer1M: 0.3, effectiveDate: new Date() },
        { model: "gpt-4o-mini", provider: "openai", inputPer1M: 0.15, outputPer1M: 0.6, effectiveDate: new Date() },
        { model: "llama-3.3-70b-versatile", provider: "groq", inputPer1M: 0.59, outputPer1M: 0.79, effectiveDate: new Date() },
      ],
    } as unknown as IAiConfig;
  }
}

export function invalidateAiConfigCache() {
  cachedConfig = null;
  lastConfigFetch = 0;
}

export function calculateEstimatedCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  config?: IAiConfig,
): number {
  if (inputTokens <= 0 && outputTokens <= 0) return 0;
  const pricings = config?.pricing || [];
  const match = pricings.find((p) => p.model.toLowerCase() === model.toLowerCase());
  const inputRate = match?.inputPer1M ?? 0.075;
  const outputRate = match?.outputPer1M ?? 0.3;
  const cost = (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate;
  return Number(cost.toFixed(6));
}

function redactSensitiveText(text: string): string {
  // Redact 10-digit phone numbers, emails, credit card patterns
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED_EMAIL]")
    .replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[REDACTED_PHONE]")
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, "[REDACTED_CARD]");
}

/* -------------------------------------------------------------------------- */
/* LLM providers (server-side only)                                            */
/* -------------------------------------------------------------------------- */

const SYSTEM_PROMPT = `You are KAMLE AI, an assistant that helps customers find local workers.
Return ONLY a JSON object with this exact shape:
{
  "reply": "a short, friendly reply to the customer",
  "service_category": "one of: Plumbing, Electrical, Appliance Repair, Carpentry, Painting, Cleaning, Vehicle Repair, Computer Repair, Other Local Services, or null",
  "required_skills": ["specific skills needed, e.g. 'Refrigerator Repair'"],
  "location": "city or service area, or null",
  "budget": number or null,
  "urgency": "low" | "normal" | "high" | "emergency",
  "missing_information": ["what you still need, e.g. 'service area'"],
  "search_ready": boolean
}
Rules:
- NEVER invent workers, prices, ratings, phone numbers or availability.
- If the location is unknown, ask for it in "reply" and set search_ready to false.
- If the service category is unclear, ask a clarifying question.
- Only set search_ready to true when the service category AND location are known.
- Keep "reply" under 60 words. Do not add markdown.`;

function toProviderMessages(messages: ChatMessage[]) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface ProviderCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  tokensEstimated: boolean;
}

async function callOpenAiCompatible(messages: ChatMessage[], model: string, timeoutMs: number): Promise<ProviderCallResult> {
  const { baseUrl, apiKey } = env.ai;
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...toProviderMessages(messages)],
      }),
    },
    timeoutMs,
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const err = new Error(`AI provider responded ${res.status}`);
    (err as unknown as { status: number; responseText: string }).status = res.status;
    (err as unknown as { status: number; responseText: string }).responseText = errText;
    throw err;
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");

  const inputTokens = data.usage?.prompt_tokens ?? Math.ceil(JSON.stringify(messages).length / 4);
  const outputTokens = data.usage?.completion_tokens ?? Math.ceil(content.length / 4);
  const tokensEstimated = !data.usage?.prompt_tokens;

  return { text: content, inputTokens, outputTokens, tokensEstimated };
}

async function callGemini(messages: ChatMessage[], model: string, timeoutMs: number): Promise<ProviderCallResult> {
  const { baseUrl, apiKey } = env.ai;
  const url = `${baseUrl.replace(/\/$/, "")}/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    },
    timeoutMs,
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const err = new Error(`Gemini responded ${res.status}`);
    (err as unknown as { status: number; responseText: string }).status = res.status;
    (err as unknown as { status: number; responseText: string }).responseText = errText;
    throw err;
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");

  const inputTokens = data.usageMetadata?.promptTokenCount ?? Math.ceil(JSON.stringify(messages).length / 4);
  const outputTokens = data.usageMetadata?.candidatesTokenCount ?? Math.ceil(text.length / 4);
  const tokensEstimated = !data.usageMetadata?.promptTokenCount;

  return { text, inputTokens, outputTokens, tokensEstimated };
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("AI response was not valid JSON");
  }
}

function isConfigured(): boolean {
  const { provider, apiKey, baseUrl } = env.ai;
  if (provider === "heuristic") return false;
  if (provider === "ollama") return Boolean(baseUrl);
  return Boolean(apiKey && baseUrl);
}

export interface AiHealthResult {
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

/**
 * Live connectivity check for the configured provider.
 * Hits the provider's model-list endpoint (cheap, no tokens consumed).
 */
export async function checkAiProvider(targetProvider?: string): Promise<AiHealthResult> {
  const provider = targetProvider || env.ai.provider;
  const baseUrl = env.ai.baseUrl;
  const apiKey = env.ai.apiKey;
  const model = env.ai.model;

  const result: AiHealthResult = {
    provider,
    configured: false,
    model: null,
    baseUrl: baseUrl || null,
    apiKeySet: Boolean(apiKey),
    reachable: false,
    latencyMs: null,
    models: [],
    error: null,
  };

  if (provider === "heuristic") {
    result.configured = true;
    result.reachable = true;
    result.latencyMs = 1;
    result.models = ["heuristic-deterministic"];
    return result;
  }

  if (!isConfigured()) return result;
  result.configured = true;
  result.model = model;

  try {
    const t0 = Date.now();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    let url = `${baseUrl}/models`;
    if (provider === "gemini") {
      url += `?pageSize=100&key=${apiKey}`;
    } else if (provider === "ollama") {
      url = `${baseUrl}/models`;
    } else {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const res = await fetchWithTimeout(url, { method: "GET", headers }, env.ai.timeoutMs);
    result.latencyMs = Date.now() - t0;
    result.reachable = res.ok;
    if (!res.ok) {
      result.error = `HTTP ${res.status}`;
      return result;
    }

    const payload = (await res.json()) as
      | { models?: { name?: string }[] }
      | { data?: { id?: string }[] };
    const named = (payload as { models?: { name?: string }[] }).models;
    const dataArr = (payload as { data?: { id?: string }[] }).data;
    const list =
      dataArr && dataArr.length
        ? dataArr.map((m) => m.id ?? "")
        : (named ?? []).map((m) => m.name?.replace(/^models\//, "") ?? "");
    result.models = list.filter(Boolean);
  } catch (err) {
    result.error = (err as Error).message;
  }
  return result;
}

/** Map any free-text urgency the model returns onto our enum. */
function normalizeUrgency(value: unknown): Urgency {
  const s = String(value ?? "").toLowerCase();
  if (/(emergency|urgent|asap|immediately|right now|critical)/.test(s)) return "emergency";
  if (/(high|soon|today|tonight|quick|priority)/.test(s)) return "high";
  if (/(low|no rush|whenever|flexible|not urgent)/.test(s)) return "low";
  return "normal";
}

/** Accept a budget as number or numeric string (e.g. "₹2,000") and coerce it. */
function coerceBudget(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/** Accept an array of strings, or a single string, and normalize to a clean array. */
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function classifyError(err: unknown): { category: string; code: string; safeMessage: string } {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;

  if (status === 401 || status === 403 || msg.includes("API key") || msg.includes("auth")) {
    return { category: "AUTH_CONFIGURATION_ERROR", code: String(status || 401), safeMessage: "Authentication or API key verification failed" };
  }
  if (status === 429 || msg.includes("rate limit") || msg.includes("quota")) {
    return { category: "RATE_LIMIT_EXCEEDED", code: "429", safeMessage: "Provider rate limit or quota exceeded" };
  }
  if (msg.includes("abort") || msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
    return { category: "PROVIDER_TIMEOUT", code: "TIMEOUT", safeMessage: "Provider request timed out after configured threshold" };
  }
  if (msg.includes("not valid JSON") || msg.includes("Unexpected token")) {
    return { category: "INVALID_STRUCTURED_OUTPUT", code: "PARSE_ERROR", safeMessage: "Provider output could not be parsed into expected schema" };
  }
  if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
    return { category: "PROVIDER_CONNECTION_FAILURE", code: "CONN_ERR", safeMessage: "Failed to establish network connection to AI provider" };
  }
  if (status && status >= 500) {
    return { category: "AI_SERVICE_UNAVAILABLE", code: String(status), safeMessage: "AI provider service temporarily unavailable (5xx)" };
  }
  return { category: "INTERNAL_PROCESSING_FAILURE", code: "500", safeMessage: "Internal processing error during AI execution" };
}

/**
 * Record an activity log entry safely into MongoDB
 */
export async function logAiActivity(entry: {
  requestId: string;
  correlationId: string;
  feature: string;
  provider: string;
  model: string;
  operation: string;
  status: AiStatus;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  tokensEstimated: boolean;
  estimatedCost: number;
  retryCount: number;
  fallbackUsed: boolean;
  fallbackReason?: string;
  errorCategory?: string;
  errorCode?: string;
  errorMessage?: string;
  userId?: string;
  userRole?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await AiLog.create({
      requestId: entry.requestId,
      correlationId: entry.correlationId,
      feature: entry.feature,
      provider: entry.provider,
      model: entry.model,
      operation: entry.operation,
      status: entry.status,
      durationMs: entry.durationMs,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      totalTokens: entry.inputTokens + entry.outputTokens,
      tokensEstimated: entry.tokensEstimated,
      estimatedCost: entry.estimatedCost,
      retryCount: entry.retryCount,
      fallbackUsed: entry.fallbackUsed,
      fallbackReason: entry.fallbackReason,
      errorCategory: entry.errorCategory,
      errorCode: entry.errorCode,
      errorMessage: entry.errorMessage,
      userId: entry.userId || undefined,
      userRole: entry.userRole || "anonymous",
      metadata: entry.metadata || {},
    });
  } catch (err) {
    logger.warn("Failed to persist AI activity log", err);
  }
}

/** Parse a free-text request into structured requirements, with centralized logging and safe fallback. */
export async function parseRequest(input: ParseInput): Promise<ParseOutput> {
  const t0 = Date.now();
  const requestId = input.requestId || `req_${crypto.randomUUID()}`;
  const correlationId = input.correlationId || requestId;
  const featureName = input.feature || "problem_understanding";

  const fallback = heuristicParse(input);
  const config = await getAiConfig();

  // Check if feature is administratively disabled
  const featureSetting = config.features && (config.features as any)[featureName];
  if (featureSetting && featureSetting.enabled === false) {
    const durationMs = Date.now() - t0;
    void logAiActivity({
      requestId,
      correlationId,
      feature: featureName,
      provider: "heuristic",
      model: "heuristic-fallback",
      operation: "parse_request",
      status: "FALLBACK",
      durationMs,
      inputTokens: 0,
      outputTokens: 0,
      tokensEstimated: false,
      estimatedCost: 0,
      retryCount: 0,
      fallbackUsed: true,
      fallbackReason: "Feature administratively disabled in AI Control Center",
      userId: input.userId,
      userRole: input.userRole,
      metadata: { disabledByAdmin: true },
    });
    return { ...fallback, degraded: true, requestId };
  }

  // If external provider is not configured or set to heuristic
  if (!isConfigured()) {
    const durationMs = Date.now() - t0;
    void logAiActivity({
      requestId,
      correlationId,
      feature: featureName,
      provider: env.ai.provider || "heuristic",
      model: "heuristic",
      operation: "parse_request",
      status: "SUCCESS",
      durationMs,
      inputTokens: 0,
      outputTokens: 0,
      tokensEstimated: false,
      estimatedCost: 0,
      retryCount: 0,
      fallbackUsed: env.ai.provider !== "heuristic",
      fallbackReason: env.ai.provider !== "heuristic" ? "Provider unconfigured (using heuristic fallback)" : undefined,
      userId: input.userId,
      userRole: input.userRole,
      metadata: {
        categoryDetected: fallback.requirements.service_category,
        searchReady: fallback.requirements.search_ready,
      },
    });
    return { ...fallback, degraded: env.ai.provider !== "heuristic", requestId };
  }

  // Try configured models with fallback
  const models = [config.defaultModel || env.ai.model, ...(config.fallbackModels || env.ai.fallbackModels)].filter(Boolean);
  let retryCount = 0;
  let lastErr: unknown = null;
  let providerResult: ProviderCallResult | null = null;
  let successfulModel = models[0] || "default";

  for (let i = 0; i < models.length; i++) {
    const currentModel = models[i]!;
    try {
      providerResult =
        env.ai.provider === "gemini"
          ? await callGemini(input.messages, currentModel, config.timeoutMs || env.ai.timeoutMs)
          : await callOpenAiCompatible(input.messages, currentModel, config.timeoutMs || env.ai.timeoutMs);
      successfulModel = currentModel;
      break;
    } catch (err) {
      lastErr = err;
      retryCount++;
      logger.warn(`AI model "${currentModel}" failed (attempt ${i + 1}/${models.length})`, err);
    }
  }

  const durationMs = Date.now() - t0;

  if (providerResult) {
    try {
      const parsed = extractJson(providerResult.text) as Record<string, unknown>;

      const requirements = requirementsSchema.parse({
        service_category: typeof parsed.service_category === "string" ? parsed.service_category : null,
        required_skills: toStringArray(parsed.required_skills),
        location: typeof parsed.location === "string" ? parsed.location : null,
        budget: coerceBudget(parsed.budget),
        urgency: normalizeUrgency(parsed.urgency),
        missing_information: toStringArray(parsed.missing_information),
        search_ready: Boolean(parsed.search_ready),
      }) as ExtractedRequirements;

      // Recompute readiness server-side; never trust the model blindly.
      requirements.search_ready = Boolean(requirements.service_category && requirements.location);
      requirements.missing_information = [];
      if (!requirements.service_category) requirements.missing_information.push("service category");
      if (!requirements.location) requirements.missing_information.push("service area");

      const reply =
        typeof parsed.reply === "string" && parsed.reply.trim().length > 0
          ? parsed.reply.trim().slice(0, 600)
          : fallback.reply;

      const estimatedCost = calculateEstimatedCost(
        successfulModel,
        providerResult.inputTokens,
        providerResult.outputTokens,
        config,
      );

      // Sanitize metadata
      const userText = input.messages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join(" ");

      void logAiActivity({
        requestId,
        correlationId,
        feature: featureName,
        provider: env.ai.provider,
        model: successfulModel,
        operation: "parse_request",
        status: retryCount > 0 ? "FALLBACK" : "SUCCESS",
        durationMs,
        inputTokens: providerResult.inputTokens,
        outputTokens: providerResult.outputTokens,
        tokensEstimated: providerResult.tokensEstimated,
        estimatedCost,
        retryCount,
        fallbackUsed: retryCount > 0,
        fallbackReason: retryCount > 0 ? `Primary model failed, succeeded with fallback model "${successfulModel}"` : undefined,
        userId: input.userId,
        userRole: input.userRole,
        metadata: {
          inputMessageCount: input.messages.length,
          sanitizedSnippet: redactSensitiveText(userText.slice(0, 120)),
          categoryDetected: requirements.service_category,
          searchReady: requirements.search_ready,
        },
      });

      return { reply, requirements, degraded: false, requestId };
    } catch (parseErr) {
      lastErr = parseErr;
      logger.warn("Schema validation or JSON parsing failed on provider output", parseErr);
    }
  }

  // If execution reaches here, provider or schema extraction failed. Use deterministic heuristic fallback.
  const classified = classifyError(lastErr);
  void logAiActivity({
    requestId,
    correlationId,
    feature: featureName,
    provider: env.ai.provider,
    model: models[0] || "unknown",
    operation: "parse_request",
    status: "FALLBACK",
    durationMs,
    inputTokens: 0,
    outputTokens: 0,
    tokensEstimated: false,
    estimatedCost: 0,
    retryCount,
    fallbackUsed: true,
    fallbackReason: `Provider failure: ${classified.safeMessage}`,
    errorCategory: classified.category,
    errorCode: classified.code,
    errorMessage: classified.safeMessage,
    userId: input.userId,
    userRole: input.userRole,
    metadata: {
      categoryDetected: fallback.requirements.service_category,
      searchReady: fallback.requirements.search_ready,
    },
  });

  return { ...fallback, degraded: true, requestId };
}

export default parseRequest;
