// ============================================================================
// Event Bus Tests — LocalEventBus publish / subscribe / filter / log
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { LocalEventBus } from "../src/event_bus/bus.js";
import type { SystemEvent } from "@trading-pod/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal SystemEvent (only `type` is used by the bus) */
function evt(type: string): SystemEvent {
  return { eventId: `e-${type}`, timestamp: new Date().toISOString(), type } as SystemEvent;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LocalEventBus", () => {
  let bus: LocalEventBus;

  beforeEach(() => {
    bus = new LocalEventBus();
  });

  it("delivers published event to all subscribers", async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    bus.subscribe(handler1);
    bus.subscribe(handler2);

    const event = evt("agent:signal");
    await bus.publish(event);

    expect(handler1).toHaveBeenCalledWith(event);
    expect(handler2).toHaveBeenCalledWith(event);
  });

  it("filters events by type prefix", async () => {
    const agentHandler = vi.fn();
    const tradeHandler = vi.fn();

    bus.subscribe(agentHandler, "agent:");
    bus.subscribe(tradeHandler, "execution:");

    await bus.publish(evt("agent:signal"));
    await bus.publish(evt("execution:filled"));

    expect(agentHandler).toHaveBeenCalledTimes(1);
    expect(tradeHandler).toHaveBeenCalledTimes(1);
    expect(agentHandler.mock.calls[0][0].type).toBe("agent:signal");
    expect(tradeHandler.mock.calls[0][0].type).toBe("execution:filled");
  });

  it("wildcard filter receives all events", async () => {
    const handler = vi.fn();
    bus.subscribe(handler, "*");

    await bus.publish(evt("agent:signal"));
    await bus.publish(evt("execution:filled"));

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("unsubscribe stops receiving events", async () => {
    const handler = vi.fn();
    const unsub = bus.subscribe(handler);

    await bus.publish(evt("agent:signal"));
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();
    await bus.publish(evt("agent:signal"));
    expect(handler).toHaveBeenCalledTimes(1); // not called again
  });

  it("does not error when publishing with no subscribers", async () => {
    await expect(bus.publish(evt("system:heartbeat"))).resolves.not.toThrow();
  });

  it("records events in getEventLog", async () => {
    await bus.publish(evt("a"));
    await bus.publish(evt("b"));

    const log = bus.getEventLog();
    expect(log).toHaveLength(2);
    expect(log[0].type).toBe("a");
    expect(log[1].type).toBe("b");
  });

  it("getEventLog returns a copy (mutations don't affect internal log)", async () => {
    await bus.publish(evt("a"));
    const log = bus.getEventLog();
    log.length = 0;
    expect(bus.getEventLog()).toHaveLength(1);
  });

  it("clearEventLog empties the log", async () => {
    await bus.publish(evt("a"));
    bus.clearEventLog();
    expect(bus.getEventLog()).toHaveLength(0);
  });

  it("handles async handlers", async () => {
    const order: string[] = [];

    bus.subscribe(async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push("slow");
    });
    bus.subscribe(() => {
      order.push("fast");
    });

    await bus.publish(evt("test"));

    expect(order).toContain("slow");
    expect(order).toContain("fast");
  });
});
