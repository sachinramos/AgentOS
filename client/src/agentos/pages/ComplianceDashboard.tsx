import { useState, useEffect, useRef } from "react";
import { aosApi } from "../lib/api";
import { useAosTheme } from "../AgentOSApp";

interface AuditLog { id: string; userId: string | null; action: string; entityType: string | null; entityId: string | null; metadata: unknown; createdAt: string; }
interface ComplianceStats { totalAgents: number; activeAgents: number; suspendedAgents: number; killSwitchActivations: number; piiEventsToday: number; openDriftAlerts: number; unmanagedAgents: number; recentAuditLogs: AuditLog[]; }

interface EvidencePackData {
  generatedAt: string;
  periodDays: number;
  periodStart: string;
  periodEnd: string;
  companyName: string;
  totals: { agents: number; policyRules: number; killSwitchEvents: number; piiRules: number; piiEvents: number; driftAlerts: number; auditLogs: number; shadowAgents: number; policyViolations: number; };
  stats: {
    totalAgents: number; activeAgents: number; suspendedAgents: number; retiredAgents: number; onboardingAgents: number;
    killSwitchActivations: number; piiEventsInPeriod: number; openDriftAlerts: number; closedDriftAlerts: number;
    unmanagedAgents: number; totalPiiRules: number; activePolicyRules: number; policyViolationsInPeriod: number;
  };
  agents: { name: string; uid: string; provider: string; model: string; status: string; role: string | null; department: string | null; version: number | null; riskScore: number | null; deploymentDate: string | null; certifiedAt: string | null; createdAt: string; }[];
  policyRules: { name: string; description: string | null; conditionField: string; operator: string; threshold: string; actionType: string; severity: string; isActive: boolean | null; }[];
  killSwitchEvents: { agentName: string; reason: string; triggeredAt: string; restoredAt: string | null; }[];
  piiRules: { name: string; category: string; pattern: string; action: string; isActive: boolean | null; }[];
  piiEvents: { agentName: string | null; category: string; direction: string; action: string; createdAt: string; }[];
  driftAlerts: { agentName: string; metric: string; baseline: string; current: string; threshold: string; severity: string; status: string; createdAt: string; }[];
  auditLogs: { action: string; entityType: string | null; entityId: string | null; userId: string | null; createdAt: string; }[];
  shadowAgents: { identifier: string; provider: string | null; model: string | null; department: string | null; callCount: number | null; status: string; firstSeen: string; lastSeen: string; }[];
  policyViolations: { agentName: string; policyName: string; severity: string; conditionField: string; actualValue: string; threshold: string; actionTaken: string; status: string; createdAt: string; }[];
  governanceConfig: {
    certMinSuccessRate: number; certMaxLatencyMs: number; certMinAccuracy: number;
    certMinRating: number; certProbationDays: number; certMinTasks: number;
    killSwitchEnabled: boolean; killSwitchTotalEvents: number; killSwitchUnrestoredCount: number;
    activePiiRuleCount: number; activePolicyRuleCount: number;
  };
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  agent_created: { label: "Agent Created", color: "text-emerald-400" }, agent_updated: { label: "Agent Updated", color: "text-blue-400" },
  agent_status_changed: { label: "Status Changed", color: "text-amber-400" }, agent_retired: { label: "Agent Retired", color: "text-slate-400" },
  kill_switch_activated: { label: "Kill Switch Activated", color: "text-red-400" }, kill_switch_restored: { label: "Kill Switch Restored", color: "text-emerald-400" },
  pii_rule_created: { label: "PII Rule Created", color: "text-violet-400" }, pii_rule_deleted: { label: "PII Rule Deleted", color: "text-orange-400" },
  drift_alert_created: { label: "Drift Alert", color: "text-amber-400" }, shadow_agent_dismissed: { label: "Shadow Agent Dismissed", color: "text-slate-400" },
  shadow_agent_registered: { label: "Shadow Agent Registered", color: "text-emerald-400" }, user_invited: { label: "User Invited", color: "text-blue-400" },
  department_created: { label: "Department Created", color: "text-violet-400" },
};

const PERIOD_OPTIONS = [
  { label: "30 Days", value: 30 },
  { label: "60 Days", value: 60 },
  { label: "90 Days", value: 90 },
  { label: "180 Days", value: 180 },
];

export default function ComplianceDashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditFilter, setAuditFilter] = useState("");
  const [exporting, setExporting] = useState(false);
  const [generatingPack, setGeneratingPack] = useState(false);
  const [evidenceDays, setEvidenceDays] = useState(90);
  const [evidenceData, setEvidenceData] = useState<EvidencePackData | null>(null);
  const evidenceRef = useRef<HTMLDivElement>(null);
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  const fetchData = async () => {
    try {
      const [statsData, logsData] = await Promise.all([aosApi.getComplianceStats(), aosApi.getAuditLogs(auditFilter ? { action: auditFilter } : undefined)]);
      setStats(statsData); setAuditLogs(logsData || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [auditFilter]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await aosApi.exportComplianceReport();
      if (response instanceof Response) {
        const blob = await response.blob(); const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `compliance-report-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      }
    } catch (err) { alert(err instanceof Error ? err.message : "Export failed"); } finally { setExporting(false); }
  };

  const handleGenerateEvidencePack = async () => {
    setGeneratingPack(true);
    try {
      const data = await aosApi.getEvidencePack(evidenceDays);
      setEvidenceData(data);
      await new Promise<void>(resolve => {
        const checkReady = () => {
          if (evidenceRef.current && evidenceRef.current.offsetHeight > 0) {
            resolve();
          } else {
            requestAnimationFrame(checkReady);
          }
        };
        requestAnimationFrame(checkReady);
      });
      const html2pdf = (await import("html2pdf.js")).default;
      const el = evidenceRef.current;
      if (!el) return;
      const companyName = data.companyName;
      await html2pdf().set({
        margin: [8, 8, 16, 8],
        filename: `compliance-evidence-pack-${evidenceDays}d-${new Date().toISOString().split("T")[0]}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      }).from(el).toPdf().get("pdf").then((pdf: { internal: { getNumberOfPages: () => number; pageSize: { getWidth: () => number; getHeight: () => number } }; setPage: (n: number) => void; setFontSize: (s: number) => void; setTextColor: (r: number, g: number, b: number) => void; text: (t: string, x: number, y: number, o?: { align?: string }) => void }) => {
        const totalPages = pdf.internal.getNumberOfPages();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(7);
          pdf.setTextColor(148, 163, 184);
          pdf.text(`${companyName} — Compliance Evidence Pack`, 8, pageHeight - 5);
          pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 8, pageHeight - 5, { align: "right" });
        }
      }).save();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Evidence pack generation failed");
    } finally {
      setGeneratingPack(false);
      setEvidenceData(null);
    }
  };

  if (loading) { return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>; }

  const panelCls = `border rounded-xl ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`;
  const titleCls = isDark ? "text-white" : "text-gray-900";
  const subtitleCls = isDark ? "text-slate-400" : "text-gray-500";
  const mutedCls = isDark ? "text-slate-500" : "text-gray-400";
  const cardCls = isDark ? "bg-slate-800/30" : "bg-gray-50";

  return (
    <div className="space-y-6" data-testid="compliance-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-2xl font-bold ${titleCls}`} data-testid="text-compliance-title">Compliance Dashboard</h1>
          <p className={`mt-1 ${subtitleCls}`}>Fleet compliance status, audit trail, and reporting</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button data-testid="button-export-report" onClick={handleExport} disabled={exporting} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
          <div className="flex items-center gap-2">
            <select data-testid="select-evidence-period" value={evidenceDays} onChange={e => setEvidenceDays(Number(e.target.value))}
              className={`px-3 py-2 border rounded-lg text-sm focus:outline-none ${isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-gray-300 text-gray-700"}`}>
              {PERIOD_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <button data-testid="button-generate-evidence-pack" onClick={handleGenerateEvidencePack} disabled={generatingPack}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
              {generatingPack ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  Evidence Pack (PDF)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <CStatCard label="Total Agents" value={stats?.totalAgents || 0} color="violet" testId="stat-total" isDark={isDark} />
        <CStatCard label="Active" value={stats?.activeAgents || 0} color="emerald" testId="stat-active" isDark={isDark} />
        <CStatCard label="Suspended" value={stats?.suspendedAgents || 0} color="red" testId="stat-suspended" isDark={isDark} />
        <CStatCard label="Kill Events" value={stats?.killSwitchActivations || 0} color="red" testId="stat-kills" isDark={isDark} />
        <CStatCard label="PII Today" value={stats?.piiEventsToday || 0} color="amber" testId="stat-pii" isDark={isDark} />
        <CStatCard label="Drift Alerts" value={stats?.openDriftAlerts || 0} color="amber" testId="stat-drift" isDark={isDark} />
        <CStatCard label="Unmanaged" value={stats?.unmanagedAgents || 0} color="red" testId="stat-unmanaged" isDark={isDark} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className={`${panelCls} p-5`}>
            <h2 className={`text-lg font-semibold mb-4 ${titleCls}`}>Quick Actions</h2>
            <div className="space-y-2">
              <NavButton label="Kill Switch" desc="Emergency access revocation" onClick={() => onNavigate?.("governance")} testId="link-kill-switch" isDark={isDark} />
              <NavButton label="Blast Shield" desc="PII detection rules" onClick={() => onNavigate?.("blast-shield")} testId="link-blast-shield" isDark={isDark} />
              <NavButton label="Drift Alerts" desc="Performance monitoring" onClick={() => onNavigate?.("drift-alerts")} testId="link-drift-alerts" isDark={isDark} />
              <NavButton label="Shadow AI" desc="Unmanaged agent discovery" onClick={() => onNavigate?.("shadow-ai")} testId="link-shadow-ai" isDark={isDark} />
              <NavButton label="Reasoning Traces" desc="Agent thought timelines" onClick={() => onNavigate?.("traces")} testId="link-traces" isDark={isDark} />
            </div>
          </div>

          <div className={`${panelCls} p-5`}>
            <h2 className={`text-lg font-semibold mb-3 ${titleCls}`}>Compliance Score</h2>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20">
                <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                  <circle cx="18" cy="18" r="16" fill="none" stroke={isDark ? "#334155" : "#e5e7eb"} strokeWidth="3" />
                  <circle cx="18" cy="18" r="16" fill="none" stroke={getScoreColor(stats)} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${getScore(stats)} 100`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`font-bold text-lg ${titleCls}`} data-testid="text-score">{getScore(stats)}%</span>
                </div>
              </div>
              <div className={`text-sm space-y-1 ${subtitleCls}`}>
                {(stats?.unmanagedAgents || 0) > 0 && <p className="text-amber-400">Unmanaged agents found</p>}
                {(stats?.openDriftAlerts || 0) > 0 && <p className="text-amber-400">Open drift alerts</p>}
                {(stats?.unmanagedAgents || 0) === 0 && (stats?.openDriftAlerts || 0) === 0 && <p className="text-emerald-400">All systems healthy</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className={`${panelCls} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-semibold ${titleCls}`}>Audit Trail</h2>
              <select data-testid="select-audit-filter" value={auditFilter} onChange={e => setAuditFilter(e.target.value)}
                className={`px-3 py-1.5 border rounded-lg text-sm focus:outline-none ${isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-gray-300 text-gray-700"}`}>
                <option value="">All Actions</option>
                <option value="agent_created">Agent Created</option>
                <option value="agent_updated">Agent Updated</option>
                <option value="agent_status_changed">Status Changed</option>
                <option value="kill_switch_activated">Kill Switch</option>
                <option value="pii_rule_created">PII Rule</option>
                <option value="drift_alert_created">Drift Alert</option>
                <option value="shadow_agent_registered">Shadow Registered</option>
                <option value="user_invited">User Invited</option>
              </select>
            </div>
            {auditLogs.length > 0 ? (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {auditLogs.map(log => {
                  const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: subtitleCls };
                  return (
                    <div key={log.id} className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm ${cardCls}`} data-testid={`audit-log-${log.id}`}>
                      <div className="flex items-center gap-3">
                        <span className={`font-medium ${actionInfo.color}`}>{actionInfo.label}</span>
                        {log.entityType && <span className={mutedCls}>{log.entityType}</span>}
                        {log.entityId && <span className={`font-mono text-xs ${isDark ? "text-slate-600" : "text-gray-400"}`}>{log.entityId.slice(0, 8)}...</span>}
                      </div>
                      <span className={`text-xs shrink-0 ${mutedCls}`}>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={`text-sm ${mutedCls}`}>No audit logs found</p>
            )}
          </div>
        </div>
      </div>

      {evidenceData && (
        <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
          <div ref={evidenceRef}>
            <EvidencePackPDF data={evidenceData} />
          </div>
        </div>
      )}
    </div>
  );
}

function EvidencePackPDF({ data }: { data: EvidencePackData }) {
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const fmtDateTime = (d: string) => new Date(d).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const score = computeEvidenceScore(data);

  const sectionStyle: React.CSSProperties = { pageBreakInside: "avoid", marginBottom: "16px" };
  const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "9px" };
  const thStyle: React.CSSProperties = { background: "#6d28d9", color: "#fff", padding: "6px 8px", textAlign: "left", fontWeight: 600 };
  const tdStyle: React.CSSProperties = { padding: "5px 8px", borderBottom: "1px solid #e2e8f0" };
  const headingStyle: React.CSSProperties = { fontSize: "14px", fontWeight: 700, color: "#1e1b4b", borderBottom: "2px solid #7c3aed", paddingBottom: "4px", marginBottom: "8px", marginTop: "12px" };
  const badgeColors: Record<string, string> = { critical: "#dc2626", high: "#ea580c", warning: "#d97706", medium: "#d97706", low: "#16a34a", info: "#2563eb" };

  const truncNote = (shown: number, total: number, label: string) => {
    if (shown >= total) return null;
    return (
      <div style={{ fontSize: "9px", color: "#94a3b8", marginTop: "4px", fontStyle: "italic", background: "#f8fafc", padding: "4px 8px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
        Showing {shown} of {total} {label}. Full data available in CSV export.
      </div>
    );
  };

  const tocItems = [
    { num: "1", title: "Executive Summary", desc: "Fleet overview, compliance score, and key metrics" },
    { num: "2", title: `Agent Registry (${data.totals.agents} agents)`, desc: "Complete inventory of registered AI agents" },
    { num: "3", title: `Governance Configuration`, desc: "Certification thresholds and kill switch settings" },
    { num: "4", title: `Governance Policies (${data.totals.policyRules} rules)`, desc: "Automated policy rules and enforcement configuration" },
    ...(data.policyViolations.length > 0 ? [{ num: "4a", title: `Policy Violations (${data.totals.policyViolations})`, desc: "Policy breach events during the reporting period" }] : []),
    { num: "5", title: "Incident History", desc: "Kill switch events, drift alerts, and PII detections" },
    { num: "6", title: `PII Protection Rules (${data.totals.piiRules})`, desc: "Data protection rules configuration" },
    { num: "7", title: `Shadow AI Report (${data.totals.shadowAgents})`, desc: "Discovered unmanaged AI agents" },
    { num: "8", title: `Audit Log (${data.totals.auditLogs} entries)`, desc: "Chronological record of all governance actions" },
  ];

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", color: "#1e293b", lineHeight: 1.5, padding: "24px", width: "700px", background: "#fff" }}>
      <div style={{ textAlign: "center", padding: "32px 0", borderBottom: "3px solid #7c3aed", marginBottom: "24px" }}>
        <div style={{ fontSize: "28px", fontWeight: 800, color: "#4c1d95", letterSpacing: "-0.5px" }}>Compliance Evidence Pack</div>
        <div style={{ fontSize: "13px", color: "#64748b", marginTop: "8px" }}>{data.companyName}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: "24px", marginTop: "16px", fontSize: "11px", color: "#64748b" }}>
          <span>Period: {fmtDate(data.periodStart)} — {fmtDate(data.periodEnd)}</span>
          <span>Generated: {fmtDateTime(data.generatedAt)}</span>
        </div>
        <div style={{ marginTop: "12px", fontSize: "11px", color: "#94a3b8" }}>
          Report covers the last {data.periodDays} days of AI fleet governance activity
        </div>
      </div>

      <div style={{ ...sectionStyle, marginBottom: "24px" }}>
        <div style={{ fontSize: "16px", fontWeight: 700, color: "#1e1b4b", marginBottom: "12px" }}>Table of Contents</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
          <tbody>
            {tocItems.map((item, i) => (
              <tr key={i}>
                <td style={{ padding: "5px 8px", width: "30px", color: "#7c3aed", fontWeight: 600 }}>{item.num}.</td>
                <td style={{ padding: "5px 8px", fontWeight: 500, color: "#1e293b" }}>{item.title}</td>
                <td style={{ padding: "5px 8px", color: "#94a3b8", textAlign: "right", fontSize: "10px" }}>{item.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ ...sectionStyle }}>
        <div style={{ ...headingStyle }}>1. Executive Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "12px" }}>
          <SummaryBox label="Total Agents" value={data.stats.totalAgents} color="#7c3aed" />
          <SummaryBox label="Active" value={data.stats.activeAgents} color="#16a34a" />
          <SummaryBox label="Suspended" value={data.stats.suspendedAgents} color="#dc2626" />
          <SummaryBox label="Kill Switch Events" value={data.stats.killSwitchActivations} color="#dc2626" />
          <SummaryBox label="PII Events" value={data.stats.piiEventsInPeriod} color="#d97706" />
          <SummaryBox label="Open Drift Alerts" value={data.stats.openDriftAlerts} color="#d97706" />
          <SummaryBox label="Unmanaged Agents" value={data.stats.unmanagedAgents} color="#dc2626" />
          <SummaryBox label="Active Policies" value={data.stats.activePolicyRules} color="#2563eb" />
          <SummaryBox label="Policy Violations" value={data.stats.policyViolationsInPeriod} color="#ea580c" />
        </div>
        <div style={{ padding: "10px 14px", background: score >= 80 ? "#f0fdf4" : score >= 60 ? "#fffbeb" : "#fef2f2", border: `1px solid ${score >= 80 ? "#bbf7d0" : score >= 60 ? "#fde68a" : "#fecaca"}`, borderRadius: "8px", fontSize: "12px" }}>
          <strong>Compliance Score: {score}%</strong>
          <span style={{ marginLeft: "8px", color: "#64748b" }}>
            {score >= 80 ? "Fleet governance posture is healthy." : score >= 60 ? "Some governance issues require attention." : "Critical governance issues detected — immediate action recommended."}
          </span>
        </div>
      </div>

      <div style={{ ...sectionStyle }}>
        <div style={{ ...headingStyle }}>2. Agent Registry ({data.totals.agents} agents)</div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th><th style={thStyle}>UID</th><th style={thStyle}>Provider</th>
              <th style={thStyle}>Model</th><th style={thStyle}>Status</th><th style={thStyle}>Risk</th>
              <th style={thStyle}>Department</th><th style={thStyle}>Registered</th>
            </tr>
          </thead>
          <tbody>
            {data.agents.map((a, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                <td style={tdStyle}>{a.name}</td>
                <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "8px" }}>{a.uid.slice(0, 12)}</td>
                <td style={tdStyle}>{a.provider}</td><td style={tdStyle}>{a.model}</td>
                <td style={tdStyle}><StatusBadge status={a.status} /></td>
                <td style={tdStyle}>{a.riskScore != null ? a.riskScore : "—"}</td>
                <td style={tdStyle}>{a.department || "—"}</td>
                <td style={tdStyle}>{fmtDate(a.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncNote(data.agents.length, data.totals.agents, "agents")}

      <div style={{ ...sectionStyle }}>
        <div style={{ ...headingStyle }}>3. Governance Configuration</div>

        <div style={{ fontSize: "11px", fontWeight: 600, color: "#4c1d95", marginBottom: "6px" }}>Agent Certification Thresholds</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
          {[
            { label: "Min Success Rate", value: `${data.governanceConfig.certMinSuccessRate}%` },
            { label: "Max Avg Latency", value: `${data.governanceConfig.certMaxLatencyMs}ms` },
            { label: "Min Accuracy Score", value: `${data.governanceConfig.certMinAccuracy}%` },
            { label: "Min Human Rating", value: `${data.governanceConfig.certMinRating}/5` },
            { label: "Probation Period", value: `${data.governanceConfig.certProbationDays} days` },
            { label: "Min Task Count for Certification", value: `${data.governanceConfig.certMinTasks}` },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: i % 2 === 0 ? "#f8fafc" : "#fff", borderRadius: "4px", fontSize: "10px" }}>
              <span style={{ color: "#64748b" }}>{item.label}</span>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>{item.value}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: "11px", fontWeight: 600, color: "#4c1d95", marginBottom: "6px" }}>Kill Switch Configuration</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
          {[
            { label: "Kill Switch Status", value: data.governanceConfig.killSwitchEnabled ? "Enabled" : "Disabled" },
            { label: "Total Kill Switch Events (All Time)", value: `${data.governanceConfig.killSwitchTotalEvents}` },
            { label: "Currently Unrestored", value: `${data.governanceConfig.killSwitchUnrestoredCount}` },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: i % 2 === 0 ? "#f8fafc" : "#fff", borderRadius: "4px", fontSize: "10px" }}>
              <span style={{ color: "#64748b" }}>{item.label}</span>
              <span style={{ fontWeight: 600, color: data.governanceConfig.killSwitchUnrestoredCount > 0 && item.label === "Currently Unrestored" ? "#dc2626" : "#1e293b" }}>{item.value}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: "11px", fontWeight: 600, color: "#4c1d95", marginBottom: "6px" }}>Active Protection Rules</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {[
            { label: "Active PII Protection Rules", value: `${data.governanceConfig.activePiiRuleCount}` },
            { label: "Active Governance Policy Rules", value: `${data.governanceConfig.activePolicyRuleCount}` },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: i % 2 === 0 ? "#f8fafc" : "#fff", borderRadius: "4px", fontSize: "10px" }}>
              <span style={{ color: "#64748b" }}>{item.label}</span>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...sectionStyle }}>
        <div style={{ ...headingStyle }}>4. Governance Policies ({data.totals.policyRules} rules)</div>
        {data.policyRules.length > 0 ? (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Policy Name</th><th style={thStyle}>Condition</th><th style={thStyle}>Threshold</th>
                <th style={thStyle}>Action</th><th style={thStyle}>Severity</th><th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.policyRules.map((p, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={tdStyle}><strong>{p.name}</strong>{p.description && <div style={{ fontSize: "8px", color: "#94a3b8" }}>{p.description}</div>}</td>
                  <td style={tdStyle}>{p.conditionField} {p.operator}</td><td style={tdStyle}>{p.threshold}</td>
                  <td style={tdStyle}>{p.actionType}</td>
                  <td style={tdStyle}><span style={{ color: badgeColors[p.severity] || "#64748b", fontWeight: 600, fontSize: "8px", textTransform: "uppercase" }}>{p.severity}</span></td>
                  <td style={tdStyle}>{p.isActive ? "Active" : "Disabled"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyNote>No governance policies configured.</EmptyNote>}
      </div>

      {truncNote(data.policyRules.length, data.totals.policyRules, "policy rules")}

      {data.policyViolations.length > 0 && (
        <div style={{ ...sectionStyle }}>
          <div style={{ ...headingStyle }}>4a. Policy Violations ({data.totals.policyViolations})</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Agent</th><th style={thStyle}>Policy</th><th style={thStyle}>Severity</th>
                <th style={thStyle}>Status</th><th style={thStyle}>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.policyViolations.map((v, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={tdStyle}>{v.agentName}</td><td style={tdStyle}>{v.policyName}</td>
                  <td style={tdStyle}><span style={{ color: badgeColors[v.severity] || "#64748b", fontWeight: 600, fontSize: "8px", textTransform: "uppercase" }}>{v.severity}</span></td>
                  <td style={tdStyle}>{v.status}</td><td style={tdStyle}>{fmtDateTime(v.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.policyViolations.length > 0 && truncNote(data.policyViolations.length, data.totals.policyViolations, "policy violations")}

      <div style={{ ...sectionStyle }}>
        <div style={{ ...headingStyle }}>5. Incident History</div>

        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#4c1d95", marginBottom: "6px" }}>5a. Kill Switch Events ({data.totals.killSwitchEvents})</div>
          {data.killSwitchEvents.length > 0 ? (
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>Agent</th><th style={thStyle}>Reason</th><th style={thStyle}>Triggered</th><th style={thStyle}>Restored</th></tr></thead>
              <tbody>
                {data.killSwitchEvents.map((e, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                    <td style={tdStyle}>{e.agentName}</td><td style={tdStyle}>{e.reason}</td>
                    <td style={tdStyle}>{fmtDateTime(e.triggeredAt)}</td><td style={tdStyle}>{e.restoredAt ? fmtDateTime(e.restoredAt) : "Not restored"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyNote>No kill switch events during this period.</EmptyNote>}
          {truncNote(data.killSwitchEvents.length, data.totals.killSwitchEvents, "kill switch events")}
        </div>

        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#4c1d95", marginBottom: "6px" }}>5b. Drift Alerts ({data.totals.driftAlerts})</div>
          {data.driftAlerts.length > 0 ? (
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>Agent</th><th style={thStyle}>Metric</th><th style={thStyle}>Baseline</th><th style={thStyle}>Current</th><th style={thStyle}>Severity</th><th style={thStyle}>Status</th><th style={thStyle}>Date</th></tr></thead>
              <tbody>
                {data.driftAlerts.map((a, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                    <td style={tdStyle}>{a.agentName}</td><td style={tdStyle}>{a.metric}</td>
                    <td style={tdStyle}>{a.baseline}</td><td style={tdStyle}>{a.current}</td>
                    <td style={tdStyle}><span style={{ color: badgeColors[a.severity] || "#64748b", fontWeight: 600, fontSize: "8px", textTransform: "uppercase" }}>{a.severity}</span></td>
                    <td style={tdStyle}>{a.status}</td><td style={tdStyle}>{fmtDateTime(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyNote>No drift alerts during this period.</EmptyNote>}
          {truncNote(data.driftAlerts.length, data.totals.driftAlerts, "drift alerts")}
        </div>

        <div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#4c1d95", marginBottom: "6px" }}>5c. PII Detection Events ({data.totals.piiEvents})</div>
          {data.piiEvents.length > 0 ? (
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>Agent</th><th style={thStyle}>Category</th><th style={thStyle}>Direction</th><th style={thStyle}>Action</th><th style={thStyle}>Date</th></tr></thead>
              <tbody>
                {data.piiEvents.map((e, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                    <td style={tdStyle}>{e.agentName || "—"}</td><td style={tdStyle}>{e.category}</td>
                    <td style={tdStyle}>{e.direction}</td><td style={tdStyle}>{e.action}</td><td style={tdStyle}>{fmtDateTime(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyNote>No PII events during this period.</EmptyNote>}
        </div>
      </div>
      {truncNote(data.piiEvents.length, data.totals.piiEvents, "PII events")}

      <div style={{ ...sectionStyle }}>
        <div style={{ ...headingStyle }}>6. PII Protection Rules ({data.totals.piiRules})</div>
        {data.piiRules.length > 0 ? (
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Name</th><th style={thStyle}>Category</th><th style={thStyle}>Pattern</th><th style={thStyle}>Action</th><th style={thStyle}>Status</th></tr></thead>
            <tbody>
              {data.piiRules.map((r, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={tdStyle}>{r.name}</td><td style={tdStyle}>{r.category}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "8px" }}>{r.pattern}</td>
                  <td style={tdStyle}>{r.action}</td><td style={tdStyle}>{r.isActive ? "Active" : "Disabled"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyNote>No PII rules configured.</EmptyNote>}
      </div>
      {truncNote(data.piiRules.length, data.totals.piiRules, "PII rules")}

      <div style={{ ...sectionStyle }}>
        <div style={{ ...headingStyle }}>7. Shadow AI Report ({data.totals.shadowAgents} discovered)</div>
        {data.shadowAgents.length > 0 ? (
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Identifier</th><th style={thStyle}>Provider</th><th style={thStyle}>Model</th><th style={thStyle}>Department</th><th style={thStyle}>Calls</th><th style={thStyle}>Status</th><th style={thStyle}>First Seen</th><th style={thStyle}>Last Seen</th></tr></thead>
            <tbody>
              {data.shadowAgents.map((s, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "8px" }}>{s.identifier}</td>
                  <td style={tdStyle}>{s.provider || "—"}</td><td style={tdStyle}>{s.model || "—"}</td>
                  <td style={tdStyle}>{s.department || "—"}</td><td style={tdStyle}>{s.callCount || 0}</td>
                  <td style={tdStyle}><StatusBadge status={s.status} /></td>
                  <td style={tdStyle}>{fmtDate(s.firstSeen)}</td><td style={tdStyle}>{fmtDate(s.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyNote>No shadow agents discovered.</EmptyNote>}
      </div>
      {truncNote(data.shadowAgents.length, data.totals.shadowAgents, "shadow agents")}

      <div style={{ ...sectionStyle }}>
        <div style={{ ...headingStyle }}>8. Audit Log ({data.totals.auditLogs} entries)</div>
        {data.auditLogs.length > 0 ? (
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Action</th><th style={thStyle}>Entity</th><th style={thStyle}>Entity ID</th><th style={thStyle}>User</th><th style={thStyle}>Timestamp</th></tr></thead>
            <tbody>
              {data.auditLogs.map((l, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={tdStyle}>{l.action}</td><td style={tdStyle}>{l.entityType || "—"}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "8px" }}>{l.entityId ? l.entityId.slice(0, 12) : "—"}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "8px" }}>{l.userId ? l.userId.slice(0, 12) : "—"}</td>
                  <td style={tdStyle}>{fmtDateTime(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyNote>No audit log entries during this period.</EmptyNote>}
      </div>
      {truncNote(data.auditLogs.length, data.totals.auditLogs, "audit log entries")}

      <div style={{ borderTop: "2px solid #e2e8f0", paddingTop: "16px", marginTop: "24px", textAlign: "center", fontSize: "10px", color: "#94a3b8" }}>
        <div>AgentOS Compliance Evidence Pack — Confidential</div>
        <div>{data.companyName} — Generated {fmtDateTime(data.generatedAt)}</div>
        <div style={{ marginTop: "4px" }}>This document is auto-generated and intended for audit and regulatory review purposes.</div>
      </div>
    </div>
  );
}

function SummaryBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: "20px", fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: "9px", color: "#64748b", marginTop: "2px" }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    active: { bg: "#dcfce7", text: "#16a34a" },
    suspended: { bg: "#fee2e2", text: "#dc2626" },
    retired: { bg: "#f1f5f9", text: "#64748b" },
    onboarding: { bg: "#dbeafe", text: "#2563eb" },
    unmanaged: { bg: "#fef3c7", text: "#d97706" },
    dismissed: { bg: "#f1f5f9", text: "#64748b" },
    registered: { bg: "#dcfce7", text: "#16a34a" },
    open: { bg: "#fef3c7", text: "#d97706" },
    resolved: { bg: "#dcfce7", text: "#16a34a" },
  };
  const c = colors[status] || { bg: "#f1f5f9", text: "#64748b" };
  return <span style={{ background: c.bg, color: c.text, padding: "2px 6px", borderRadius: "4px", fontSize: "8px", fontWeight: 600, textTransform: "uppercase" }}>{status}</span>;
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "10px", color: "#94a3b8", fontStyle: "italic" }}>{children}</div>;
}

function computeEvidenceScore(data: EvidencePackData): number {
  let score = 100;
  if (data.stats.unmanagedAgents > 0) score -= Math.min(30, data.stats.unmanagedAgents * 10);
  if (data.stats.openDriftAlerts > 0) score -= Math.min(20, data.stats.openDriftAlerts * 5);
  if (data.stats.suspendedAgents > 0) score -= Math.min(10, data.stats.suspendedAgents * 5);
  if (data.stats.killSwitchActivations > 0) score -= 5;
  if (data.stats.policyViolationsInPeriod > 0) score -= Math.min(15, data.stats.policyViolationsInPeriod * 3);
  return Math.max(0, score);
}

function getScore(stats: ComplianceStats | null): number {
  if (!stats) return 100;
  let score = 100;
  if (stats.unmanagedAgents > 0) score -= Math.min(30, stats.unmanagedAgents * 10);
  if (stats.openDriftAlerts > 0) score -= Math.min(20, stats.openDriftAlerts * 5);
  if (stats.suspendedAgents > 0) score -= Math.min(10, stats.suspendedAgents * 5);
  if (stats.killSwitchActivations > 0) score -= 5;
  return Math.max(0, score);
}

function getScoreColor(stats: ComplianceStats | null): string {
  const score = getScore(stats);
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

function CStatCard({ label, value, color, testId, isDark }: { label: string; value: number; color: string; testId: string; isDark: boolean }) {
  const colorMap: Record<string, string> = { violet: "border-violet-500/20", emerald: "border-emerald-500/20", amber: "border-amber-500/20", red: "border-red-500/20" };
  return (
    <div className={`border ${colorMap[color] || (isDark ? "border-slate-700/50" : "border-gray-200")} rounded-xl p-4 ${isDark ? "bg-slate-800/50" : "bg-white"}`} data-testid={testId}>
      <p className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}>{label}</p>
      <p className={`text-2xl font-bold mt-1 ${isDark ? "text-white" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function NavButton({ label, desc, onClick, testId, isDark }: { label: string; desc: string; onClick: () => void; testId: string; isDark: boolean }) {
  return (
    <button data-testid={testId} onClick={onClick}
      className={`w-full flex items-center justify-between p-3 border rounded-lg transition-colors text-left ${isDark ? "bg-slate-800/30 hover:bg-slate-800/60 border-slate-700/30" : "bg-gray-50 hover:bg-gray-100 border-gray-200"}`}>
      <div>
        <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{label}</p>
        <p className={`text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}>{desc}</p>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDark ? "text-slate-500" : "text-gray-400"}><path d="m9 18 6-6-6-6"/></svg>
    </button>
  );
}
