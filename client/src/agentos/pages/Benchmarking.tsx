import { useState, useEffect } from "react";
import { aosGet } from "../lib/api";
import { BarChart3, TrendingUp, Cpu, DollarSign, Clock, Target, AlertTriangle } from "lucide-react";
import { useAosTheme } from "../AgentOSApp";

export default function Benchmarking() {
  const [benchData, setBenchData] = useState<any>(null);
  const [forecastData, setForecastData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [benchError, setBenchError] = useState<string | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"provider" | "role" | "forecast">("provider");
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    Promise.allSettled([
      aosGet("/analytics/benchmarking"),
      aosGet("/analytics/forecast?days=90"),
    ]).then(([benchResult, forecastResult]) => {
      if (benchResult.status === "fulfilled") setBenchData(benchResult.value);
      else setBenchError(benchResult.reason?.message || "Failed to load benchmarking data");
      if (forecastResult.status === "fulfilled") setForecastData(forecastResult.value);
      else setForecastError(forecastResult.reason?.message || "Failed to load forecast data");
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full" /></div>;
  }

  const { providerSummary = [], byRole = {} } = benchData || {};
  const { trend = [], forecast = [], summary } = forecastData || {};

  const panelCls = `border rounded-xl ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`;
  const titleCls = isDark ? "text-white" : "text-gray-900";
  const subtitleCls = isDark ? "text-slate-400" : "text-gray-500";
  const mutedCls = isDark ? "text-slate-500" : "text-gray-400";
  const borderCls = isDark ? "border-slate-700/50" : "border-gray-200";
  const rowBorderCls = isDark ? "border-slate-700/30" : "border-gray-100";
  const hoverCls = isDark ? "hover:bg-slate-700/20" : "hover:bg-gray-50";
  const thCls = `text-xs font-medium p-4 ${subtitleCls}`;
  const tabInactiveCls = isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-gray-100 text-gray-500 hover:text-gray-900";
  const barBgCls = isDark ? "bg-slate-700/50" : "bg-gray-200";

  return (
    <div className="space-y-6" data-testid="aos-benchmarking">
      <div>
        <h1 className={`text-2xl font-bold ${titleCls}`} data-testid="text-benchmarking-title">Benchmarking & Forecasting</h1>
        <p className={`text-sm mt-1 ${subtitleCls}`}>Cross-provider comparison and cost forecasting</p>
      </div>

      <div className="flex gap-2">
        {(["provider", "role", "forecast"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? "bg-emerald-600 text-white" : tabInactiveCls}`}
            data-testid={`tab-${tab}`}>
            {tab === "provider" && <Cpu className="inline w-4 h-4 mr-1" />}
            {tab === "role" && <Target className="inline w-4 h-4 mr-1" />}
            {tab === "forecast" && <TrendingUp className="inline w-4 h-4 mr-1" />}
            {tab === "provider" ? "Provider Comparison" : tab === "role" ? "By Role" : "Cost Forecast"}
          </button>
        ))}
      </div>

      {activeTab === "provider" && benchError && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 flex items-center gap-3" data-testid="error-benchmarking">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-300 text-sm">{benchError}</p>
        </div>
      )}

      {activeTab === "provider" && !benchError && (
        <div className={`${panelCls} overflow-hidden`}>
          <table className="w-full" data-testid="table-provider-benchmark">
            <thead>
              <tr className={`border-b ${borderCls}`}>
                <th className={`text-left ${thCls}`}>Provider</th>
                <th className={`text-left ${thCls}`}>Model</th>
                <th className={`text-right ${thCls}`}>Total Cost</th>
                <th className={`text-right ${thCls}`}>Tokens</th>
                <th className={`text-right ${thCls}`}>Cost/1K Tokens</th>
                <th className={`text-right ${thCls}`}>Avg Latency</th>
                <th className={`text-right ${thCls}`}>Success Rate</th>
                <th className={`text-right ${thCls}`}>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {providerSummary.length === 0 ? (
                <tr><td colSpan={8} className={`p-8 text-center ${mutedCls}`}>No provider data available</td></tr>
              ) : providerSummary.map((p: any, i: number) => {
                const totalCost = parseFloat(p.totalCost || "0");
                const costPer1k = p.totalTokens > 0 ? (totalCost / p.totalTokens) * 1000 : 0;
                const sr = p.eventCount > 0 ? ((p.successCount || 0) / p.eventCount) * 100 : 0;
                return (
                  <tr key={i} className={`border-b ${rowBorderCls} ${hoverCls}`} data-testid={`row-provider-${i}`}>
                    <td className={`p-4 text-sm font-medium ${titleCls}`}>{p.provider}</td>
                    <td className={`p-4 text-sm ${subtitleCls}`}>{p.model}</td>
                    <td className={`p-4 text-sm ${titleCls} text-right`}>${totalCost.toFixed(2)}</td>
                    <td className={`p-4 text-sm ${subtitleCls} text-right`}>{(p.totalTokens || 0).toLocaleString()}</td>
                    <td className="p-4 text-sm text-emerald-400 text-right">${costPer1k.toFixed(4)}</td>
                    <td className={`p-4 text-sm ${subtitleCls} text-right`}>{Math.round(p.avgLatency || 0)}ms</td>
                    <td className="p-4 text-right">
                      <span className={`text-sm ${sr >= 90 ? "text-emerald-400" : sr >= 70 ? "text-amber-400" : "text-red-400"}`}>{sr.toFixed(1)}%</span>
                    </td>
                    <td className={`p-4 text-sm ${subtitleCls} text-right`}>{(p.avgAccuracy || 0).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "role" && benchError && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 flex items-center gap-3" data-testid="error-role-benchmarking">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-300 text-sm">{benchError}</p>
        </div>
      )}

      {activeTab === "role" && !benchError && (
        <div className="space-y-4">
          {Object.keys(byRole).length === 0 ? (
            <div className={`${panelCls} p-8 text-center ${mutedCls}`}>
              No role-based data available. Assign roles to your agents to see comparisons.
            </div>
          ) : Object.entries(byRole).map(([role, entries]: [string, any]) => (
            <div key={role} className={`${panelCls} overflow-hidden`} data-testid={`role-section-${role}`}>
              <div className={`p-4 border-b ${borderCls}`}>
                <h3 className={`font-medium ${titleCls}`}>{role}</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${rowBorderCls}`}>
                    <th className={`text-left text-xs font-medium p-3 ${subtitleCls}`}>Agent</th>
                    <th className={`text-left text-xs font-medium p-3 ${subtitleCls}`}>Provider/Model</th>
                    <th className={`text-right text-xs font-medium p-3 ${subtitleCls}`}>Cost</th>
                    <th className={`text-right text-xs font-medium p-3 ${subtitleCls}`}>Latency</th>
                    <th className={`text-right text-xs font-medium p-3 ${subtitleCls}`}>Success</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e: any, i: number) => (
                    <tr key={i} className={`border-b ${isDark ? "border-slate-700/20" : "border-gray-100"}`}>
                      <td className={`p-3 text-sm ${titleCls}`}>{e.agentName}</td>
                      <td className={`p-3 text-sm ${subtitleCls}`}>{e.provider}/{e.model}</td>
                      <td className={`p-3 text-sm ${titleCls} text-right`}>${e.totalCost.toFixed(2)}</td>
                      <td className={`p-3 text-sm ${subtitleCls} text-right`}>{Math.round(e.avgLatency || 0)}ms</td>
                      <td className="p-3 text-sm text-right">
                        <span className={e.successRate >= 90 ? "text-emerald-400" : "text-amber-400"}>{e.successRate.toFixed(1)}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {activeTab === "forecast" && forecastError && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 flex items-center gap-3" data-testid="error-forecast">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-300 text-sm">{forecastError}</p>
        </div>
      )}

      {activeTab === "forecast" && !forecastError && (
        <div className="space-y-6">
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className={`${panelCls} p-4`}>
                <p className={`text-xs ${subtitleCls} mb-1`}>Avg Daily Cost</p>
                <p className={`text-xl font-bold ${titleCls}`} data-testid="text-avg-daily-cost">${summary.avgDailyCost}</p>
              </div>
              <div className={`${panelCls} p-4`}>
                <p className={`text-xs ${subtitleCls} mb-1`}>Avg Daily Tokens</p>
                <p className={`text-xl font-bold ${titleCls}`}>{summary.avgDailyTokens?.toLocaleString()}</p>
              </div>
              <div className={`${panelCls} p-4`}>
                <p className={`text-xs ${subtitleCls} mb-1`}>30-Day Forecast</p>
                <p className={`text-xl font-bold ${titleCls}`} data-testid="text-monthly-forecast">${summary.monthlyForecast}</p>
              </div>
              <div className={`${panelCls} p-4`}>
                <p className={`text-xs ${subtitleCls} mb-1`}>Trend Direction</p>
                <p className={`text-xl font-bold ${summary.trendDirection === "increasing" ? "text-red-400" : summary.trendDirection === "decreasing" ? "text-emerald-400" : subtitleCls}`}>
                  {summary.trendDirection === "increasing" ? "↑ Rising" : summary.trendDirection === "decreasing" ? "↓ Falling" : "→ Stable"}
                </p>
              </div>
            </div>
          )}

          <div className={`${panelCls} p-5`}>
            <h3 className={`font-medium mb-4 ${titleCls}`}>Cost Trend & Forecast</h3>
            {trend.length === 0 && forecast.length === 0 ? (
              <p className={`text-sm ${mutedCls}`}>Not enough data for forecasting. Need at least 7 days of telemetry.</p>
            ) : (
              <div className="space-y-1">
                {trend.slice(-14).map((d: any, i: number) => {
                  const cost = parseFloat(d.totalCost || "0");
                  const maxCost = Math.max(...trend.map((t: any) => parseFloat(t.totalCost || "0")), ...forecast.map((f: any) => f.predictedCost), 1);
                  return (
                    <div key={`t-${i}`} className="flex items-center gap-2 text-xs">
                      <span className={`w-20 shrink-0 ${mutedCls}`}>{new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      <div className={`flex-1 rounded h-4 overflow-hidden ${barBgCls}`}>
                        <div className="h-full bg-emerald-500/60 rounded" style={{ width: `${(cost / maxCost) * 100}%` }} />
                      </div>
                      <span className={`w-16 text-right ${subtitleCls}`}>${cost.toFixed(2)}</span>
                    </div>
                  );
                })}
                {forecast.slice(0, 7).map((f: any, i: number) => {
                  const maxCost = Math.max(...trend.map((t: any) => parseFloat(t.totalCost || "0")), ...forecast.map((ff: any) => ff.predictedCost), 1);
                  return (
                    <div key={`f-${i}`} className="flex items-center gap-2 text-xs">
                      <span className="text-blue-400 w-20 shrink-0">{new Date(f.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      <div className={`flex-1 rounded h-4 overflow-hidden ${barBgCls}`}>
                        <div className="h-full bg-blue-500/40 rounded border border-blue-500/60 border-dashed" style={{ width: `${(f.predictedCost / maxCost) * 100}%` }} />
                      </div>
                      <span className="text-blue-400 w-16 text-right">${f.predictedCost.toFixed(2)}</span>
                    </div>
                  );
                })}
                <div className={`flex items-center gap-4 mt-2 text-xs ${mutedCls}`}>
                  <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500/60 rounded" /> Actual</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-500/40 rounded border border-blue-500/60" /> Forecast</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
