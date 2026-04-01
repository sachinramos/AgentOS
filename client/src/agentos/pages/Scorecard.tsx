import { useState, useEffect } from "react";
import { aosGet, aosPost } from "../lib/api";
import { Award, Star, CheckCircle, Clock, Target, Zap, TrendingUp, Shield, DollarSign, AlertCircle } from "lucide-react";
import { useAosTheme } from "../AgentOSApp";

function mapPerfData(perfData: any) {
  return {
    metrics: {
      totalTasks: perfData.metrics?.totalTasks || 0,
      successCount: perfData.metrics?.totalTasks > 0
        ? Math.round((perfData.metrics.successRate / 100) * perfData.metrics.totalTasks)
        : 0,
      avgLatency: perfData.metrics?.avgLatencyMs || 0,
      avgAccuracy: perfData.metrics?.avgAccuracy || 0,
      avgHumanRating: perfData.humanRating || 0,
      totalCost: perfData.metrics?.totalCost || 0,
    },
    ratings: perfData.recentRatings || [],
  };
}

export default function Scorecard() {
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [certResult, setCertResult] = useState<any>(null);
  const [ratings, setRatings] = useState<any[]>([]);
  const [newRating, setNewRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [perfError, setPerfError] = useState(false);
  const [certError, setCertError] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    aosGet("/agents").then(setAgents).catch(() => []).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedAgent) return;
    setMetrics(null);
    setCertResult(null);
    setRatings([]);
    setPerfError(false);
    setCertError(false);
    setRateError(null);
    setLoadingAgent(true);
    Promise.all([
      aosGet(`/agents/${selectedAgent}/performance`).catch(() => null),
      aosPost(`/agents/${selectedAgent}/evaluate-certification`, {}).catch(() => ({ _error: true })),
    ]).then(([perfData, c]) => {
      if (perfData) {
        const mapped = mapPerfData(perfData);
        setMetrics(mapped.metrics);
        setRatings(mapped.ratings);
      } else {
        setMetrics(null);
        setRatings([]);
        setPerfError(true);
      }
      if (c && !(c as any)._error) {
        setCertResult(c);
      } else {
        setCertResult(null);
        setCertError(true);
      }
      setLoadingAgent(false);
    });
  }, [selectedAgent]);

  const handleRate = async () => {
    if (!selectedAgent) return;
    setRateError(null);
    try {
      await aosPost(`/agents/${selectedAgent}/rate`, { rating: newRating, comment: ratingComment });
      setRatingComment("");
      const perfData = await aosGet(`/agents/${selectedAgent}/performance`).catch(() => null);
      if (perfData) {
        const mapped = mapPerfData(perfData);
        setMetrics(mapped.metrics);
        setRatings(mapped.ratings);
      }
    } catch {
      setRateError("Failed to submit rating. Please try again.");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full" /></div>;
  }

  const panelCls = `border rounded-xl ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`;
  const titleCls = isDark ? "text-white" : "text-gray-900";
  const subtitleCls = isDark ? "text-slate-400" : "text-gray-500";
  const mutedCls = isDark ? "text-slate-500" : "text-gray-400";
  const tabInactiveCls = isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-gray-100 text-gray-500 hover:text-gray-900";

  const successRate = metrics && metrics.totalTasks > 0 ? ((metrics.successCount || 0) / metrics.totalTasks * 100) : 0;

  return (
    <div className="space-y-6" data-testid="aos-scorecard">
      <div>
        <h1 className={`text-2xl font-bold ${titleCls}`} data-testid="text-scorecard-title">Performance Scorecards</h1>
        <p className={`text-sm mt-1 ${subtitleCls}`}>Per-agent metrics, ratings, and certification status</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {agents.map((agent: any) => (
          <button key={agent.id} onClick={() => setSelectedAgent(agent.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              selectedAgent === agent.id ? "bg-emerald-600 text-white" : tabInactiveCls
            }`}
            data-testid={`button-select-agent-${agent.id}`}>
            {agent.status === "certified" && <CheckCircle size={14} className="text-emerald-300" />}
            {agent.name}
          </button>
        ))}
        {agents.length === 0 && <p className={`text-sm ${mutedCls}`}>No agents registered yet.</p>}
      </div>

      {selectedAgent && loadingAgent && (
        <div className="flex items-center justify-center h-32"><div className="animate-spin w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full" /></div>
      )}

      {selectedAgent && !loadingAgent && perfError && !metrics && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 flex items-center gap-3" data-testid="scorecard-error">
          <AlertCircle size={20} className="text-red-400 shrink-0" />
          <div>
            <p className={`font-medium ${titleCls}`}>Unable to load performance data</p>
            <p className={`text-sm mt-1 ${subtitleCls}`}>There was a problem fetching metrics for this agent. Please try selecting the agent again.</p>
          </div>
        </div>
      )}

      {selectedAgent && !loadingAgent && !perfError && !metrics && (
        <div className={`${panelCls} p-5 text-center`} data-testid="scorecard-empty">
          <p className={`text-sm ${subtitleCls}`}>No performance data available for this agent yet.</p>
        </div>
      )}

      {selectedAgent && !loadingAgent && metrics && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className={`${panelCls} p-4`}>
              <div className="flex items-center gap-2 text-emerald-400 mb-1"><Target size={16} /><span className={`text-xs ${subtitleCls}`}>Success Rate</span></div>
              <p className={`text-xl font-bold ${titleCls}`} data-testid="text-success-rate">{successRate.toFixed(1)}%</p>
              <p className={`text-xs ${mutedCls}`}>{metrics.successCount || 0}/{metrics.totalTasks || 0} tasks</p>
            </div>
            <div className={`${panelCls} p-4`}>
              <div className="flex items-center gap-2 text-blue-400 mb-1"><Clock size={16} /><span className={`text-xs ${subtitleCls}`}>Avg Latency</span></div>
              <p className={`text-xl font-bold ${titleCls}`} data-testid="text-avg-latency">{Math.round(metrics.avgLatency || 0)}ms</p>
            </div>
            <div className={`${panelCls} p-4`}>
              <div className="flex items-center gap-2 text-purple-400 mb-1"><Zap size={16} /><span className={`text-xs ${subtitleCls}`}>Accuracy</span></div>
              <p className={`text-xl font-bold ${titleCls}`} data-testid="text-accuracy">{(metrics.avgAccuracy || 0).toFixed(1)}%</p>
            </div>
            <div className={`${panelCls} p-4`}>
              <div className="flex items-center gap-2 text-amber-400 mb-1"><Star size={16} /><span className={`text-xs ${subtitleCls}`}>Human Rating</span></div>
              <p className={`text-xl font-bold ${titleCls}`} data-testid="text-human-rating">{(metrics.avgHumanRating || 0).toFixed(1)}<span className={`text-sm ${mutedCls}`}>/5</span></p>
            </div>
            <div className={`${panelCls} p-4`}>
              <div className="flex items-center gap-2 text-emerald-400 mb-1"><DollarSign size={16} /><span className={`text-xs ${subtitleCls}`}>Total Cost</span></div>
              <p className={`text-xl font-bold ${titleCls}`} data-testid="text-total-cost">${parseFloat(metrics.totalCost || "0").toFixed(2)}</p>
            </div>
          </div>

          {certResult && (
            <div className={`border rounded-xl p-5 ${certResult.certified ? "bg-emerald-500/10 border-emerald-500/30" : panelCls}`} data-testid="certification-panel">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={20} className={certResult.certified ? "text-emerald-400" : subtitleCls} />
                <h3 className={`font-medium ${titleCls}`}>
                  Certification Status: <span className={certResult.certified ? "text-emerald-400" : "text-amber-400"}>{certResult.certified ? "Certified" : "In Progress"}</span>
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(certResult.checks || {}).map(([key, passed]) => (
                  <div key={key} className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${passed ? "bg-emerald-500/20" : "bg-red-500/20"}`}>
                      {passed ? <CheckCircle size={12} className="text-emerald-400" /> : <span className="text-red-400 text-xs">x</span>}
                    </div>
                    <span className={`text-sm ${subtitleCls}`}>{key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!certResult && certError && (
            <div className={`${panelCls} p-5 flex items-center gap-3`} data-testid="certification-error">
              <Shield size={20} className={`shrink-0 ${mutedCls}`} />
              <p className={`text-sm ${subtitleCls}`}>Certification status could not be loaded.</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`${panelCls} p-5`}>
              <h3 className={`font-medium mb-4 ${titleCls}`}>Rate This Agent</h3>
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onClick={() => setNewRating(s)} data-testid={`button-star-${s}`}
                    className={`p-1 transition-colors ${s <= newRating ? "text-amber-400" : isDark ? "text-slate-600" : "text-gray-300"}`}>
                    <Star size={24} fill={s <= newRating ? "currentColor" : "none"} />
                  </button>
                ))}
                <span className={`text-sm ml-2 ${subtitleCls}`}>{newRating}/5</span>
              </div>
              <textarea value={ratingComment} onChange={e => setRatingComment(e.target.value)} placeholder="Optional comment..."
                className={`w-full border rounded-lg p-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${isDark ? "bg-slate-700/50 border-slate-600/50 text-white" : "bg-white border-gray-300 text-gray-900"}`}
                data-testid="input-rating-comment" />
              <button onClick={handleRate} className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm transition-colors" data-testid="button-submit-rating">
                Submit Rating
              </button>
              {rateError && <p className="text-red-400 text-sm mt-2" data-testid="text-rate-error">{rateError}</p>}
            </div>

            <div className={`${panelCls} p-5`}>
              <h3 className={`font-medium mb-4 ${titleCls}`}>Recent Ratings</h3>
              {ratings.length === 0 ? (
                <p className={`text-sm ${mutedCls}`}>No ratings yet</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {ratings.slice(0, 10).map((r: any) => (
                    <div key={r.id} className={`border-b pb-2 ${isDark ? "border-slate-700/30" : "border-gray-100"}`} data-testid={`rating-${r.id}`}>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} size={12} className={s <= r.rating ? "text-amber-400" : isDark ? "text-slate-600" : "text-gray-300"} fill={s <= r.rating ? "currentColor" : "none"} />
                        ))}
                        <span className={`text-xs ml-2 ${mutedCls}`}>{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>
                      {r.comment && <p className={`text-sm mt-1 ${subtitleCls}`}>{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
