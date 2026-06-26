// Minimal structured (JSON-line) logger. One event per line so logs are grep-/ingest-friendly
// (CloudWatch, Loki, Datadog, etc.). Swap the sink here to forward to an aggregator in production.

type Level = "debug" | "info" | "warn" | "error";
type Context = Record<string, unknown>;

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: Level = (process.env.LOG_LEVEL as Level) || (process.env.NODE_ENV === "production" ? "info" : "debug");

function emit(level: Level, msg: string, ctx?: Context) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...ctx });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, ctx?: Context) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: Context) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: Context) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: Context) => emit("error", msg, ctx),
};
