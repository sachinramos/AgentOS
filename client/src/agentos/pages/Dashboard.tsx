import { useState, useEffect } from "react";
import { aosApi } from "../lib/api";
import { useAosTheme } from "../AgentOSApp";

const STATUS_COLORS: Record<string, string> = {
  onboarding: "bg-amber-500",
  active: "bg-emerald-500",
  probation: "bg-orange-500",
  suspended: "bg-red-500",
  retired: "bg-slate-500",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  warning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const ALERT_ICONS: Record<string, string> = {
  drift: "⚠",
  shadow: "👻",
  budget: "💰",
  policy_violation: "🛡",
};

interface CommandCenterStats {
  totalAgents: number;
  monthlySpend: number;
  fteEquivalent: number;
  activeAlerts: number;
  byStatus: { status: string; count: number }[];
  byProvider: { provider: string; count: number }[];
  costTrend: { date: string; cost: number }[];
  topAgentsByCost: { agentId: string; name: string; provider: string; model: string; totalCost: number }[];
  recentAlerts: { id: string; type: string; severity: string; message: string; agentName: string; createdAt: string }[];
}

export default function Dashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [stats, setStats] = useState<CommandCenterStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  const loadStats = () => {
    setLoading(true);
    aosApi.getCommandCenterStats()
      .then((data: CommandCenterStats) => {
        setStats(data);
        setIsEmpty(data.totalAgents === 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStats(); }, []);

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      await aosApi.seedDemoData();
      loadStats();
    } catch (e: any) {
      console.error(e);
    } finally {
      setSeeding(false);
    }
  };

  const handleClearDemo = async () => {
    if (!confirm("Are you sure you want to remove all demo data? This action cannot be undone.")) return;
    setClearing(true);
    try {
      await aosApi.clearDemoData();
      loadStats();
    } catch (e: any) {
      console.error(e);
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-6" data-testid="dashboard-empty">
        <div className="w-20 h-20 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <RocketIcon />
        </div>
        <div className="text-center">
          <h2 className={`text-2xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`} data-testid="text-empty-title">Welcome to AgentOS</h2>
          <p className={`max-w-md ${isDark ? "text-slate-400" : "text-gray-500"}`}>Your fleet is empty. Load demo data to explore the full platform with realistic agents, telemetry, and alerts.</p>
        </div>
        <button
          onClick={handleSeedDemo}
          disabled={seeding}
          className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
          data-testid="button-seed-demo"
        >
          {seeding ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Seeding data...
            </>
          ) : (
            <>
              <SparklesIcon />
              Load Demo Data
            </>
          )}
        </button>
      </div>
    );
  }

  const maxCost = Math.max(...(stats?.costTrend?.map(c => c.cost) || [1]));

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`} data-testid="text-dashboard-title">Command Center</h1>
          <p className={`mt-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>AI fleet operations at a glance</p>
        </div>
        <button
          onClick={handleClearDemo}
          disabled={clearing}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
            isDark
              ? "bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-300 border border-slate-700 hover:border-red-500/40"
              : "bg-white hover:bg-red-50 text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300"
          } disabled:opacity-50`}
          data-testid="button-clear-demo"
        >
          {clearing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              Clearing...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Clear Demo Data
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Agents" value={String(stats?.totalAgents || 0)} icon={<BotIcon />} color="violet" testId="stat-total-agents" isDark={isDark} />
        <StatCard label="Monthly Spend" value={`$${(stats?.monthlySpend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={<DollarIcon />} color="emerald" testId="stat-monthly-spend" isDark={isDark} />
        <StatCard label="FTE Equivalent" value={`${stats?.fteEquivalent || 0}x`} subtitle="salary-to-cost ratio" icon={<UsersIcon />} color="blue" testId="stat-fte-equivalent" isDark={isDark} />
        <StatCard label="Active Alerts" value={String(stats?.activeAlerts || 0)} icon={<AlertIcon />} color={stats?.activeAlerts && stats.activeAlerts > 0 ? "red" : "emerald"} testId="stat-active-alerts" isDark={isDark} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-2 rounded-xl p-5 border ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`}>
          <h2 className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`} data-testid="text-cost-trend">30-Day Cost Trend</h2>
          {stats?.costTrend && stats.costTrend.length > 0 ? (
            <div className="h-40" data-testid="chart-cost-trend">
              <CostTrendChart data={stats.costTrend} maxCost={maxCost} isDark={isDark} />
            </div>
          ) : (
            <p className={`text-sm h-40 flex items-center justify-center ${isDark ? "text-slate-500" : "text-gray-400"}`}>No cost data available</p>
          )}
        </div>

        <div className={`rounded-xl p-5 border ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`}>
          <h2 className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`} data-testid="text-fleet-status">Fleet Status</h2>
          <div className="space-y-3">
            {stats?.byStatus?.map(s => {
              const total = stats.totalAgents || 1;
              const pct = Math.round((s.count / total) * 100);
              return (
                <div key={s.status} data-testid={`status-row-${s.status}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm capitalize ${isDark ? "text-slate-300" : "text-gray-600"}`}>{s.status}</span>
                    <span className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{s.count} ({pct}%)</span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-slate-700" : "bg-gray-200"}`}>
                    <div
                      className={`h-full rounded-full transition-all ${STATUS_COLORS[s.status] || "bg-slate-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className={`mt-4 pt-3 border-t ${isDark ? "border-slate-700/50" : "border-gray-200"}`}>
            <div className="flex flex-wrap gap-2">
              {stats?.byProvider?.map(p => (
                <span key={p.provider} className={`text-xs px-2 py-1 rounded-full ${isDark ? "bg-slate-700/50 text-slate-300" : "bg-gray-100 text-gray-600"}`} data-testid={`provider-badge-${p.provider}`}>
                  {p.provider}: {p.count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`rounded-xl p-5 border ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`} data-testid="text-top-agents">Top 5 Agents by Cost</h2>
            {onNavigate && (
              <button onClick={() => onNavigate("agents")} className="text-violet-400 hover:text-violet-300 text-sm" data-testid="link-view-all-agents">
                View all
              </button>
            )}
          </div>
          <div className="space-y-3">
            {stats?.topAgentsByCost?.map((agent, idx) => {
              const barWidth = stats.topAgentsByCost.length > 0
                ? (agent.totalCost / stats.topAgentsByCost[0].totalCost) * 100
                : 0;
              return (
                <div key={agent.agentId} className="group" data-testid={`top-agent-${idx}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs w-5 ${isDark ? "text-slate-500" : "text-gray-400"}`}>#{idx + 1}</span>
                      <span className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{agent.name}</span>
                    </div>
                    <span className="text-sm text-emerald-400 font-mono">${agent.totalCost.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-slate-700" : "bg-gray-200"}`}>
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${barWidth}%` }} />
                    </div>
                    <span className={`text-[10px] w-24 text-right ${isDark ? "text-slate-500" : "text-gray-400"}`}>{agent.provider}/{agent.model.split("-").slice(-1)}</span>
                  </div>
                </div>
              );
            })}
            {(!stats?.topAgentsByCost || stats.topAgentsByCost.length === 0) && (
              <p className={`text-sm ${isDark ? "text-slate-500" : "text-gray-400"}`}>No cost data available</p>
            )}
          </div>
        </div>

        <div className={`rounded-xl p-5 border ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`} data-testid="text-recent-alerts">Recent Alerts</h2>
            {onNavigate && (
              <button onClick={() => onNavigate("compliance")} className="text-violet-400 hover:text-violet-300 text-sm" data-testid="link-view-compliance">
                View all
              </button>
            )}
          </div>
          <div className="space-y-2">
            {stats?.recentAlerts?.map(alert => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info}`}
                data-testid={`alert-row-${alert.id}`}
              >
                <span className="text-lg leading-none mt-0.5">{ALERT_ICONS[alert.type] || "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{alert.message}</p>
                  <p className="text-xs opacity-70 mt-0.5">
                    {alert.agentName && alert.type !== "shadow" ? `${alert.agentName} · ` : ""}
                    {timeAgo(alert.createdAt)}
                  </p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-medium ${alert.severity === "critical" ? "bg-red-500/30 text-red-300" : "bg-amber-500/30 text-amber-300"}`}>
                  {alert.severity}
                </span>
              </div>
            ))}
            {(!stats?.recentAlerts || stats.recentAlerts.length === 0) && (
              <p className={`text-sm ${isDark ? "text-slate-500" : "text-gray-400"}`}>No active alerts</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Agents", page: "agents", icon: "🤖" },
          { label: "Org Chart", page: "org-chart", icon: "🏢" },
          { label: "Scorecard", page: "scorecard", icon: "📊" },
          { label: "Compliance", page: "compliance", icon: "🛡" },
          { label: "Blast Shield", page: "blast-shield", icon: "🔒" },
          { label: "Shadow AI", page: "shadow-ai", icon: "👻" },
        ].map(item => (
          <button
            key={item.page}
            onClick={() => onNavigate?.(item.page)}
            className={`rounded-xl p-4 text-center transition-all group border ${isDark ? "bg-slate-800/50 hover:bg-slate-700/50 border-slate-700/50 hover:border-violet-500/30" : "bg-white hover:bg-gray-50 border-gray-200 hover:border-violet-400/40"}`}
            data-testid={`quicknav-${item.page}`}
          >
            <span className="text-2xl block mb-2">{item.icon}</span>
            <span className={`text-sm transition-colors ${isDark ? "text-slate-300 group-hover:text-white" : "text-gray-600 group-hover:text-gray-900"}`}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CostTrendChart({ data, maxCost, isDark }: { data: { date: string; cost: number }[]; maxCost: number; isDark: boolean }) {
  if (data.length === 0) return null;
  const w = 600;
  const h = 140;
  const pad = { top: 10, right: 10, bottom: 20, left: 50 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const points = data.map((d, i) => ({
    x: pad.left + (i / Math.max(data.length - 1, 1)) * plotW,
    y: pad.top + plotH - (d.cost / (maxCost || 1)) * plotH,
    cost: d.cost,
    date: d.date,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${pad.top + plotH} L ${points[0].x} ${pad.top + plotH} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    y: pad.top + plotH * (1 - pct),
    label: `$${(maxCost * pct).toFixed(0)}`,
  }));

  const gridColor = isDark ? "#334155" : "#e5e7eb";
  const textColor = isDark ? "#64748b" : "#9ca3af";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={pad.left} y1={g.y} x2={w - pad.right} y2={g.y} stroke={gridColor} strokeWidth="0.5" />
          <text x={pad.left - 5} y={g.y + 3} textAnchor="end" fill={textColor} fontSize="8">{g.label}</text>
        </g>
      ))}
      <path d={areaPath} fill="url(#costGrad)" />
      <path d={linePath} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round" />
      {points.filter((_, i) => i % Math.max(Math.floor(data.length / 6), 1) === 0 || i === data.length - 1).map((p, i) => (
        <text key={i} x={p.x} y={h - 4} textAnchor="middle" fill={textColor} fontSize="7">
          {new Date(p.date).toLocaleDateString("en", { month: "short", day: "numeric" })}
        </text>
      ))}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2" fill="#8b5cf6" opacity="0.6" />
      ))}
    </svg>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatCard({ label, value, subtitle, icon, color, testId, isDark }: { label: string; value: string; subtitle?: string; icon: React.ReactNode; color: string; testId: string; isDark: boolean }) {
  const colorMap: Record<string, string> = {
    violet: "bg-violet-500/10 border-violet-500/20 text-violet-400",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    red: "bg-red-500/10 border-red-500/20 text-red-400",
  };
  return (
    <div className={`rounded-xl p-5 border ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`} data-testid={testId}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>{label}</span>
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
      <p className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{value}</p>
      {subtitle && <p className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-gray-400"}`}>{subtitle}</p>}
    </div>
  );
}

function BotIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="10" x="3" y="11" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>;
}
function DollarIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}
function UsersIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function AlertIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}
function RocketIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>;
}
function SparklesIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>;
}
