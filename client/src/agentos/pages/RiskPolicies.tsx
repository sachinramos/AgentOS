import { useState, useEffect, useCallback } from "react";
import { aosApi } from "../lib/api";
import { useAosTheme } from "../AgentOSApp";

interface RiskDistribution {
  buckets: { range: string; count: number; agents: { id: string; name: string; score: number }[] }[];
  avgScore: number;
  highRiskCount: number;
}

interface PolicyRule {
  id: string;
  name: string;
  description: string | null;
  conditionField: string;
  operator: string;
  threshold: string;
  secondaryField: string | null;
  secondaryOperator: string | null;
  secondaryThreshold: string | null;
  actionType: string;
  severity: string;
  isActive: boolean;
  createdAt: string;
}

interface PolicyViolation {
  id: string;
  policyName: string;
  agentName?: string;
  conditionField: string;
  actualValue: string;
  threshold: string;
  actionTaken: string;
  severity: string;
  status: string;
  createdAt: string;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

const CONDITION_FIELDS = [
  { value: "risk_score", label: "Risk Score" },
  { value: "failure_rate", label: "Failure Rate (%)" },
  { value: "pii_exposure", label: "PII Exposure" },
  { value: "drift_alerts", label: "Drift Alerts" },
  { value: "autonomy_level", label: "Autonomy Level" },
  { value: "monthly_cost", label: "Monthly Cost ($)" },
  { value: "status", label: "Status" },
  { value: "environment", label: "Environment" },
];

const OPERATORS = [
  { value: ">", label: ">" },
  { value: ">=", label: ">=" },
  { value: "<", label: "<" },
  { value: "<=", label: "<=" },
  { value: "==", label: "==" },
  { value: "!=", label: "!=" },
];

const ACTION_TYPES = [
  { value: "alert", label: "Alert Only" },
  { value: "suspend", label: "Auto-Suspend" },
];

const SEVERITIES = [
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
];

let toastId = 0;

export default function RiskPolicies({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [tab, setTab] = useState<"overview" | "policies" | "violations">("overview");
  const [distribution, setDistribution] = useState<RiskDistribution | null>(null);
  const [policies, setPolicies] = useState<PolicyRule[]>([]);
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);
  const [previewMatches, setPreviewMatches] = useState<{ id: string; name: string; riskScore: number | null; matchValue: string }[] | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  const [newPolicy, setNewPolicy] = useState({
    name: "",
    description: "",
    conditionField: "risk_score",
    operator: ">",
    threshold: "75",
    secondaryField: "",
    secondaryOperator: ">",
    secondaryThreshold: "",
    actionType: "alert",
    severity: "warning",
  });

  const addToast = useCallback((message: string, type: Toast["type"]) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchData = async () => {
    try {
      const [dist, pols, viols] = await Promise.all([
        aosApi.getFleetRiskDistribution(),
        aosApi.getPolicyRules(),
        aosApi.getPolicyViolations(),
      ]);
      setDistribution(dist);
      setPolicies(pols || []);
      setViolations(viols || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const result = await aosApi.recalculateRiskScores();
      addToast(`Risk scores recalculated for ${result.updated} agents`, "success");
      await fetchData();
    } catch (err) {
      addToast("Failed to recalculate risk scores", "error");
    } finally {
      setRecalculating(false);
    }
  };

  const handlePreview = async () => {
    try {
      const result = await aosApi.previewPolicyRule({
        conditionField: newPolicy.conditionField,
        operator: newPolicy.operator,
        threshold: newPolicy.threshold,
        ...(newPolicy.secondaryField ? {
          secondaryField: newPolicy.secondaryField,
          secondaryOperator: newPolicy.secondaryOperator,
          secondaryThreshold: newPolicy.secondaryThreshold,
        } : {}),
      });
      setPreviewMatches(result.matches || []);
    } catch {
      addToast("Preview failed", "error");
    }
  };

  const handleCreatePolicy = async () => {
    try {
      await aosApi.createPolicyRule({
        name: newPolicy.name,
        description: newPolicy.description || undefined,
        conditionField: newPolicy.conditionField,
        operator: newPolicy.operator,
        threshold: newPolicy.threshold,
        ...(newPolicy.secondaryField ? {
          secondaryField: newPolicy.secondaryField,
          secondaryOperator: newPolicy.secondaryOperator,
          secondaryThreshold: newPolicy.secondaryThreshold,
        } : {}),
        actionType: newPolicy.actionType,
        severity: newPolicy.severity,
      });
      addToast("Policy created successfully", "success");
      setShowCreatePolicy(false);
      setNewPolicy({ name: "", description: "", conditionField: "risk_score", operator: ">", threshold: "75", secondaryField: "", secondaryOperator: ">", secondaryThreshold: "", actionType: "alert", severity: "warning" });
      setPreviewMatches(null);
      await fetchData();
    } catch {
      addToast("Failed to create policy", "error");
    }
  };

  const handleTogglePolicy = async (id: string, isActive: boolean) => {
    try {
      await aosApi.updatePolicyRule(id, { isActive: !isActive });
      await fetchData();
    } catch {
      addToast("Failed to update policy", "error");
    }
  };

  const handleDeletePolicy = async (id: string) => {
    try {
      await aosApi.deletePolicyRule(id);
      addToast("Policy deleted", "success");
      await fetchData();
    } catch {
      addToast("Failed to delete policy", "error");
    }
  };

  const handleResolveViolation = async (id: string) => {
    try {
      await aosApi.resolvePolicyViolation(id);
      addToast("Violation resolved", "success");
      await fetchData();
    } catch {
      addToast("Failed to resolve violation", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const panelCls = `border rounded-xl ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`;
  const titleCls = isDark ? "text-white" : "text-gray-900";
  const subtitleCls = isDark ? "text-slate-400" : "text-gray-500";
  const mutedCls = isDark ? "text-slate-500" : "text-gray-400";
  const inputCls = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm ${isDark ? "bg-slate-800/50 border-slate-700 text-white" : "bg-white border-gray-300 text-gray-900"}`;
  const selectCls = `px-3 py-2 border rounded-lg text-sm focus:outline-none ${isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-gray-300 text-gray-700"}`;

  const maxBucket = Math.max(...(distribution?.buckets?.map(b => b.count) || [1]));
  const openViolations = violations.filter(v => v.status === "open");

  return (
    <div className="space-y-6" data-testid="risk-policies-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${titleCls}`} data-testid="text-risk-title">Risk & Policies</h1>
            <p className={`mt-0.5 text-sm ${subtitleCls}`}>Fleet risk distribution and automated policy enforcement</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="button-recalculate"
            onClick={handleRecalculate}
            disabled={recalculating}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {recalculating ? (
              <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Recalculating...</>
            ) : (
              <><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>Recalculate All</>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`${panelCls} p-5`} data-testid="stat-avg-risk">
          <p className={`text-xs ${subtitleCls}`}>Average Risk Score</p>
          <div className="flex items-center gap-2 mt-1">
            <p className={`text-3xl font-bold ${titleCls}`}>{distribution?.avgScore ?? 0}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRiskBadgeColor(distribution?.avgScore ?? 0, isDark)}`}>
              {getRiskLabel(distribution?.avgScore ?? 0)}
            </span>
          </div>
        </div>
        <div className={`${panelCls} p-5`} data-testid="stat-high-risk">
          <p className={`text-xs ${subtitleCls}`}>High Risk Agents</p>
          <p className={`text-3xl font-bold ${(distribution?.highRiskCount ?? 0) > 0 ? "text-red-400" : titleCls}`}>{distribution?.highRiskCount ?? 0}</p>
        </div>
        <div className={`${panelCls} p-5`} data-testid="stat-open-violations">
          <p className={`text-xs ${subtitleCls}`}>Open Violations</p>
          <p className={`text-3xl font-bold ${openViolations.length > 0 ? "text-amber-400" : titleCls}`}>{openViolations.length}</p>
        </div>
      </div>

      <div className="flex gap-1">
        {(["overview", "policies", "violations"] as const).map(t => (
          <button
            key={t}
            data-testid={`tab-${t}`}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? isDark ? "bg-violet-600/20 text-violet-400" : "bg-violet-50 text-violet-600"
                : isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            {t === "overview" ? "Risk Overview" : t === "policies" ? `Policies (${policies.length})` : `Violations (${openViolations.length})`}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className={`${panelCls} p-5`}>
            <h2 className={`text-lg font-semibold mb-4 ${titleCls}`} data-testid="text-distribution-title">Fleet Risk Distribution</h2>
            {distribution && distribution.buckets.some(b => b.count > 0) ? (
              <div className="space-y-2" data-testid="risk-histogram">
                {distribution.buckets.map(bucket => (
                  <div key={bucket.range} className="flex items-center gap-3" data-testid={`bucket-${bucket.range}`}>
                    <span className={`text-xs w-14 text-right font-mono ${mutedCls}`}>{bucket.range}</span>
                    <div className={`flex-1 h-7 rounded-md overflow-hidden ${isDark ? "bg-slate-700/50" : "bg-gray-100"}`}>
                      <div
                        className={`h-full rounded-md transition-all ${getBucketColor(bucket.range)} flex items-center px-2`}
                        style={{ width: `${maxBucket > 0 ? (bucket.count / maxBucket) * 100 : 0}%`, minWidth: bucket.count > 0 ? "24px" : "0" }}
                      >
                        {bucket.count > 0 && <span className="text-xs font-medium text-white">{bucket.count}</span>}
                      </div>
                    </div>
                    {bucket.agents.length > 0 && (
                      <div className="flex -space-x-1">
                        {bucket.agents.slice(0, 3).map(a => (
                          <div key={a.id} title={`${a.name} (${a.score})`} className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-white text-[10px] font-bold border-2 border-slate-900">
                            {a.name.charAt(0)}
                          </div>
                        ))}
                        {bucket.agents.length > 3 && (
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${isDark ? "bg-slate-700 border-slate-900 text-slate-300" : "bg-gray-200 border-white text-gray-600"}`}>
                            +{bucket.agents.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className={`text-sm ${mutedCls}`}>No risk scores calculated yet</p>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-600" : "text-gray-400"}`}>Click "Recalculate All" to compute risk scores for all agents</p>
              </div>
            )}
          </div>

          <div className={`${panelCls} p-5`}>
            <h2 className={`text-lg font-semibold mb-3 ${titleCls}`}>Risk Score Legend</h2>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className={`text-sm ${subtitleCls}`}>Low Risk (0-40)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className={`text-sm ${subtitleCls}`}>Medium Risk (41-70)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className={`text-sm ${subtitleCls}`}>High Risk (71-100)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "policies" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className={`text-lg font-semibold ${titleCls}`}>Policy Rules</h2>
            <button
              data-testid="button-create-policy"
              onClick={() => setShowCreatePolicy(true)}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Policy
            </button>
          </div>

          {policies.length > 0 ? (
            <div className="space-y-3">
              {policies.map(policy => (
                <div key={policy.id} className={`${panelCls} p-4`} data-testid={`policy-${policy.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${policy.isActive ? "bg-emerald-400" : "bg-slate-500"}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`font-medium text-sm ${titleCls}`}>{policy.name}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-semibold ${
                            policy.severity === "critical"
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}>{policy.severity}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-semibold ${
                            policy.actionType === "suspend"
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          }`}>{policy.actionType}</span>
                        </div>
                        <p className={`text-xs mt-0.5 ${mutedCls}`}>
                          IF {CONDITION_FIELDS.find(f => f.value === policy.conditionField)?.label || policy.conditionField} {policy.operator} {policy.threshold}
                          {policy.secondaryField && ` AND ${CONDITION_FIELDS.find(f => f.value === policy.secondaryField)?.label || policy.secondaryField} ${policy.secondaryOperator} ${policy.secondaryThreshold}`}
                        </p>
                        {policy.description && <p className={`text-xs mt-1 ${subtitleCls}`}>{policy.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        data-testid={`button-toggle-policy-${policy.id}`}
                        onClick={() => handleTogglePolicy(policy.id, policy.isActive)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          policy.isActive
                            ? isDark ? "bg-slate-700 hover:bg-slate-600 text-slate-300" : "bg-gray-200 hover:bg-gray-300 text-gray-600"
                            : "bg-emerald-600/80 hover:bg-emerald-500 text-white"
                        }`}
                      >
                        {policy.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        data-testid={`button-delete-policy-${policy.id}`}
                        onClick={() => handleDeletePolicy(policy.id)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`${panelCls} p-8 text-center`}>
              <p className={`text-sm ${mutedCls}`}>No policy rules defined</p>
              <p className={`text-xs mt-1 ${isDark ? "text-slate-600" : "text-gray-400"}`}>Create policies to automatically monitor and enforce governance rules</p>
            </div>
          )}
        </div>
      )}

      {tab === "violations" && (
        <div className="space-y-4">
          <h2 className={`text-lg font-semibold ${titleCls}`}>Policy Violations</h2>
          {violations.length > 0 ? (
            <div className="space-y-3">
              {violations.map(v => (
                <div key={v.id} className={`${panelCls} p-4`} data-testid={`violation-${v.id}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${v.status === "open" ? "bg-red-400 animate-pulse" : "bg-emerald-400"}`} />
                        <p className={`font-medium text-sm ${titleCls}`}>{v.policyName}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-semibold ${
                          v.severity === "critical"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        }`}>{v.severity}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-semibold ${
                          v.status === "open"
                            ? "bg-red-500/20 text-red-300"
                            : "bg-emerald-500/20 text-emerald-400"
                        }`}>{v.status}</span>
                      </div>
                      <p className={`text-xs mt-1 ${subtitleCls}`}>
                        Agent: <span className={titleCls}>{v.agentName || "Unknown"}</span> — {v.conditionField} is {v.actualValue} (threshold: {v.threshold})
                      </p>
                      <p className={`text-xs mt-0.5 ${mutedCls}`}>{new Date(v.createdAt).toLocaleString()} — Action: {v.actionTaken}</p>
                    </div>
                    {v.status === "open" && (
                      <button
                        data-testid={`button-resolve-${v.id}`}
                        onClick={() => handleResolveViolation(v.id)}
                        className="px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`${panelCls} p-8 text-center`}>
              <p className={`text-sm ${mutedCls}`}>No policy violations recorded</p>
              <p className={`text-xs mt-1 ${isDark ? "text-slate-600" : "text-gray-400"}`}>Violations appear when agents breach active policy rules</p>
            </div>
          )}
        </div>
      )}

      {showCreatePolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className={`border rounded-xl w-full max-w-lg p-6 shadow-2xl ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200"}`}>
            <h2 className={`text-lg font-semibold mb-4 ${titleCls}`}>Create Policy Rule</h2>

            <div className="space-y-3">
              <div>
                <label className={`block text-xs mb-1 ${subtitleCls}`}>Policy Name *</label>
                <input
                  data-testid="input-policy-name"
                  value={newPolicy.name}
                  onChange={e => setNewPolicy({ ...newPolicy, name: e.target.value })}
                  className={inputCls}
                  placeholder="e.g., High Risk PII Alert"
                />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${subtitleCls}`}>Description</label>
                <input
                  data-testid="input-policy-desc"
                  value={newPolicy.description}
                  onChange={e => setNewPolicy({ ...newPolicy, description: e.target.value })}
                  className={inputCls}
                  placeholder="Optional description"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={`block text-xs mb-1 ${subtitleCls}`}>Condition</label>
                  <select data-testid="select-condition" value={newPolicy.conditionField} onChange={e => setNewPolicy({ ...newPolicy, conditionField: e.target.value })} className={selectCls + " w-full"}>
                    {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${subtitleCls}`}>Operator</label>
                  <select data-testid="select-operator" value={newPolicy.operator} onChange={e => setNewPolicy({ ...newPolicy, operator: e.target.value })} className={selectCls + " w-full"}>
                    {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${subtitleCls}`}>Threshold</label>
                  <input data-testid="input-threshold" value={newPolicy.threshold} onChange={e => setNewPolicy({ ...newPolicy, threshold: e.target.value })} className={inputCls} />
                </div>
              </div>

              <div className={`text-xs ${mutedCls}`}>Optional: Add a secondary condition (AND)</div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <select data-testid="select-secondary-condition" value={newPolicy.secondaryField} onChange={e => setNewPolicy({ ...newPolicy, secondaryField: e.target.value })} className={selectCls + " w-full"}>
                    <option value="">None</option>
                    {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <select value={newPolicy.secondaryOperator} onChange={e => setNewPolicy({ ...newPolicy, secondaryOperator: e.target.value })} className={selectCls + " w-full"} disabled={!newPolicy.secondaryField}>
                    {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <input value={newPolicy.secondaryThreshold} onChange={e => setNewPolicy({ ...newPolicy, secondaryThreshold: e.target.value })} className={inputCls} disabled={!newPolicy.secondaryField} placeholder="Value" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block text-xs mb-1 ${subtitleCls}`}>Action</label>
                  <select data-testid="select-action" value={newPolicy.actionType} onChange={e => setNewPolicy({ ...newPolicy, actionType: e.target.value })} className={selectCls + " w-full"}>
                    {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${subtitleCls}`}>Severity</label>
                  <select data-testid="select-severity" value={newPolicy.severity} onChange={e => setNewPolicy({ ...newPolicy, severity: e.target.value })} className={selectCls + " w-full"}>
                    {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <button
                data-testid="button-preview-policy"
                onClick={handlePreview}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? "bg-slate-700 hover:bg-slate-600 text-slate-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
              >
                Preview: Which agents would match?
              </button>

              {previewMatches !== null && (
                <div className={`p-3 rounded-lg border text-sm ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-gray-50 border-gray-200"}`}>
                  <p className={`font-medium mb-1 ${titleCls}`}>{previewMatches.length} agent{previewMatches.length !== 1 ? "s" : ""} would match</p>
                  {previewMatches.length > 0 ? (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {previewMatches.map(m => (
                        <div key={m.id} className={`flex items-center justify-between text-xs ${subtitleCls}`}>
                          <span>{m.name}</span>
                          <span className="font-mono">value: {m.matchValue}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-xs ${mutedCls}`}>No agents currently match this condition</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                data-testid="button-cancel-policy"
                onClick={() => { setShowCreatePolicy(false); setPreviewMatches(null); }}
                className={`flex-1 py-2.5 rounded-lg transition-colors text-sm ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}
              >Cancel</button>
              <button
                data-testid="button-save-policy"
                onClick={handleCreatePolicy}
                disabled={!newPolicy.name.trim() || !newPolicy.threshold.trim()}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
              >Create Policy</button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed top-4 right-4 z-[60] space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-xl border backdrop-blur-sm flex items-center gap-2 min-w-[280px] ${
              toast.type === "success"
                ? "bg-emerald-900/90 border-emerald-700/50 text-emerald-200"
                : "bg-red-900/90 border-red-700/50 text-red-300"
            }`}
          >
            {toast.type === "success" ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getRiskLabel(score: number): string {
  if (score <= 40) return "Low";
  if (score <= 70) return "Medium";
  return "High";
}

function getRiskBadgeColor(score: number, isDark: boolean): string {
  if (score <= 40) return isDark ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-emerald-100 text-emerald-700 border border-emerald-200";
  if (score <= 70) return isDark ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-amber-100 text-amber-700 border border-amber-200";
  return isDark ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-red-100 text-red-700 border border-red-200";
}

function getBucketColor(range: string): string {
  const start = parseInt(range.split("-")[0]);
  if (start <= 40) return "bg-emerald-500";
  if (start <= 70) return "bg-amber-500";
  return "bg-red-500";
}
