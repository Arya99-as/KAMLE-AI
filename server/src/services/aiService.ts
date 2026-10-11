import env from "../config/env.js";
import logger from "../utils/logger.js";
import type { AiParseResult, ExtractedRequirements, ChatMessage, Urgency } from "../types/ai.js";
import { requirementsSchema } from "../validators/chat.js";

export interface ParseInput {
  messages: ChatMessage[];
  previous?: Partial<ExtractedRequirements>;
}

export interface ParseOutput extends AiParseResult {
  degraded: boolean;
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
    keywords: ["refrigerator", "fridge", "washing machine", "washing machine", "ac ", "air conditioner", "microwave", "oven", "geyser", "appliance", "dishwasher", "cooling", "not cooling"],
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

function detectCategory(text: string): { category: string | null; matchedSkills: string[] } {
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

function detectLocation(text: string): string | null {
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

function detectBudget(text: string): number | null {
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

function detectUrgency(text: string): Urgency {
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

  // Acknowledge that we understand when text contains a phone number (privacy).
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

async function callOpenAiCompatible(messages: ChatMessage[]): Promise<string> {
  const { baseUrl, apiKey, model } = env.ai;
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
    env.ai.timeoutMs,
  );
  if (!res.ok) throw new Error(`AI provider responded ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  return content;
}

async function callGemini(messages: ChatMessage[]): Promise<string> {
  const { baseUrl, apiKey, model } = env.ai;
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
    env.ai.timeoutMs,
  );
  if (!res.ok) throw new Error(`Gemini responded ${res.status}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");
  return text;
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
export async function checkAiProvider(): Promise<AiHealthResult> {
  const { provider, baseUrl, apiKey, model } = env.ai;
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

/** Parse a free-text request into structured requirements, with a safe fallback. */
export async function parseRequest(input: ParseInput): Promise<ParseOutput> {
  const fallback = heuristicParse(input);

  if (!isConfigured()) {
    return { ...fallback, degraded: env.ai.provider !== "heuristic" };
  }

  try {
    const raw =
      env.ai.provider === "gemini" ? await callGemini(input.messages) : await callOpenAiCompatible(input.messages);
    const parsed = extractJson(raw) as Record<string, unknown>;

    const requirements = requirementsSchema.parse({
      service_category: parsed.service_category ?? null,
      required_skills: parsed.required_skills ?? [],
      location: parsed.location ?? null,
      budget: typeof parsed.budget === "number" ? parsed.budget : null,
      urgency: parsed.urgency ?? "normal",
      missing_information: parsed.missing_information ?? [],
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

    return { reply, requirements, degraded: false };
  } catch (err) {
    logger.warn("AI provider failed, using deterministic fallback", err);
    return { ...fallback, degraded: true };
  }
}

export default parseRequest;
