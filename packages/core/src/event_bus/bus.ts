// ============================================================================
// Event Bus — Local implementation for testing
// ============================================================================

import type { SystemEvent } from "@trading-pod/shared";

/** Event handler callback */
export type EventHandler = (event: SystemEvent) => void | Promise<void>;

/**
 * Event Bus interface.
 * Local implementation for testing; Cloudflare Durable Object implementation in backend.
 */
export interface EventBus {
  /** Publish an event to all subscribers */
  publish(event: SystemEvent): Promise<void>;

  /** Subscribe to events, optionally filtered by type prefix */
  subscribe(handler: EventHandler, filter?: string): () => void;
}

/**
 * Local in-memory event bus for testing and development.
 */
export class LocalEventBus implements EventBus {
  private subscribers: Array<{ handler: EventHandler; filter?: string }> = [];
  private eventLog: SystemEvent[] = [];

  async publish(event: SystemEvent): Promise<void> {
    this.eventLog.push(event);

    const matchingSubscribers = this.subscribers.filter((sub) => {
      if (!sub.filter || sub.filter === "*") return true;
      return event.type.startsWith(sub.filter);
    });

    await Promise.all(
      matchingSubscribers.map((sub) => sub.handler(event))
    );
  }

  subscribe(handler: EventHandler, filter?: string): () => void {
    const subscription = { handler, filter };
    this.subscribers.push(subscription);

    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(subscription);
      if (index !== -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /** Get all recorded events (for debugging/testing) */
  getEventLog(): SystemEvent[] {
    return [...this.eventLog];
  }

  /** Clear the event log */
  clearEventLog(): void {
    this.eventLog = [];
  }
}
