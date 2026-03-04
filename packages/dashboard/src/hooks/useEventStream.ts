import { useEffect, useRef, useCallback } from "react";
import { usePodStore } from "../store/index.js";
import type { SystemEvent } from "@trading-pod/shared";

const WS_URL =
  (import.meta as any).env?.VITE_WS_URL ?? "ws://localhost:8787/ws";

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

/**
 * Hook that maintains a WebSocket connection to the event-stream Durable Object.
 * Automatically reconnects with exponential back-off.
 * Dispatches received events into the Zustand store.
 */
export function useEventStream() {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connected = usePodStore((s) => s.connected);
  const setConnected = usePodStore((s) => s.setConnected);
  const handleEvent = usePodStore((s) => s.handleEvent);

  const connect = useCallback(() => {
    // Clean up previous
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setConnected(true);
      };

      ws.onmessage = (msg) => {
        try {
          const event: SystemEvent = JSON.parse(msg.data);
          handleEvent(event);
        } catch {
          console.warn("[EventStream] Failed to parse message:", msg.data);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setConnected(false);
      scheduleReconnect();
    }
  }, [setConnected, handleEvent]);

  const scheduleReconnect = useCallback(() => {
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** retryRef.current,
      RECONNECT_MAX_MS,
    );
    retryRef.current += 1;
    timerRef.current = setTimeout(connect, delay);
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { connected };
}
