import { useState, useEffect } from "react";
import { aosApi } from "../lib/api";
import { useAosTheme } from "../AgentOSApp";

interface ShadowAgent { id: string; identifier: string; provider: string | null; llmModel: string | null; sourceIp: string | null; department: string | null; firstSeenAt: string; lastSeenAt: string; callCount: number; status: string; registeredAgentId: string | null; }
const STATUS_COLORS: Record<string, string> = { unmanaged: "bg-red-500/20 text-red-400", registered: "bg-emerald-500/20 text-emerald-400", dismissed: "bg-slate-500/20 text-slate-400" };

export default function ShadowAI() {
  const [agents, setAgents] = useState<ShadowAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [showSnippet, setShowSnippet] = useState(false);
  const [snippet, setSnippet] = useState("");
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  const fetchData = async () => { try { const data = await aosApi.getShadowAgents(filter || undefined); setAgents(data || []); } catch (err) { console.error(err); } finally { setLoading(false); } };
  useEffect(() => { fetchData(); }, [filter]);
  const handleRegister = async (id: string) => { try { await aosApi.registerShadowAgent(id); await fetchData(); } catch (err) { alert(err instanceof Error ? err.message : "Failed"); } };
  const handleDismiss = async (id: string) => { try { await aosApi.dismissShadowAgent(id); await fetchData(); } catch (err) { alert(err instanceof Error ? err.message : "Failed"); } };
  const handleShowSnippet = async () => { try { const data = await aosApi.getSdkSnippet(); setSnippet(data.snippet); setShowSnippet(true); } catch (err) { alert(err instanceof Error ? err.message : "Failed"); } };

  if (loading) { return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>; }

  const unmanagedCount = agents.filter(a => a.status === "unmanaged").length;
  const panelCls = `border rounded-xl ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`;
  const titleCls = isDark ? "text-white" : "text-gray-900";
  const subtitleCls = isDark ? "text-slate-400" : "text-gray-500";
  const mutedCls = isDark ? "text-slate-500" : "text-gray-400";
  const cardCls = isDark ? "bg-slate-800/30 border-slate-700/30" : "bg-gray-50 border-gray-200";
  const tabInactiveCls = isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-gray-100 text-gray-500 hover:text-gray-900";
  const modalCls = isDark ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200";
  const codeCls = isDark ? "bg-slate-950 border-slate-700 text-slate-300" : "bg-gray-100 border-gray-200 text-gray-800";

  return (
    <div className="space-y-6" data-testid="shadow-ai-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${titleCls}`} data-testid="text-shadow-title">Shadow AI Discovery</h1>
          <p className={`mt-1 ${subtitleCls}`}>Discover and manage unregistered AI agents in your organization</p>
        </div>
        <button data-testid="button-show-sdk" onClick={handleShowSnippet} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">Get SDK Snippet</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${panelCls} p-5`} data-testid="stat-total-discovered">
          <p className={`text-sm ${subtitleCls}`}>Total Discovered</p>
          <p className={`text-3xl font-bold mt-1 ${titleCls}`}>{agents.length}</p>
        </div>
        <div className={`rounded-xl p-5 border ${isDark ? "bg-red-900/20 border-red-800/30" : "bg-red-50 border-red-200"}`} data-testid="stat-unmanaged">
          <p className={`text-sm ${isDark ? "text-red-400" : "text-red-600"}`}>Unmanaged</p>
          <p className={`text-3xl font-bold mt-1 ${isDark ? "text-red-300" : "text-red-700"}`}>{unmanagedCount}</p>
        </div>
        <div className={`rounded-xl p-5 border ${isDark ? "bg-emerald-900/20 border-emerald-800/30" : "bg-emerald-50 border-emerald-200"}`} data-testid="stat-registered">
          <p className={`text-sm ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>Registered</p>
          <p className={`text-3xl font-bold mt-1 ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>{agents.filter(a => a.status === "registered").length}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {["", "unmanaged", "registered", "dismissed"].map(s => (
          <button key={s} data-testid={`filter-${s || "all"}`} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? "bg-violet-600 text-white" : tabInactiveCls}`}>
            {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className={`${panelCls} p-5`}>
        {agents.length > 0 ? (
          <div className="space-y-3">
            {agents.map(agent => (
              <div key={agent.id} className={`p-4 border rounded-lg ${cardCls}`} data-testid={`shadow-agent-${agent.id}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-medium ${titleCls}`}>{agent.identifier}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[agent.status]}`}>{agent.status}</span>
                    </div>
                    <div className={`flex items-center gap-4 text-sm ${subtitleCls}`}>
                      {agent.provider && <span>Provider: {agent.provider}</span>}
                      {agent.llmModel && <span>Model: {agent.llmModel}</span>}
                      {agent.sourceIp && <span>IP: {agent.sourceIp}</span>}
                    </div>
                    <div className={`flex items-center gap-4 text-xs mt-1 ${mutedCls}`}>
                      <span>First seen: {new Date(agent.firstSeenAt).toLocaleDateString()}</span>
                      <span>Last seen: {new Date(agent.lastSeenAt).toLocaleDateString()}</span>
                      <span>{agent.callCount} API calls</span>
                    </div>
                  </div>
                  {agent.status === "unmanaged" && (
                    <div className="flex gap-2 ml-4">
                      <button data-testid={`button-register-${agent.id}`} onClick={() => handleRegister(agent.id)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors">Register</button>
                      <button data-testid={`button-dismiss-${agent.id}`} onClick={() => handleDismiss(agent.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}>Dismiss</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className={mutedCls}>No shadow agents discovered</p>
            <p className={`text-sm mt-1 ${isDark ? "text-slate-600" : "text-gray-400"}`}>Deploy the SDK snippet to start discovering unmanaged agents</p>
          </div>
        )}
      </div>

      {showSnippet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`border rounded-xl w-full max-w-2xl p-6 ${modalCls}`}>
            <h2 className={`text-lg font-semibold mb-2 ${titleCls}`}>SDK Integration Snippet</h2>
            <p className={`text-sm mb-4 ${subtitleCls}`}>Add this code to your applications to automatically discover unmanaged AI agents.</p>
            <div className={`border rounded-lg p-4 overflow-auto max-h-80 ${codeCls}`}>
              <pre className="text-sm font-mono whitespace-pre-wrap" data-testid="text-sdk-snippet">{snippet}</pre>
            </div>
            <div className="flex gap-3 mt-4">
              <button data-testid="button-copy-snippet" onClick={() => { navigator.clipboard.writeText(snippet); }} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">Copy to Clipboard</button>
              <button data-testid="button-close-snippet" onClick={() => setShowSnippet(false)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
