import { useState, useEffect, useMemo } from "react";
import { aosApi } from "../lib/api";
import { useAosTheme } from "../AgentOSApp";

interface PiiRule { id: string; name: string; category: string; pattern: string; action: string; isActive: boolean; createdAt: string; }
interface PiiEvent { id: string; agentId: string | null; category: string; direction: string; action: string; sample: string | null; createdAt: string; }

const DEFAULT_RULES = [
  { name: "SSN", category: "ssn", pattern: "\\b\\d{3}-\\d{2}-\\d{4}\\b", action: "redact" },
  { name: "Email Address", category: "email", pattern: "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b", action: "flag" },
  { name: "Phone Number", category: "phone", pattern: "\\b(?:\\+1)?[-. (]?\\d{3}[-. )]?\\d{3}[-. ]?\\d{4}\\b", action: "flag" },
  { name: "Credit Card", category: "financial", pattern: "\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\\b", action: "block" },
  { name: "IP Address", category: "network", pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b", action: "flag" },
];

const DEMO_TEXT = `Dear Support Team,

My name is John Smith and I need help with my account. Here are my details:
- Social Security Number: 123-45-6789
- Email: john.smith@example.com
- Phone: (555) 867-5309
- Secondary phone: +1-202-555-0147
- Credit Card: 4111111111111111
- Backup Email: jsmith.personal@gmail.com
- IP Address from last login: 192.168.1.42

My secondary SSN for tax purposes is 987-65-4321. 
Please contact me at john.smith@work.org if you need more information.

Thanks,
John`;

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; highlight: string }> = {
  ssn: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30", highlight: "bg-red-500/30 text-red-200 border-red-400/50" },
  email: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30", highlight: "bg-blue-500/30 text-blue-200 border-blue-400/50" },
  phone: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30", highlight: "bg-amber-500/30 text-amber-200 border-amber-400/50" },
  financial: { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/30", highlight: "bg-purple-500/30 text-purple-200 border-purple-400/50" },
  network: { bg: "bg-cyan-500/20", text: "text-cyan-400", border: "border-cyan-500/30", highlight: "bg-cyan-500/30 text-cyan-200 border-cyan-400/50" },
};

const ACTION_COLORS: Record<string, string> = { redact: "bg-red-500/20 text-red-400", flag: "bg-amber-500/20 text-amber-400", block: "bg-red-600/20 text-red-300" };
const ACTION_ICONS: Record<string, string> = { redact: "Redacts matching content", flag: "Logs and flags matches", block: "Blocks entire content" };

function highlightPii(text: string, rules: PiiRule[]): JSX.Element[] {
  const activeRules = rules.filter(r => r.isActive);
  if (activeRules.length === 0) return [<span key="0">{text}</span>];
  interface Match { start: number; end: number; category: string; rule: string }
  const allMatches: Match[] = [];
  for (const rule of activeRules) { try { const regex = new RegExp(rule.pattern, "gi"); let m; while ((m = regex.exec(text)) !== null) { allMatches.push({ start: m.index, end: m.index + m[0].length, category: rule.category, rule: rule.name }); } } catch {} }
  allMatches.sort((a, b) => a.start - b.start);
  const merged: Match[] = [];
  for (const m of allMatches) { if (merged.length > 0 && m.start < merged[merged.length - 1].end) continue; merged.push(m); }
  if (merged.length === 0) return [<span key="0">{text}</span>];
  const parts: JSX.Element[] = [];
  let lastEnd = 0;
  merged.forEach((m, i) => {
    if (m.start > lastEnd) parts.push(<span key={`t-${i}`}>{text.slice(lastEnd, m.start)}</span>);
    const colors = CATEGORY_COLORS[m.category] || CATEGORY_COLORS.ssn;
    parts.push(<span key={`m-${i}`} className={`${colors.highlight} px-1 py-0.5 rounded border inline-block`} title={`${m.rule} (${m.category})`}>{text.slice(m.start, m.end)}</span>);
    lastEnd = m.end;
  });
  if (lastEnd < text.length) parts.push(<span key="end">{text.slice(lastEnd)}</span>);
  return parts;
}

export default function BlastShield() {
  const [rules, setRules] = useState<PiiRule[]>([]);
  const [events, setEvents] = useState<PiiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newRule, setNewRule] = useState({ name: "", category: "", pattern: "", action: "redact" });
  const [testText, setTestText] = useState("");
  const [scanResult, setScanResult] = useState<{ findings: { rule: string; category: string; action: string; matches: number }[]; redactedText: string | null; blocked: boolean } | null>(null);
  const [scanning, setScanning] = useState(false);
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  const fetchData = async () => { try { const [r, e] = await Promise.all([aosApi.getPiiRules(), aosApi.getPiiEvents()]); setRules(r || []); setEvents(e || []); } catch (err) { console.error(err); } finally { setLoading(false); } };
  useEffect(() => { fetchData(); }, []);

  const handleAddRule = async () => { try { await aosApi.createPiiRule(newRule); setShowAdd(false); setNewRule({ name: "", category: "", pattern: "", action: "redact" }); await fetchData(); } catch (err) { alert(err instanceof Error ? err.message : "Failed"); } };
  const handleToggleRule = async (rule: PiiRule) => { try { await aosApi.updatePiiRule(rule.id, { isActive: !rule.isActive }); await fetchData(); } catch (err) { alert(err instanceof Error ? err.message : "Failed"); } };
  const handleDeleteRule = async (id: string) => { try { await aosApi.deletePiiRule(id); await fetchData(); } catch (err) { alert(err instanceof Error ? err.message : "Failed"); } };
  const handleAddDefaults = async () => { for (const rule of DEFAULT_RULES) { try { await aosApi.createPiiRule(rule); } catch {} } await fetchData(); };
  const handleScan = async () => { if (!testText.trim()) return; setScanning(true); try { const result = await aosApi.scanPii(testText); setScanResult(result); await fetchData(); } catch (err) { alert(err instanceof Error ? err.message : "Scan failed"); } finally { setScanning(false); } };
  const handleTryDemo = () => { setTestText(DEMO_TEXT); setScanResult(null); };

  const totalMatches = useMemo(() => { if (!scanResult) return 0; return scanResult.findings.reduce((s, f) => s + f.matches, 0); }, [scanResult]);

  if (loading) { return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>; }

  const panelCls = `border rounded-xl ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`;
  const titleCls = isDark ? "text-white" : "text-gray-900";
  const subtitleCls = isDark ? "text-slate-400" : "text-gray-500";
  const mutedCls = isDark ? "text-slate-500" : "text-gray-400";
  const cardCls = isDark ? "bg-slate-800/30 border-slate-700/30" : "bg-gray-50 border-gray-200";
  const inputCls = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${isDark ? "bg-slate-800/50 border-slate-700 text-white" : "bg-white border-gray-300 text-gray-900"}`;
  const labelCls = `block text-sm mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`;
  const modalCls = isDark ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200";
  const scannerBgCls = isDark ? "bg-slate-900/80 border-slate-700" : "bg-gray-50 border-gray-300";
  const scannerTextCls = isDark ? "text-white" : "text-gray-900";

  return (
    <div className="space-y-6" data-testid="blast-shield-page">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div>
          <h1 className={`text-2xl font-bold ${titleCls}`} data-testid="text-blast-shield-title">Blast Shield</h1>
          <p className={`mt-0.5 text-sm ${subtitleCls}`}>PII detection and redaction for agent inputs & outputs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Active Rules", value: rules.filter(r => r.isActive).length },
          { label: "Total Rules", value: rules.length },
          { label: "PII Events", value: events.length },
          { label: "Categories", value: new Set(rules.map(r => r.category)).size },
        ].map((s, i) => (
          <div key={i} className={`${panelCls} p-4`}>
            <p className={`text-xs ${subtitleCls}`}>{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${titleCls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-br from-violet-900/20 to-slate-800/50 border border-violet-700/30 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <h2 className={`text-lg font-semibold ${titleCls}`}>Live PII Scanner</h2>
          </div>
          <div className="flex items-center gap-2">
            <button data-testid="button-try-demo" onClick={handleTryDemo} className="px-3 py-1.5 bg-violet-600/30 hover:bg-violet-600/50 text-violet-300 rounded-lg text-xs font-medium transition-colors border border-violet-500/30 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Try Demo
            </button>
            <button data-testid="button-scan" onClick={handleScan} disabled={!testText.trim() || scanning} className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
              {scanning ? (<><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Scanning...</>) : (<><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Scan Text</>)}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}>Original Text</label>
              {testText && (<button onClick={() => { setTestText(""); setScanResult(null); }} className={`text-xs transition-colors ${isDark ? "text-slate-500 hover:text-slate-300" : "text-gray-400 hover:text-gray-600"}`} data-testid="button-clear-text">Clear</button>)}
            </div>
            <div className="relative">
              {scanResult && scanResult.findings.length > 0 ? (
                <div className={`w-full px-3 py-2 border rounded-lg text-sm min-h-[200px] max-h-[300px] overflow-auto whitespace-pre-wrap font-mono leading-relaxed ${scannerBgCls}`} data-testid="text-highlighted-original">{highlightPii(testText, rules)}</div>
              ) : (
                <textarea data-testid="input-test-text" value={testText} onChange={e => { setTestText(e.target.value); setScanResult(null); }} className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50 min-h-[200px] max-h-[300px] resize-none font-mono text-sm ${scannerBgCls} ${scannerTextCls}`} placeholder="Paste or type text containing PII to scan..." />
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}>Redacted Output</label>
              {scanResult && (<span className={`text-xs px-2 py-0.5 rounded-full ${totalMatches > 0 ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}>{totalMatches} match{totalMatches !== 1 ? "es" : ""} found</span>)}
            </div>
            <div className={`w-full px-3 py-2 border rounded-lg text-sm min-h-[200px] max-h-[300px] overflow-auto whitespace-pre-wrap font-mono leading-relaxed ${scanResult ? scanResult.blocked ? "bg-red-900/30 border-red-700/50 text-red-300" : `${scannerBgCls} ${isDark ? "text-slate-300" : "text-gray-700"}` : `${isDark ? "bg-slate-900/40 border-slate-700/50 text-slate-600" : "bg-gray-50/50 border-gray-200 text-gray-400"}`}`} data-testid="text-redacted-output">
              {scanResult ? (
                scanResult.blocked ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[160px] gap-3">
                    <div className="w-12 h-12 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                    </div>
                    <p className="text-red-300 font-semibold text-sm">BLOCKED</p>
                    <p className="text-red-400/70 text-xs text-center">Content blocked — contains data matching a block rule</p>
                  </div>
                ) : scanResult.redactedText ? scanResult.redactedText : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[160px] gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
                    <p className="text-emerald-400 text-sm font-medium">No PII detected</p>
                    <p className={`text-xs ${isDark ? "text-slate-600" : "text-gray-400"}`}>Text is clean — no sensitive data found</p>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[160px] gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDark ? "text-slate-600" : "text-gray-400"}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <p className={`text-xs ${isDark ? "text-slate-600" : "text-gray-400"}`}>Scan results will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {scanResult && scanResult.findings.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {scanResult.findings.map((f, i) => {
              const colors = CATEGORY_COLORS[f.category] || CATEGORY_COLORS.ssn;
              return (
                <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colors.bg} ${colors.border}`} data-testid={`finding-${f.category}-${i}`}>
                  <span className={`text-xs font-medium ${colors.text}`}>{f.rule}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ACTION_COLORS[f.action]}`}>{f.action}</span>
                  <span className={`text-xs ${mutedCls}`}>{f.matches}×</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${panelCls} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={subtitleCls}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <h2 className={`text-lg font-semibold ${titleCls}`}>Detection Rules</h2>
            </div>
            <div className="flex items-center gap-2">
              {rules.length === 0 && (<button data-testid="button-add-defaults" onClick={handleAddDefaults} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}>Load Defaults</button>)}
              <button data-testid="button-add-rule" onClick={() => setShowAdd(true)} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Rule
              </button>
            </div>
          </div>

          {rules.length > 0 ? (
            <div className="space-y-2">
              {rules.map(rule => {
                const colors = CATEGORY_COLORS[rule.category] || { bg: "bg-slate-500/20", text: "text-slate-400", border: "border-slate-500/30", highlight: "" };
                return (
                  <div key={rule.id} className={`flex items-center justify-between py-2.5 px-3 rounded-lg border transition-all duration-300 ${rule.isActive ? cardCls : `${isDark ? "bg-slate-800/10 border-slate-700/20" : "bg-gray-50/50 border-gray-200"} opacity-60`}`} data-testid={`rule-${rule.id}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button data-testid={`toggle-rule-${rule.id}`} onClick={() => handleToggleRule(rule)} className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${rule.isActive ? "bg-emerald-600" : isDark ? "bg-slate-700" : "bg-gray-300"}`}>
                        <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-all ${rule.isActive ? "left-[18px]" : "left-[3px]"}`} />
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium text-sm truncate ${titleCls}`}>{rule.name}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${colors.bg} ${colors.text} ${colors.border}`}>{rule.category}</span>
                        </div>
                        <p className={`text-[10px] font-mono mt-0.5 truncate ${isDark ? "text-slate-600" : "text-gray-400"}`}>{rule.pattern.length > 35 ? rule.pattern.slice(0, 35) + "..." : rule.pattern}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ACTION_COLORS[rule.action] || "bg-slate-500/20 text-slate-400"}`}>{rule.action}</span>
                      <button data-testid={`delete-rule-${rule.id}`} onClick={() => handleDeleteRule(rule.id)} className={`transition-colors p-1 ${isDark ? "text-slate-600 hover:text-red-400" : "text-gray-400 hover:text-red-500"}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 border ${isDark ? "bg-slate-800 border-slate-700" : "bg-gray-100 border-gray-200"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDark ? "text-slate-600" : "text-gray-400"}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <p className={`text-sm ${mutedCls}`}>No PII rules configured</p>
              <p className={`text-xs mt-1 ${isDark ? "text-slate-600" : "text-gray-400"}`}>Add rules to detect and redact sensitive data</p>
            </div>
          )}
        </div>

        <div className={`${panelCls} p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={subtitleCls}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <h2 className={`text-lg font-semibold ${titleCls}`}>Recent PII Events</h2>
          </div>
          {events.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-auto">
              {events.map(event => {
                const colors = CATEGORY_COLORS[event.category] || { bg: "bg-slate-500/20", text: "text-slate-400", border: "border-slate-500/30", highlight: "" };
                return (
                  <div key={event.id} className={`flex items-center justify-between py-2 px-3 rounded-lg text-sm border ${cardCls}`} data-testid={`pii-event-${event.id}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${ACTION_COLORS[event.action] || "bg-slate-500/20 text-slate-400"}`}>{event.action}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${colors.bg} ${colors.text} ${colors.border}`}>{event.category}</span>
                      <span className={`text-xs shrink-0 ${mutedCls}`}>{event.direction === "inbound" ? "→ In" : "← Out"}</span>
                      {event.sample && <span className={`font-mono text-[10px] truncate ${isDark ? "text-slate-600" : "text-gray-400"}`}>{event.sample}</span>}
                    </div>
                    <span className={`text-[10px] shrink-0 ml-2 ${isDark ? "text-slate-600" : "text-gray-400"}`}>{new Date(event.createdAt).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 border ${isDark ? "bg-slate-800 border-slate-700" : "bg-gray-100 border-gray-200"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isDark ? "text-slate-600" : "text-gray-400"}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <p className={`text-sm ${mutedCls}`}>No PII events recorded</p>
              <p className={`text-xs mt-1 ${isDark ? "text-slate-600" : "text-gray-400"}`}>Events appear when PII is detected in agent traffic</p>
            </div>
          )}
        </div>
      </div>

      <div className={`border rounded-xl p-4 ${isDark ? "bg-slate-800/30 border-slate-700/30" : "bg-gray-50 border-gray-200"}`}>
        <div className="flex items-center gap-2 mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={mutedCls}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <h3 className={`text-sm font-medium ${subtitleCls}`}>Category Legend</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(CATEGORY_COLORS).map(([cat, colors]) => (
            <div key={cat} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${colors.bg} ${colors.border}`}>
              <div className={`w-2 h-2 rounded-full ${colors.text === "text-red-400" ? "bg-red-400" : colors.text === "text-blue-400" ? "bg-blue-400" : colors.text === "text-amber-400" ? "bg-amber-400" : colors.text === "text-purple-400" ? "bg-purple-400" : "bg-cyan-400"}`} />
              <span className={`text-xs ${colors.text} capitalize`}>{cat}</span>
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`border rounded-xl w-full max-w-md p-6 shadow-2xl ${modalCls}`}>
            <h2 className={`text-lg font-semibold mb-4 ${titleCls}`}>Add PII Rule</h2>
            <div className="space-y-4">
              <div><label className={labelCls}>Rule Name</label><input data-testid="input-rule-name" value={newRule.name} onChange={e => setNewRule(r => ({ ...r, name: e.target.value }))} className={inputCls} placeholder="e.g., SSN Detection" /></div>
              <div><label className={labelCls}>Category</label><select data-testid="select-rule-category" value={newRule.category} onChange={e => setNewRule(r => ({ ...r, category: e.target.value }))} className={inputCls}><option value="">Select category...</option><option value="ssn">SSN</option><option value="email">Email</option><option value="phone">Phone</option><option value="financial">Financial</option><option value="network">Network</option><option value="custom">Custom</option></select></div>
              <div><label className={labelCls}>Regex Pattern</label><input data-testid="input-rule-pattern" value={newRule.pattern} onChange={e => setNewRule(r => ({ ...r, pattern: e.target.value }))} className={`${inputCls} font-mono text-sm`} placeholder="\\b\\d{3}-\\d{2}-\\d{4}\\b" /></div>
              <div>
                <label className={labelCls}>Action</label>
                <select data-testid="select-rule-action" value={newRule.action} onChange={e => setNewRule(r => ({ ...r, action: e.target.value }))} className={inputCls}><option value="flag">Flag (log only)</option><option value="redact">Redact (replace with placeholder)</option><option value="block">Block (prevent processing)</option></select>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-600" : "text-gray-400"}`}>{ACTION_ICONS[newRule.action]}</p>
              </div>
              <div className="flex gap-3">
                <button data-testid="button-cancel-rule" onClick={() => setShowAdd(false)} className={`flex-1 py-2 rounded-lg transition-colors text-sm ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}>Cancel</button>
                <button data-testid="button-save-rule" onClick={handleAddRule} disabled={!newRule.name || !newRule.category || !newRule.pattern} className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 text-sm">Add Rule</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
