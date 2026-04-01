import { useState, useEffect } from "react";
import { aosGet } from "../lib/api";
import { DollarSign, Building2, Cpu, TrendingUp, AlertTriangle } from "lucide-react";
import { useAosTheme } from "../AgentOSApp";

type ViewMode = "agent" | "department" | "provider";

export default function Payroll() {
  const [view, setView] = useState<ViewMode>("agent");
  const [costByAgent, setCostByAgent] = useState<any[]>([]);
  const [costByDept, setCostByDept] = useState<any[]>([]);
  const [costByProvider, setCostByProvider] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    const errors: string[] = [];
    Promise.all([
      aosGet("/analytics/costs?groupBy=agent").catch((e) => { errors.push("Failed to load agent costs"); return []; }),
      aosGet("/analytics/costs?groupBy=department").catch((e) => { errors.push("Failed to load department costs"); return []; }),
      aosGet("/analytics/costs?groupBy=provider").catch((e) => { errors.push("Failed to load provider costs"); return []; }),
      aosGet("/agents").catch((e) => { errors.push("Failed to load agents"); return []; }),
      aosGet("/departments").catch((e) => { errors.push("Failed to load departments"); return []; }),
    ]).then(([ca, cd, cp, a, d]) => {
      setCostByAgent(Array.isArray(ca) ? ca : []);
      setCostByDept(Array.isArray(cd) ? cd : []);
      setCostByProvider(Array.isArray(cp) ? cp : []);
      setAgents(Array.isArray(a) ? a : []);
      setDepartments(Array.isArray(d) ? d : []);
      if (errors.length > 0) setError(errors.join(". "));
      setLoading(false);
    });
  }, []);

  const totalCost = costByAgent.reduce((s: number, c: any) => s + parseFloat(c.totalCost || "0"), 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full" /></div>;
  }

  const panelCls = `border rounded-xl ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`;
  const thCls = `text-xs font-medium p-4 ${isDark ? "text-slate-400" : "text-gray-500"}`;
  const tdWhiteCls = `p-4 text-sm ${isDark ? "text-white" : "text-gray-900"}`;
  const tdMutedCls = `p-4 text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`;
  const borderCls = isDark ? "border-slate-700/50" : "border-gray-200";
  const rowBorderCls = isDark ? "border-slate-700/30" : "border-gray-100";
  const hoverCls = isDark ? "hover:bg-slate-700/20" : "hover:bg-gray-50";

  return (
    <div className="space-y-6" data-testid="aos-payroll">
      <div>
        <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`} data-testid="text-payroll-title">Agent Payroll</h1>
        <p className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>Cost aggregation by agent, department, and provider</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 flex items-center gap-2 text-red-300 text-sm" data-testid="payroll-error-banner">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-200">×</button>
        </div>
      )}

      <div className={`${panelCls} p-6`}>
        <div className="flex items-center gap-3 mb-2">
          <DollarSign className="text-emerald-400" size={24} />
          <div>
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>Total Agent Payroll</p>
            <p className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`} data-testid="text-total-payroll">${totalCost.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {(["agent", "department", "provider"] as ViewMode[]).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === v ? "bg-emerald-600 text-white" : isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-gray-100 text-gray-500 hover:text-gray-900"}`}
            data-testid={`button-view-${v}`}>
            {v === "agent" && <DollarSign className="inline w-4 h-4 mr-1" />}
            {v === "department" && <Building2 className="inline w-4 h-4 mr-1" />}
            {v === "provider" && <Cpu className="inline w-4 h-4 mr-1" />}
            By {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      <div className={`${panelCls} overflow-hidden`}>
        {view === "agent" && (
          <table className="w-full" data-testid="table-cost-by-agent">
            <thead>
              <tr className={`border-b ${borderCls}`}>
                <th className={`text-left ${thCls}`}>Agent</th>
                <th className={`text-left ${thCls}`}>Provider/Model</th>
                <th className={`text-right ${thCls}`}>Tokens</th>
                <th className={`text-right ${thCls}`}>Events</th>
                <th className={`text-right ${thCls}`}>Cost</th>
                <th className={`text-right ${thCls}`}>Budget</th>
              </tr>
            </thead>
            <tbody>
              {costByAgent.length === 0 ? (
                <tr><td colSpan={6} className={`p-8 text-center ${isDark ? "text-slate-500" : "text-gray-400"}`}>No cost data available</td></tr>
              ) : costByAgent.map((c: any, i: number) => {
                const agent = agents.find((a: any) => a.id === c.agentId);
                const cost = parseFloat(c.totalCost || "0");
                const cap = agent?.budgetCap ? parseFloat(agent.budgetCap) : null;
                const pct = cap ? (cost / cap) * 100 : null;
                return (
                  <tr key={i} className={`border-b ${rowBorderCls} ${hoverCls}`} data-testid={`row-agent-cost-${i}`}>
                    <td className={tdWhiteCls}>{agent?.name || c.agentId.slice(0, 8)}</td>
                    <td className={tdMutedCls}>{c.provider}/{c.model}</td>
                    <td className={`${tdMutedCls} text-right`}>{(c.totalTokens || 0).toLocaleString()}</td>
                    <td className={`${tdMutedCls} text-right`}>{c.eventCount}</td>
                    <td className={`${tdWhiteCls} text-right font-medium`}>${cost.toFixed(2)}</td>
                    <td className="p-4 text-right">
                      {cap ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className={`w-20 rounded h-2 overflow-hidden ${isDark ? "bg-slate-700" : "bg-gray-200"}`}>
                            <div className={`h-full rounded ${pct! >= 100 ? "bg-red-500" : pct! >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(pct!, 100)}%` }} />
                          </div>
                          <span className={`text-xs ${pct! >= 100 ? "text-red-400" : pct! >= 80 ? "text-amber-400" : isDark ? "text-slate-400" : "text-gray-500"}`}>
                            {pct!.toFixed(0)}%
                          </span>
                        </div>
                      ) : <span className={`text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}>No cap</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {view === "department" && (
          <table className="w-full" data-testid="table-cost-by-department">
            <thead>
              <tr className={`border-b ${borderCls}`}>
                <th className={`text-left ${thCls}`}>Department</th>
                <th className={`text-right ${thCls}`}>Tokens</th>
                <th className={`text-right ${thCls}`}>Events</th>
                <th className={`text-right ${thCls}`}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {costByDept.length === 0 ? (
                <tr><td colSpan={4} className={`p-8 text-center ${isDark ? "text-slate-500" : "text-gray-400"}`}>No department cost data</td></tr>
              ) : costByDept.map((c: any, i: number) => {
                const dept = departments.find((d: any) => d.id === c.departmentId);
                return (
                  <tr key={i} className={`border-b ${rowBorderCls} ${hoverCls}`} data-testid={`row-dept-cost-${i}`}>
                    <td className={tdWhiteCls}>{dept?.name || "Unassigned"}</td>
                    <td className={`${tdMutedCls} text-right`}>{(c.totalTokens || 0).toLocaleString()}</td>
                    <td className={`${tdMutedCls} text-right`}>{c.eventCount}</td>
                    <td className={`${tdWhiteCls} text-right font-medium`}>${parseFloat(c.totalCost || "0").toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {view === "provider" && (
          <table className="w-full" data-testid="table-cost-by-provider">
            <thead>
              <tr className={`border-b ${borderCls}`}>
                <th className={`text-left ${thCls}`}>Provider</th>
                <th className={`text-left ${thCls}`}>Model</th>
                <th className={`text-right ${thCls}`}>Tokens</th>
                <th className={`text-right ${thCls}`}>Avg Latency</th>
                <th className={`text-right ${thCls}`}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {costByProvider.length === 0 ? (
                <tr><td colSpan={5} className={`p-8 text-center ${isDark ? "text-slate-500" : "text-gray-400"}`}>No provider cost data</td></tr>
              ) : costByProvider.map((c: any, i: number) => (
                <tr key={i} className={`border-b ${rowBorderCls} ${hoverCls}`} data-testid={`row-provider-cost-${i}`}>
                  <td className={tdWhiteCls}>{c.provider}</td>
                  <td className={tdMutedCls}>{c.model}</td>
                  <td className={`${tdMutedCls} text-right`}>{(c.totalTokens || 0).toLocaleString()}</td>
                  <td className={`${tdMutedCls} text-right`}>{Math.round(c.avgLatency || 0)}ms</td>
                  <td className={`${tdWhiteCls} text-right font-medium`}>${parseFloat(c.totalCost || "0").toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
