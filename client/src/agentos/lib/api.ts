const BASE = "/api/agentos";

async function request(path: string, options?: RequestInit) {
  const token = localStorage.getItem("aos_token");
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    credentials: "include",
  });

  if (res.status === 401) {
    localStorage.removeItem("aos_token");
    if (!window.location.pathname.includes("/agentos/login") && window.location.pathname !== "/agentos") {
      window.location.href = "/agentos/login";
    }
    throw new Error("Unauthorized");
  }

  if (res.headers.get("content-type")?.includes("text/csv")) {
    return res;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

export function setAosToken(token: string) {
  localStorage.setItem("aos_token", token);
}

export function clearAosToken() {
  localStorage.removeItem("aos_token");
}

export const aosGet = (path: string) => request(path);
export const aosPost = (path: string, data?: any) => request(path, { method: "POST", body: data ? JSON.stringify(data) : undefined });
export const aosPut = (path: string, data?: any) => request(path, { method: "PUT", body: data ? JSON.stringify(data) : undefined });
export const aosDelete = (path: string) => request(path, { method: "DELETE" });

interface CreateDepartmentPayload {
  name: string;
  description?: string;
  color?: string;
}

interface CreateAgentPayload {
  name: string;
  role?: string;
  description?: string;
  departmentId?: string;
  provider: string;
  llmModel: string;
  skills?: string[];
  tools?: string[];
  ownerId?: string;
  monthlyCap?: string;
  costPerToken?: string;
  avatarUrl?: string;
  config?: Record<string, unknown>;
  apiKey: string;
}

interface UpdateAgentPayload {
  name?: string;
  role?: string;
  description?: string;
  departmentId?: string;
  provider?: string;
  llmModel?: string;
  skills?: string[];
  tools?: string[];
  ownerId?: string;
  monthlyCap?: string | null;
  costPerToken?: string | null;
  avatarUrl?: string | null;
  config?: Record<string, unknown>;
}

interface UpdateUserPayload {
  role?: string;
  isActive?: boolean;
}

export const aosApi = {
  register: (data: { companyName: string; adminName: string; email: string; password: string; industry?: string; country?: string; website?: string }) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(data) }),

  logout: () => request("/auth/logout", { method: "POST" }),

  me: () => request("/auth/me"),

  getDashboardStats: () => request("/dashboard/stats"),
  getCommandCenterStats: () => request("/dashboard/command-center"),

  getDepartments: () => request("/departments"),
  createDepartment: (data: CreateDepartmentPayload) => request("/departments", { method: "POST", body: JSON.stringify(data) }),

  getAgents: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/agents${qs}`);
  },
  getAgent: (id: string) => request(`/agents/${id}`),
  createAgent: (data: CreateAgentPayload) => request("/agents", { method: "POST", body: JSON.stringify(data) }),
  updateAgent: (id: string, data: UpdateAgentPayload) => request(`/agents/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAgent: (id: string) => request(`/agents/${id}`, { method: "DELETE" }),
  transitionAgent: (id: string, status: string) => request(`/agents/${id}/transition`, { method: "POST", body: JSON.stringify({ status }) }),
  getAgentVersions: (id: string) => request(`/agents/${id}/versions`),
  getAgentUsage: (id: string, days?: number) => request(`/agents/${id}/usage${days ? `?days=${days}` : ""}`),
  setAgentApiKey: (id: string, apiKey: string) => request(`/agents/${id}/api-key`, { method: "POST", body: JSON.stringify({ apiKey }) }),
  removeAgentApiKey: (id: string) => request(`/agents/${id}/api-key`, { method: "DELETE" }),
  uploadAgentAvatar: async (id: string, file: File) => {
    const token = localStorage.getItem("aos_token");
    const formData = new FormData();
    formData.append("avatar", file);
    const res = await fetch(`${BASE}/agents/${id}/avatar`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Upload failed");
    return data as { avatarUrl: string };
  },
  removeAgentAvatar: (id: string) => request(`/agents/${id}/avatar`, { method: "DELETE" }),

  getUsers: () => request("/users"),
  getTeamMembers: () => request("/team-members"),
  inviteUser: (data: { name: string; email: string; role: string; password: string }) =>
    request("/users/invite", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: string, data: UpdateUserPayload) => request(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  getAuditLogs: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/audit-logs${qs}`);
  },

  activateKillSwitch: (agentId: string, reason: string) =>
    request(`/agents/${agentId}/kill-switch`, { method: "POST", body: JSON.stringify({ reason }) }),
  restoreKillSwitch: (agentId: string) =>
    request(`/agents/${agentId}/kill-switch/restore`, { method: "POST" }),
  getKillSwitchEvents: (agentId?: string) => {
    const qs = agentId ? `?agentId=${agentId}` : "";
    return request(`/kill-switch/events${qs}`);
  },

  getPiiRules: () => request("/pii/rules"),
  createPiiRule: (data: { name: string; category: string; pattern: string; action?: string }) =>
    request("/pii/rules", { method: "POST", body: JSON.stringify(data) }),
  updatePiiRule: (id: string, data: { name?: string; category?: string; pattern?: string; action?: string; isActive?: boolean }) =>
    request(`/pii/rules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePiiRule: (id: string) => request(`/pii/rules/${id}`, { method: "DELETE" }),
  getPiiEvents: () => request("/pii/events"),
  scanPii: (text: string, agentId?: string, direction?: string) =>
    request("/pii/scan", { method: "POST", body: JSON.stringify({ text, agentId, direction }) }),

  getReasoningTraces: (agentId?: string) => {
    const qs = agentId ? `?agentId=${agentId}` : "";
    return request(`/reasoning/traces${qs}`);
  },
  getReasoningTrace: (id: string) => request(`/reasoning/traces/${id}`),
  createReasoningTrace: (data: Record<string, unknown>) =>
    request("/reasoning/traces", { method: "POST", body: JSON.stringify(data) }),

  getDriftAlerts: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/drift/alerts${qs}`);
  },
  createDriftAlert: (data: Record<string, unknown>) =>
    request("/drift/alerts", { method: "POST", body: JSON.stringify(data) }),
  acknowledgeDriftAlert: (id: string) => request(`/drift/alerts/${id}/acknowledge`, { method: "POST" }),
  dismissDriftAlert: (id: string) => request(`/drift/alerts/${id}/dismiss`, { method: "POST" }),

  getShadowAgents: (status?: string) => {
    const qs = status ? `?status=${status}` : "";
    return request(`/shadow-agents${qs}`);
  },
  dismissShadowAgent: (id: string) => request(`/shadow-agents/${id}/dismiss`, { method: "POST" }),
  registerShadowAgent: (id: string) => request(`/shadow-agents/${id}/register`, { method: "POST" }),

  getNotifications: (unreadOnly?: boolean) => {
    const qs = unreadOnly ? "?unreadOnly=true" : "";
    return request(`/notifications${qs}`);
  },
  markNotificationRead: (id: string) => request(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request("/notifications/read-all", { method: "POST" }),

  getComplianceStats: () => request("/compliance/stats"),
  exportComplianceReport: () => request("/compliance/export"),
  getEvidencePack: (days?: number) => request(`/compliance/evidence-pack${days ? `?days=${days}` : ""}`),

  getSdkSnippet: () => request("/sdk/snippet"),

  completeOnboarding: () => request("/onboarding/complete", { method: "POST" }),
  discoverPeopleosAgents: () => request("/onboarding/peopleos-agents"),
  importPeopleosAgents: (agentKeys: string[]) => request("/onboarding/import-peopleos-agents", { method: "POST", body: JSON.stringify({ agentKeys }) }),
  seedOnboardingDemo: () => request("/onboarding/seed-demo", { method: "POST" }),
  seedDemoData: () => request("/seed-demo", { method: "POST" }),
  clearDemoData: () => request("/clear-demo", { method: "POST" }),

  getFleetRiskDistribution: () => request("/risk/fleet-distribution"),
  recalculateRiskScores: () => request("/risk/recalculate", { method: "POST" }),
  getAgentRiskBreakdown: (id: string) => request(`/agents/${id}/risk-breakdown`),

  getPolicyRules: () => request("/risk/policies"),
  createPolicyRule: (data: Record<string, unknown>) => request("/risk/policies", { method: "POST", body: JSON.stringify(data) }),
  updatePolicyRule: (id: string, data: Record<string, unknown>) => request(`/risk/policies/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePolicyRule: (id: string) => request(`/risk/policies/${id}`, { method: "DELETE" }),
  previewPolicyRule: (data: Record<string, unknown>) => request("/risk/policies/preview", { method: "POST", body: JSON.stringify(data) }),

  getPolicyViolations: (status?: string) => request(`/risk/violations${status ? `?status=${status}` : ""}`),
  resolvePolicyViolation: (id: string) => request(`/risk/violations/${id}/resolve`, { method: "POST" }),
  evaluateAgentRisk: (agentId: string) => request(`/risk/evaluate/${agentId}`, { method: "POST" }),

  getWorkforceReport: (days?: number, granularity?: string) => {
    const params = new URLSearchParams();
    if (days) params.set("days", String(days));
    if (granularity) params.set("granularity", granularity);
    const qs = params.toString();
    return request(`/analytics/workforce-report${qs ? `?${qs}` : ""}`);
  },
  getWorkforceStats: () => request("/analytics/workforce-stats"),
};
