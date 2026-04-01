import { useState, useEffect, useMemo } from "react";
import { aosGet } from "../lib/api";
import {
  Calculator, TrendingUp, TrendingDown, DollarSign, Users,
  Settings2, Sparkles, Building2, ChevronDown, ChevronUp, BarChart3
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend
} from "recharts";
import { useAosTheme } from "../AgentOSApp";

interface AgentComparison {
  agentId: string;
  agentName: string;
  humanEquivalentRole: string;
  department: string;
  departmentId: string | null;
  provider: string;
  model: string;
  tokenCost: number;
  platformFee: number;
  agentCostMonthly: number;
  humanHourlyRate: number;
  humanCostMonthly: number;
  netSavings: number;
  roi: number;
  fteEquivalent: number;
}

interface DepartmentRollup {
  department: string;
  agentCount: number;
  totalAgentCost: number;
  totalHumanCost: number;
  totalSavings: number;
  avgRoi: number;
}

interface ArbitrageData {
  agents: AgentComparison[];
  departmentRollup: DepartmentRollup[];
  topPerformer: { agentName: string; netSavings: number; role: string } | null;
  totals: {
    totalAgentCost: number;
    totalHumanCost: number;
    totalNetSavings: number;
    savingsPercent: number;
    totalFteEquivalent: number;
    agentCount: number;
  };
  config: {
    hourlyRate: number | null;
    workingHoursPerMonth: number;
    platformFeePercent: number;
  };
}

const fmt = (n: number) => {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
};

const fmtFull = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ArbitrageCalculator() {
  const [data, setData] = useState<ArbitrageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [workingHours, setWorkingHours] = useState<string>("160");
  const [platformFee, setPlatformFee] = useState<string>("20");
  const [showConfig, setShowConfig] = useState(false);
  const [whatIfCount, setWhatIfCount] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  const fetchData = (hr?: string, wh?: string, pf?: string) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    const rate = hr ?? hourlyRate;
    const hours = wh ?? workingHours;
    const fee = pf ?? platformFee;
    if (rate && rate !== "0") params.set("hourlyRate", rate);
    if (hours && hours !== "160") params.set("workingHours", hours);
    if (fee && fee !== "20") params.set("platformFee", fee);
    const qs = params.toString();
    aosGet(`/analytics/arbitrage${qs ? `?${qs}` : ""}`)
      .then(setData)
      .catch((e: Error) => {
        setError(e.message || "Failed to load arbitrage data");
        setData(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleApplyConfig = () => { fetchData(hourlyRate, workingHours, platformFee); };

  const { agents = [], totals, departmentRollup = [], topPerformer } = data || {};
  const t = totals || { totalAgentCost: 0, totalHumanCost: 0, totalNetSavings: 0, savingsPercent: 0, totalFteEquivalent: 0, agentCount: 0 };

  const summaryChartData = useMemo(() => [
    { name: "Human Cost", value: t.totalHumanCost, fill: "#3b82f6" },
    { name: "Agent Cost", value: t.totalAgentCost, fill: "#10b981" },
    { name: "Net Savings", value: t.totalNetSavings, fill: "#a855f7" },
  ], [t]);

  const deptChartData = useMemo(() =>
    departmentRollup.map(d => ({
      name: d.department.length > 12 ? d.department.slice(0, 12) + "…" : d.department,
      fullName: d.department,
      humanCost: d.totalHumanCost,
      agentCost: d.totalAgentCost,
      savings: d.totalSavings,
    })),
    [departmentRollup]
  );

  const whatIfSavings = useMemo(() => {
    if (!topPerformer) return 0;
    return topPerformer.netSavings * whatIfCount;
  }, [topPerformer, whatIfCount]);

  const sortedAgents = useMemo(() =>
    [...agents].sort((a, b) => b.netSavings - a.netSavings),
    [agents]
  );

  const panelCls = `border rounded-xl ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`;
  const titleCls = isDark ? "text-white" : "text-gray-900";
  const subtitleCls = isDark ? "text-slate-400" : "text-gray-500";
  const mutedCls = isDark ? "text-slate-500" : "text-gray-400";
  const inputCls = `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${isDark ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500" : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500"}`;
  const borderCls = isDark ? "border-slate-700/50" : "border-gray-200";
  const rowBorderCls = isDark ? "border-slate-700/30" : "border-gray-100";
  const hoverCls = isDark ? "hover:bg-slate-700/20" : "hover:bg-gray-50";
  const thCls = `text-xs font-medium p-4 ${subtitleCls}`;
  const tooltipStyle = isDark
    ? { backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#fff" }
    : { backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", color: "#111827" };
  const tooltipLabelStyle = isDark ? { color: "#94a3b8" } : { color: "#6b7280" };
  const axisTick = isDark ? { fill: "#94a3b8", fontSize: 12 } : { fill: "#6b7280", fontSize: 12 };

  if (loading && !data) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full" /></div>;
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-400 mb-2">{error}</p>
          <button onClick={() => fetchData()} className={`px-4 py-2 rounded-lg text-sm ${isDark ? "bg-slate-700 text-white hover:bg-slate-600" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`} data-testid="button-retry">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="aos-arbitrage">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${titleCls}`} data-testid="text-arbitrage-title">Labor Arbitrage Calculator</h1>
          <p className={`text-sm mt-1 ${subtitleCls}`}>Quantify AI agent savings vs human labor equivalents</p>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${isDark ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/50" : "bg-gray-100 hover:bg-gray-200 text-gray-600 border-gray-200"}`}
          data-testid="button-toggle-config"
        >
          <Settings2 size={16} />
          Configure Assumptions
          {showConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {showConfig && (
        <div className={`${panelCls} p-6 space-y-4`} data-testid="panel-config">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={`block text-xs mb-1.5 font-medium ${subtitleCls}`}>Avg Human Hourly Rate ($)</label>
              <input type="number" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} placeholder="Use per-agent rates" className={inputCls} data-testid="input-hourly-rate" min="0" step="5" />
            </div>
            <div>
              <label className={`block text-xs mb-1.5 font-medium ${subtitleCls}`}>Working Hours / Month</label>
              <input type="number" value={workingHours} onChange={e => setWorkingHours(e.target.value)} className={inputCls} data-testid="input-working-hours" min="0" step="8" />
            </div>
            <div>
              <label className={`block text-xs mb-1.5 font-medium ${subtitleCls}`}>Platform Fee (%)</label>
              <input type="number" value={platformFee} onChange={e => setPlatformFee(e.target.value)} className={inputCls} data-testid="input-platform-fee" min="0" max="100" step="5" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className={`text-xs ${mutedCls}`}>
              {hourlyRate ? `Override: $${hourlyRate}/hr × ${workingHours || 0} hrs = ${fmtFull(parseFloat(hourlyRate) * parseFloat(workingHours || "0"))}/mo per agent` : "Using each agent's configured human-equivalent salary"}
            </p>
            <button onClick={handleApplyConfig} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors" data-testid="button-apply-config">
              Apply & Recalculate
            </button>
          </div>
        </div>
      )}

      <div className={`rounded-xl p-8 text-center border ${isDark ? "bg-gradient-to-r from-emerald-900/40 via-emerald-800/30 to-slate-800/40 border-emerald-700/30" : "bg-gradient-to-r from-emerald-50 via-emerald-100/60 to-white border-emerald-200"}`} data-testid="hero-fte">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Users className={isDark ? "text-emerald-400" : "text-emerald-600"} size={28} />
          <p className={`text-sm font-medium uppercase tracking-wider ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>FTE Equivalent</p>
        </div>
        <p className={`text-5xl font-bold ${titleCls} mb-2`} data-testid="text-fte-hero">{t.totalFteEquivalent.toFixed(1)}</p>
        <p className={`text-sm ${subtitleCls}`}>
          Your AI fleet replaces <span className={`font-semibold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>{t.totalFteEquivalent.toFixed(1)} full-time employees</span>
          {t.totalNetSavings > 0 && (<span>, saving <span className={`font-semibold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>{fmtFull(t.totalNetSavings)}/month</span></span>)}
        </p>
        <div className={`flex items-center justify-center gap-6 mt-4 text-sm`}>
          <span className={subtitleCls}>{t.agentCount} agents active</span>
          <span className={isDark ? "text-slate-600" : "text-gray-300"}>|</span>
          <span className={t.savingsPercent >= 0 ? (isDark ? "text-emerald-400" : "text-emerald-600") : "text-red-400"}>{t.savingsPercent.toFixed(1)}% cost reduction</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={panelCls + " p-5"}>
          <div className="flex items-center gap-2 text-blue-400 mb-2"><Users size={18} /><span className="text-xs font-medium uppercase tracking-wide">Human Cost</span></div>
          <p className={`text-2xl font-bold ${titleCls}`} data-testid="text-total-human-cost">{fmtFull(t.totalHumanCost)}</p>
          <p className={`text-xs mt-1 ${mutedCls}`}>per month</p>
        </div>
        <div className={panelCls + " p-5"}>
          <div className="flex items-center gap-2 text-emerald-400 mb-2"><DollarSign size={18} /><span className="text-xs font-medium uppercase tracking-wide">Agent Cost</span></div>
          <p className={`text-2xl font-bold ${titleCls}`} data-testid="text-total-agent-cost">{fmtFull(t.totalAgentCost)}</p>
          <p className={`text-xs mt-1 ${mutedCls}`}>tokens + platform fee</p>
        </div>
        <div className={panelCls + " p-5"}>
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            {t.totalNetSavings >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            <span className="text-xs font-medium uppercase tracking-wide">Net Savings</span>
          </div>
          <p className={`text-2xl font-bold ${t.totalNetSavings >= 0 ? "text-emerald-400" : "text-red-400"}`} data-testid="text-net-savings">
            {fmtFull(Math.abs(t.totalNetSavings))}
            <span className="text-sm ml-1 font-normal">{t.totalNetSavings >= 0 ? "saved" : "over"}</span>
          </p>
          <p className={`text-xs mt-1 ${mutedCls}`}>per month</p>
        </div>
        <div className={panelCls + " p-5"}>
          <div className="flex items-center gap-2 text-orange-400 mb-2"><Calculator size={18} /><span className="text-xs font-medium uppercase tracking-wide">Avg ROI</span></div>
          <p className={`text-2xl font-bold ${titleCls}`} data-testid="text-avg-roi">
            {agents.length > 0 ? (agents.reduce((s, a) => s + a.roi, 0) / agents.length).toFixed(0) : 0}%
          </p>
          <p className={`text-xs mt-1 ${mutedCls}`}>return on investment</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${panelCls} p-6`} data-testid="chart-summary">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className={subtitleCls} />
            <h3 className={`text-sm font-medium ${titleCls}`}>Cost Comparison Overview</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summaryChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" tickFormatter={fmt} tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={axisTick} axisLine={false} tickLine={false} width={90} />
                <Tooltip formatter={(value: number) => fmtFull(value)} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={32}>
                  {summaryChartData.map((entry, i) => (<Cell key={i} fill={entry.fill} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {departmentRollup.length > 0 && (
          <div className={`${panelCls} p-6`} data-testid="chart-department">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={18} className={subtitleCls} />
              <h3 className={`text-sm font-medium ${titleCls}`}>Savings by Department</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptChartData} margin={{ left: 0, right: 10 }}>
                  <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmt} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number, name: string) => [fmtFull(value), name === "humanCost" ? "Human Cost" : name === "agentCost" ? "Agent Cost" : "Savings"]}
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  <Legend
                    formatter={(value: string) => value === "humanCost" ? "Human" : value === "agentCost" ? "Agent" : "Savings"}
                    wrapperStyle={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#6b7280" }}
                  />
                  <Bar dataKey="humanCost" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="agentCost" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="savings" fill="#a855f7" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {departmentRollup.length > 0 && (
        <div className={`${panelCls} overflow-x-auto`} data-testid="table-department-rollup">
          <div className={`p-4 border-b ${borderCls}`}>
            <h3 className={`text-sm font-medium ${titleCls} flex items-center gap-2`}>
              <Building2 size={16} className={subtitleCls} />
              Department Rollup
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className={`border-b ${borderCls}`}>
                <th className={`text-left ${thCls}`}>Department</th>
                <th className={`text-right ${thCls}`}>Agents</th>
                <th className={`text-right ${thCls}`}>Human Cost</th>
                <th className={`text-right ${thCls}`}>Agent Cost</th>
                <th className={`text-right ${thCls}`}>Net Savings</th>
                <th className={`text-right ${thCls}`}>ROI</th>
              </tr>
            </thead>
            <tbody>
              {departmentRollup.map((d, i) => (
                <tr key={i} className={`border-b ${rowBorderCls} ${hoverCls}`} data-testid={`row-dept-rollup-${i}`}>
                  <td className={`p-4 text-sm font-medium ${titleCls}`}>{d.department}</td>
                  <td className={`p-4 text-sm ${subtitleCls} text-right`}>{d.agentCount}</td>
                  <td className="p-4 text-sm text-blue-400 text-right">{fmtFull(d.totalHumanCost)}</td>
                  <td className="p-4 text-sm text-emerald-400 text-right">{fmtFull(d.totalAgentCost)}</td>
                  <td className={`p-4 text-sm text-right font-medium ${d.totalSavings >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {d.totalSavings >= 0 ? "+" : ""}{fmtFull(d.totalSavings)}
                  </td>
                  <td className={`p-4 text-sm text-right ${d.avgRoi >= 0 ? "text-emerald-400" : "text-red-400"}`}>{d.avgRoi.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={`${panelCls} overflow-hidden`} data-testid="table-arbitrage">
        <div className={`p-4 border-b ${borderCls}`}>
          <h3 className={`text-sm font-medium ${titleCls}`}>Per-Agent Comparison</h3>
        </div>
        {sortedAgents.length === 0 ? (
          <div className={`p-8 text-center ${mutedCls}`}>Configure human equivalent rates on agents to see arbitrage data</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
            {sortedAgents.map((a, i) => (
              <div
                key={a.agentId}
                className={`rounded-lg p-4 transition-colors border ${isDark ? "bg-slate-900/50 border-slate-700/30 hover:border-slate-600/50" : "bg-gray-50 border-gray-200 hover:border-gray-300"}`}
                data-testid={`card-agent-${i}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className={`text-sm font-medium ${titleCls}`}>{a.agentName}</p>
                    <p className={`text-xs ${mutedCls}`}>{a.humanEquivalentRole} · {a.department}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${a.netSavings >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                    {a.roi >= 0 ? "+" : ""}{a.roi.toFixed(0)}% ROI
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className={`text-[10px] uppercase tracking-wide ${mutedCls}`}>Human Monthly</p>
                    <p className="text-sm font-medium text-blue-400">{fmtFull(a.humanCostMonthly)}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] uppercase tracking-wide ${mutedCls}`}>Token Cost</p>
                    <p className="text-sm font-medium text-emerald-400">{fmtFull(a.tokenCost)}</p>
                    <p className={`text-[10px] ${mutedCls}`}>+{fmtFull(a.platformFee)} fee = {fmtFull(a.agentCostMonthly)}</p>
                  </div>
                </div>
                <div className={`flex items-center justify-between pt-3 border-t ${rowBorderCls}`}>
                  <div>
                    <p className={`text-[10px] uppercase tracking-wide ${mutedCls}`}>Net Savings</p>
                    <p className={`text-sm font-bold ${a.netSavings >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {a.netSavings >= 0 ? "+" : ""}{fmtFull(a.netSavings)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[10px] uppercase tracking-wide ${mutedCls}`}>ROI Multiplier</p>
                    <p className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}>{a.agentCostMonthly > 0 ? `${(a.humanCostMonthly / a.agentCostMonthly).toFixed(1)}x` : "∞"}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className={`flex justify-between text-[10px] mb-1 ${mutedCls}`}>
                    <span>Agent vs Human</span>
                    <span>{(100 - a.fteEquivalent * 100).toFixed(0)}% cheaper</span>
                  </div>
                  <div className={`w-full rounded-full h-1.5 overflow-hidden ${isDark ? "bg-slate-700" : "bg-gray-200"}`}>
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(Math.max(100 - a.fteEquivalent * 100, 0), 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {topPerformer && (
        <div className={`rounded-xl p-6 border ${isDark ? "bg-gradient-to-r from-purple-900/30 via-slate-800/40 to-purple-900/30 border-purple-700/30" : "bg-gradient-to-r from-violet-50 via-purple-50/60 to-white border-violet-200"}`} data-testid="section-what-if">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className={isDark ? "text-purple-400" : "text-violet-500"} />
            <h3 className={`text-sm font-medium ${titleCls}`}>What If Projection</h3>
          </div>
          <p className={`text-sm mb-4 ${subtitleCls}`}>
            Your top performer is <span className={`font-medium ${isDark ? "text-purple-300" : "text-violet-600"}`}>{topPerformer.agentName}</span> ({topPerformer.role}), saving <span className={`font-medium ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>{fmtFull(topPerformer.netSavings)}/mo</span>.
            What if you added more agents like them?
          </p>
          <div className="flex items-center gap-4 mb-4">
            <label className={`text-sm whitespace-nowrap ${subtitleCls}`}>Add agents:</label>
            <input type="range" min={1} max={50} value={whatIfCount} onChange={e => setWhatIfCount(parseInt(e.target.value))} className="flex-1 accent-purple-500 h-2" data-testid="slider-what-if" />
            <span className={`text-lg font-bold w-10 text-right ${titleCls}`} data-testid="text-what-if-count">{whatIfCount}</span>
          </div>
          <div className={`rounded-lg p-4 text-center ${isDark ? "bg-slate-900/50" : "bg-white/80 border border-gray-200"}`}>
            <p className={`text-sm mb-1 ${subtitleCls}`}>
              Adding <span className={`font-medium ${titleCls}`}>{whatIfCount}</span> more agents like {topPerformer.agentName} would save:
            </p>
            <p className="text-3xl font-bold text-emerald-400" data-testid="text-what-if-savings">
              {fmtFull(whatIfSavings)}<span className={`text-base font-normal ${subtitleCls}`}>/month</span>
            </p>
            <p className={`text-sm mt-1 ${mutedCls}`}>{fmtFull(whatIfSavings * 12)}/year additional savings</p>
          </div>
        </div>
      )}
    </div>
  );
}
