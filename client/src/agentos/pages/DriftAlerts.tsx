import { useState, useEffect } from "react";
import { aosApi } from "../lib/api";
import { useAosTheme } from "../AgentOSApp";

interface DriftAlert { id: string; agentId: string; metric: string; baselineValue: string; currentValue: string; threshold: string; severity: string; status: string; acknowledgedBy: string | null; acknowledgedAt: string | null; createdAt: string; }
interface Agent { id: string; name: string; uid: string; }

const SEVERITY_COLORS: Record<string, string> = { warning: "bg-amber-500/20 text-amber-400 border-amber-500/30", critical: "bg-red-500/20 text-red-400 border-red-500/30", info: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
const STATUS_COLORS: Record<string, string> = { open: "bg-red-500/20 text-red-400", acknowledged: "bg-amber-500/20 text-amber-400", dismissed: "bg-slate-500/20 text-slate-400" };

export default function DriftAlerts() {
  const [alerts, setAlerts] = useState<DriftAlert[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  const fetchData = async () => {
    try {
      const [alertData, agentData] = await Promise.all([aosApi.getDriftAlerts(filter ? { status: filter } : undefined), aosApi.getAgents({ limit: "200" })]);
      setAlerts(alertData || []); setAgents(agentData.agents || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [filter]);

  const agentMap = new Map(agents.map(a => [a.id, a]));
  const handleAcknowledge = async (id: string) => { try { await aosApi.acknowledgeDriftAlert(id); await fetchData(); } catch (err) { alert(err instanceof Error ? err.message : "Failed"); } };
  const handleDismiss = async (id: string) => { try { await aosApi.dismissDriftAlert(id); await fetchData(); } catch (err) { alert(err instanceof Error ? err.message : "Failed"); } };

  if (loading) { return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>; }

  const openAlerts = alerts.filter(a => a.status === "open");
  const criticalAlerts = alerts.filter(a => a.severity === "critical" && a.status === "open");
  const panelCls = `border rounded-xl ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`;
  const titleCls = isDark ? "text-white" : "text-gray-900";
  const subtitleCls = isDark ? "text-slate-400" : "text-gray-500";
  const mutedCls = isDark ? "text-slate-500" : "text-gray-400";
  const cardCls = isDark ? "bg-slate-800/30 border-slate-700/30" : "bg-gray-50 border-gray-200";
  const tabInactiveCls = isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-gray-100 text-gray-500 hover:text-gray-900";

  return (
    <div className="space-y-6" data-testid="drift-alerts-page">
      <div>
        <h1 className={`text-2xl font-bold ${titleCls}`} data-testid="text-drift-title">Agent Drift Alerts</h1>
        <p className={`mt-1 ${subtitleCls}`}>Monitor performance deviations across your agent fleet</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${panelCls} p-5`} data-testid="stat-total-alerts">
          <p className={`text-sm ${subtitleCls}`}>Total Alerts</p>
          <p className={`text-3xl font-bold mt-1 ${titleCls}`}>{alerts.length}</p>
        </div>
        <div className={`rounded-xl p-5 border ${isDark ? "bg-red-900/20 border-red-800/30" : "bg-red-50 border-red-200"}`} data-testid="stat-open-alerts">
          <p className={`text-sm ${isDark ? "text-red-400" : "text-red-600"}`}>Open Alerts</p>
          <p className={`text-3xl font-bold mt-1 ${isDark ? "text-red-300" : "text-red-700"}`}>{openAlerts.length}</p>
        </div>
        <div className={`rounded-xl p-5 border ${isDark ? "bg-red-900/20 border-red-800/30" : "bg-red-50 border-red-200"}`} data-testid="stat-critical-alerts">
          <p className={`text-sm ${isDark ? "text-red-400" : "text-red-600"}`}>Critical</p>
          <p className={`text-3xl font-bold mt-1 ${isDark ? "text-red-300" : "text-red-700"}`}>{criticalAlerts.length}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {["", "open", "acknowledged", "dismissed"].map(s => (
          <button key={s} data-testid={`filter-${s || "all"}`} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? "bg-violet-600 text-white" : tabInactiveCls}`}>
            {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className={`${panelCls} p-5`}>
        {alerts.length > 0 ? (
          <div className="space-y-3">
            {alerts.map(alert => {
              const agent = agentMap.get(alert.agentId);
              return (
                <div key={alert.id} className={`p-4 border rounded-lg ${cardCls}`} data-testid={`drift-alert-${alert.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info}`}>{alert.severity}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[alert.status]}`}>{alert.status}</span>
                        <span className={`text-xs ${mutedCls}`}>{new Date(alert.createdAt).toLocaleString()}</span>
                      </div>
                      <p className={`font-medium text-sm ${titleCls}`}>
                        {alert.metric} drift detected
                        {agent && <span className={subtitleCls}> on {agent.name}</span>}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <div><span className={mutedCls}>Baseline: </span><span className="text-emerald-400 font-mono">{alert.baselineValue}</span></div>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDark ? "text-slate-600" : "text-gray-300"}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        <div><span className={mutedCls}>Current: </span><span className="text-red-400 font-mono">{alert.currentValue}</span></div>
                        <div><span className={mutedCls}>Threshold: </span><span className={`font-mono ${isDark ? "text-slate-300" : "text-gray-700"}`}>{alert.threshold}</span></div>
                      </div>
                    </div>
                    {alert.status === "open" && (
                      <div className="flex gap-2 ml-4">
                        <button data-testid={`button-acknowledge-${alert.id}`} onClick={() => handleAcknowledge(alert.id)} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-colors">Acknowledge</button>
                        <button data-testid={`button-dismiss-${alert.id}`} onClick={() => handleDismiss(alert.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}>Dismiss</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className={mutedCls}>No drift alerts found</p>
            <p className={`text-sm mt-1 ${isDark ? "text-slate-600" : "text-gray-400"}`}>Alerts will appear when agent performance deviates from baselines</p>
          </div>
        )}
      </div>
    </div>
  );
}
