import { useState, useEffect, useCallback } from "react";
import { aosGet, aosPost, aosPut, aosDelete } from "../lib/api";
import { Key, Shield, Plus, Trash2, Copy, Check, Building2, Save, AlertCircle, Play } from "lucide-react";
import { useAosTheme } from "../AgentOSApp";

type StatusMsg = { type: "success" | "error"; text: string } | null;

function StatusBanner({ status, onDismiss }: { status: StatusMsg; onDismiss: () => void }) {
  if (!status) return null;
  const isError = status.type === "error";
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm mb-4 ${isError ? "bg-red-500/10 border border-red-500/30 text-red-400" : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"}`}
      data-testid="status-banner"
    >
      {isError ? <AlertCircle size={14} /> : <Check size={14} />}
      <span className="flex-1">{status.text}</span>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100">✕</button>
    </div>
  );
}

export default function Settings({ onShowProductTour }: { onShowProductTour?: () => void }) {
  const [activeTab, setActiveTab] = useState<"certification" | "apikeys" | "departments">("certification");
  const [certConfig, setCertConfig] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusMsg>(null);
  const [saving, setSaving] = useState(false);
  const [peopleosLinked, setPeopleosLinked] = useState(false);
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  const flash = useCallback((type: "success" | "error", text: string) => {
    setStatus({ type, text });
    if (type === "success") {
      setTimeout(() => setStatus(null), 3000);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      aosGet("/certification/config").catch(() => null),
      aosGet("/api-keys").catch(() => []),
      aosGet("/departments").catch(() => []),
      aosGet("/auth/me").catch(() => null),
    ]).then(([c, k, d, me]) => {
      setCertConfig(c);
      setApiKeys(Array.isArray(k) ? k : []);
      setDepartments(Array.isArray(d) ? d : []);
      if (me?.company?.peopleosLinked) setPeopleosLinked(true);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setStatus(null);
  }, [activeTab]);

  const getErrorMsg = (err: unknown, fallback: string): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === "object" && err !== null && "message" in err) return String((err as { message: unknown }).message);
    return fallback;
  };

  const saveCertConfig = async () => {
    setSaving(true);
    try {
      const updated = await aosPut("/certification/config", certConfig);
      setCertConfig(updated);
      flash("success", "Certification configuration saved");
    } catch (err: unknown) {
      flash("error", getErrorMsg(err, "Failed to save certification config"));
    } finally {
      setSaving(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const result = await aosPost("/api-keys", { name: newKeyName.trim() });
      setNewKey(result.key);
      setNewKeyName("");
      const keys = await aosGet("/api-keys");
      setApiKeys(Array.isArray(keys) ? keys : []);
      flash("success", "API key created — copy it now, it won't be shown again");
    } catch (err: unknown) {
      flash("error", getErrorMsg(err, "Failed to create API key"));
    }
  };

  const deleteApiKey = async (id: string) => {
    try {
      await aosDelete(`/api-keys/${id}`);
      const keys = await aosGet("/api-keys");
      setApiKeys(Array.isArray(keys) ? keys : []);
      flash("success", "API key deactivated");
    } catch (err: unknown) {
      flash("error", getErrorMsg(err, "Failed to delete API key"));
    }
  };

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const createDepartment = async () => {
    if (!newDeptName.trim()) return;
    try {
      await aosPost("/departments", {
        name: newDeptName.trim(),
      });
      setNewDeptName("");
      const d = await aosGet("/departments");
      setDepartments(Array.isArray(d) ? d : []);
      flash("success", "Department created");
    } catch (err: unknown) {
      flash("error", getErrorMsg(err, "Failed to create department"));
    }
  };

  const deleteDepartment = async (id: string) => {
    try {
      await aosDelete(`/departments/${id}`);
      const d = await aosGet("/departments");
      setDepartments(Array.isArray(d) ? d : []);
      flash("success", "Department deleted");
    } catch (err: unknown) {
      flash("error", getErrorMsg(err, "Failed to delete department"));
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full" /></div>;
  }

  const panelCls = `rounded-xl p-6 border ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`;
  const inputCls = `w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 border ${isDark ? "bg-slate-700/50 border-slate-600/50 text-white" : "bg-white border-gray-300 text-gray-900"}`;
  const rowCls = `flex items-center justify-between rounded-lg px-4 py-3 ${isDark ? "bg-slate-700/30" : "bg-gray-50"}`;

  return (
    <div className="space-y-6" data-testid="aos-settings">
      <div className="flex items-start justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`} data-testid="text-settings-title">Settings</h1>
          <p className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>Configure certification, API keys, and departments</p>
        </div>
        {onShowProductTour && (
          <button
            onClick={onShowProductTour}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? "bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700" : "bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200 border border-gray-200"}`}
            data-testid="button-watch-demo"
          >
            <Play size={14} />
            Watch Demo
          </button>
        )}
      </div>

      {peopleosLinked && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-200"}`} data-testid="peopleos-linked-banner">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? "bg-emerald-500/20" : "bg-emerald-100"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>PeopleOS Connected</p>
            <p className={`text-xs ${isDark ? "text-slate-500" : "text-gray-500"}`}>This AgentOS account is linked to your PeopleOS organization. HR AI agents are being tracked.</p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"}`}>Active</span>
        </div>
      )}

      <div className="flex gap-2">
        {(["certification", "apikeys", "departments"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? "bg-violet-600 text-white" : isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-gray-100 text-gray-500 hover:text-gray-900"}`}
            data-testid={`tab-${tab}`}>
            {tab === "certification" && <Shield className="inline w-4 h-4 mr-1" />}
            {tab === "apikeys" && <Key className="inline w-4 h-4 mr-1" />}
            {tab === "departments" && <Building2 className="inline w-4 h-4 mr-1" />}
            {tab === "certification" ? "Certification" : tab === "apikeys" ? "API Keys" : "Departments"}
          </button>
        ))}
      </div>

      <StatusBanner status={status} onDismiss={() => setStatus(null)} />

      {activeTab === "certification" && certConfig && (
        <div className={panelCls} data-testid="certification-config">
          <h3 className={`font-medium mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>Certification Thresholds</h3>
          <p className={`text-sm mb-6 ${isDark ? "text-slate-400" : "text-gray-500"}`}>Agents must meet all thresholds during their probation period to earn "Certified" status.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={`block text-xs mb-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>Min Success Rate (%)</label>
              <input type="number" step="1" min="0" max="100" value={certConfig.minSuccessRate ?? 90}
                onChange={e => setCertConfig({ ...certConfig, minSuccessRate: parseFloat(e.target.value) })}
                className={inputCls} data-testid="input-min-success-rate" />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>Max Avg Latency (ms)</label>
              <input type="number" value={certConfig.maxAvgLatencyMs ?? 5000}
                onChange={e => setCertConfig({ ...certConfig, maxAvgLatencyMs: parseInt(e.target.value) })}
                className={inputCls} data-testid="input-max-latency" />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>Min Accuracy Score (%)</label>
              <input type="number" step="1" min="0" max="100" value={certConfig.minAccuracyScore ?? 85}
                onChange={e => setCertConfig({ ...certConfig, minAccuracyScore: parseFloat(e.target.value) })}
                className={inputCls} data-testid="input-min-accuracy" />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>Min Human Rating (1-5)</label>
              <input type="number" step="0.1" min="1" max="5" value={certConfig.minHumanRating ?? 3.5}
                onChange={e => setCertConfig({ ...certConfig, minHumanRating: parseFloat(e.target.value) })}
                className={inputCls} data-testid="input-min-rating" />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>Probation Period (days)</label>
              <input type="number" min="1" value={certConfig.probationDays ?? 30}
                onChange={e => setCertConfig({ ...certConfig, probationDays: parseInt(e.target.value) })}
                className={inputCls} data-testid="input-probation-days" />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>Min Task Count</label>
              <input type="number" min="1" value={certConfig.minTaskCount ?? 50}
                onChange={e => setCertConfig({ ...certConfig, minTaskCount: parseInt(e.target.value) })}
                className={inputCls} data-testid="input-min-tasks" />
            </div>
          </div>
          <button onClick={saveCertConfig} disabled={saving}
            className="mt-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
            data-testid="button-save-cert-config">
            <Save size={16} /> {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      )}

      {activeTab === "apikeys" && (
        <div className={panelCls} data-testid="api-keys-section">
          <h3 className={`font-medium mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>API Keys</h3>
          <p className={`text-sm mb-4 ${isDark ? "text-slate-400" : "text-gray-500"}`}>Generate API keys for external systems to push telemetry data to the <code className="text-violet-400">/api/agentos/telemetry</code> endpoint.</p>

          {newKey && (
            <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-4 mb-4" data-testid="new-key-display">
              <p className="text-violet-400 text-sm font-medium mb-2">New API Key Created — Copy it now, it won't be shown again!</p>
              <div className="flex items-center gap-2">
                <code className={`flex-1 rounded px-3 py-2 text-sm font-mono break-all ${isDark ? "bg-slate-900 text-white" : "bg-gray-100 text-gray-900"}`} data-testid="text-raw-key">{newKey}</code>
                <button onClick={copyKey} className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1"
                  data-testid="button-copy-key">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name..."
              onKeyDown={e => e.key === "Enter" && createApiKey()}
              className={`flex-1 ${inputCls}`}
              data-testid="input-api-key-name" />
            <button onClick={createApiKey}
              className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
              data-testid="button-create-api-key">
              <Plus size={14} /> Generate
            </button>
          </div>

          <div className="space-y-2">
            {apiKeys.map((key: any) => (
              <div key={key.id} className={rowCls} data-testid={`api-key-${key.id}`}>
                <div>
                  <span className={`text-sm ${isDark ? "text-white" : "text-gray-900"}`}>{key.name}</span>
                  <span className={`text-xs ml-3 ${isDark ? "text-slate-500" : "text-gray-400"}`}>{key.prefix}...****</span>
                  {key.lastUsedAt && <span className={`text-xs ml-3 ${isDark ? "text-slate-500" : "text-gray-400"}`}>Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</span>}
                </div>
                <button onClick={() => deleteApiKey(key.id)} className={`p-1 ${isDark ? "text-slate-400 hover:text-red-400" : "text-gray-400 hover:text-red-500"}`}
                  data-testid={`button-delete-key-${key.id}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {apiKeys.length === 0 && <p className={`text-sm ${isDark ? "text-slate-500" : "text-gray-400"}`}>No API keys yet</p>}
          </div>
        </div>
      )}

      {activeTab === "departments" && (
        <div className={panelCls} data-testid="departments-section">
          <h3 className={`font-medium mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>Departments</h3>
          <div className="flex gap-2 mb-4">
            <div className="flex-1 min-w-0">
              <input value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="Department name..."
                onKeyDown={e => e.key === "Enter" && createDepartment()}
                className={`rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-1 focus:ring-violet-500 border ${isDark ? "bg-slate-700/50 border-slate-600/50 text-white placeholder:text-slate-500" : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"}`}
                data-testid="input-dept-name" />
            </div>
            <button onClick={createDepartment}
              className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 shrink-0"
              data-testid="button-create-dept">
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="space-y-2">
            {departments.map((dept: any) => (
              <div key={dept.id} className={rowCls} data-testid={`dept-${dept.id}`}>
                <div>
                  <span className={`text-sm ${isDark ? "text-white" : "text-gray-900"}`}>{dept.name}</span>
                </div>
                <button onClick={() => deleteDepartment(dept.id)} className={`p-1 ${isDark ? "text-slate-400 hover:text-red-400" : "text-gray-400 hover:text-red-500"}`}
                  data-testid={`button-delete-dept-${dept.id}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {departments.length === 0 && <p className={`text-sm ${isDark ? "text-slate-500" : "text-gray-400"}`}>No departments yet</p>}
          </div>
        </div>
      )}
    </div>
  );
}
