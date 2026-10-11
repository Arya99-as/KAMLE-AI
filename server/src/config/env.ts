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
    const defaults: Record<AiProvider, { baseUrl: string; model: string }> = {
      openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
      groq: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
      ollama: { baseUrl: "http://localhost:11434/v1", model: "llama3.2" },
      gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-flash-latest" },
      heuristic: { baseUrl: "", model: "" },
    };
    return {
      provider,
      apiKey: str("AI_API_KEY"),
      baseUrl: str("AI_BASE_URL") || defaults[provider].baseUrl,
      model: str("AI_MODEL") || defaults[provider].model,
      timeoutMs: num("AI_TIMEOUT_MS", 20000),
    };
  })(),

  uploadDir: str("UPLOAD_DIR", "uploads"),
  maxUploadMb: num("MAX_UPLOAD_MB", 5),

  rateLimit: {
    windowMs: num("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
    max: num("RATE_LIMIT_MAX", 300),
    authMax: num("AUTH_RATE_LIMIT_MAX", 20),
    aiMax: num("AI_RATE_LIMIT_MAX", 30),
  },
} as const;

if (env.isProd && env.jwtSecret.includes("dev_only_insecure_secret")) {
  // Fail fast rather than shipping an insecure default secret to production.
  throw new Error("JWT_SECRET must be set to a strong value in production");
}

export default env;
