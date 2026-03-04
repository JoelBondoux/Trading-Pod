// ============================================================================
// Structured Logger Tests — JSON output, level filtering, child loggers
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "../src/logger.js";

describe("createLogger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("info emits JSON with timestamp, level, worker, msg", () => {
    const log = createLogger({ worker: "fc" });
    log.info("Hello world");

    expect(logSpy).toHaveBeenCalledOnce();
    const entry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(entry.level).toBe("info");
    expect(entry.worker).toBe("fc");
    expect(entry.msg).toBe("Hello world");
    expect(entry.timestamp).toBeTruthy();
  });

  it("debug is filtered when minLevel is 'info' (default)", () => {
    const log = createLogger({ worker: "fc" });
    log.debug("should not appear");
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it("debug emits when minLevel is 'debug'", () => {
    const log = createLogger({ worker: "fc", minLevel: "debug" });
    log.debug("visible");
    expect(debugSpy).toHaveBeenCalledOnce();
  });

  it("error is never filtered by info level", () => {
    const log = createLogger({ worker: "fc" });
    log.error("critical failure");
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("warn uses console.warn", () => {
    const log = createLogger({ worker: "fc" });
    log.warn("caution");
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("includes correlationId when configured", () => {
    const log = createLogger({ worker: "fc", correlationId: "corr-123" });
    log.info("with correlation");

    const entry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(entry.correlationId).toBe("corr-123");
  });

  it("omits correlationId when not configured", () => {
    const log = createLogger({ worker: "fc" });
    log.info("without correlation");

    const entry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(entry.correlationId).toBeUndefined();
  });

  it("includes extra fields in output", () => {
    const log = createLogger({ worker: "fc" });
    log.info("with extras", { agentId: "trend_agent", confidence: 0.85 });

    const entry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(entry.agentId).toBe("trend_agent");
    expect(entry.confidence).toBe(0.85);
  });

  it("child logger inherits worker and overrides correlationId", () => {
    const parent = createLogger({ worker: "fc", correlationId: "parent" });
    const child = parent.child("child-id");

    child.info("child message");

    const entry = JSON.parse(logSpy.mock.calls[0][0]);
    expect(entry.worker).toBe("fc");
    expect(entry.correlationId).toBe("child-id");
  });

  it("filters warn at error minLevel", () => {
    const log = createLogger({ worker: "fc", minLevel: "error" });
    log.info("hidden");
    log.warn("hidden too");
    log.error("visible");

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();
  });
});
