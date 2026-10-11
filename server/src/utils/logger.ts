export type LogLevel = "debug" | "info" | "warn" | "error";

const order: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

function ts(): string {
  return new Date().toISOString();
}

// Never pass whole request objects here: only safe, already-scrubbed data.
function safeMeta(meta: unknown): unknown {
  if (meta instanceof Error) {
    return { name: meta.name, message: meta.message };
  }
  return meta;
}

function write(level: LogLevel, message: string, meta?: unknown) {
  if (order[level] < order[minLevel]) return;
  const line = `[${ts()}] ${level.toUpperCase()} ${message}`;
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (meta === undefined) fn(line);
  else fn(line, safeMeta(meta));
}

export const logger = {
  debug: (m: string, meta?: unknown) => write("debug", m, meta),
  info: (m: string, meta?: unknown) => write("info", m, meta),
  warn: (m: string, meta?: unknown) => write("warn", m, meta),
  error: (m: string, meta?: unknown) => write("error", m, meta),
};

export default logger;
