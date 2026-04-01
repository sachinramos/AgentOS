import { useState, useEffect, useCallback } from "react";
import { aosApi } from "../lib/api";
import AgentOSLogo from "../components/AgentOSLogo";
import { useAosTheme } from "../AgentOSApp";

interface AgentListItem {
  id: string;
  uid: string;
  name: string;
  role: string | null;
  provider: string;
  llmModel: string;
  status: string;
  skills: string[];
  tools: string[];
  avatarUrl: string | null;
  riskScore: number | null;
  createdAt: string;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
}

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const STATUS_COLORS: Record<string, string> = {
  onboarding: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  suspended: "bg-red-500/20 text-red-400 border-red-500/30",
  retired: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

import { PROVIDER_MODELS, DEFAULT_MODEL } from "../lib/models";
const LLM_MODELS = PROVIDER_MODELS;

interface CreateAgentForm {
  name: string;
  role: string;
  description: string;
  departmentId: string;
  provider: string;
  llmModel: string;
  skills: string;
  tools: string;
  ownerId: string;
  monthlyCap: string;
  apiKey: string;
}

export default function AgentDirectory({ onNavigate, userRole }: { onNavigate?: (page: string) => void; userRole?: string }) {
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAgentForm>({
    name: "", role: "", description: "", departmentId: "", provider: "OpenAI", llmModel: DEFAULT_MODEL, skills: "", tools: "", ownerId: "", monthlyCap: "", apiKey: "",
  });
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (providerFilter) params.provider = providerFilter;
      if (departmentFilter) params.departmentId = departmentFilter;
      if (ownerFilter) params.ownerId = ownerFilter;
      const result = await aosApi.getAgents(params);
      const agentsList = Array.isArray(result) ? result : (result.agents || []);
      setAgents(agentsList);
      setTotal(Array.isArray(result) ? agentsList.length : (result.total || agentsList.length));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, providerFilter, departmentFilter, ownerFilter]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  useEffect(() => {
    aosApi.getDepartments().then(setDepartments).catch(() => {});
    aosApi.getUsers().then(setUsers).catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);
    try {
      const created = await aosApi.createAgent({
        name: createForm.name,
        role: createForm.role,
        description: createForm.description,
        provider: createForm.provider,
        llmModel: createForm.llmModel,
        skills: createForm.skills ? createForm.skills.split(",").map(s => s.trim()).filter(Boolean) : [],
        tools: createForm.tools ? createForm.tools.split(",").map(s => s.trim()).filter(Boolean) : [],
        departmentId: createForm.departmentId || undefined,
        ownerId: createForm.ownerId || undefined,
        monthlyCap: createForm.monthlyCap || undefined,
        apiKey: createForm.apiKey.trim(),
      }) as { id: string };
      if (avatarFile && created?.id) {
        try {
          await aosApi.uploadAgentAvatar(created.id, avatarFile);
        } catch (avatarErr) {
          console.warn("Agent created but avatar upload failed:", avatarErr);
          setCreateError("Agent created successfully, but avatar upload failed. You can add it later from the agent detail page.");
          setCreateLoading(false);
          fetchAgents();
          return;
        }
      }
      setShowCreate(false);
      setCreateForm({ name: "", role: "", description: "", departmentId: "", provider: "OpenAI", llmModel: DEFAULT_MODEL, skills: "", tools: "", ownerId: "", monthlyCap: "", apiKey: "" });
      setAvatarFile(null);
      setAvatarPreview(null);
      fetchAgents();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setCreateLoading(false);
    }
  };

  const inputCls = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${isDark ? "bg-slate-800/50 border-slate-700 text-white placeholder-slate-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"}`;
  const selectCls = `px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${isDark ? "bg-slate-800/50 border-slate-700 text-white" : "bg-white border-gray-300 text-gray-900"}`;

  return (
    <div className="space-y-6" data-testid="agent-directory-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`} data-testid="text-directory-title">Agent Directory</h1>
          <p className={`mt-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>{total} agent{total !== 1 ? "s" : ""} registered</p>
        </div>
        {userRole !== "viewer" && (
          <button
            data-testid="button-register-agent"
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            Register Agent
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          data-testid="input-search-agents"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search agents..."
          className={`${inputCls} w-64`}
        />
        <select data-testid="select-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
          <option value="">All Statuses</option>
          <option value="onboarding">Onboarding</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="retired">Retired</option>
        </select>
        <select data-testid="select-provider-filter" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} className={selectCls}>
          <option value="">All Providers</option>
          {Object.keys(LLM_MODELS).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select data-testid="select-department-filter" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className={selectCls}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select data-testid="select-owner-filter" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className={selectCls}>
          <option value="">All Owners</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : agents.length === 0 ? (
        <div className={`text-center py-16 rounded-xl border ${isDark ? "bg-slate-800/30 border-slate-700/50" : "bg-gray-50 border-gray-200"}`}>
          <div className="flex justify-center mb-4">
            <AgentOSLogo size={48} className="text-violet-400" />
          </div>
          <h3 className={`font-semibold text-lg mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>No agents found</h3>
          <p className={`text-sm mb-4 ${isDark ? "text-slate-400" : "text-gray-500"}`}>
            {search || statusFilter || providerFilter || departmentFilter || ownerFilter ? "Try adjusting your filters" : "Register your first AI agent to get started"}
          </p>
          {!search && !statusFilter && !providerFilter && !departmentFilter && !ownerFilter && (
            <button data-testid="button-register-first-agent" onClick={() => setShowCreate(true)} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors">
              Register First Agent
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {agents.map(agent => (
            <div
              key={agent.id}
              data-testid={`card-agent-${agent.id}`}
              onClick={() => onNavigate?.(`agents/${agent.id}`)}
              className={`rounded-xl p-5 cursor-pointer transition-all group border ${isDark ? "bg-slate-800/50 border-slate-700/50 hover:border-violet-500/30" : "bg-white border-gray-200 hover:border-violet-400/40 hover:shadow-sm"}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {agent.avatarUrl ? (
                    <img src={agent.avatarUrl} alt={agent.name} className="w-10 h-10 rounded-lg object-cover border border-violet-500/30" data-testid={`img-agent-avatar-${agent.id}`} />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 font-bold">
                      {agent.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h3 className={`font-medium group-hover:text-violet-300 transition-colors ${isDark ? "text-white" : "text-gray-900"}`}>{agent.name}</h3>
                    <p className={`text-xs font-mono ${isDark ? "text-slate-500" : "text-gray-400"}`}>{agent.uid}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLORS[agent.status]}`}>
                  {agent.status}
                </span>
              </div>
              {agent.role && <p className={`text-sm mb-2 ${isDark ? "text-slate-400" : "text-gray-500"}`}>{agent.role}</p>}
              <div className={`flex items-center gap-2 text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}>
                <span className={`px-2 py-0.5 rounded ${isDark ? "bg-slate-700/50" : "bg-gray-100"}`}>{agent.provider}</span>
                <span className={`px-2 py-0.5 rounded ${isDark ? "bg-slate-700/50" : "bg-gray-100"}`}>{agent.llmModel}</span>
                {agent.riskScore !== null && agent.riskScore !== undefined && (
                  <span data-testid={`risk-badge-${agent.id}`} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    agent.riskScore <= 40
                      ? "bg-emerald-500/20 text-emerald-400"
                      : agent.riskScore <= 70
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-red-500/20 text-red-400"
                  }`}>
                    Risk: {agent.riskScore}
                  </span>
                )}
              </div>
              {agent.skills?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {agent.skills.slice(0, 3).map((s: string) => (
                    <span key={s} className="text-xs px-1.5 py-0.5 bg-violet-500/10 text-violet-400 rounded">{s}</span>
                  ))}
                  {agent.skills.length > 3 && <span className={`text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}>+{agent.skills.length - 3}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`rounded-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto border ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200"}`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Register New Agent</h2>
              <button data-testid="button-close-create" onClick={() => setShowCreate(false)} className={isDark ? "text-slate-400 hover:text-white" : "text-gray-400 hover:text-gray-600"}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {createError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm">{createError}</div>}

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}>Agent Avatar</label>
                <div className="flex items-center gap-4">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-violet-500/30" data-testid="img-create-avatar-preview" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xl font-bold">
                      {createForm.name ? createForm.name.charAt(0) : "?"}
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      data-testid="input-agent-avatar"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setAvatarFile(file);
                          setAvatarPreview(URL.createObjectURL(file));
                        }
                      }}
                      className={`block w-full text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-600 file:text-white hover:file:bg-violet-500 file:cursor-pointer ${isDark ? "text-slate-400" : "text-gray-500"}`}
                    />
                    {avatarFile && (
                      <button type="button" data-testid="button-remove-create-avatar" onClick={() => { setAvatarFile(null); setAvatarPreview(null); }} className="text-xs text-red-400 hover:text-red-300 mt-1">Remove</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}>Agent Name *</label>
                  <input data-testid="input-agent-name" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="e.g. Support Bot Alpha" required />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}>Role</label>
                  <input data-testid="input-agent-role" value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))} className={inputCls} placeholder="e.g. Customer Support" />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}>Description</label>
                <input data-testid="input-agent-description" value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} className={inputCls} placeholder="What does this agent do?" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}>Provider *</label>
                  <select data-testid="select-agent-provider" value={createForm.provider} onChange={e => setCreateForm(f => ({ ...f, provider: e.target.value, llmModel: LLM_MODELS[e.target.value]?.[0] || "" }))} className={`${selectCls} w-full`}>
                    {Object.keys(LLM_MODELS).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}>LLM Model *</label>
                  <select data-testid="select-agent-model" value={createForm.llmModel} onChange={e => setCreateForm(f => ({ ...f, llmModel: e.target.value }))} className={`${selectCls} w-full`}>
                    {(LLM_MODELS[createForm.provider] || []).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}>Department</label>
                  <select data-testid="select-agent-department" value={createForm.departmentId} onChange={e => setCreateForm(f => ({ ...f, departmentId: e.target.value }))} className={`${selectCls} w-full`}>
                    <option value="">None</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}>Owner</label>
                  <select data-testid="select-agent-owner" value={createForm.ownerId} onChange={e => setCreateForm(f => ({ ...f, ownerId: e.target.value }))} className={`${selectCls} w-full`}>
                    <option value="">Self</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}>Monthly Budget Cap ($)</label>
                <input data-testid="input-agent-monthly-cap" type="number" step="1" min="0" value={createForm.monthlyCap} onChange={e => setCreateForm(f => ({ ...f, monthlyCap: e.target.value }))} className={inputCls} placeholder="e.g. 500 (leave empty for no limit)" />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}>Provider API Key <span className="text-red-500">*</span></label>
                <input data-testid="input-agent-create-api-key" type="password" value={createForm.apiKey} onChange={e => setCreateForm(f => ({ ...f, apiKey: e.target.value }))} className={inputCls} placeholder="sk-... (encrypted at rest, minimum 8 characters)" />
                <p className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-gray-400"}`}>Required. The API key for this agent's LLM provider. Stored encrypted.</p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}>Skills (comma-separated)</label>
                <input data-testid="input-agent-skills" value={createForm.skills} onChange={e => setCreateForm(f => ({ ...f, skills: e.target.value }))} className={inputCls} placeholder="e.g. NLP, Code Review, Data Analysis" />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`}>Tools / APIs (comma-separated)</label>
                <input data-testid="input-agent-tools" value={createForm.tools} onChange={e => setCreateForm(f => ({ ...f, tools: e.target.value }))} className={inputCls} placeholder="e.g. Slack API, GitHub, JIRA" />
              </div>

              <div className="flex gap-3 pt-2">
                <button data-testid="button-cancel-create" type="button" onClick={() => setShowCreate(false)} className={`flex-1 py-2 rounded-lg transition-colors ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}>Cancel</button>
                <button data-testid="button-submit-agent" type="submit" disabled={createLoading || createForm.apiKey.trim().length < 8} className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                  {createLoading ? "Registering..." : "Register Agent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
