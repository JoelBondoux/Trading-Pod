import { useState } from "react";
import { useRuntimeStatus } from "./hooks/useRuntimeStatus.js";
import { AuthProvider, useAuth } from "./auth/AuthContext.js";
import { LoginPage } from "./auth/LoginPage.js";
import { AgentTiles } from "./panels/AgentTiles.js";
import { FCPipeline } from "./panels/FCPipeline.js";
import { TreasurerPanel } from "./panels/TreasurerPanel.js";
import { ExecutionPanel } from "./panels/ExecutionPanel.js";
import { DecisionReplay } from "./panels/DecisionReplay.js";
import { ControlPanel } from "./panels/ControlPanel.js";
import { SettingsPanel } from "./panels/SettingsPanel.js";

type Tab =
  | "overview"
  | "agents"
  | "fc"
  | "treasurer"
  | "execution"
  | "replay"
  | "control"
  | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "agents", label: "Agents" },
  { id: "fc", label: "FC Pipeline" },
  { id: "treasurer", label: "Treasurer" },
  { id: "execution", label: "Execution" },
  { id: "replay", label: "Replay" },
  { id: "control", label: "Control" },
  { id: "settings", label: "Settings" },
];

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

/** Show login page when auth is required and user is not logged in */
function AuthGate() {
  const { user, loading } = useAuth();

  // Missing auth configuration never opens the dashboard.
  if (!user) {
    return <LoginPage />;
  }

  // If still loading auth state, show nothing
  if (loading) return null;

  return <Dashboard />;
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const { connected } = useRuntimeStatus();
  const { user, signOut } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-pod-surface border-r border-pod-border flex flex-col">
        <div className="p-4 border-b border-pod-border">
          <h1 className="text-lg font-bold text-white tracking-tight">🤖 Trading Pod</h1>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-pod-green" : "bg-pod-red"}`} />
            <span className="text-gray-400">
              {connected ? "Status connected" : "Status unavailable"}
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

        {/* User info + sign out */}
        {user && (
          <div className="p-3 border-t border-pod-border">
            <div className="flex items-center gap-2">
              <img src={user.picture} alt="" className="h-6 w-6 rounded-full" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-300 truncate">{user.name}</p>
                <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="mt-2 w-full text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}

        <div className="p-3 border-t border-pod-border text-[10px] text-gray-600">
          Trading Pod v0.1.0
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-5 rounded-md border border-pod-accent/30 bg-pod-accent/10 p-3 text-sm text-gray-300">
          FX research · OANDA practice · Execution locked · Broker not connected
        </div>
        {activeTab === "overview" && <OverviewPage />}
        {activeTab === "agents" && <AgentTiles />}
        {activeTab === "fc" && <FCPipeline />}
        {activeTab === "treasurer" && <TreasurerPanel />}
        {activeTab === "execution" && <ExecutionPanel />}
        {activeTab === "replay" && <DecisionReplay />}
        {activeTab === "control" && <ControlPanel />}
        {activeTab === "settings" && <SettingsPanel />}
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
        <ExecutionPanel compact />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FCPipeline compact />
      </div>
    </div>
  );
}
