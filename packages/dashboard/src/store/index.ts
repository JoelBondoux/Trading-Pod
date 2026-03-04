import { create } from "zustand";
import type {
  AgentSignal,
  CredibilityRecord,
  FCDecision,
  TreasurerState,
  TradeExecution,
  SavingsState,
  TaxReserveState,
  SystemEvent,
} from "@trading-pod/shared";

// ---------------------------------------------------------------------------
// Slice types
// ---------------------------------------------------------------------------

export interface AgentsSlice {
  signals: AgentSignal[];
  credibility: Record<string, CredibilityRecord>;
}

export interface FCSlice {
  decisions: FCDecision[];
  latestDecision: FCDecision | null;
}

export interface TreasurerSlice {
  treasurerState: TreasurerState | null;
}

export interface ExecutionSlice {
  openTrades: TradeExecution[];
  closedTrades: TradeExecution[];
}

export interface SavingsSlice {
  savingsState: SavingsState | null;
}

export interface TaxSlice {
  taxState: TaxReserveState | null;
}

export interface ConnectionSlice {
  connected: boolean;
  eventLog: SystemEvent[];
}

export interface ControlSlice {
  frozenAgents: Set<string>;
  tradingPaused: boolean;
}

export interface PodStore
  extends AgentsSlice,
    FCSlice,
    TreasurerSlice,
    ExecutionSlice,
    SavingsSlice,
    TaxSlice,
    ConnectionSlice,
    ControlSlice {
  // Actions
  addSignal: (s: AgentSignal) => void;
  updateCredibility: (c: CredibilityRecord) => void;
  addDecision: (d: FCDecision) => void;
  setTreasurerState: (t: TreasurerState) => void;
  upsertTrade: (t: TradeExecution) => void;
  setSavingsState: (s: SavingsState) => void;
  setTaxState: (t: TaxReserveState) => void;
  setConnected: (v: boolean) => void;
  pushEvent: (e: SystemEvent) => void;
  toggleFreezeAgent: (agentId: string) => void;
  toggleTradingPaused: () => void;
  handleEvent: (e: SystemEvent) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const MAX_SIGNALS = 200;
const MAX_DECISIONS = 200;
const MAX_CLOSED_TRADES = 200;
const MAX_EVENT_LOG = 500;

export const usePodStore = create<PodStore>((set, get) => ({
  // --- Initial state ---
  signals: [],
  credibility: {},
  decisions: [],
  latestDecision: null,
  treasurerState: null,
  savingsState: null,
  taxState: null,
  openTrades: [],
  closedTrades: [],
  connected: false,
  eventLog: [],
  frozenAgents: new Set(),
  tradingPaused: false,

  // --- Actions ---
  addSignal: (s) =>
    set((prev) => ({
      signals: [s, ...prev.signals].slice(0, MAX_SIGNALS),
    })),

  updateCredibility: (c) =>
    set((prev) => ({
      credibility: { ...prev.credibility, [c.agentId]: c },
    })),

  addDecision: (d) =>
    set((prev) => ({
      decisions: [d, ...prev.decisions].slice(0, MAX_DECISIONS),
      latestDecision: d,
    })),

  setTreasurerState: (t) => set({ treasurerState: t }),

  upsertTrade: (t) =>
    set((prev) => {
      if (t.status === "closed" || t.status === "cancelled" || t.status === "error") {
        return {
          openTrades: prev.openTrades.filter(
            (o) => o.executionId !== t.executionId,
          ),
          closedTrades: [t, ...prev.closedTrades].slice(0, MAX_CLOSED_TRADES),
        };
      }
      const exists = prev.openTrades.find(
        (o) => o.executionId === t.executionId,
      );
      if (exists) {
        return {
          openTrades: prev.openTrades.map((o) =>
            o.executionId === t.executionId ? t : o,
          ),
        };
      }
      return { openTrades: [t, ...prev.openTrades] };
    }),

  setSavingsState: (_s) => set({ savingsState: _s }),

  setTaxState: (_t) => set({ taxState: _t }),

  setConnected: (v) => set({ connected: v }),

  pushEvent: (e) =>
    set((prev) => ({
      eventLog: [e, ...prev.eventLog].slice(0, MAX_EVENT_LOG),
    })),

  toggleFreezeAgent: (agentId) =>
    set((prev) => {
      const next = new Set(prev.frozenAgents);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return { frozenAgents: next };
    }),

  toggleTradingPaused: () =>
    set((prev) => ({ tradingPaused: !prev.tradingPaused })),

  // --- Unified event handler ---
  handleEvent: (e) => {
    const store = get();
    store.pushEvent(e);

    switch (e.type) {
      case "agent:signal":
        store.addSignal(e.payload);
        break;
      case "agent:credibility_updated":
        store.updateCredibility(e.payload);
        break;
      case "fc:decision":
        store.addDecision(e.payload);
        break;
      case "execution:submitted":
      case "execution:filled":
      case "execution:closed":
      case "execution:error":
        store.upsertTrade(e.payload);
        break;
      default:
        break;
    }
  },
}));


