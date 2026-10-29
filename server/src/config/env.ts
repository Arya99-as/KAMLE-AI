import "dotenv/config";

function str(key: string, fallback = ""): string {
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
}

function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(key: string, fallback = false): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  return v.toLowerCase() === "true" || v === "1";
}

export type AiProvider = "openai" | "groq" | "ollama" | "gemini" | "heuristic";

const nodeEnv = str("NODE_ENV", "development");

export const env = {
  nodeEnv,
  isProd: nodeEnv === "production",
  isTest: nodeEnv === "test",
  port: num("PORT", 4000),
  clientOrigins: str("CLIENT_ORIGIN", "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  mongoUri: str("MONGODB_URI", "mongodb://127.0.0.1:27017/kamle_ai"),
  useMemoryDb: bool("USE_MEMORY_DB", false),

  jwtSecret: str("JWT_SECRET", "dev_only_insecure_secret_change_me"),
  jwtExpiresIn: str("JWT_EXPIRES_IN", "7d"),

  ai: (() => {
    const provider = str("AI_PROVIDER", "heuristic") as AiProvider;
    const defaults: Record<AiProvider, { baseUrl: string; model: string; fallbacks: string[] }> = {
      openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", fallbacks: [] },
      groq: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", fallbacks: [] },
      ollama: { baseUrl: "http://localhost:11434/v1", model: "llama3.2", fallbacks: [] },
      gemini: {
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        model: "gemini-3.5-flash-lite",
        // Tried in order if the primary model errors (503/404/timeout) before
        // giving up and using the deterministic heuristic parser.
        fallbacks: ["gemini-flash-lite-latest", "gemini-3.6-flash"],
      },
      heuristic: { baseUrl: "", model: "", fallbacks: [] },
    };
    const fallbackModels = str("AI_FALLBACK_MODELS")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      provider,
      apiKey: str("AI_API_KEY"),
      baseUrl: str("AI_BASE_URL") || defaults[provider].baseUrl,
      model: str("AI_MODEL") || defaults[provider].model,
      fallbackModels: fallbackModels.length ? fallbackModels : defaults[provider].fallbacks,
      timeoutMs: num("AI_TIMEOUT_MS", 8000),
    };
  })(),

  uploadDir: str("UPLOAD_DIR", "uploads"),
  maxUploadMb: num("MAX_UPLOAD_MB", 5),

  payments: (() => {
    const provider = str("PAYMENT_PROVIDER", "mock").toLowerCase();
    return {
      provider,
      keyId: str("RAZORPAY_KEY_ID"),
      keySecret: str("RAZORPAY_KEY_SECRET"),
      webhookSecret: str("RAZORPAY_WEBHOOK_SECRET"),
      signingSecret: str("PAYMENT_SECRET", "dev_only_payment_signing_secret_change_me"),
      allowMock: provider === "mock" && nodeEnv !== "production",
    };
  })(),

  rateLimit: {
    windowMs: num("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
    max: num("RATE_LIMIT_MAX", 300),
    authMax: num("AUTH_RATE_LIMIT_MAX", 20),
    aiMax: num("AI_RATE_LIMIT_MAX", 30),
  },
} as const;

const insecureSecretPatterns = ["dev_only_insecure_secret", "change_me", "replace_me_with"];

if (env.isProd && (env.jwtSecret.includes("dev_only_insecure_secret") || insecureSecretPatterns.some((p) => env.jwtSecret.includes(p)))) {
  // Fail fast rather than shipping an insecure default secret to production.
  throw new Error("JWT_SECRET must be set to a strong value in production");
}

if (env.isProd && env.useMemoryDb) {
  throw new Error("USE_MEMORY_DB must be false in production");
}

if (env.isProd && env.payments.provider === "mock") {
  throw new Error("PAYMENT_PROVIDER must be a real provider (e.g. razorpay) in production");
}

if (env.payments.provider === "razorpay" && (!env.payments.keyId || !env.payments.keySecret)) {
  throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required when PAYMENT_PROVIDER=razorpay");
}

if (env.isProd && (env.payments.signingSecret.includes("dev_only_payment_signing_secret") || insecureSecretPatterns.some((p) => env.payments.signingSecret.includes(p)))) {
  throw new Error("PAYMENT_SECRET must be set to a strong value in production");
}

export default env;
