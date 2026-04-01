import { useState, useEffect, useMemo } from "react";
import { aosApi } from "../lib/api";
import { useAosTheme } from "../AgentOSApp";
import AgentOSLogo from "../components/AgentOSLogo";

interface Agent {
  id: string;
  uid: string;
  name: string;
  role: string | null;
  provider: string;
  llmModel: string;
  status: string;
  departmentId: string | null;
  ownerId: string | null;
  monthlyCap: string | null;
  skills: string[];
  avatarUrl: string | null;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
}

interface User {
  id: string;
  name: string;
  role: string;
}

interface OrgNode {
  department: Department;
  owners: OwnerNode[];
  unassignedAgents: Agent[];
}

interface OwnerNode {
  user: User;
  agents: Agent[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  onboarding: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30", dot: "bg-amber-400" },
  active: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  suspended: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30", dot: "bg-red-400" },
  retired: { bg: "bg-slate-500/20", text: "text-slate-400", border: "border-slate-500/30", dot: "bg-slate-400" },
};

const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: "#10a37f",
  Anthropic: "#d4a27f",
  Google: "#4285f4",
  Meta: "#0668e1",
  Mistral: "#f7d046",
  Cohere: "#39594d",
  Custom: "#8b5cf6",
};

function ProviderIcon({ provider }: { provider: string }) {
  const color = PROVIDER_COLORS[provider] || "#8b5cf6";
  return (
    <div
      className="w-4 h-4 rounded-sm flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
      style={{ backgroundColor: color }}
      title={provider}
    >
      {provider.charAt(0)}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.retired;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {status}
    </span>
  );
}

function CostIndicator({ monthlyCap, isDark }: { monthlyCap: string | null; isDark: boolean }) {
  if (!monthlyCap) return null;
  const val = parseFloat(monthlyCap);
  if (isNaN(val)) return null;
  const bars = val > 5000 ? 3 : val > 1000 ? 2 : 1;
  return (
    <div className="flex items-center gap-0.5" title={`$${val.toLocaleString()}/mo cap`}>
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className={`w-1 rounded-full ${i <= bars ? "bg-emerald-400" : isDark ? "bg-slate-700" : "bg-slate-300"}`}
          style={{ height: 4 + i * 3 }}
        />
      ))}
    </div>
  );
}

function AgentAvatar({ avatarUrl, size = 24 }: { avatarUrl: string | null; size?: number }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => { setImgError(false); }, [avatarUrl]);

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        draggable={false}
        onError={() => setImgError(true)}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return <AgentOSLogo size={size} className="text-violet-400 flex-shrink-0" />;
}

function AgentNode({ agent, isDark, onNavigate }: { agent: Agent; isDark: boolean; onNavigate: (page: string) => void }) {
  return (
    <div
      data-testid={`orgchart-agent-${agent.id}`}
      onClick={() => onNavigate(`agents/${agent.id}`)}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all group ${
        isDark
          ? "bg-slate-800/60 border-slate-700/50 hover:border-violet-500/40 hover:bg-slate-800"
          : "bg-white border-slate-200 hover:border-violet-400/40 hover:shadow-sm"
      }`}
    >
      <AgentAvatar avatarUrl={agent.avatarUrl} size={24} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-medium truncate group-hover:text-violet-400 transition-colors ${isDark ? "text-white" : "text-slate-900"}`}>
            {agent.name}
          </span>
          <ProviderIcon provider={agent.provider} />
        </div>
        {agent.role && (
          <p className={`text-xs truncate ${isDark ? "text-slate-500" : "text-slate-400"}`}>{agent.role}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <CostIndicator monthlyCap={agent.monthlyCap} isDark={isDark} />
        <StatusBadge status={agent.status} />
      </div>
    </div>
  );
}

function HumanNode({ user, agentCount, isDark }: { user: User; agentCount: number; isDark: boolean }) {
  return (
    <div
      data-testid={`orgchart-human-${user.id}`}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${
        isDark
          ? "bg-slate-800/80 border-slate-600/50"
          : "bg-white border-slate-300 shadow-sm"
      }`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ${
        user.role === "admin" ? "bg-violet-600" : "bg-blue-600"
      }`}>
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <span className={`text-sm font-medium truncate block ${isDark ? "text-white" : "text-slate-900"}`}>
          {user.name}
        </span>
        <span className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
          {user.role} &middot; {agentCount} agent{agentCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

function TreeDesktop({ orgNodes, unassignedNode, companyName, isDark, onNavigate, onDeptFilter }: {
  orgNodes: OrgNode[];
  unassignedNode: OrgNode | null;
  companyName: string;
  isDark: boolean;
  onNavigate: (page: string) => void;
  onDeptFilter: (deptId: string) => void;
}) {
  const allNodes = [...orgNodes, ...(unassignedNode ? [unassignedNode] : [])];

  return (
    <div className="flex flex-col items-center" data-testid="orgchart-tree-view">
      <div className={`px-5 py-3 rounded-xl border-2 mb-2 ${
        isDark ? "bg-violet-600/20 border-violet-500/40 text-white" : "bg-violet-50 border-violet-300 text-violet-900"
      }`}>
        <span className="font-semibold text-sm">{companyName}</span>
      </div>

      {allNodes.length > 0 && (
        <>
          <div className={`w-0.5 h-6 ${isDark ? "bg-slate-700" : "bg-slate-300"}`} />
          <div className={`flex relative`}>
            {allNodes.length > 1 && (
              <div className={`absolute top-0 h-0.5 ${isDark ? "bg-slate-700" : "bg-slate-300"}`} style={{
                left: `calc(${100 / (allNodes.length * 2)}% )`,
                right: `calc(${100 / (allNodes.length * 2)}% )`,
              }} />
            )}
          </div>
          <div className="flex gap-6 flex-wrap justify-center">
            {allNodes.map((node, idx) => (
              <DepartmentBranch key={node.department.id || `unassigned-${idx}`} node={node} isDark={isDark} onNavigate={onNavigate} onDeptFilter={onDeptFilter} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DepartmentBranch({ node, isDark, onNavigate, onDeptFilter }: { node: OrgNode; isDark: boolean; onNavigate: (page: string) => void; onDeptFilter: (deptId: string) => void }) {
  const deptColor = node.department.color || "#8b5cf6";
  const totalAgents = node.owners.reduce((sum, o) => sum + o.agents.length, 0) + node.unassignedAgents.length;

  return (
    <div className="flex flex-col items-center min-w-[260px] max-w-[360px]">
      <div className={`w-0.5 h-4 ${isDark ? "bg-slate-700" : "bg-slate-300"}`} />
      <div
        data-testid={`orgchart-dept-${node.department.id || "unassigned"}`}
        onClick={() => node.department.id && onDeptFilter(node.department.id)}
        className={`px-4 py-2.5 rounded-xl border-2 mb-3 text-center w-full transition-colors ${
          node.department.id ? "cursor-pointer" : ""
        } ${
          isDark
            ? "bg-slate-800/80 border-slate-600/50 hover:border-violet-500/40"
            : "bg-white border-slate-300 shadow-sm hover:border-violet-400/40"
        }`}
        style={{ borderLeftColor: deptColor, borderLeftWidth: 4 }}
      >
        <span className={`font-semibold text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
          {node.department.name}
        </span>
        <span className={`text-xs ml-2 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
          {totalAgents} agent{totalAgents !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3 w-full">
        {node.owners.map(owner => (
          <div key={owner.user.id} className="w-full">
            <div className="flex flex-col items-center">
              <div className={`w-0.5 h-3 ${isDark ? "bg-slate-700" : "bg-slate-300"}`} />
              <HumanNode user={owner.user} agentCount={owner.agents.length} isDark={isDark} />
              {owner.agents.length > 0 && (
                <div className="w-full pl-6 mt-1 space-y-1">
                  {owner.agents.map(agent => (
                    <div key={agent.id} className="flex items-start">
                      <div className={`w-4 border-l-2 border-b-2 h-4 mt-2 mr-1 rounded-bl flex-shrink-0 ${
                        isDark ? "border-slate-700" : "border-slate-300"
                      }`} />
                      <div className="flex-1">
                        <AgentNode agent={agent} isDark={isDark} onNavigate={onNavigate} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {node.unassignedAgents.length > 0 && (
          <div className="w-full pl-6 space-y-1">
            <p className={`text-xs font-medium px-2 ${isDark ? "text-slate-600" : "text-slate-400"}`}>No assigned owner</p>
            {node.unassignedAgents.map(agent => (
              <div key={agent.id} className="flex items-start">
                <div className={`w-4 border-l-2 border-b-2 h-4 mt-2 mr-1 rounded-bl flex-shrink-0 ${
                  isDark ? "border-slate-700" : "border-slate-300"
                }`} />
                <div className="flex-1">
                  <AgentNode agent={agent} isDark={isDark} onNavigate={onNavigate} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ListMobile({ orgNodes, unassignedNode, companyName, isDark, onNavigate, onDeptFilter }: {
  orgNodes: OrgNode[];
  unassignedNode: OrgNode | null;
  companyName: string;
  isDark: boolean;
  onNavigate: (page: string) => void;
  onDeptFilter: (deptId: string) => void;
}) {
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  const toggleDept = (id: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allNodes = [...orgNodes, ...(unassignedNode ? [unassignedNode] : [])];

  return (
    <div className="space-y-2" data-testid="orgchart-list-view">
      <div className={`px-4 py-3 rounded-xl border-2 ${
        isDark ? "bg-violet-600/20 border-violet-500/40 text-white" : "bg-violet-50 border-violet-300 text-violet-900"
      }`}>
        <span className="font-semibold text-sm">{companyName}</span>
      </div>

      {allNodes.map(node => {
        const deptId = node.department.id || "unassigned";
        const isExpanded = expandedDepts.has(deptId);
        const deptColor = node.department.color || "#8b5cf6";
        const totalAgents = node.owners.reduce((sum, o) => sum + o.agents.length, 0) + node.unassignedAgents.length;

        return (
          <div key={deptId}>
            <div
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                isDark
                  ? "bg-slate-800/80 border-slate-700/50 hover:border-slate-600"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
              style={{ borderLeftColor: deptColor, borderLeftWidth: 4 }}
            >
              <button
                data-testid={`orgchart-dept-toggle-${deptId}`}
                onClick={() => toggleDept(deptId)}
                className={`p-1 rounded transition-colors flex-shrink-0 ${isDark ? "text-slate-400 hover:bg-slate-700" : "text-slate-500 hover:bg-slate-100"}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
              <button
                data-testid={`orgchart-dept-${deptId}`}
                onClick={() => node.department.id && onDeptFilter(node.department.id)}
                className={`flex-1 min-w-0 text-left ${node.department.id ? "cursor-pointer" : ""}`}
              >
                <span className={`font-medium text-sm truncate block ${isDark ? "text-white" : "text-slate-900"}`}>{node.department.name}</span>
              </button>
              <span className={`text-xs flex-shrink-0 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                {totalAgents} agent{totalAgents !== 1 ? "s" : ""}
              </span>
            </div>

            {isExpanded && (
              <div className="ml-4 mt-1 space-y-1">
                {node.owners.map(owner => (
                  <div key={owner.user.id} className="space-y-1">
                    <div className="ml-2">
                      <HumanNode user={owner.user} agentCount={owner.agents.length} isDark={isDark} />
                    </div>
                    <div className="ml-6 space-y-1">
                      {owner.agents.map(agent => (
                        <AgentNode key={agent.id} agent={agent} isDark={isDark} onNavigate={onNavigate} />
                      ))}
                    </div>
                  </div>
                ))}
                {node.unassignedAgents.length > 0 && (
                  <div className="ml-6 space-y-1">
                    <p className={`text-xs font-medium px-1 ${isDark ? "text-slate-600" : "text-slate-400"}`}>No assigned owner</p>
                    {node.unassignedAgents.map(agent => (
                      <AgentNode key={agent.id} agent={agent} isDark={isDark} onNavigate={onNavigate} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OrgChart({ onNavigate, companyName }: { onNavigate: (page: string) => void; companyName?: string }) {
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  const [agents, setAgents] = useState<Agent[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    Promise.allSettled([
      aosApi.getAgents(),
      aosApi.getDepartments(),
      aosApi.getTeamMembers(),
    ]).then(([agentsResult, deptsResult, usersResult]) => {
      if (agentsResult.status === "fulfilled") {
        const agentsList = Array.isArray(agentsResult.value) ? agentsResult.value : agentsResult.value?.agents || [];
        setAgents(agentsList);
      }
      if (deptsResult.status === "fulfilled") {
        setDepartments(deptsResult.value || []);
      }
      if (usersResult.status === "fulfilled") {
        setUsers(usersResult.value || []);
      }
    }).finally(() => setLoading(false));
  }, []);

  const { orgNodes, unassignedNode, stats } = useMemo(() => {
    const userMap = new Map(users.map(u => [u.id, u]));
    const deptMap = new Map(departments.map(d => [d.id, d]));

    const filteredAgents = departmentFilter
      ? agents.filter(a => a.departmentId === departmentFilter)
      : agents;

    const deptAgents = new Map<string, Agent[]>();
    const noDeptAgents: Agent[] = [];

    filteredAgents.forEach(agent => {
      if (agent.departmentId && deptMap.has(agent.departmentId)) {
        if (!deptAgents.has(agent.departmentId)) deptAgents.set(agent.departmentId, []);
        deptAgents.get(agent.departmentId)!.push(agent);
      } else if (!departmentFilter) {
        noDeptAgents.push(agent);
      }
    });

    const visibleDepts = departmentFilter
      ? departments.filter(d => d.id === departmentFilter)
      : departments;

    const orgNodes: OrgNode[] = visibleDepts.map(dept => {
      const deptAgentList = deptAgents.get(dept.id) || [];
      const ownerGroups = new Map<string, Agent[]>();
      const unowned: Agent[] = [];

      deptAgentList.forEach(agent => {
        if (agent.ownerId && userMap.has(agent.ownerId)) {
          if (!ownerGroups.has(agent.ownerId)) ownerGroups.set(agent.ownerId, []);
          ownerGroups.get(agent.ownerId)!.push(agent);
        } else {
          unowned.push(agent);
        }
      });

      const owners: OwnerNode[] = Array.from(ownerGroups.entries()).map(([userId, ags]) => ({
        user: userMap.get(userId)!,
        agents: ags,
      }));

      return { department: dept, owners, unassignedAgents: unowned };
    }).filter(n => n.owners.length > 0 || n.unassignedAgents.length > 0);

    let unassignedNode: OrgNode | null = null;
    if (noDeptAgents.length > 0 && !departmentFilter) {
      const ownerGroups = new Map<string, Agent[]>();
      const unowned: Agent[] = [];
      noDeptAgents.forEach(agent => {
        if (agent.ownerId && userMap.has(agent.ownerId)) {
          if (!ownerGroups.has(agent.ownerId)) ownerGroups.set(agent.ownerId, []);
          ownerGroups.get(agent.ownerId)!.push(agent);
        } else {
          unowned.push(agent);
        }
      });
      const owners: OwnerNode[] = Array.from(ownerGroups.entries()).map(([userId, ags]) => ({
        user: userMap.get(userId)!,
        agents: ags,
      }));
      unassignedNode = {
        department: { id: "", name: "Unassigned", description: null, color: "#64748b" },
        owners,
        unassignedAgents: unowned,
      };
    }

    const activeCount = agents.filter(a => a.status === "active").length;

    return {
      orgNodes,
      unassignedNode,
      stats: { totalAgents: agents.length, activeCount, totalOwners: users.length, totalDepts: departments.length },
    };
  }, [agents, departments, users, departmentFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="orgchart-loading">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="orgchart-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`} data-testid="text-orgchart-title">Org Chart</h1>
          <p className={`mt-1 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {stats.totalAgents} agents across {stats.totalDepts} departments, managed by {stats.totalOwners} team members
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            data-testid="select-orgchart-department-filter"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className={`px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
              isDark
                ? "bg-slate-800/50 border-slate-700 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {departmentFilter && (
            <button
              data-testid="button-clear-dept-filter-header"
              onClick={() => setDepartmentFilter("")}
              className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                isDark
                  ? "border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                  : "border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3`}>
        {[
          { label: "Total Agents", value: stats.totalAgents, color: "violet" },
          { label: "Active", value: stats.activeCount, color: "emerald" },
          { label: "Departments", value: stats.totalDepts, color: "blue" },
          { label: "Team Members", value: stats.totalOwners, color: "amber" },
        ].map(stat => (
          <div
            key={stat.label}
            className={`px-4 py-3 rounded-xl border ${
              isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-slate-200"
            }`}
          >
            <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>{stat.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${isDark ? "text-white" : "text-slate-900"}`} data-testid={`text-stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {agents.length === 0 ? (
        <div className={`text-center py-16 rounded-xl border ${isDark ? "bg-slate-800/30 border-slate-700/50" : "bg-white border-slate-200"}`}>
          <div className={`w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 ${isDark ? "bg-violet-600/10 border border-violet-500/20 text-violet-400" : "bg-violet-50 text-violet-500"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className={`font-semibold text-lg mb-1 ${isDark ? "text-white" : "text-slate-900"}`}>No agents registered yet</h3>
          <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>Register agents to see the organizational hierarchy</p>
        </div>
      ) : orgNodes.length === 0 && !unassignedNode ? (
        <div className={`text-center py-12 rounded-xl border ${isDark ? "bg-slate-800/30 border-slate-700/50" : "bg-white border-slate-200"}`}>
          <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            No agents found {departmentFilter ? "in this department" : ""}
          </p>
          {departmentFilter && (
            <button
              data-testid="button-clear-dept-filter"
              onClick={() => setDepartmentFilter("")}
              className="mt-2 text-sm text-violet-400 hover:text-violet-300"
            >
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <div className={`rounded-xl border p-6 overflow-x-auto ${isDark ? "bg-slate-900/30 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
          {isMobile ? (
            <ListMobile orgNodes={orgNodes} unassignedNode={unassignedNode} companyName={companyName || "Company"} isDark={isDark} onNavigate={onNavigate} onDeptFilter={setDepartmentFilter} />
          ) : (
            <TreeDesktop orgNodes={orgNodes} unassignedNode={unassignedNode} companyName={companyName || "Company"} isDark={isDark} onNavigate={onNavigate} onDeptFilter={setDepartmentFilter} />
          )}
        </div>
      )}
    </div>
  );
}
