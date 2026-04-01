import { useState, useEffect } from "react";
import { aosApi } from "../lib/api";
import { useAosTheme } from "../AgentOSApp";

const STATUS_COLORS: Record<string, string> = {
  onboarding: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  suspended: "bg-red-500/20 text-red-400 border-red-500/30",
  retired: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const TRANSITIONS: Record<string, { label: string; target: string; color: string }[]> = {
  onboarding: [{ label: "Activate", target: "active", color: "bg-emerald-600 hover:bg-emerald-500" }, { label: "Retire", target: "retired", color: "bg-slate-600 hover:bg-slate-500" }],
  active: [{ label: "Suspend", target: "suspended", color: "bg-red-600 hover:bg-red-500" }, { label: "Retire", target: "retired", color: "bg-slate-600 hover:bg-slate-500" }],
  suspended: [{ label: "Reactivate", target: "active", color: "bg-emerald-600 hover:bg-emerald-500" }, { label: "Retire", target: "retired", color: "bg-slate-600 hover:bg-slate-500" }],
  retired: [],
};

interface Agent { id: string; uid: string; name: string; role: string | null; description: string | null; provider: string; llmModel: string; status: string; version: number; skills: string[]; tools: string[]; avatarUrl: string | null; deploymentDate: string | null; costPerToken: string | null; monthlyCap: string | null; hasApiKey: boolean; apiKeyPrefix: string | null; createdAt: string; updatedAt: string; }
interface AgentVersion { id: string; agentId: string; version: number; changes: string; snapshot: Record<string, unknown>; changedBy: string | null; createdAt: string; }
interface UsageData { metrics: { totalTasks: number; successCount: number; failureCount: number; successRate: number; avgLatency: number; avgAccuracy: number | null; totalCost: number; totalTokens: number }; budget: { monthlyCap: number | null; monthlySpend: number; remaining: number | null; capUsagePercent: number | null; costPerToken: number | null }; trend: { date: string; totalCost: string; totalTokens: number; inputTokens: number; outputTokens: number; eventCount: number; successCount: number; failureCount: number }[]; recentEvents: { id: string; eventType: string; provider: string; model: string; inputTokens: number; outputTokens: number; totalTokens: number; costUsd: string; latencyMs: number; taskOutcome: string; timestamp: string }[]; }
interface EditFormState { name: string; role: string; description: string; skills: string; tools: string; costPerToken: string; monthlyCap: string; }

export default function AgentDetail({ params, onNavigate }: { params?: { id: string }; onNavigate?: (page: string) => void }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({ name: "", role: "", description: "", skills: "", tools: "", costPerToken: "", monthlyCap: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [editAvatarRemoved, setEditAvatarRemoved] = useState(false);
  const [tab, setTab] = useState<"profile" | "usage" | "versions">("profile");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [apiKeyMessage, setApiKeyMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [riskData, setRiskData] = useState<{ score: number; factors: Record<string, { weight: number; value: number; contribution: number; label: string }> } | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  const agentId = params?.id || "";

  const fetchAgent = async () => { try { const [a, v] = await Promise.all([aosApi.getAgent(agentId), aosApi.getAgentVersions(agentId)]); setAgent(a as Agent); setVersions(v as AgentVersion[]); } catch (err) { console.error(err); } finally { setLoading(false); } };
  const fetchUsage = async () => { setUsageLoading(true); try { const data = await aosApi.getAgentUsage(agentId); setUsage(data as UsageData); } catch (err) { console.error(err); } finally { setUsageLoading(false); } };

  const fetchRisk = async () => { setRiskLoading(true); try { const data = await aosApi.getAgentRiskBreakdown(agentId); setRiskData(data); } catch {} finally { setRiskLoading(false); } };
  useEffect(() => { if (agentId) { setUsage(null); setRiskData(null); setTab("profile"); fetchAgent(); fetchRisk(); } }, [agentId]);
  useEffect(() => { if (tab === "usage" && agentId && !usage) fetchUsage(); }, [tab, agentId]);

  const handleTransition = async (status: string) => { try { const updated = await aosApi.transitionAgent(agentId, status); setAgent(updated as Agent); const v = await aosApi.getAgentVersions(agentId); setVersions(v as AgentVersion[]); } catch (err) { alert(err instanceof Error ? err.message : "Transition failed"); } };

  const handleEdit = async () => {
    setEditLoading(true);
    try {
      const payload: Parameters<typeof aosApi.updateAgent>[1] = { name: editForm.name, role: editForm.role, description: editForm.description, skills: editForm.skills ? editForm.skills.split(",").map((s) => s.trim()).filter(Boolean) : [], tools: editForm.tools ? editForm.tools.split(",").map((s) => s.trim()).filter(Boolean) : [], costPerToken: editForm.costPerToken || null, monthlyCap: editForm.monthlyCap || null };
      if (editAvatarFile) { try { const result = await aosApi.uploadAgentAvatar(agentId, editAvatarFile); payload.avatarUrl = result.avatarUrl; } catch { alert("Avatar upload failed. Other changes will still be saved."); } } else if (editAvatarRemoved) { await aosApi.removeAgentAvatar(agentId); payload.avatarUrl = null; }
      const updated = await aosApi.updateAgent(agentId, payload); setAgent(updated as Agent); setEditing(false); setEditAvatarFile(null); setEditAvatarPreview(null); setEditAvatarRemoved(false); setUsage(null); const v = await aosApi.getAgentVersions(agentId); setVersions(v as AgentVersion[]);
    } catch (err) { alert(err instanceof Error ? err.message : "Update failed"); } finally { setEditLoading(false); }
  };

  const handleSetApiKey = async () => {
    if (!apiKeyInput.trim()) return; setApiKeyLoading(true); setApiKeyMessage(null);
    try { const result = await aosApi.setAgentApiKey(agentId, apiKeyInput.trim()) as { maskedKey: string; hasKey: boolean }; setAgent(prev => prev ? { ...prev, hasApiKey: true, apiKeyPrefix: result.maskedKey } : prev); setApiKeyInput(""); setApiKeyMessage({ type: "success", text: "API key saved securely" }); setTimeout(() => setApiKeyMessage(null), 3000); } catch (err) { setApiKeyMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to set API key" }); } finally { setApiKeyLoading(false); }
  };

  const handleRemoveApiKey = async () => {
    setApiKeyLoading(true); setApiKeyMessage(null);
    try { await aosApi.removeAgentApiKey(agentId); setAgent(prev => prev ? { ...prev, hasApiKey: false, apiKeyPrefix: null } : prev); setApiKeyMessage({ type: "success", text: "API key removed" }); setTimeout(() => setApiKeyMessage(null), 3000); } catch (err) { setApiKeyMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to remove API key" }); } finally { setApiKeyLoading(false); }
  };

  const handleDeleteAgent = async () => {
    setDeleteLoading(true);
    try {
      await aosApi.deleteAgent(agentId);
      onNavigate?.("agents");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete agent");
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const panelCls = `border rounded-xl ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`;
  const titleCls = isDark ? "text-white" : "text-gray-900";
  const subtitleCls = isDark ? "text-slate-400" : "text-gray-500";
  const mutedCls = isDark ? "text-slate-500" : "text-gray-400";
  const borderCls = isDark ? "border-slate-700/50" : "border-gray-200";
  const rowBorderCls = isDark ? "border-slate-700/30" : "border-gray-100";
  const bodyCls = isDark ? "text-slate-300" : "text-gray-700";
  const inputCls = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${isDark ? "bg-slate-800/50 border-slate-700 text-white" : "bg-white border-gray-300 text-gray-900"}`;
  const labelCls = `block text-sm mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`;
  const modalCls = isDark ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200";
  const codeBgCls = isDark ? "bg-slate-900 border-slate-700 text-slate-300" : "bg-gray-100 border-gray-200 text-gray-800";
  const tabBgCls = isDark ? "bg-slate-800/30" : "bg-gray-100";
  const tabInactiveCls = isDark ? "text-slate-400 hover:text-white" : "text-gray-500 hover:text-gray-900";
  const backCls = isDark ? "text-slate-400 hover:text-white" : "text-gray-500 hover:text-gray-900";

  if (loading) { return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>; }

  if (!agent) {
    return (
      <div className="text-center py-16">
        <h2 className={`text-lg font-semibold ${titleCls}`}>Agent not found</h2>
        <button data-testid="button-back-to-directory" onClick={() => onNavigate?.("agents")} className="mt-4 text-violet-400 hover:text-violet-300">Back to directory</button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="agent-detail-page">
      <button data-testid="button-back" onClick={() => onNavigate?.("agents")} className={`flex items-center gap-2 transition-colors text-sm ${backCls}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back to Directory
      </button>

      <div className={`${panelCls} p-6`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {agent.avatarUrl ? (
              <img src={agent.avatarUrl} alt={agent.name} className="w-14 h-14 rounded-xl object-cover border border-violet-500/30" data-testid="img-agent-detail-avatar" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xl font-bold">{agent.name.charAt(0)}</div>
            )}
            <div>
              <h1 className={`text-2xl font-bold ${titleCls}`} data-testid="text-agent-name">{agent.name}</h1>
              <p className={`font-mono text-sm ${subtitleCls}`} data-testid="text-agent-uid">{agent.uid}</p>
              {agent.role && <p className={`mt-1 ${bodyCls}`}>{agent.role}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm px-3 py-1 rounded-full border ${STATUS_COLORS[agent.status]}`} data-testid="text-agent-status">{agent.status}</span>
            {agent.status !== "retired" && (
              <button data-testid="button-edit-agent" onClick={() => { setEditing(true); setEditForm({ name: agent.name, role: agent.role || "", description: agent.description || "", skills: agent.skills?.join(", ") || "", tools: agent.tools?.join(", ") || "", costPerToken: agent.costPerToken || "", monthlyCap: agent.monthlyCap || "" }); setEditAvatarFile(null); setEditAvatarPreview(null); setEditAvatarRemoved(false); }} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}>Edit</button>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          {(TRANSITIONS[agent.status] || []).map(t => (<button key={t.target} data-testid={`button-transition-${t.target}`} onClick={() => handleTransition(t.target)} className={`px-3 py-1.5 text-white rounded-lg text-sm transition-colors ${t.color}`}>{t.label}</button>))}
          {agent.status === "retired" && (
            <button data-testid="button-delete-agent" onClick={() => setShowDeleteConfirm(true)} className="px-3 py-1.5 text-white rounded-lg text-sm transition-colors bg-red-600 hover:bg-red-500">Delete Agent</button>
          )}
        </div>
      </div>

      <div className={`flex gap-1 ${tabBgCls} p-1 rounded-lg w-fit`}>
        <button data-testid="tab-profile" onClick={() => setTab("profile")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "profile" ? "bg-violet-600 text-white" : tabInactiveCls}`}>Profile</button>
        <button data-testid="tab-usage" onClick={() => setTab("usage")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "usage" ? "bg-violet-600 text-white" : tabInactiveCls}`}>Usage & Cost</button>
        <button data-testid="tab-versions" onClick={() => setTab("versions")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "versions" ? "bg-violet-600 text-white" : tabInactiveCls}`}>Version History ({versions.length})</button>
      </div>

      {tab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className={`${panelCls} p-5 space-y-4`}>
              <h3 className={`font-semibold ${titleCls}`}>Digital Personnel File</h3>
              <InfoRow label="Provider" value={agent.provider} testId="info-provider" isDark={isDark} />
              <InfoRow label="LLM Model" value={agent.llmModel} testId="info-model" isDark={isDark} />
              <InfoRow label="Status" value={agent.status} testId="info-status" isDark={isDark} />
              <InfoRow label="Version" value={`v${agent.version || 1}`} testId="info-version" isDark={isDark} />
              <InfoRow label="Cost Per Token" value={agent.costPerToken ? `$${agent.costPerToken}` : "Not set"} testId="info-cost-per-token" isDark={isDark} />
              <InfoRow label="Monthly Cap" value={agent.monthlyCap ? `$${parseFloat(agent.monthlyCap).toLocaleString()}` : "No limit"} testId="info-monthly-cap" isDark={isDark} />
              <InfoRow label="Deployment Date" value={agent.deploymentDate ? new Date(agent.deploymentDate).toLocaleDateString() : "Not deployed"} testId="info-deployment" isDark={isDark} />
              <InfoRow label="Created" value={new Date(agent.createdAt).toLocaleDateString()} testId="info-created" isDark={isDark} />
            </div>

            <div className={`${panelCls} p-5`} data-testid="api-key-section">
              <h3 className={`font-semibold mb-3 ${titleCls}`}>Provider API Key</h3>
              <p className={`text-xs mb-3 ${subtitleCls}`}>Set a provider-specific API key for this agent. Overrides the company-level key.</p>
              {agent.hasApiKey ? (
                <div className="space-y-3">
                  <div className={`flex items-center gap-3 rounded-lg px-4 py-3 ${isDark ? "bg-slate-700/30" : "bg-gray-100"}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                    <div className="flex-1">
                      <span className={`text-sm font-mono ${titleCls}`} data-testid="text-api-key-prefix">{agent.apiKeyPrefix}</span>
                      <span className="text-emerald-400 text-xs ml-2">Active</span>
                    </div>
                    <button data-testid="button-remove-api-key" onClick={handleRemoveApiKey} disabled={apiKeyLoading} className="text-red-400 hover:text-red-300 text-sm px-2 py-1 transition-colors disabled:opacity-50">Remove</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input data-testid="input-agent-api-key" type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} placeholder="Paste provider API key (e.g. sk-...)" className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${isDark ? "bg-slate-800/50 border-slate-700 text-white placeholder-slate-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"}`} />
                  <button data-testid="button-set-api-key" onClick={handleSetApiKey} disabled={apiKeyLoading || !apiKeyInput.trim()} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">{apiKeyLoading ? "Saving..." : "Save Key"}</button>
                </div>
              )}
              {apiKeyMessage && (<p className={`mt-2 text-xs ${apiKeyMessage.type === "success" ? "text-emerald-400" : "text-red-400"}`} data-testid="api-key-message">{apiKeyMessage.text}</p>)}
            </div>
          </div>

          <div className="space-y-6">
            <div className={`${panelCls} p-5`}>
              <h3 className={`font-semibold mb-3 ${titleCls}`}>Description</h3>
              <p className={`text-sm ${bodyCls}`}>{agent.description || "No description provided"}</p>
            </div>
            <div className={`${panelCls} p-5`}>
              <h3 className={`font-semibold mb-3 ${titleCls}`}>Skills</h3>
              {agent.skills?.length > 0 ? (
                <div className="flex flex-wrap gap-2">{agent.skills.map((s) => (<span key={s} className="text-sm px-2 py-1 bg-violet-500/10 text-violet-400 rounded-lg border border-violet-500/20">{s}</span>))}</div>
              ) : (<p className={`text-sm ${mutedCls}`}>No skills defined</p>)}
            </div>
            <div className={`${panelCls} p-5`}>
              <h3 className={`font-semibold mb-3 ${titleCls}`}>Tools & APIs</h3>
              {agent.tools?.length > 0 ? (
                <div className="flex flex-wrap gap-2">{agent.tools.map((t) => (<span key={t} className="text-sm px-2 py-1 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">{t}</span>))}</div>
              ) : (<p className={`text-sm ${mutedCls}`}>No tools configured</p>)}
            </div>
            <div className={`${panelCls} p-5`} data-testid="risk-breakdown-section">
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-semibold ${titleCls}`}>Risk Score</h3>
                {riskData && (
                  <span className={`text-sm px-2.5 py-1 rounded-full font-bold ${
                    riskData.score <= 40 ? "bg-emerald-500/20 text-emerald-400" :
                    riskData.score <= 70 ? "bg-amber-500/20 text-amber-400" :
                    "bg-red-500/20 text-red-400"
                  }`} data-testid="text-risk-score">{riskData.score}/100</span>
                )}
              </div>
              {riskLoading ? (
                <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : riskData ? (
                <div className="space-y-2">
                  {Object.entries(riskData.factors).map(([key, f]) => (
                    <div key={key} data-testid={`risk-factor-${key}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-xs ${subtitleCls}`}>{f.label}</span>
                        <span className={`text-xs font-mono ${mutedCls}`}>{f.contribution} pts ({Math.round(f.weight * 100)}%)</span>
                      </div>
                      <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-slate-700" : "bg-gray-200"}`}>
                        <div className={`h-full rounded-full transition-all ${
                          f.value <= 40 ? "bg-emerald-500" : f.value <= 70 ? "bg-amber-500" : "bg-red-500"
                        }`} style={{ width: `${f.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-sm ${mutedCls}`}>Risk score not yet calculated</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "usage" && <UsageTab usage={usage} loading={usageLoading} onRefresh={fetchUsage} isDark={isDark} />}

      {tab === "versions" && (
        <div className={`${panelCls} p-5`}>
          <h3 className={`font-semibold mb-4 ${titleCls}`}>Lifecycle Timeline</h3>
          {versions.length > 0 ? (
            <div className="relative space-y-4">
              <div className={`absolute left-4 top-2 bottom-2 w-0.5 ${isDark ? "bg-slate-700" : "bg-gray-200"}`} />
              {versions.map((v, i) => (
                <div key={v.id} className="relative flex gap-4 pl-10" data-testid={`version-entry-${v.version}`}>
                  <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${i === 0 ? "bg-violet-500 border-violet-400" : isDark ? "bg-slate-700 border-slate-600" : "bg-gray-300 border-gray-400"}`} />
                  <div className={`flex-1 border rounded-lg p-3 ${isDark ? "bg-slate-800/50 border-slate-700/30" : "bg-gray-50 border-gray-200"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-medium text-sm ${titleCls}`}>v{v.version}</span>
                      <span className={`text-xs ${mutedCls}`}>{new Date(v.createdAt).toLocaleString()}</span>
                    </div>
                    <p className={`text-sm ${bodyCls}`}>{v.changes}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (<p className={`text-sm ${mutedCls}`}>No version history available</p>)}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" data-testid="modal-delete-confirm">
          <div className={`border rounded-xl w-full max-w-sm p-6 ${modalCls}`}>
            <h2 className={`text-lg font-semibold mb-2 ${titleCls}`}>Delete Agent</h2>
            <p className={`text-sm mb-6 ${isDark ? "text-slate-400" : "text-gray-500"}`}>Are you sure you want to permanently delete <strong>{agent.name}</strong>? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button data-testid="button-cancel-delete" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading} className={`flex-1 py-2 rounded-lg transition-colors ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}>Cancel</button>
              <button data-testid="button-confirm-delete" onClick={handleDeleteAgent} disabled={deleteLoading} className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">{deleteLoading ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`border rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto ${modalCls}`}>
            <h2 className={`text-lg font-semibold mb-4 ${titleCls}`}>Edit Agent</h2>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Avatar</label>
                <div className="flex items-center gap-4">
                  {editAvatarPreview ? (<img src={editAvatarPreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-violet-500/30" data-testid="img-edit-avatar-preview" />) : !editAvatarRemoved && agent.avatarUrl ? (<img src={agent.avatarUrl} alt={agent.name} className="w-16 h-16 rounded-lg object-cover border border-violet-500/30" data-testid="img-edit-current-avatar" />) : (<div className="w-16 h-16 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xl font-bold">{editForm.name ? editForm.name.charAt(0) : "?"}</div>)}
                  <div className="flex-1 space-y-1">
                    <input data-testid="input-edit-avatar" type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setEditAvatarFile(file); setEditAvatarPreview(URL.createObjectURL(file)); setEditAvatarRemoved(false); } }} className={`block w-full text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-600 file:text-white hover:file:bg-violet-500 file:cursor-pointer ${subtitleCls}`} />
                    {(editAvatarFile || (!editAvatarRemoved && agent.avatarUrl)) && (<button type="button" data-testid="button-remove-edit-avatar" onClick={() => { setEditAvatarFile(null); setEditAvatarPreview(null); setEditAvatarRemoved(true); }} className="text-xs text-red-400 hover:text-red-300">Remove avatar</button>)}
                  </div>
                </div>
              </div>
              <div><label className={labelCls}>Name</label><input data-testid="input-edit-name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={inputCls} /></div>
              <div><label className={labelCls}>Role</label><input data-testid="input-edit-role" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} className={inputCls} /></div>
              <div><label className={labelCls}>Description</label><input data-testid="input-edit-description" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className={inputCls} /></div>
              <div><label className={labelCls}>Skills (comma-separated)</label><input data-testid="input-edit-skills" value={editForm.skills} onChange={e => setEditForm(f => ({ ...f, skills: e.target.value }))} className={inputCls} /></div>
              <div><label className={labelCls}>Tools (comma-separated)</label><input data-testid="input-edit-tools" value={editForm.tools} onChange={e => setEditForm(f => ({ ...f, tools: e.target.value }))} className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Cost Per Token ($)</label><input data-testid="input-edit-cost-per-token" type="number" step="0.0001" min="0" value={editForm.costPerToken} onChange={e => setEditForm(f => ({ ...f, costPerToken: e.target.value }))} placeholder="e.g. 0.003" className={inputCls} /></div>
                <div><label className={labelCls}>Monthly Cap ($)</label><input data-testid="input-edit-monthly-cap" type="number" step="1" min="0" value={editForm.monthlyCap} onChange={e => setEditForm(f => ({ ...f, monthlyCap: e.target.value }))} placeholder="e.g. 500" className={inputCls} /></div>
              </div>
              <div className="flex gap-3">
                <button data-testid="button-cancel-edit" onClick={() => setEditing(false)} className={`flex-1 py-2 rounded-lg transition-colors ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}>Cancel</button>
                <button data-testid="button-save-edit" onClick={handleEdit} disabled={editLoading} className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">{editLoading ? "Saving..." : "Save Changes"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UsageTab({ usage, loading, onRefresh, isDark }: { usage: UsageData | null; loading: boolean; onRefresh: () => void; isDark: boolean }) {
  const panelCls = `border rounded-xl ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`;
  const titleCls = isDark ? "text-white" : "text-gray-900";
  const subtitleCls = isDark ? "text-slate-400" : "text-gray-500";
  const mutedCls = isDark ? "text-slate-500" : "text-gray-400";
  const bodyCls = isDark ? "text-slate-300" : "text-gray-700";
  const borderCls = isDark ? "border-slate-700/50" : "border-gray-200";
  const rowBorderCls = isDark ? "border-slate-700/20" : "border-gray-100";
  const hoverCls = isDark ? "hover:bg-slate-700/20" : "hover:bg-gray-50";

  if (loading) { return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>; }

  if (!usage) {
    return (
      <div className={`text-center py-16 border rounded-xl ${isDark ? "bg-slate-800/30 border-slate-700/50" : "bg-gray-50 border-gray-200"}`}>
        <p className={subtitleCls}>Failed to load usage data</p>
        <button data-testid="button-retry-usage" onClick={onRefresh} className="mt-2 text-violet-400 hover:text-violet-300 text-sm">Retry</button>
      </div>
    );
  }

  const { metrics, budget, trend: rawTrend, recentEvents } = usage;

  const trend = (() => {
    const days = 30;
    const trendMap = new Map<string, typeof rawTrend[number]>();
    for (const d of rawTrend) {
      const key = new Date(d.date).toISOString().split("T")[0];
      trendMap.set(key, d);
    }
    const filled: typeof rawTrend = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(now);
      dt.setDate(dt.getDate() - i);
      const key = dt.toISOString().split("T")[0];
      filled.push(trendMap.get(key) || { date: key, totalCost: "0", totalTokens: 0, inputTokens: 0, outputTokens: 0, eventCount: 0, successCount: 0, failureCount: 0 });
    }
    return filled;
  })();

  const maxCost = Math.max(...trend.map(d => parseFloat(d.totalCost) || 0), 0.01);
  const maxTokens = Math.max(...trend.map(d => d.totalTokens || 0), 1);
  const remaining = budget.monthlyCap !== null ? Math.max(budget.monthlyCap - budget.monthlySpend, 0) : null;

  return (
    <div className="space-y-6" data-testid="usage-tab">
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold text-lg ${titleCls}`}>Usage & Cost Dashboard</h3>
        <button data-testid="button-refresh-usage" onClick={onRefresh} className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Tasks" value={metrics.totalTasks.toLocaleString()} testId="metric-total-tasks" isDark={isDark} />
        <MetricCard label="Success Rate" value={`${metrics.successRate}%`} color={metrics.successRate >= 90 ? "text-emerald-400" : metrics.successRate >= 70 ? "text-amber-400" : "text-red-400"} testId="metric-success-rate" isDark={isDark} />
        <MetricCard label="Avg Latency" value={`${metrics.avgLatency.toLocaleString()}ms`} testId="metric-avg-latency" isDark={isDark} />
        <MetricCard label="Total Cost" value={`$${metrics.totalCost < 0.01 && metrics.totalCost > 0 ? metrics.totalCost.toFixed(4) : metrics.totalCost.toFixed(2)}`} testId="metric-total-cost" isDark={isDark} />
      </div>

      {budget.monthlyCap !== null && (
        <div className={`${panelCls} p-5`} data-testid="budget-section">
          <div className="flex items-center justify-between mb-3">
            <h4 className={`font-medium ${titleCls}`}>Monthly Budget</h4>
            <span className={`text-sm ${subtitleCls}`}>${budget.monthlySpend.toFixed(2)} / ${budget.monthlyCap.toLocaleString()}</span>
          </div>
          <div className={`w-full rounded-full h-3 overflow-hidden ${isDark ? "bg-slate-700/50" : "bg-gray-200"}`}>
            <div className={`h-full rounded-full transition-all ${(budget.capUsagePercent || 0) >= 90 ? "bg-red-500" : (budget.capUsagePercent || 0) >= 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(budget.capUsagePercent || 0, 100)}%` }} data-testid="budget-bar" />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className={`text-xs ${mutedCls}`}>{budget.capUsagePercent !== null ? `${budget.capUsagePercent}% of monthly cap used` : ""}{budget.costPerToken !== null && ` | Cost per token: $${budget.costPerToken}`}</p>
            <p className="text-sm font-medium" data-testid="text-remaining-budget"><span className={subtitleCls}>Remaining: </span><span className={remaining !== null && remaining < 50 ? "text-red-400" : "text-emerald-400"}>${remaining !== null ? remaining.toFixed(2) : "N/A"}</span></p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MetricCard label="Success" value={metrics.successCount.toLocaleString()} color="text-emerald-400" testId="metric-success-count" isDark={isDark} />
        <MetricCard label="Failures" value={metrics.failureCount.toLocaleString()} color="text-red-400" testId="metric-failure-count" isDark={isDark} />
        <MetricCard label="Total Tokens" value={formatTokens(metrics.totalTokens)} testId="metric-total-tokens" isDark={isDark} />
      </div>

      {trend.length > 0 && (
        <div className={`${panelCls} p-5`} data-testid="cost-trend-chart">
          <h4 className={`font-medium mb-4 ${titleCls}`}>Daily Cost Trend (30 days)</h4>
          <div className="flex items-end gap-[2px]" style={{ height: "160px" }}>
            {trend.map((d, i) => {
              const cost = parseFloat(d.totalCost) || 0;
              const pct = Math.max((cost / maxCost) * 100, 2);
              const barH = Math.max(Math.round((pct / 100) * 160), 3);
              const dateStr = new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
              return (
                <div key={i} className="flex-1 flex items-end group relative" style={{ height: "160px" }} data-testid={`trend-bar-${i}`}>
                  <div className={`absolute -top-8 left-1/2 -translate-x-1/2 border rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 ${isDark ? "bg-slate-900 border-slate-600 text-white" : "bg-white border-gray-300 text-gray-900"}`}>{dateStr}: ${cost.toFixed(4)} | {d.eventCount} tasks</div>
                  <div className="w-full bg-violet-500 hover:bg-violet-400 rounded-t transition-all cursor-pointer" style={{ height: `${barH}px` }} />
                </div>
              );
            })}
          </div>
          <div className={`flex justify-between mt-2 text-xs ${mutedCls}`}>
            <span>{trend.length > 0 ? new Date(trend[0].date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}</span>
            <span>{trend.length > 0 ? new Date(trend[trend.length - 1].date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}</span>
          </div>
        </div>
      )}

      {trend.length > 0 && (
        <div className={`${panelCls} p-5`} data-testid="token-trend-chart">
          <h4 className={`font-medium mb-4 ${titleCls}`}>Daily Token Usage</h4>
          <div className="flex items-end gap-[2px]" style={{ height: "128px" }}>
            {trend.map((d, i) => {
              const tokens = d.totalTokens || 0;
              const pct = Math.max((tokens / maxTokens) * 100, 2);
              const barH = Math.max(Math.round((pct / 100) * 128), 3);
              const dateStr = new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
              return (
                <div key={i} className="flex-1 flex items-end group relative" style={{ height: "128px" }}>
                  <div className={`absolute -top-8 left-1/2 -translate-x-1/2 border rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 ${isDark ? "bg-slate-900 border-slate-600 text-white" : "bg-white border-gray-300 text-gray-900"}`}>{dateStr}: {tokens.toLocaleString()} tokens</div>
                  <div className="w-full bg-blue-500 hover:bg-blue-400 rounded-t transition-all cursor-pointer" style={{ height: `${barH}px` }} />
                </div>
              );
            })}
          </div>
          <div className={`flex justify-between mt-2 text-xs ${mutedCls}`}>
            <span>{new Date(trend[0].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            <span>{new Date(trend[trend.length - 1].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          </div>
        </div>
      )}

      {recentEvents.length > 0 && (
        <div className={`${panelCls} p-5`} data-testid="recent-events">
          <h4 className={`font-medium mb-4 ${titleCls}`}>Recent Events</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${borderCls} ${subtitleCls}`}>
                  <th className="text-left py-2 pr-3">Time</th><th className="text-left py-2 pr-3">Type</th><th className="text-left py-2 pr-3">Model</th><th className="text-right py-2 pr-3">Tokens</th><th className="text-right py-2 pr-3">Cost</th><th className="text-right py-2 pr-3">Latency</th><th className="text-left py-2">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map(e => (
                  <tr key={e.id} className={`border-b ${rowBorderCls} ${hoverCls}`} data-testid={`event-row-${e.id}`}>
                    <td className={`py-2 pr-3 whitespace-nowrap ${subtitleCls}`}>{new Date(e.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className={`py-2 pr-3 ${bodyCls}`}>{e.eventType}</td>
                    <td className={`py-2 pr-3 font-mono text-xs ${bodyCls}`}>{e.model}</td>
                    <td className={`py-2 pr-3 text-right ${bodyCls}`}>{(e.totalTokens || 0).toLocaleString()}</td>
                    <td className={`py-2 pr-3 text-right ${bodyCls}`}>${parseFloat(e.costUsd || "0").toFixed(4)}</td>
                    <td className={`py-2 pr-3 text-right ${bodyCls}`}>{e.latencyMs ? `${e.latencyMs}ms` : "-"}</td>
                    <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${e.taskOutcome === "success" ? "bg-emerald-500/20 text-emerald-400" : e.taskOutcome === "failure" ? "bg-red-500/20 text-red-400" : "bg-slate-500/20 text-slate-400"}`}>{e.taskOutcome || "n/a"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {trend.length === 0 && recentEvents.length === 0 && (
        <div className={`text-center py-12 border rounded-xl ${isDark ? "bg-slate-800/30 border-slate-700/50" : "bg-gray-50 border-gray-200"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`mx-auto mb-3 ${isDark ? "text-slate-600" : "text-gray-400"}`}><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
          <p className={subtitleCls}>No usage data yet</p>
          <p className={`text-sm mt-1 ${mutedCls}`}>Usage data will appear once telemetry events are ingested for this agent</p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color, testId, isDark }: { label: string; value: string; color?: string; testId: string; isDark: boolean }) {
  return (
    <div className={`border rounded-xl p-4 ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`} data-testid={testId}>
      <p className={`text-xs uppercase tracking-wider mb-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>{label}</p>
      <p className={`text-xl font-bold ${color || (isDark ? "text-white" : "text-gray-900")}`}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value, testId, isDark }: { label: string; value: string; testId: string; isDark: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 border-b last:border-0 ${isDark ? "border-slate-700/30" : "border-gray-100"}`}>
      <span className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>{label}</span>
      <span className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`} data-testid={testId}>{value}</span>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
