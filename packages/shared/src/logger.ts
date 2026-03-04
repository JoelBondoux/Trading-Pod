// ============================================================================
// Structured Logger — JSON logs with correlation IDs
// ============================================================================
// Designed for Cloudflare Workers where console.log emits to `wrangler tail`.
// Each log entry includes:
//   - timestamp (ISO 8601)
//   - level (debug/info/warn/error)
//   - msg (human-readable message)
//   - correlationId (traces a signal → decision → execution chain)
//   - worker (which worker emitted the log)
//   - extra fields (arbitrary structured data)
// ============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  worker: string;
  msg: string;
  correlationId?: string;
  [key: string]: unknown;
}

export interface LoggerOptions {
  /** Worker name (e.g., "fc", "treasurer") */
  worker: string;

  /** Minimum log level (default: "info") */
  minLevel?: LogLevel;

  /** Correlation ID — threads through the entire request lifecycle */
  correlationId?: string;
}

/**
 * Create a structured JSON logger.
 *
 * Usage:
 * ```ts
 * const log = createLogger({ worker: "fc", correlationId: decisionId });
 * log.info("Signal received", { agentId: "agent-A", instrument: "GBP/USD" });
 * log.warn("Risk check failed", { rule: "min_confidence", value: 0.45 });
 * log.error("Treasurer unreachable", { attempt: 3 });
 * ```
 */
export function createLogger(opts: LoggerOptions) {
  const minLevel = LEVEL_ORDER[opts.minLevel ?? "info"];

  function emit(level: LogLevel, msg: string, extra?: Record<string, unknown>) {
    if (LEVEL_ORDER[level] < minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      worker: opts.worker,
      msg,
      ...(opts.correlationId ? { correlationId: opts.correlationId } : {}),
      ...extra,
    };

    // Cloudflare Workers: console.log → wrangler tail / logpush
    const output = JSON.stringify(entry);
    switch (level) {
      case "debug":
        console.debug(output);
        break;
      case "info":
        console.log(output);
        break;
      case "warn":
        console.warn(output);
        break;
      case "error":
        console.error(output);
        break;
    }
  }

  return {
    debug: (msg: string, extra?: Record<string, unknown>) => emit("debug", msg, extra),
    info: (msg: string, extra?: Record<string, unknown>) => emit("info", msg, extra),
    warn: (msg: string, extra?: Record<string, unknown>) => emit("warn", msg, extra),
    error: (msg: string, extra?: Record<string, unknown>) => emit("error", msg, extra),

    /** Create a child logger with a specific correlation ID */
    child: (correlationId: string) =>
      createLogger({ ...opts, correlationId }),
  };
}
