import { useState, useEffect, useMemo, useRef } from "react";
import { aosApi } from "../lib/api";
import {
  DollarSign, Users, TrendingUp, Target, Cpu, Building2,
  Download, BarChart3, CheckCircle2, Zap, AlertTriangle, Wallet
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, Legend, PieChart, Pie, LineChart, Line
} from "recharts";
import { useAosTheme } from "../AgentOSApp";

interface WorkforceData {
  kpis: {
    totalSpend: number;
    humanEquivSaved: number;
    netROI: number;
    tasksCompleted: number;
    costPerTask: number;
    successRate: number;
    activeAgents: number;
  };
  trend: { date: string; cost: number; tasks: number; successRate: number; costPerTask: number; tokens: number; roi: number; costEfficiency: number }[];
  providers: { provider: string; model: string; totalCost: number; tasks: number; costPerTask: number; successRate: number; avgLatency: number; tokens: number; share: number }[];
  departments: { department: string; departmentId: string | null; totalCost: number; tasks: number; agentCount: number; costPerTask: number; successRate: number; share: number }[];
  workforce: {
    aiAgents: number; aiMonthlyCost: number; humanHeadcount: number; humanMonthlySalary: number;
    humanEquivSalary: number; savings: number; efficiencyRatio: number;
    posDepartmentStats: { department: string; headcount: number; totalSalary: number }[];
    dataSource: "peopleos" | "agent-estimates";
  };
  budgets: { agentId: string; agentName: string; department: string; monthlyCap: number; spent: number; utilization: number; projected: number; projectedUtilization: number; tasks: number }[];
  departmentBudgets: { department: string; monthlyCap: number; spent: number; utilization: number; projected: number; projectedUtilization: number; tasks: number; agentCount: number }[];
  period: number;
}

const PERIOD_OPTIONS = [
  { label: "30 Days", value: 30 },
  { label: "90 Days", value: 90 },
  { label: "180 Days", value: 180 },
];

const GRANULARITY_OPTIONS = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#84cc16"];

const fmt = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
};
const fmtFull = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(0);
};

export default function WorkforceReport() {
  const [data, setData] = useState<WorkforceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);
  const [granularity, setGranularity] = useState("daily");
  const [exporting, setExporting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const reportRef = useRef<HTMLDivElement>(null);
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    setLoading(true);
    setError(null);
    aosApi.getWorkforceReport(period, granularity)
      .then(setData)
      .catch((e: Error) => { setError(e.message); setData(null); })
      .finally(() => setLoading(false));
  }, [period, granularity, refreshKey]);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const el = reportRef.current;
      if (!el) return;
      await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: `ai-workforce-report-${period}d.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      }).from(el).save();
    } catch {
      alert("PDF export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const panelCls = `border rounded-xl ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`;
  const titleCls = isDark ? "text-white" : "text-gray-900";
  const subtitleCls = isDark ? "text-slate-400" : "text-gray-500";
  const mutedCls = isDark ? "text-slate-500" : "text-gray-400";
  const borderCls = isDark ? "border-slate-700/50" : "border-gray-200";
  const rowBorderCls = isDark ? "border-slate-700/30" : "border-gray-100";
  const hoverCls = isDark ? "hover:bg-slate-700/20" : "hover:bg-gray-50";
  const thCls = `text-xs font-medium p-4 ${subtitleCls}`;
  const tooltipStyle = isDark
    ? { backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#fff" }
    : { backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", color: "#111827" };
  const tooltipLabelStyle = isDark ? { color: "#94a3b8" } : { color: "#6b7280" };
  const axisTick = isDark ? { fill: "#94a3b8", fontSize: 11 } : { fill: "#6b7280", fontSize: 11 };

  const pieData = useMemo(() => {
    if (!data) return [];
    return data.providers.map((p, i) => ({
      name: `${p.provider}/${p.model.split("-").slice(-2).join("-")}`,
      value: p.totalCost,
      fill: COLORS[i % COLORS.length],
    }));
  }, [data]);

  if (loading && !data) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full" /></div>;
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400 mb-2">{error}</p>
          <button onClick={() => setRefreshKey(k => k + 1)} className={`px-4 py-2 rounded-lg text-sm ${isDark ? "bg-slate-700 text-white hover:bg-slate-600" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`} data-testid="button-retry">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, trend, providers, departments, workforce, budgets, departmentBudgets } = data;

  return (
    <div className="space-y-6" data-testid="aos-workforce-report">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${titleCls}`} data-testid="text-workforce-title">AI Workforce Report</h1>
          <p className={`text-sm mt-1 ${subtitleCls}`}>Quantify your AI fleet's business impact and ROI</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-slate-700/50">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${period === opt.value
                  ? "bg-violet-600 text-white"
                  : isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-gray-100 text-gray-500 hover:text-gray-900"
                }`}
                data-testid={`button-period-${opt.value}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg overflow-hidden border border-slate-700/50">
            {GRANULARITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setGranularity(opt.value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${granularity === opt.value
                  ? "bg-violet-600 text-white"
                  : isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-gray-100 text-gray-500 hover:text-gray-900"
                }`}
                data-testid={`button-granularity-${opt.value}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 text-white rounded-lg text-sm font-medium transition-colors"
            data-testid="button-export-pdf"
          >
            <Download size={16} />
            {exporting ? "Exporting..." : "Download PDF"}
          </button>
        </div>
      </div>

      <div ref={reportRef}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <KPICard icon={<DollarSign size={18} />} label={`AI Spend (${period}d)`} value={fmtFull(kpis.totalSpend)} color="violet" isDark={isDark} testId="kpi-total-spend" />
          <KPICard icon={<Users size={18} />} label="Human Equiv Saved" value={fmtFull(kpis.humanEquivSaved)} color="blue" isDark={isDark} testId="kpi-human-equiv" />
          <KPICard icon={<TrendingUp size={18} />} label="Net ROI" value={`${kpis.netROI >= 0 ? "+" : ""}${kpis.netROI.toFixed(1)}%`} color={kpis.netROI >= 0 ? "emerald" : "red"} isDark={isDark} testId="kpi-net-roi" />
          <KPICard icon={<Target size={18} />} label="Tasks Completed" value={fmtShort(kpis.tasksCompleted)} color="orange" isDark={isDark} testId="kpi-tasks" />
          <KPICard icon={<Zap size={18} />} label="Cost / Task" value={`$${kpis.costPerTask.toFixed(4)}`} color="cyan" isDark={isDark} testId="kpi-cost-per-task" />
          <KPICard icon={<CheckCircle2 size={18} />} label="Success Rate" value={`${kpis.successRate.toFixed(1)}%`} color={kpis.successRate >= 90 ? "emerald" : "amber"} isDark={isDark} testId="kpi-success-rate" />
        </div>

        {trend.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className={`${panelCls} p-6`} data-testid="chart-spend-trend">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className={subtitleCls} />
                <h3 className={`text-sm font-medium ${titleCls}`}>Spend Trend</h3>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tickFormatter={(d: string) => new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })} tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tickFormatter={fmt} tick={axisTick} axisLine={false} tickLine={false} width={60} />
                    <Tooltip formatter={(v: number) => fmtFull(v)} labelFormatter={(d: string) => new Date(d).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                    <Area type="monotone" dataKey="cost" stroke="#8b5cf6" fill="url(#spendGrad)" strokeWidth={2} name="Spend" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`${panelCls} p-6`} data-testid="chart-tasks-trend">
              <div className="flex items-center gap-2 mb-4">
                <Target size={18} className={subtitleCls} />
                <h3 className={`text-sm font-medium ${titleCls}`}>Tasks Completed</h3>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                    <XAxis dataKey="date" tickFormatter={(d: string) => new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })} tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={50} />
                    <Tooltip formatter={(v: number, name: string) => [v, name === "tasks" ? "Tasks" : "Success Rate"]} labelFormatter={(d: string) => new Date(d).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                    <Bar dataKey="tasks" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={trend.length > 60 ? 4 : 12} name="Tasks" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {trend.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className={`${panelCls} p-6`} data-testid="chart-roi-trend">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className={subtitleCls} />
                <h3 className={`text-sm font-medium ${titleCls}`}>ROI Trend</h3>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                    <XAxis dataKey="date" tickFormatter={(d: string) => new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })} tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={axisTick} axisLine={false} tickLine={false} width={60} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, "ROI"]} labelFormatter={(d: string) => new Date(d).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                    <Line type="monotone" dataKey="roi" stroke="#10b981" strokeWidth={2} dot={false} name="ROI %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`${panelCls} p-6`} data-testid="chart-cost-efficiency-trend">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={18} className={subtitleCls} />
                <h3 className={`text-sm font-medium ${titleCls}`}>Cost Efficiency Trend</h3>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                    <XAxis dataKey="date" tickFormatter={(d: string) => new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })} tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tickFormatter={(v: number) => `$${v.toFixed(3)}`} tick={axisTick} axisLine={false} tickLine={false} width={60} />
                    <Tooltip formatter={(v: number) => [`$${v.toFixed(4)}`, "Cost/Task"]} labelFormatter={(d: string) => new Date(d).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                    <Line type="monotone" dataKey="costEfficiency" stroke="#f59e0b" strokeWidth={2} dot={false} name="Cost/Task" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className={`${panelCls} p-6`} data-testid="chart-provider-pie">
            <div className="flex items-center gap-2 mb-4">
              <Cpu size={18} className={subtitleCls} />
              <h3 className={`text-sm font-medium ${titleCls}`}>Spend by Provider</h3>
            </div>
            {providers.length === 0 ? (
              <p className={`text-sm h-48 flex items-center justify-center ${mutedCls}`}>No provider data</p>
            ) : (
              <div className="flex items-center">
                <div className="h-48 w-48 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtFull(v)} contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2 ml-4">
                  {providers.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className={`flex-1 truncate ${subtitleCls}`}>{p.provider}/{p.model.split("-").slice(-2).join("-")}</span>
                      <span className={`font-medium ${titleCls}`}>{p.share}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={`${panelCls} p-6`} data-testid="section-workforce">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className={subtitleCls} />
                <h3 className={`text-sm font-medium ${titleCls}`}>Workforce Comparison</h3>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${workforce.dataSource === "peopleos" ? (isDark ? "bg-emerald-900/40 text-emerald-300" : "bg-emerald-100 text-emerald-700") : (isDark ? "bg-slate-700 text-slate-400" : "bg-gray-100 text-gray-500")}`} data-testid="text-data-source">
                {workforce.dataSource === "peopleos" ? "PeopleOS Linked" : "Estimated"}
              </span>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className={`rounded-lg p-4 text-center border ${isDark ? "bg-blue-900/20 border-blue-700/30" : "bg-blue-50 border-blue-200"}`}>
                  <p className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-blue-300" : "text-blue-600"}`}>Human Workforce</p>
                  <p className={`text-xl font-bold ${titleCls}`} data-testid="text-human-cost">{fmtFull(workforce.humanMonthlySalary)}</p>
                  <p className={`text-xs ${mutedCls}`}>{workforce.humanHeadcount} employees</p>
                </div>
                <div className={`rounded-lg p-4 text-center border ${isDark ? "bg-violet-900/20 border-violet-700/30" : "bg-violet-50 border-violet-200"}`}>
                  <p className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-violet-300" : "text-violet-600"}`}>AI Fleet Cost</p>
                  <p className={`text-xl font-bold ${titleCls}`} data-testid="text-ai-cost">{fmtFull(workforce.aiMonthlyCost)}</p>
                  <p className={`text-xs ${mutedCls}`}>{workforce.aiAgents} agents</p>
                </div>
              </div>
              <div className={`rounded-lg p-4 text-center border ${isDark ? "bg-emerald-900/20 border-emerald-700/30" : "bg-emerald-50 border-emerald-200"}`}>
                <p className={`text-xs uppercase tracking-wide mb-1 ${isDark ? "text-emerald-300" : "text-emerald-600"}`}>Net Savings</p>
                <p className={`text-2xl font-bold ${workforce.savings >= 0 ? "text-emerald-400" : "text-red-400"}`} data-testid="text-net-savings">
                  {workforce.savings >= 0 ? "+" : ""}{fmtFull(workforce.savings)}
                  <span className={`text-sm font-normal ml-2 ${subtitleCls}`}>{workforce.efficiencyRatio}x multiplier</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {providers.length > 0 && (
          <div className={`${panelCls} overflow-hidden mb-6`} data-testid="table-providers">
            <div className={`p-4 border-b ${borderCls}`}>
              <h3 className={`text-sm font-medium ${titleCls} flex items-center gap-2`}>
                <Cpu size={16} className={subtitleCls} />
                Provider Breakdown
              </h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderCls}`}>
                  <th className={`text-left ${thCls}`}>Provider / Model</th>
                  <th className={`text-right ${thCls}`}>Total Cost</th>
                  <th className={`text-right ${thCls}`}>Tasks</th>
                  <th className={`text-right ${thCls}`}>Cost/Task</th>
                  <th className={`text-right ${thCls}`}>Success</th>
                  <th className={`text-right ${thCls}`}>Latency</th>
                  <th className={`text-right ${thCls}`}>Share</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p, i) => (
                  <tr key={i} className={`border-b ${rowBorderCls} ${hoverCls}`} data-testid={`row-provider-${i}`}>
                    <td className={`p-4 text-sm font-medium ${titleCls}`}>
                      <span>{p.provider}</span>
                      <span className={`ml-2 text-xs ${mutedCls}`}>{p.model}</span>
                    </td>
                    <td className={`p-4 text-sm ${titleCls} text-right font-mono`}>{fmtFull(p.totalCost)}</td>
                    <td className={`p-4 text-sm ${subtitleCls} text-right`}>{p.tasks.toLocaleString()}</td>
                    <td className="p-4 text-sm text-emerald-400 text-right font-mono">${p.costPerTask.toFixed(4)}</td>
                    <td className="p-4 text-right">
                      <span className={`text-sm ${p.successRate >= 90 ? "text-emerald-400" : p.successRate >= 70 ? "text-amber-400" : "text-red-400"}`}>{p.successRate}%</span>
                    </td>
                    <td className={`p-4 text-sm ${subtitleCls} text-right`}>{p.avgLatency}ms</td>
                    <td className={`p-4 text-sm ${titleCls} text-right`}>{p.share}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {departments.length > 0 && (
          <div className={`${panelCls} overflow-hidden mb-6`} data-testid="table-departments">
            <div className={`p-4 border-b ${borderCls}`}>
              <h3 className={`text-sm font-medium ${titleCls} flex items-center gap-2`}>
                <Building2 size={16} className={subtitleCls} />
                Department Breakdown
              </h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderCls}`}>
                  <th className={`text-left ${thCls}`}>Department</th>
                  <th className={`text-right ${thCls}`}>Agents</th>
                  <th className={`text-right ${thCls}`}>Total Cost</th>
                  <th className={`text-right ${thCls}`}>Tasks</th>
                  <th className={`text-right ${thCls}`}>Cost/Task</th>
                  <th className={`text-right ${thCls}`}>Success</th>
                  <th className={`text-right ${thCls}`}>Share</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d, i) => (
                  <tr key={i} className={`border-b ${rowBorderCls} ${hoverCls}`} data-testid={`row-dept-${i}`}>
                    <td className={`p-4 text-sm font-medium ${titleCls}`}>{d.department}</td>
                    <td className={`p-4 text-sm ${subtitleCls} text-right`}>{d.agentCount}</td>
                    <td className={`p-4 text-sm ${titleCls} text-right font-mono`}>{fmtFull(d.totalCost)}</td>
                    <td className={`p-4 text-sm ${subtitleCls} text-right`}>{d.tasks.toLocaleString()}</td>
                    <td className="p-4 text-sm text-emerald-400 text-right font-mono">${d.costPerTask.toFixed(4)}</td>
                    <td className="p-4 text-right">
                      <span className={`text-sm ${d.successRate >= 90 ? "text-emerald-400" : d.successRate >= 70 ? "text-amber-400" : "text-red-400"}`}>{d.successRate}%</span>
                    </td>
                    <td className={`p-4 text-sm ${titleCls} text-right`}>{d.share}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {departmentBudgets && departmentBudgets.length > 0 && (
          <div className={`${panelCls} overflow-hidden mb-6`} data-testid="table-dept-budgets">
            <div className={`p-4 border-b ${borderCls}`}>
              <h3 className={`text-sm font-medium ${titleCls} flex items-center gap-2`}>
                <Building2 size={16} className={subtitleCls} />
                Department Budget Utilization (Current Month)
              </h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderCls}`}>
                  <th className={`text-left ${thCls}`}>Department</th>
                  <th className={`text-right ${thCls}`}>Agents</th>
                  <th className={`text-right ${thCls}`}>Budget</th>
                  <th className={`text-right ${thCls}`}>Spent</th>
                  <th className={`text-right ${thCls}`}>Used</th>
                  <th className={`text-right ${thCls}`}>Projected</th>
                  <th className={`text-right ${thCls}`}>EOM %</th>
                </tr>
              </thead>
              <tbody>
                {departmentBudgets.map((db, i) => (
                  <tr key={i} className={`border-b ${rowBorderCls} ${hoverCls}`} data-testid={`row-dept-budget-${i}`}>
                    <td className={`p-4 text-sm font-medium ${titleCls}`}>{db.department}</td>
                    <td className={`p-4 text-sm ${subtitleCls} text-right`}>{db.agentCount}</td>
                    <td className={`p-4 text-sm ${titleCls} text-right font-mono`}>{fmtFull(db.monthlyCap)}</td>
                    <td className={`p-4 text-sm ${titleCls} text-right font-mono`}>{fmtFull(db.spent)}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className={`w-16 h-2 rounded-full overflow-hidden ${isDark ? "bg-slate-700" : "bg-gray-200"}`}>
                          <div
                            className={`h-full rounded-full ${db.utilization >= 90 ? "bg-red-500" : db.utilization >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(db.utilization, 100)}%` }}
                          />
                        </div>
                        <span className={`text-sm ${db.utilization >= 90 ? "text-red-400" : db.utilization >= 70 ? "text-amber-400" : "text-emerald-400"}`}>{db.utilization}%</span>
                      </div>
                    </td>
                    <td className={`p-4 text-sm ${titleCls} text-right font-mono`}>{fmtFull(db.projected)}</td>
                    <td className="p-4 text-right">
                      <span className={`text-sm font-medium ${db.projectedUtilization >= 100 ? "text-red-400" : db.projectedUtilization >= 80 ? "text-amber-400" : "text-emerald-400"}`}>
                        {db.projectedUtilization}%
                        {db.projectedUtilization >= 100 && <AlertTriangle size={12} className="inline ml-1" />}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {budgets.length > 0 && (
          <div className={`${panelCls} overflow-hidden`} data-testid="table-budgets">
            <div className={`p-4 border-b ${borderCls}`}>
              <h3 className={`text-sm font-medium ${titleCls} flex items-center gap-2`}>
                <Wallet size={16} className={subtitleCls} />
                Agent Budget Utilization (Current Month)
              </h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderCls}`}>
                  <th className={`text-left ${thCls}`}>Agent</th>
                  <th className={`text-left ${thCls}`}>Department</th>
                  <th className={`text-right ${thCls}`}>Budget</th>
                  <th className={`text-right ${thCls}`}>Spent</th>
                  <th className={`text-right ${thCls}`}>Used</th>
                  <th className={`text-right ${thCls}`}>Projected</th>
                  <th className={`text-right ${thCls}`}>EOM %</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((b, i) => (
                  <tr key={b.agentId} className={`border-b ${rowBorderCls} ${hoverCls}`} data-testid={`row-budget-${i}`}>
                    <td className={`p-4 text-sm font-medium ${titleCls}`}>{b.agentName}</td>
                    <td className={`p-4 text-sm ${subtitleCls}`}>{b.department}</td>
                    <td className={`p-4 text-sm ${titleCls} text-right font-mono`}>{fmtFull(b.monthlyCap)}</td>
                    <td className={`p-4 text-sm ${titleCls} text-right font-mono`}>{fmtFull(b.spent)}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className={`w-16 h-2 rounded-full overflow-hidden ${isDark ? "bg-slate-700" : "bg-gray-200"}`}>
                          <div
                            className={`h-full rounded-full ${b.utilization >= 90 ? "bg-red-500" : b.utilization >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(b.utilization, 100)}%` }}
                          />
                        </div>
                        <span className={`text-sm ${b.utilization >= 90 ? "text-red-400" : b.utilization >= 70 ? "text-amber-400" : "text-emerald-400"}`}>{b.utilization}%</span>
                      </div>
                    </td>
                    <td className={`p-4 text-sm ${titleCls} text-right font-mono`}>{fmtFull(b.projected)}</td>
                    <td className="p-4 text-right">
                      <span className={`text-sm font-medium ${b.projectedUtilization >= 100 ? "text-red-400" : b.projectedUtilization >= 80 ? "text-amber-400" : "text-emerald-400"}`}>
                        {b.projectedUtilization}%
                        {b.projectedUtilization >= 100 && <AlertTriangle size={12} className="inline ml-1" />}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KPICard({ icon, label, value, color, isDark, testId, subtitle }: {
  icon: React.ReactNode; label: string; value: string; color: string; isDark: boolean; testId: string; subtitle?: string;
}) {
  const colorMap: Record<string, string> = {
    violet: "text-violet-400",
    blue: "text-blue-400",
    emerald: "text-emerald-400",
    red: "text-red-400",
    orange: "text-orange-400",
    cyan: "text-cyan-400",
    amber: "text-amber-400",
  };
  return (
    <div className={`border rounded-xl p-4 ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`} data-testid={testId}>
      <div className={`flex items-center gap-1.5 mb-2 ${colorMap[color] || "text-violet-400"}`}>
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{value}</p>
      {subtitle && <p className={`text-[10px] mt-0.5 ${isDark ? "text-slate-500" : "text-gray-400"}`}>{subtitle}</p>}
    </div>
  );
}
