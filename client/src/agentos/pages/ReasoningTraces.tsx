import { useState, useEffect } from "react";
import { aosApi } from "../lib/api";
import { useAosTheme } from "../AgentOSApp";

interface Trace { id: string; agentId: string; taskName: string; status: string; input: string | null; output: string | null; durationMs: number | null; tokenCount: number | null; createdAt: string; completedAt: string | null; }
interface Step { id: string; traceId: string; stepNumber: number; type: string; title: string; content: string | null; toolName: string | null; toolInput: unknown; toolOutput: unknown; durationMs: number | null; createdAt: string; }

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  thought: { icon: "T", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  tool_call: { icon: "C", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  observation: { icon: "O", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  action: { icon: "A", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  error: { icon: "E", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  output: { icon: "R", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
};
const STATUS_COLORS: Record<string, string> = { running: "bg-blue-500/20 text-blue-400", completed: "bg-emerald-500/20 text-emerald-400", failed: "bg-red-500/20 text-red-400" };

export default function ReasoningTraces({ agentId }: { agentId?: string }) {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [traceDetail, setTraceDetail] = useState<Trace | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  useEffect(() => { aosApi.getReasoningTraces(agentId).then((data: Trace[]) => setTraces(data)).catch(console.error).finally(() => setLoading(false)); }, [agentId]);

  const handleSelectTrace = async (traceId: string) => {
    setSelectedTrace(traceId);
    try { const data = await aosApi.getReasoningTrace(traceId); setTraceDetail(data.trace); setSteps(data.steps || []); } catch (err) { console.error(err); }
  };

  const toggleStep = (stepId: string) => { setExpandedSteps(prev => { const next = new Set(prev); if (next.has(stepId)) next.delete(stepId); else next.add(stepId); return next; }); };

  if (loading) { return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>; }

  const panelCls = `border rounded-xl ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`;
  const titleCls = isDark ? "text-white" : "text-gray-900";
  const subtitleCls = isDark ? "text-slate-400" : "text-gray-500";
  const mutedCls = isDark ? "text-slate-500" : "text-gray-400";
  const codeCls = isDark ? "bg-slate-900 border-slate-700 text-slate-300" : "bg-gray-100 border-gray-200 text-gray-800";
  const stepBtnCls = isDark ? "bg-slate-800/30 border-slate-700/30 hover:border-slate-600" : "bg-gray-50 border-gray-200 hover:border-gray-300";

  return (
    <div className="space-y-6" data-testid="reasoning-traces-page">
      <div>
        <h1 className={`text-2xl font-bold ${titleCls}`} data-testid="text-traces-title">Reasoning Traces</h1>
        <p className={`mt-1 ${subtitleCls}`}>Visual timeline of agent thought processes and tool calls</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          <h2 className={`text-sm font-medium uppercase tracking-wider ${subtitleCls}`}>Recent Traces</h2>
          {traces.length > 0 ? (
            <div className="space-y-2">
              {traces.map(trace => (
                <button key={trace.id} data-testid={`trace-item-${trace.id}`} onClick={() => handleSelectTrace(trace.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedTrace === trace.id ? "bg-violet-600/20 border-violet-500/30" : isDark ? "bg-slate-800/50 border-slate-700/50 hover:border-slate-600" : "bg-white border-gray-200 hover:border-gray-300"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium truncate ${titleCls}`}>{trace.taskName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[trace.status] || (isDark ? "bg-slate-500/20 text-slate-400" : "bg-gray-200 text-gray-500")}`}>{trace.status}</span>
                  </div>
                  <div className={`flex items-center gap-3 text-xs ${mutedCls}`}>
                    {trace.durationMs && <span>{(trace.durationMs / 1000).toFixed(1)}s</span>}
                    {trace.tokenCount && <span>{trace.tokenCount} tokens</span>}
                    <span>{new Date(trace.createdAt).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className={`${panelCls} p-8 text-center`}>
              <p className={mutedCls}>No reasoning traces recorded</p>
              <p className={`text-sm mt-1 ${isDark ? "text-slate-600" : "text-gray-400"}`}>Traces will appear here when agents process tasks</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {traceDetail ? (
            <div className="space-y-4">
              <div className={`${panelCls} p-5`}>
                <h3 className={`font-semibold mb-3 ${titleCls}`}>{traceDetail.taskName}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><p className={mutedCls}>Status</p><p className={`px-2 py-0.5 rounded-full text-xs w-fit mt-1 ${STATUS_COLORS[traceDetail.status]}`}>{traceDetail.status}</p></div>
                  <div><p className={mutedCls}>Duration</p><p className={titleCls}>{traceDetail.durationMs ? `${(traceDetail.durationMs / 1000).toFixed(2)}s` : "N/A"}</p></div>
                  <div><p className={mutedCls}>Tokens</p><p className={titleCls}>{traceDetail.tokenCount || "N/A"}</p></div>
                  <div><p className={mutedCls}>Started</p><p className={titleCls}>{new Date(traceDetail.createdAt).toLocaleString()}</p></div>
                </div>
                {traceDetail.input && (
                  <div className="mt-3">
                    <p className={`text-sm mb-1 ${mutedCls}`}>Input</p>
                    <div className={`border rounded-lg p-3 text-sm font-mono whitespace-pre-wrap ${codeCls}`}>{traceDetail.input}</div>
                  </div>
                )}
                {traceDetail.output && (
                  <div className="mt-3">
                    <p className={`text-sm mb-1 ${mutedCls}`}>Output</p>
                    <div className={`border rounded-lg p-3 text-sm font-mono whitespace-pre-wrap ${codeCls}`}>{traceDetail.output}</div>
                  </div>
                )}
              </div>

              <div className={`${panelCls} p-5`}>
                <h3 className={`font-semibold mb-4 ${titleCls}`}>Steps ({steps.length})</h3>
                {steps.length > 0 ? (
                  <div className="relative space-y-3">
                    <div className={`absolute left-5 top-2 bottom-2 w-0.5 ${isDark ? "bg-slate-700" : "bg-gray-200"}`} />
                    {steps.map(step => {
                      const typeInfo = TYPE_ICONS[step.type] || { icon: "?", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" };
                      const isExpanded = expandedSteps.has(step.id);
                      return (
                        <div key={step.id} className="relative pl-12" data-testid={`step-${step.stepNumber}`}>
                          <div className={`absolute left-3 w-5 h-5 rounded-full border text-xs flex items-center justify-center font-bold ${typeInfo.color}`}>{typeInfo.icon}</div>
                          <button onClick={() => toggleStep(step.id)} className={`w-full text-left border rounded-lg p-3 transition-colors ${stepBtnCls}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${titleCls}`}>{step.title}</span>
                                {step.toolName && <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full">{step.toolName}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                {step.durationMs && <span className={`text-xs ${mutedCls}`}>{step.durationMs}ms</span>}
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${mutedCls} ${isExpanded ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6"/></svg>
                              </div>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="mt-2 ml-3 space-y-2">
                              {step.content && (<div className={`border rounded-lg p-3 ${codeCls}`}><p className={`text-xs mb-1 ${mutedCls}`}>Content</p><p className="text-sm whitespace-pre-wrap">{step.content}</p></div>)}
                              {step.toolInput && (<div className={`border rounded-lg p-3 ${codeCls}`}><p className={`text-xs mb-1 ${mutedCls}`}>Tool Input</p><pre className="text-sm overflow-x-auto">{JSON.stringify(step.toolInput, null, 2)}</pre></div>)}
                              {step.toolOutput && (<div className={`border rounded-lg p-3 ${codeCls}`}><p className={`text-xs mb-1 ${mutedCls}`}>Tool Output</p><pre className="text-sm overflow-x-auto">{JSON.stringify(step.toolOutput, null, 2)}</pre></div>)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={`text-sm ${mutedCls}`}>No steps recorded for this trace</p>
                )}
              </div>
            </div>
          ) : (
            <div className={`${panelCls} p-12 text-center`}>
              <p className={mutedCls}>Select a trace to view its timeline</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
