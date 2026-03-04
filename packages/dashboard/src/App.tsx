import { useState } from "react";
import { useEventStream } from "./hooks/useEventStream.js";
import { AgentTiles } from "./panels/AgentTiles.js";
import { FCPipeline } from "./panels/FCPipeline.js";
import { TreasurerPanel } from "./panels/TreasurerPanel.js";
import { ExecutionPanel } from "./panels/ExecutionPanel.js";
import { SavingsPanel } from "./panels/SavingsPanel.js";
import { TaxPanel } from "./panels/TaxPanel.js";
import { DecisionReplay } from "./panels/DecisionReplay.js";
import { ControlPanel } from "./panels/ControlPanel.js";

type Tab =
  | "overview"
  | "agents"
  | "fc"
  | "treasurer"
  | "execution"
  | "savings"
  | "tax"
  | "replay"
  | "control";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "agents", label: "Agents" },
  { id: "fc", label: "FC Pipeline" },
  { id: "treasurer", label: "Treasurer" },
  { id: "execution", label: "Execution" },
  { id: "savings", label: "Savings" },
  { id: "tax", label: "Tax" },
  { id: "replay", label: "Replay" },
  { id: "control", label: "Control" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const { connected } = useEventStream();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-pod-surface border-r border-pod-border flex flex-col">
        <div className="p-4 border-b border-pod-border">
          <h1 className="text-lg font-bold text-white tracking-tight">
            🤖 Trading Pod
          </h1>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? "bg-pod-green" : "bg-pod-red"
              }`}
            />
            <span className="text-gray-400">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                activeTab === tab.id
                  ? "bg-pod-accent/20 text-pod-accent font-medium"
                  : "text-gray-400 hover:text-gray-200 hover:bg-pod-border/40"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-pod-border text-[10px] text-gray-600">
          Trading Pod v0.1.0
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        {activeTab === "overview" && <OverviewPage />}
        {activeTab === "agents" && <AgentTiles />}
        {activeTab === "fc" && <FCPipeline />}
        {activeTab === "treasurer" && <TreasurerPanel />}
        {activeTab === "execution" && <ExecutionPanel />}
        {activeTab === "savings" && <SavingsPanel />}
        {activeTab === "tax" && <TaxPanel />}
        {activeTab === "replay" && <DecisionReplay />}
        {activeTab === "control" && <ControlPanel />}
      </main>
    </div>
  );
}

/** Overview page showing a compact summary of all subsystems */
function OverviewPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">System Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <AgentTiles compact />
        <TreasurerPanel compact />
        <SavingsPanel compact />
        <TaxPanel compact />
        <ExecutionPanel compact />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FCPipeline compact />
      </div>
    </div>
  );
}
