import { useState, useEffect } from "react";
import { aosApi, aosGet } from "../lib/api";
import { useAosTheme } from "../AgentOSApp";

interface ComplianceStats {
  totalAgents: number;
  activeAgents: number;
  suspendedAgents: number;
  killSwitchActivations: number;
  piiEventsToday: number;
  openDriftAlerts: number;
  unmanagedAgents: number;
  recentAuditLogs: { id: string; action: string; entityType: string | null; entityId: string | null; userId: string | null; createdAt: string }[];
}

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface CertConfig {
  minSuccessRate: number;
  maxAvgLatencyMs: number;
  minAccuracyScore: number;
  minHumanRating: number;
  probationDays: number;
  minTaskCount: number;
}

interface DepartmentItem {
  id: string;
  name: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  agent_created: { label: "Agent Created", color: "text-emerald-400" },
  agent_updated: { label: "Agent Updated", color: "text-blue-400" },
  agent_status_changed: { label: "Status Changed", color: "text-amber-400" },
  agent_retired: { label: "Agent Retired", color: "text-slate-400" },
  kill_switch_activated: { label: "Kill Switch", color: "text-red-400" },
  kill_switch_restored: { label: "Kill Switch Restored", color: "text-emerald-400" },
  pii_rule_created: { label: "PII Rule Created", color: "text-violet-400" },
  pii_rule_deleted: { label: "PII Rule Deleted", color: "text-orange-400" },
  drift_alert_created: { label: "Drift Alert", color: "text-amber-400" },
  shadow_agent_dismissed: { label: "Shadow Dismissed", color: "text-slate-400" },
  shadow_agent_registered: { label: "Shadow Registered", color: "text-emerald-400" },
  user_invited: { label: "User Invited", color: "text-blue-400" },
  department_created: { label: "Dept Created", color: "text-violet-400" },
  policy_rule_created: { label: "Policy Created", color: "text-violet-400" },
  risk_recalculated: { label: "Risk Recalculated", color: "text-blue-400" },
};

export default function AdminPanel({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [certConfig, setCertConfig] = useState<CertConfig | null>(null);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [piiRuleCount, setPiiRuleCount] = useState(0);
  const [policyRuleCount, setPolicyRuleCount] = useState(0);
  const [policyViolationCount, setPolicyViolationCount] = useState(0);
  const [apiKeyCount, setApiKeyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    Promise.all([
      aosApi.getComplianceStats().catch(() => null),
      aosApi.getUsers().catch(() => []),
      aosGet("/certification/config").catch(() => null),
      aosGet("/departments").catch(() => []),
      aosApi.getPiiRules().catch(() => []),
      aosApi.getPolicyRules().catch(() => []),
      aosApi.getPolicyViolations().catch(() => []),
      aosGet("/api-keys").catch(() => []),
    ]).then(([s, u, c, d, pii, pol, violations, keys]) => {
      setStats(s as ComplianceStats);
      setUsers(Array.isArray(u) ? u as TeamUser[] : []);
      setCertConfig(c as CertConfig);
      setDepartments(Array.isArray(d) ? d : []);
      setPiiRuleCount(Array.isArray(pii) ? pii.filter((r: { isActive?: boolean }) => r.isActive).length : 0);
      setPolicyRuleCount(Array.isArray(pol) ? pol.filter((r: { isActive?: boolean }) => r.isActive).length : 0);
      setPolicyViolationCount(Array.isArray(violations) ? violations.filter((v: { status?: string }) => v.status === "open").length : 0);
      setApiKeyCount(Array.isArray(keys) ? keys.length : 0);
      setLoading(false);
    });
  }, []);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await aosApi.recalculateRiskScores();
    } catch {
    } finally {
      setRecalculating(false);
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
  const cardBg = isDark ? "bg-slate-800/30" : "bg-gray-50";

  const adminCount = users.filter(u => u.role === "admin").length;
  const managerCount = users.filter(u => u.role === "manager").length;
  const viewerCount = users.filter(u => u.role === "viewer").length;
  const activeUserCount = users.filter(u => u.isActive).length;

  return (
    <div className="space-y-6" data-testid="admin-panel-page">
      <div>
        <h1 className={`text-2xl font-bold ${titleCls}`} data-testid="text-admin-title">Admin Panel</h1>
        <p className={`mt-1 ${subtitleCls}`}>System overview, quick actions, and configuration hub</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard label="Total Agents" value={stats?.totalAgents || 0} color="violet" isDark={isDark} testId="admin-stat-total" />
        <StatCard label="Active" value={stats?.activeAgents || 0} color="emerald" isDark={isDark} testId="admin-stat-active" />
        <StatCard label="Suspended" value={stats?.suspendedAgents || 0} color="red" isDark={isDark} testId="admin-stat-suspended" />
        <StatCard label="Kill Events" value={stats?.killSwitchActivations || 0} color="red" isDark={isDark} testId="admin-stat-kills" />
        <StatCard label="PII Today" value={stats?.piiEventsToday || 0} color="amber" isDark={isDark} testId="admin-stat-pii" />
        <StatCard label="Drift Alerts" value={stats?.openDriftAlerts || 0} color="amber" isDark={isDark} testId="admin-stat-drift" />
        <StatCard label="Violations" value={policyViolationCount} color="orange" isDark={isDark} testId="admin-stat-violations" />
        <StatCard label="Unmanaged" value={stats?.unmanagedAgents || 0} color="red" isDark={isDark} testId="admin-stat-unmanaged" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className={`${panelCls} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-semibold ${titleCls}`}>Team Overview</h2>
              <button
                data-testid="link-manage-team"
                onClick={() => onNavigate?.("team")}
                className="text-violet-400 hover:text-violet-300 text-sm font-medium"
              >
                Manage Team &rarr;
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={`${cardBg} rounded-lg p-3 text-center`}>
                <div className={`text-2xl font-bold ${titleCls}`} data-testid="text-total-users">{users.length}</div>
                <div className={`text-xs ${subtitleCls}`}>Total Members</div>
              </div>
              <div className={`${cardBg} rounded-lg p-3 text-center`}>
                <div className="text-2xl font-bold text-emerald-400" data-testid="text-active-users">{activeUserCount}</div>
                <div className={`text-xs ${subtitleCls}`}>Active</div>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <RoleBadge label="Admins" count={adminCount} color="violet" isDark={isDark} />
              <RoleBadge label="Managers" count={managerCount} color="blue" isDark={isDark} />
              <RoleBadge label="Viewers" count={viewerCount} color="slate" isDark={isDark} />
            </div>
          </div>

          <div className={`${panelCls} p-5`}>
            <h2 className={`text-lg font-semibold mb-4 ${titleCls}`}>Quick Actions</h2>
            <div className="space-y-2">
              <ActionButton
                label="Recalculate Risk Scores"
                desc="Re-evaluate all agent risk levels"
                onClick={handleRecalculate}
                loading={recalculating}
                testId="action-recalculate-risk"
                isDark={isDark}
              />
              <ActionButton label="Export Compliance CSV" desc="Download full compliance report" onClick={() => onNavigate?.("compliance")} testId="action-export-csv" isDark={isDark} />
              <ActionButton label="Generate Evidence Pack" desc="Create audit-ready PDF" onClick={() => onNavigate?.("compliance")} testId="action-evidence-pack" isDark={isDark} />
              <ActionButton label="Manage API Keys" desc="Generate or revoke API keys" onClick={() => onNavigate?.("settings")} testId="action-api-keys" isDark={isDark} />
              <ActionButton label="Configure Certification" desc="Set agent certification thresholds" onClick={() => onNavigate?.("settings")} testId="action-certification" isDark={isDark} />
              <ActionButton label="Kill Switch" desc="Emergency agent suspension" onClick={() => onNavigate?.("governance")} testId="action-kill-switch" isDark={isDark} />
              <ActionButton label="Risk & Policies" desc="Manage governance rules" onClick={() => onNavigate?.("risk-policies")} testId="action-risk-policies" isDark={isDark} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className={`${panelCls} p-5`}>
            <h2 className={`text-lg font-semibold mb-4 ${titleCls}`}>Recent Activity</h2>
            {stats?.recentAuditLogs && stats.recentAuditLogs.length > 0 ? (
              <div className="space-y-2 max-h-[340px] overflow-y-auto">
                {stats.recentAuditLogs.map(log => {
                  const info = ACTION_LABELS[log.action] || { label: log.action, color: subtitleCls };
                  return (
                    <div key={log.id} className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm ${cardBg}`} data-testid={`admin-log-${log.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`font-medium shrink-0 ${info.color}`}>{info.label}</span>
                        {log.entityType && <span className={`${mutedCls} shrink-0`}>{log.entityType}</span>}
                        {log.entityId && <span className={`font-mono text-xs truncate ${isDark ? "text-slate-600" : "text-gray-400"}`}>{log.entityId.slice(0, 8)}...</span>}
                      </div>
                      <span className={`text-xs shrink-0 ml-2 ${mutedCls}`}>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={`text-sm ${mutedCls}`}>No recent activity</p>
            )}
            <button
              data-testid="link-view-audit-log"
              onClick={() => onNavigate?.("compliance")}
              className="mt-3 text-violet-400 hover:text-violet-300 text-sm font-medium"
            >
              View Full Audit Trail &rarr;
            </button>
          </div>

          <div className={`${panelCls} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-semibold ${titleCls}`}>Configuration Summary</h2>
              <button
                data-testid="link-settings"
                onClick={() => onNavigate?.("settings")}
                className="text-violet-400 hover:text-violet-300 text-sm font-medium"
              >
                Settings &rarr;
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className={`text-sm font-medium mb-3 ${subtitleCls}`}>Certification Thresholds</h3>
                <div className="space-y-2">
                  <ConfigRow label="Min Success Rate" value={`${certConfig?.minSuccessRate ?? 90}%`} isDark={isDark} />
                  <ConfigRow label="Max Avg Latency" value={`${certConfig?.maxAvgLatencyMs ?? 5000}ms`} isDark={isDark} />
                  <ConfigRow label="Min Accuracy" value={`${certConfig?.minAccuracyScore ?? 85}%`} isDark={isDark} />
                  <ConfigRow label="Min Human Rating" value={`${certConfig?.minHumanRating ?? 3.5}/5`} isDark={isDark} />
                  <ConfigRow label="Probation Period" value={`${certConfig?.probationDays ?? 30} days`} isDark={isDark} />
                  <ConfigRow label="Min Task Count" value={`${certConfig?.minTaskCount ?? 50}`} isDark={isDark} />
                </div>
              </div>

              <div>
                <h3 className={`text-sm font-medium mb-3 ${subtitleCls}`}>Active Protection</h3>
                <div className="space-y-2">
                  <ConfigRow label="PII Rules (Active)" value={String(piiRuleCount)} isDark={isDark} />
                  <ConfigRow label="Policy Rules (Active)" value={String(policyRuleCount)} isDark={isDark} />
                  <ConfigRow label="Departments" value={String(departments.length)} isDark={isDark} />
                  <ConfigRow label="API Keys" value={String(apiKeyCount)} isDark={isDark} />
                  <ConfigRow label="Kill Switch" value="Enabled" isDark={isDark} highlight />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, isDark, testId }: { label: string; value: number; color: string; isDark: boolean; testId: string }) {
  const colors: Record<string, string> = {
    violet: isDark ? "text-violet-400 border-violet-500/30" : "text-violet-600 border-violet-200",
    emerald: isDark ? "text-emerald-400 border-emerald-500/30" : "text-emerald-600 border-emerald-200",
    red: isDark ? "text-red-400 border-red-500/30" : "text-red-600 border-red-200",
    amber: isDark ? "text-amber-400 border-amber-500/30" : "text-amber-600 border-amber-200",
    orange: isDark ? "text-orange-400 border-orange-500/30" : "text-orange-600 border-orange-200",
  };
  return (
    <div className={`border rounded-xl p-3 text-center ${isDark ? "bg-slate-800/50" : "bg-white"} ${colors[color] || colors.violet}`} data-testid={testId}>
      <div className={`text-xl font-bold ${colors[color]?.split(" ")[0]}`}>{value}</div>
      <div className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-gray-500"}`}>{label}</div>
    </div>
  );
}

function RoleBadge({ label, count, color, isDark }: { label: string; count: number; color: string; isDark: boolean }) {
  const colorMap: Record<string, string> = {
    violet: isDark ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-violet-50 text-violet-600 border-violet-200",
    blue: isDark ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-blue-50 text-blue-600 border-blue-200",
    slate: isDark ? "bg-slate-500/10 text-slate-400 border-slate-500/20" : "bg-gray-50 text-gray-600 border-gray-200",
  };
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${colorMap[color] || colorMap.slate}`}>
      <span>{label}</span>
      <span className="font-semibold">{count}</span>
    </div>
  );
}

function ActionButton({ label, desc, onClick, loading, testId, isDark }: { label: string; desc: string; onClick: () => void; loading?: boolean; testId: string; isDark: boolean }) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      disabled={loading}
      className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between group ${isDark ? "hover:bg-slate-700/50 bg-slate-800/30" : "hover:bg-gray-100 bg-gray-50"} disabled:opacity-50`}
    >
      <div>
        <div className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{label}</div>
        <div className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-gray-500"}`}>{desc}</div>
      </div>
      {loading ? (
        <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin shrink-0" />
      ) : (
        <svg className={`w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${isDark ? "text-slate-500" : "text-gray-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      )}
    </button>
  );
}

function ConfigRow({ label, value, isDark, highlight }: { label: string; value: string; isDark: boolean; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${isDark ? "bg-slate-800/30" : "bg-gray-50"}`}>
      <span className={isDark ? "text-slate-400" : "text-gray-500"}>{label}</span>
      <span className={`font-medium ${highlight ? "text-emerald-400" : isDark ? "text-white" : "text-gray-900"}`}>{value}</span>
    </div>
  );
}
