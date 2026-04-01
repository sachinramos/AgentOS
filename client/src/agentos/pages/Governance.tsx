import { useState, useEffect, useCallback } from "react";
import { aosApi } from "../lib/api";
import { useAosTheme } from "../AgentOSApp";

interface KillSwitchEvent {
  id: string;
  agentId: string;
  triggeredBy: string;
  reason: string;
  revokedKeys: unknown;
  restoredAt: string | null;
  restoredBy: string | null;
  createdAt: string;
}

interface Agent {
  id: string;
  uid: string;
  name: string;
  status: string;
  provider: string;
  llmModel: string;
  config?: Record<string, unknown>;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "warning";
}

let toastId = 0;

export default function Governance({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<KillSwitchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [killReason, setKillReason] = useState("");
  const [killLoading, setKillLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [recentlyKilled, setRecentlyKilled] = useState<Set<string>>(new Set());
  const [recentlyRestored, setRecentlyRestored] = useState<Set<string>>(new Set());
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  const addToast = useCallback((message: string, type: Toast["type"]) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchData = async () => {
    try {
      const [agentData, eventData] = await Promise.all([
        aosApi.getAgents({ limit: "100" }),
        aosApi.getKillSwitchEvents(),
      ]);
      setAgents(agentData.agents || []);
      setEvents(eventData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleKillSwitch = async (agentId: string) => {
    if (!killReason.trim()) return;
    setKillLoading(true);
    try {
      await aosApi.activateKillSwitch(agentId, killReason);
      setShowConfirm(null);
      setKillReason("");
      setRecentlyKilled(prev => new Set(prev).add(agentId));
      setTimeout(() => setRecentlyKilled(prev => { const n = new Set(prev); n.delete(agentId); return n; }), 2000);
      await fetchData();
      setNewEventIds(new Set(["latest"]));
      setTimeout(() => setNewEventIds(new Set()), 5000);
      addToast(`Kill switch activated — all access revoked`, "warning");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to activate kill switch", "error");
    } finally {
      setKillLoading(false);
    }
  };

  const handleRestore = async (agentId: string) => {
    try {
      await aosApi.restoreKillSwitch(agentId);
      setRecentlyRestored(prev => new Set(prev).add(agentId));
      setTimeout(() => setRecentlyRestored(prev => { const n = new Set(prev); n.delete(agentId); return n; }), 2000);
      await fetchData();
      addToast("Agent access restored successfully", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to restore agent", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeAgents = agents.filter(a => a.status === "active" || a.status === "onboarding");
  const suspendedByKill = agents.filter(a => a.config && (a.config as Record<string, unknown>)._killSwitchActive);
  const confirmAgent = agents.find(a => a.id === showConfirm);

  const panelCls = `border rounded-xl ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`;
  const titleCls = isDark ? "text-white" : "text-gray-900";
  const subtitleCls = isDark ? "text-slate-400" : "text-gray-500";
  const mutedCls = isDark ? "text-slate-500" : "text-gray-400";
  const cardCls = isDark ? "bg-slate-800/30 border-slate-700/30" : "bg-gray-50 border-gray-200";
  const modalBgCls = isDark ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200";
  const inputCls = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 h-24 resize-none ${isDark ? "bg-slate-800/50 border-slate-700 text-white" : "bg-white border-gray-300 text-gray-900"}`;

  return (
    <div className="space-y-6" data-testid="governance-page">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        </div>
        <div>
          <h1 className={`text-2xl font-bold ${titleCls}`} data-testid="text-governance-title">Universal Kill Switch</h1>
          <p className={`mt-0.5 text-sm ${subtitleCls}`}>Emergency revocation of agent access and API keys</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${panelCls} p-5`} data-testid="stat-active-agents">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className={`text-sm ${subtitleCls}`}>Active Agents</p>
          </div>
          <p className={`text-3xl font-bold ${titleCls}`}>{activeAgents.length}</p>
        </div>
        <div className={`rounded-xl p-5 border ${isDark ? "bg-red-900/20 border-red-800/30" : "bg-red-50 border-red-200"}`} data-testid="stat-kill-switch-active">
          <div className="flex items-center gap-2 mb-2">
            {suspendedByKill.length > 0 && <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />}
            <p className={`text-sm ${isDark ? "text-red-400" : "text-red-600"}`}>Kill Switch Active</p>
          </div>
          <p className={`text-3xl font-bold ${isDark ? "text-red-300" : "text-red-700"}`}>{suspendedByKill.length}</p>
        </div>
        <div className={`${panelCls} p-5`} data-testid="stat-total-events">
          <div className="flex items-center gap-2 mb-2">
            <p className={`text-sm ${subtitleCls}`}>Total Events</p>
          </div>
          <p className={`text-3xl font-bold ${titleCls}`}>{events.length}</p>
        </div>
      </div>

      <div className={`${panelCls} p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-semibold ${titleCls}`}>Active Agents</h2>
          <span className={`text-xs ${mutedCls}`}>{activeAgents.length} agent{activeAgents.length !== 1 ? "s" : ""}</span>
        </div>
        {activeAgents.length > 0 ? (
          <div className="space-y-3">
            {activeAgents.map(agent => (
              <div
                key={agent.id}
                className={`flex items-center justify-between py-3 px-4 rounded-lg border transition-all duration-500 ${
                  recentlyRestored.has(agent.id)
                    ? "bg-emerald-900/30 border-emerald-500/50 shadow-lg shadow-emerald-500/10"
                    : cardCls
                }`}
                data-testid={`agent-row-${agent.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 font-bold text-sm relative`}>
                    {agent.name.charAt(0)}
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 ${isDark ? "border-slate-800" : "border-white"}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={`font-medium text-sm ${titleCls}`}>{agent.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase font-semibold tracking-wider">Active</span>
                    </div>
                    <p className={`text-xs font-mono ${mutedCls}`}>{agent.uid}</p>
                  </div>
                </div>
                <button
                  data-testid={`button-kill-${agent.id}`}
                  onClick={() => setShowConfirm(agent.id)}
                  className="group px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-red-500/20 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:animate-pulse"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  Kill Switch
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 border ${isDark ? "bg-slate-800 border-slate-700" : "bg-gray-100 border-gray-200"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDark ? "text-slate-600" : "text-gray-400"}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/></svg>
            </div>
            <p className={`text-sm ${mutedCls}`}>No active agents</p>
            <p className={`text-xs mt-1 ${isDark ? "text-slate-600" : "text-gray-400"}`}>All agents are either suspended or not yet onboarded</p>
          </div>
        )}
      </div>

      {suspendedByKill.length > 0 && (
        <div className="bg-red-900/10 border border-red-800/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <h2 className="text-lg font-semibold text-red-300">Agents Under Kill Switch</h2>
          </div>
          <div className="space-y-3">
            {suspendedByKill.map(agent => (
              <div
                key={agent.id}
                className={`flex items-center justify-between py-3 px-4 rounded-lg border transition-all duration-700 ${
                  recentlyKilled.has(agent.id)
                    ? "bg-red-900/40 border-red-500/60 shadow-lg shadow-red-500/20 animate-pulse"
                    : "bg-red-900/20 border-red-800/30"
                }`}
                data-testid={`killed-agent-${agent.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 font-bold text-sm relative">
                    {agent.name.charAt(0)}
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 ${isDark ? "border-slate-800" : "border-white"}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={`font-medium text-sm ${titleCls}`}>{agent.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/30 text-red-300 border border-red-500/40 uppercase font-bold tracking-wider animate-pulse">Terminated</span>
                    </div>
                    <p className="text-red-400/70 text-xs">All access revoked</p>
                  </div>
                </div>
                <button
                  data-testid={`button-restore-${agent.id}`}
                  onClick={() => handleRestore(agent.id)}
                  className="px-4 py-2 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                  Restore Access
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`${panelCls} p-5`}>
        <div className="flex items-center gap-2 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={subtitleCls}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <h2 className={`text-lg font-semibold ${titleCls}`}>Audit Trail</h2>
        </div>
        {events.length > 0 ? (
          <div className="space-y-3">
            {events.map((event, idx) => {
              const agentObj = agents.find(a => a.id === event.agentId);
              const agentLabel = agentObj ? agentObj.name : event.agentId.slice(0, 8) + "...";
              const isNew = idx === 0 && newEventIds.size > 0;
              return (
                <div
                  key={event.id}
                  className={`py-3 px-4 rounded-lg border transition-all duration-500 ${
                    isNew
                      ? "bg-amber-900/20 border-amber-700/40 shadow-lg shadow-amber-500/5"
                      : cardCls
                  }`}
                  data-testid={`event-${event.id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${event.restoredAt ? "bg-emerald-400" : "bg-red-400"}`} />
                      <span className={`text-sm font-medium ${titleCls}`}>{agentLabel}</span>
                      {isNew && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold">NEW</span>}
                    </div>
                    <span className={`text-xs ${mutedCls}`}>{new Date(event.createdAt).toLocaleString()}</span>
                  </div>
                  <p className={`text-sm ml-4 ${isDark ? "text-slate-300" : "text-gray-700"}`}>
                    <span className={mutedCls}>Reason:</span> {event.reason}
                  </p>
                  <div className="flex items-center gap-2 mt-2 ml-4">
                    {event.restoredAt ? (
                      <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Restored {new Date(event.restoredAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full border border-red-500/30 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        Kill Active
                      </span>
                    )}
                    {Array.isArray(event.revokedKeys) && event.revokedKeys.length > 0 && (
                      <span className={`text-xs ${mutedCls}`}>{event.revokedKeys.length} key{event.revokedKeys.length !== 1 ? "s" : ""} revoked</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 border ${isDark ? "bg-slate-800 border-slate-700" : "bg-gray-100 border-gray-200"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDark ? "text-slate-600" : "text-gray-400"}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <p className={`text-sm ${mutedCls}`}>No kill switch events recorded</p>
            <p className={`text-xs mt-1 ${isDark ? "text-slate-600" : "text-gray-400"}`}>Events will appear here when the kill switch is activated</p>
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className={`border border-red-800/50 rounded-xl w-full max-w-md p-6 shadow-2xl shadow-red-500/10 animate-slideUp ${isDark ? "bg-slate-900" : "bg-white"}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <h2 className={`text-lg font-semibold ${titleCls}`}>Activate Kill Switch</h2>
                <p className="text-red-400 text-sm">This action takes effect immediately</p>
              </div>
            </div>

            <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 mb-4">
              <p className="text-red-300 text-sm font-medium mb-1">Warning — this will:</p>
              <ul className="text-red-400/80 text-xs space-y-1 ml-3">
                <li className="flex items-center gap-1.5"><span className="text-red-500">•</span> Immediately suspend agent <span className={`font-medium ${titleCls}`}>{confirmAgent?.name || "Unknown"}</span></li>
                <li className="flex items-center gap-1.5"><span className="text-red-500">•</span> Revoke all associated API keys</li>
                <li className="flex items-center gap-1.5"><span className="text-red-500">•</span> Block all pending and future requests</li>
                <li className="flex items-center gap-1.5"><span className="text-red-500">•</span> Create an audit trail entry</li>
              </ul>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}>Reason for activation *</label>
                <textarea data-testid="input-kill-reason" value={killReason} onChange={e => setKillReason(e.target.value)} className={inputCls} placeholder="Describe why this agent's access is being revoked..." autoFocus />
              </div>
              <div className="flex gap-3">
                <button data-testid="button-cancel-kill" onClick={() => { setShowConfirm(null); setKillReason(""); }} className={`flex-1 py-2.5 rounded-lg transition-colors text-sm ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}>Cancel</button>
                <button
                  data-testid="button-confirm-kill"
                  onClick={() => handleKillSwitch(showConfirm)}
                  disabled={killLoading || !killReason.trim()}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                >
                  {killLoading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Revoking...</>
                  ) : (
                    <><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>Confirm Kill Switch</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed top-4 right-4 z-[60] space-y-2 pointer-events-none" data-testid="toast-container">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-xl border backdrop-blur-sm flex items-center gap-2 animate-slideIn min-w-[280px] ${
              toast.type === "success"
                ? "bg-emerald-900/90 border-emerald-700/50 text-emerald-200"
                : toast.type === "warning"
                ? "bg-red-900/90 border-red-700/50 text-red-200"
                : "bg-slate-900/90 border-red-700/50 text-red-300"
            }`}
            data-testid={`toast-${toast.type}`}
          >
            {toast.type === "success" && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            {toast.type === "warning" && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
            {toast.type === "error" && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(100px); } to { opacity: 1; transform: translateX(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
      `}</style>
    </div>
  );
}
