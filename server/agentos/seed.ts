import { db } from "../db";
import {
  aosCompanies, aosDepartments, aosAgents, aosTelemetryEvents,
  aosPerformanceRatings, aosDriftAlerts, aosShadowAgents, aosPiiEvents,
  aosPiiRules, aosKillSwitchEvents, aosUsers, aosAuditLogs,
  aosReasoningTraces, aosReasoningSteps,
} from "@shared/agentos-schema";
import { eq, sql } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 4): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const DEPARTMENTS = [
  { name: "Engineering", description: "Software engineering and infrastructure", color: "#6366f1" },
  { name: "Product", description: "Product management and design", color: "#f59e0b" },
  { name: "Data Science", description: "Analytics, ML, and data pipelines", color: "#10b981" },
  { name: "Operations", description: "Business operations and logistics", color: "#3b82f6" },
  { name: "Customer Support", description: "Customer success and support", color: "#ef4444" },
];

const AGENTS = [
  { name: "CodeReview-Alpha", role: "Code Review", dept: "Engineering", provider: "Anthropic", model: "claude-3.5-sonnet", status: "active", salary: "95000", skills: ["code-review", "static-analysis"], tools: ["GitHub", "GitLab"] },
  { name: "CI-Pipeline-Bot", role: "CI/CD Automation", dept: "Engineering", provider: "OpenAI", model: "gpt-4o", status: "active", salary: "85000", skills: ["build-automation", "deployment"], tools: ["Jenkins", "Docker"] },
  { name: "Infra-Monitor", role: "Infrastructure Monitoring", dept: "Engineering", provider: "Google", model: "gemini-1.5-pro", status: "active", salary: "90000", skills: ["monitoring", "alerting"], tools: ["Datadog", "PagerDuty"] },
  { name: "Security-Sentinel", role: "Security Scanner", dept: "Engineering", provider: "Anthropic", model: "claude-3-opus", status: "active", salary: "110000", skills: ["vulnerability-scanning", "pen-testing"], tools: ["Snyk", "SonarQube"] },
  { name: "Doc-Writer-Pro", role: "Documentation Generator", dept: "Product", provider: "OpenAI", model: "gpt-4o-mini", status: "active", salary: "65000", skills: ["technical-writing", "api-docs"], tools: ["Confluence", "Notion"] },
  { name: "UX-Analyst", role: "UX Research Assistant", dept: "Product", provider: "Google", model: "gemini-1.5-flash", status: "onboarding", salary: "75000", skills: ["user-research", "survey-analysis"], tools: ["Hotjar", "Figma"] },
  { name: "Roadmap-Planner", role: "Feature Prioritization", dept: "Product", provider: "Anthropic", model: "claude-3.5-sonnet", status: "active", salary: "80000", skills: ["prioritization", "stakeholder-analysis"], tools: ["Jira", "Linear"] },
  { name: "Data-Pipeline-Agent", role: "ETL Orchestrator", dept: "Data Science", provider: "Meta", model: "llama-3.1-70b", status: "active", salary: "100000", skills: ["etl", "data-validation"], tools: ["Airflow", "dbt"] },
  { name: "ML-Trainer-v2", role: "Model Training", dept: "Data Science", provider: "OpenAI", model: "gpt-4-turbo", status: "probation", salary: "120000", skills: ["model-training", "hyperparameter-tuning"], tools: ["MLflow", "Weights & Biases"] },
  { name: "Analytics-Dash", role: "Dashboard Generator", dept: "Data Science", provider: "Mistral", model: "mistral-large", status: "active", salary: "70000", skills: ["data-visualization", "sql"], tools: ["Metabase", "Tableau"] },
  { name: "Forecast-Engine", role: "Demand Forecasting", dept: "Data Science", provider: "Google", model: "gemini-1.5-pro", status: "onboarding", salary: "105000", skills: ["time-series", "forecasting"], tools: ["BigQuery", "Looker"] },
  { name: "Ops-Scheduler", role: "Shift & Resource Planning", dept: "Operations", provider: "OpenAI", model: "gpt-4o", status: "active", salary: "60000", skills: ["scheduling", "optimization"], tools: ["Google Calendar", "Slack"] },
  { name: "Invoice-Bot", role: "Invoice Processing", dept: "Operations", provider: "Mistral", model: "mistral-medium", status: "active", salary: "55000", skills: ["ocr", "data-extraction"], tools: ["Xero", "QuickBooks"] },
  { name: "Compliance-Checker", role: "Regulatory Compliance", dept: "Operations", provider: "Anthropic", model: "claude-3.5-sonnet", status: "probation", salary: "95000", skills: ["compliance", "audit"], tools: ["Vanta", "Drata"] },
  { name: "Support-Bot-Prime", role: "Tier 1 Support", dept: "Customer Support", provider: "OpenAI", model: "gpt-4o-mini", status: "active", salary: "45000", skills: ["ticket-triage", "response-generation"], tools: ["Zendesk", "Intercom"] },
  { name: "Escalation-Agent", role: "Escalation Handler", dept: "Customer Support", provider: "Anthropic", model: "claude-3-haiku", status: "active", salary: "50000", skills: ["sentiment-analysis", "escalation"], tools: ["Zendesk", "Slack"] },
  { name: "Knowledge-Curator", role: "FAQ & Knowledge Base", dept: "Customer Support", provider: "Meta", model: "llama-3.1-8b", status: "suspended", salary: "40000", skills: ["content-curation", "search"], tools: ["Notion", "Algolia"] },
  { name: "Legacy-Chatbot", role: "Deprecated Chat Agent", dept: "Customer Support", provider: "OpenAI", model: "gpt-3.5-turbo", status: "retired", salary: "35000", skills: ["chat"], tools: ["Intercom"] },
  { name: "Bug-Triage-Bot", role: "Bug Classification", dept: "Engineering", provider: "Mistral", model: "mistral-large", status: "onboarding", salary: "70000", skills: ["classification", "prioritization"], tools: ["Jira", "GitHub Issues"] },
];

const COST_PER_MODEL: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
  "claude-3.5-sonnet": { input: 0.003, output: 0.015 },
  "claude-3-opus": { input: 0.015, output: 0.075 },
  "claude-3-haiku": { input: 0.00025, output: 0.00125 },
  "gemini-1.5-pro": { input: 0.00125, output: 0.005 },
  "gemini-1.5-flash": { input: 0.000075, output: 0.0003 },
  "llama-3.1-70b": { input: 0.00059, output: 0.00079 },
  "llama-3.1-8b": { input: 0.00018, output: 0.00018 },
  "mistral-large": { input: 0.002, output: 0.006 },
  "mistral-medium": { input: 0.0027, output: 0.0081 },
};

export async function seedDemoData(companyId: string, userId: string): Promise<{ success: boolean; message: string }> {
  const existingTelemetry = await db.select({ count: sql<number>`count(*)` })
    .from(aosTelemetryEvents).where(eq(aosTelemetryEvents.companyId, companyId));

  if (Number(existingTelemetry[0].count) > 0) {
    return { success: false, message: "Demo telemetry data already exists for this company." };
  }

  const existingAgentsList = await db.select()
    .from(aosAgents).where(eq(aosAgents.companyId, companyId));

  const agentMap: Record<string, { id: string; provider: string; model: string; status: string }> = {};
  for (const a of existingAgentsList) {
    agentMap[a.name] = { id: a.id, provider: a.provider, model: a.llmModel, status: a.status };
  }

  const existingDepts = await db.select().from(aosDepartments).where(eq(aosDepartments.companyId, companyId));
  const deptMap: Record<string, string> = {};
  for (const d of existingDepts) {
    deptMap[d.name] = d.id;
  }
  for (const dept of DEPARTMENTS) {
    if (!deptMap[dept.name]) {
      const [created] = await db.insert(aosDepartments).values({
        companyId,
        name: dept.name,
        description: dept.description,
        color: dept.color,
        budgetCap: String(randomBetween(5000, 20000)),
        budgetPeriod: "monthly",
        alertThreshold: 80,
      }).returning();
      deptMap[dept.name] = created.id;
    }
  }

  for (const agent of AGENTS) {
    if (agentMap[agent.name]) continue;
    const deploymentDate = agent.status === "active" ? daysAgo(randomBetween(15, 90)) : undefined;
    const [created] = await db.insert(aosAgents).values({
      companyId,
      uid: `AGT-${agent.provider.slice(0, 3).toUpperCase()}-${agent.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`,
      name: agent.name,
      role: agent.role,
      description: `${agent.role} agent powered by ${agent.provider} ${agent.model}`,
      departmentId: deptMap[agent.dept],
      provider: agent.provider,
      llmModel: agent.model,
      status: agent.status,
      ownerId: userId,
      deploymentDate,
      skills: agent.skills,
      tools: agent.tools,
      humanEquivalentRole: agent.role,
      humanEquivalentSalary: agent.salary,
      monthlyCap: String(randomBetween(500, 3000)),
      tags: [agent.dept.toLowerCase(), agent.provider.toLowerCase()],
      probationStartDate: agent.status === "probation" ? daysAgo(randomBetween(5, 15)) : undefined,
      probationDays: 30,
    }).returning();
    agentMap[agent.name] = { id: created.id, provider: agent.provider, model: agent.model, status: agent.status };
  }

  const activeAgentEntries = Object.entries(agentMap).filter(([_, a]) => ["active", "probation"].includes(a.status));
  const telemetryBatch: any[] = [];

  for (let day = 29; day >= 0; day--) {
    const isWeekend = [0, 6].includes(new Date(daysAgo(day)).getDay());
    const dailyMultiplier = isWeekend ? 0.3 : 1.0;
    const dayVariance = randomFloat(0.7, 1.3, 2);

    for (const [, agent] of activeAgentEntries) {
      const pricing = COST_PER_MODEL[agent.model] || { input: 0.001, output: 0.003 };
      const baseTaskCount = randomBetween(3, 12);
      const taskCount = Math.max(1, Math.floor(baseTaskCount * dailyMultiplier * dayVariance));

      for (let t = 0; t < taskCount; t++) {
        const hour = randomBetween(8, 20);
        const minute = randomBetween(0, 59);
        const ts = new Date(daysAgo(day));
        ts.setHours(hour, minute, randomBetween(0, 59));

        const inputTokens = randomBetween(200, 4000);
        const outputTokens = randomBetween(100, 2000);
        const totalTokens = inputTokens + outputTokens;
        const costUsd = (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
        const isSuccess = Math.random() > 0.08;

        telemetryBatch.push({
          companyId,
          agentId: agent.id,
          eventType: "task",
          provider: agent.provider,
          model: agent.model,
          inputTokens,
          outputTokens,
          totalTokens,
          costUsd: costUsd.toFixed(6),
          latencyMs: randomBetween(200, 8000),
          taskOutcome: isSuccess ? "success" : "failure",
          accuracyScore: isSuccess ? randomFloat(0.7, 1.0, 2) : randomFloat(0.2, 0.5, 2),
          errorMessage: isSuccess ? null : pickRandom(["Timeout exceeded", "Context window overflow", "Rate limited", "Invalid output format"]),
          timestamp: ts,
        });
      }
    }
  }

  for (let i = 0; i < telemetryBatch.length; i += 200) {
    const batch = telemetryBatch.slice(i, i + 200);
    await db.insert(aosTelemetryEvents).values(batch);
  }

  const ratingAgents = Object.entries(agentMap).filter(([_, a]) => a.status === "active");
  for (const [name, agent] of ratingAgents) {
    const numRatings = randomBetween(2, 5);
    for (let i = 0; i < numRatings; i++) {
      await db.insert(aosPerformanceRatings).values({
        companyId,
        agentId: agent.id,
        ratedBy: userId,
        rating: randomBetween(2, 5),
        comment: pickRandom([
          "Consistent performance, meets expectations",
          "Excellent response quality and low latency",
          "Good accuracy but occasional timeouts",
          "Needs improvement on complex tasks",
          "Outstanding — saves significant manual effort",
          "Reliable for routine tasks",
        ]),
        createdAt: daysAgo(randomBetween(1, 25)),
      });
    }
  }

  const agentsByName: Record<string, string> = {};
  for (const [name, info] of Object.entries(agentMap)) {
    agentsByName[name] = info.id;
  }
  const driftAlertDefs: Array<{
    agentName: string; metric: string; baselineValue: string; currentValue: string;
    threshold: string; severity: string; status: string; daysAgoCreated: number;
  }> = [
    { agentName: "CodeReview-Alpha", metric: "accuracy_score", baselineValue: "0.95", currentValue: "0.82", threshold: "0.10", severity: "critical", status: "open", daysAgoCreated: 0 },
    { agentName: "CI-Pipeline-Bot", metric: "avg_latency_ms", baselineValue: "1200", currentValue: "3500", threshold: "1000", severity: "warning", status: "open", daysAgoCreated: 1 },
    { agentName: "Infra-Monitor", metric: "error_rate", baselineValue: "0.03", currentValue: "0.12", threshold: "0.05", severity: "warning", status: "acknowledged", daysAgoCreated: 2 },
    { agentName: "Security-Sentinel", metric: "hallucination_rate", baselineValue: "0.02", currentValue: "0.15", threshold: "0.05", severity: "critical", status: "open", daysAgoCreated: 0 },
    { agentName: "Data-Pipeline-Agent", metric: "token_cost_per_task", baselineValue: "0.045", currentValue: "0.19", threshold: "0.08", severity: "warning", status: "open", daysAgoCreated: 1 },
    { agentName: "ML-Trainer-v2", metric: "response_quality", baselineValue: "0.91", currentValue: "0.73", threshold: "0.10", severity: "critical", status: "open", daysAgoCreated: 0 },
    { agentName: "Analytics-Dash", metric: "throughput_rps", baselineValue: "250", currentValue: "95", threshold: "100", severity: "warning", status: "acknowledged", daysAgoCreated: 3 },
    { agentName: "Support-Bot-Prime", metric: "customer_satisfaction_score", baselineValue: "4.5", currentValue: "3.1", threshold: "1.0", severity: "critical", status: "open", daysAgoCreated: 0 },
    { agentName: "Escalation-Agent", metric: "avg_latency_ms", baselineValue: "800", currentValue: "2200", threshold: "500", severity: "warning", status: "open", daysAgoCreated: 2 },
    { agentName: "Ops-Scheduler", metric: "memory_usage_mb", baselineValue: "512", currentValue: "1890", threshold: "500", severity: "critical", status: "acknowledged", daysAgoCreated: 5 },
    { agentName: "Invoice-Bot", metric: "uptime_percentage", baselineValue: "99.9", currentValue: "97.2", threshold: "1.5", severity: "warning", status: "dismissed", daysAgoCreated: 7 },
    { agentName: "Compliance-Checker", metric: "error_rate", baselineValue: "0.01", currentValue: "0.08", threshold: "0.03", severity: "warning", status: "dismissed", daysAgoCreated: 10 },
    { agentName: "Doc-Writer-Pro", metric: "hallucination_rate", baselineValue: "0.03", currentValue: "0.09", threshold: "0.04", severity: "info", status: "dismissed", daysAgoCreated: 12 },
    { agentName: "Roadmap-Planner", metric: "token_cost_per_task", baselineValue: "0.08", currentValue: "0.14", threshold: "0.05", severity: "info", status: "open", daysAgoCreated: 4 },
    { agentName: "CodeReview-Alpha", metric: "memory_usage_mb", baselineValue: "256", currentValue: "780", threshold: "300", severity: "info", status: "acknowledged", daysAgoCreated: 6 },
  ];
  for (const drift of driftAlertDefs) {
    const agentId = agentsByName[drift.agentName];
    if (!agentId) continue;
    await db.insert(aosDriftAlerts).values({
      companyId,
      agentId,
      metric: drift.metric,
      baselineValue: drift.baselineValue,
      currentValue: drift.currentValue,
      threshold: drift.threshold,
      severity: drift.severity,
      status: drift.status,
      acknowledgedBy: (drift.status === "acknowledged" || drift.status === "dismissed") ? userId : undefined,
      acknowledgedAt: (drift.status === "acknowledged" || drift.status === "dismissed") ? daysAgo(drift.daysAgoCreated > 0 ? drift.daysAgoCreated - 1 : 0) : undefined,
      createdAt: daysAgo(drift.daysAgoCreated),
    });
  }

  await db.insert(aosShadowAgents).values([
    {
      companyId,
      identifier: "unknown-gpt4-marketing",
      provider: "OpenAI",
      llmModel: "gpt-4",
      sourceIp: "10.0.5.42",
      department: "Marketing",
      firstSeenAt: daysAgo(12),
      lastSeenAt: daysAgo(1),
      callCount: 247,
      status: "unmanaged",
    },
    {
      companyId,
      identifier: "rogue-claude-finance",
      provider: "Anthropic",
      llmModel: "claude-3-haiku",
      sourceIp: "10.0.8.15",
      department: "Finance",
      firstSeenAt: daysAgo(5),
      lastSeenAt: daysAgo(0),
      callCount: 89,
      status: "unmanaged",
    },
    {
      companyId,
      identifier: "gemini-pro-research",
      provider: "Google",
      llmModel: "gemini-1.5-pro",
      sourceIp: "10.0.3.110",
      department: "Research",
      firstSeenAt: daysAgo(30),
      lastSeenAt: daysAgo(2),
      callCount: 1823,
      status: "registered",
    },
    {
      companyId,
      identifier: "mistral-large-engineering",
      provider: "Mistral",
      llmModel: "mistral-large",
      sourceIp: "10.0.2.77",
      department: "Engineering",
      firstSeenAt: daysAgo(21),
      lastSeenAt: daysAgo(0),
      callCount: 634,
      status: "unmanaged",
    },
    {
      companyId,
      identifier: "cohere-cmd-r-support",
      provider: "Cohere",
      llmModel: "command-r-plus",
      sourceIp: "10.0.9.201",
      department: "Customer Support",
      firstSeenAt: daysAgo(45),
      lastSeenAt: daysAgo(7),
      callCount: 3102,
      status: "registered",
    },
    {
      companyId,
      identifier: "gpt4o-sales-outreach",
      provider: "OpenAI",
      llmModel: "gpt-4o",
      sourceIp: "10.0.6.18",
      department: "Sales",
      firstSeenAt: daysAgo(3),
      lastSeenAt: daysAgo(0),
      callCount: 56,
      status: "unmanaged",
    },
    {
      companyId,
      identifier: "claude-sonnet-legal",
      provider: "Anthropic",
      llmModel: "claude-3.5-sonnet",
      sourceIp: "10.0.4.93",
      department: "Legal",
      firstSeenAt: daysAgo(18),
      lastSeenAt: daysAgo(3),
      callCount: 412,
      status: "dismissed",
    },
    {
      companyId,
      identifier: "gemini-flash-hr",
      provider: "Google",
      llmModel: "gemini-1.5-flash",
      sourceIp: "10.0.7.55",
      department: "Human Resources",
      firstSeenAt: daysAgo(60),
      lastSeenAt: daysAgo(14),
      callCount: 2450,
      status: "registered",
    },
    {
      companyId,
      identifier: "mixtral-devops-automation",
      provider: "Mistral",
      llmModel: "mixtral-8x7b",
      sourceIp: "10.0.1.132",
      department: "Engineering",
      firstSeenAt: daysAgo(8),
      lastSeenAt: daysAgo(0),
      callCount: 178,
      status: "unmanaged",
    },
    {
      companyId,
      identifier: "gpt35-intern-project",
      provider: "OpenAI",
      llmModel: "gpt-3.5-turbo",
      sourceIp: "10.0.10.44",
      department: "Marketing",
      firstSeenAt: daysAgo(90),
      lastSeenAt: daysAgo(30),
      callCount: 5210,
      status: "dismissed",
    },
  ]);

  const piiRuleIds: string[] = [];
  const piiRuleDefs = [
    { name: "SSN Detection", category: "ssn", pattern: "\\b\\d{3}-\\d{2}-\\d{4}\\b", action: "redact" },
    { name: "Email Detection", category: "email", pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}", action: "mask" },
    { name: "Credit Card Detection", category: "credit_card", pattern: "\\b\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}\\b", action: "block" },
  ];
  for (const rule of piiRuleDefs) {
    const [created] = await db.insert(aosPiiRules).values({ companyId, ...rule }).returning();
    piiRuleIds.push(created.id);
  }

  const piiAgentIds = Object.values(agentMap).filter(a => a.status === "active").slice(0, 4).map(a => a.id);
  const piiEventDefs = [
    { agentIdx: 0, ruleIdx: 0, category: "ssn", direction: "output", action: "redact", sample: "SSN: ***-**-****" },
    { agentIdx: 1, ruleIdx: 1, category: "email", direction: "input", action: "mask", sample: "j***@example.com" },
    { agentIdx: 0, ruleIdx: 2, category: "credit_card", direction: "output", action: "block", sample: "Card: ****-****-****-****" },
    { agentIdx: 2, ruleIdx: 1, category: "email", direction: "output", action: "mask", sample: "s***@company.io" },
    { agentIdx: 3, ruleIdx: 0, category: "ssn", direction: "input", action: "redact", sample: "SSN: ***-**-****" },
    { agentIdx: 1, ruleIdx: 2, category: "credit_card", direction: "input", action: "block", sample: "Card: ****-****-****-****" },
    { agentIdx: 2, ruleIdx: 0, category: "ssn", direction: "output", action: "redact", sample: "SSN: ***-**-****" },
    { agentIdx: 3, ruleIdx: 1, category: "email", direction: "output", action: "mask", sample: "t***@org.net" },
  ];
  for (const evt of piiEventDefs) {
    if (evt.agentIdx >= piiAgentIds.length) continue;
    await db.insert(aosPiiEvents).values({
      companyId,
      agentId: piiAgentIds[evt.agentIdx],
      ruleId: piiRuleIds[evt.ruleIdx],
      category: evt.category,
      direction: evt.direction,
      action: evt.action,
      sample: evt.sample,
      createdAt: daysAgo(randomBetween(0, 14)),
    });
  }

  const allAgentValues = Object.values(agentMap);
  const killAgentId = allAgentValues.find(a => a.status === "suspended")?.id || allAgentValues[0]?.id;
  if (killAgentId) {
    await db.insert(aosKillSwitchEvents).values({
      companyId,
      agentId: killAgentId,
      triggeredBy: userId,
      reason: "Agent exceeded error threshold — 15% failure rate detected over 24h window",
      revokedKeys: ["sdk-key-abc123"],
      restoredAt: daysAgo(2),
      restoredBy: userId,
      createdAt: daysAgo(5),
    });
  }

  const traceAgents = Object.entries(agentMap).filter(([_, a]) => a.status === "active").slice(0, 6);
  const TRACE_DEFS = [
    {
      agentName: traceAgents[0]?.[0],
      taskName: "Screen candidate resume — Senior Frontend Engineer",
      status: "completed",
      input: "Review resume for Sarah Chen applying for Senior Frontend Engineer position. Check for React/TypeScript experience, 5+ years, and portfolio quality.",
      output: "RECOMMENDATION: Strong Hire. Candidate exceeds requirements with 7 years React experience, TypeScript expertise, and impressive portfolio including 3 open-source projects with 2k+ GitHub stars.",
      durationMs: 12450,
      tokenCount: 3842,
      steps: [
        { type: "thought", title: "Analyzing resume structure and content", content: "The resume is well-structured with clear sections. I need to extract key qualifications: years of experience, tech stack, notable projects, and education.", durationMs: 180 },
        { type: "tool_call", title: "Extract skills from resume", toolName: "resume_parser", toolInput: { document: "sarah_chen_resume.pdf", extractFields: ["skills", "experience", "education"] }, toolOutput: { skills: ["React", "TypeScript", "Next.js", "GraphQL", "Node.js", "AWS"], experience: "7 years", education: "BS Computer Science, Stanford" }, durationMs: 2340 },
        { type: "observation", title: "Skills match analysis", content: "Candidate has 7 years of experience (exceeds 5-year requirement). Strong React and TypeScript skills confirmed. Additional expertise in Next.js, GraphQL — both valuable for the role.", durationMs: 150 },
        { type: "tool_call", title: "Check GitHub portfolio", toolName: "github_analyzer", toolInput: { username: "sarahchen-dev", metrics: ["stars", "contributions", "languages"] }, toolOutput: { totalStars: 2341, topRepos: ["react-data-grid (1.2k stars)", "ts-form-builder (890 stars)"], contributions: 1847, topLanguages: ["TypeScript", "JavaScript", "CSS"] }, durationMs: 3200 },
        { type: "thought", title: "Evaluating overall fit", content: "Strong technical profile with proven open-source contributions. GitHub activity shows consistent engagement. The candidate's experience aligns well with team needs.", durationMs: 120 },
        { type: "output", title: "Final recommendation generated", content: "Score: 92/100. Strong Hire recommendation with detailed breakdown of qualifications and fit assessment.", durationMs: 80 },
      ],
    },
    {
      agentName: traceAgents[1]?.[0],
      taskName: "Automated code review — PR #1247 auth middleware",
      status: "completed",
      input: "Review pull request #1247: 'Add JWT refresh token rotation to auth middleware'. Check for security vulnerabilities, code quality, and test coverage.",
      output: "REVIEW COMPLETE: 2 critical security issues found, 3 suggestions. Blocking merge until token expiry validation is fixed.",
      durationMs: 8920,
      tokenCount: 5210,
      steps: [
        { type: "thought", title: "Understanding PR scope", content: "PR adds refresh token rotation to the auth middleware. This is security-critical code — I need to carefully check token validation, storage, and expiry handling.", durationMs: 200 },
        { type: "tool_call", title: "Fetch PR diff", toolName: "github_pr_diff", toolInput: { repo: "acme/backend", prNumber: 1247 }, toolOutput: { filesChanged: 4, additions: 187, deletions: 23, files: ["src/middleware/auth.ts", "src/services/token.ts", "tests/auth.test.ts", "src/types/auth.d.ts"] }, durationMs: 1500 },
        { type: "tool_call", title: "Run static analysis", toolName: "semgrep_scan", toolInput: { files: ["src/middleware/auth.ts", "src/services/token.ts"], rules: ["jwt-security", "crypto-misuse"] }, toolOutput: { findings: [{ rule: "jwt-no-expiry-check", severity: "critical", file: "src/services/token.ts", line: 45 }, { rule: "weak-token-entropy", severity: "warning", file: "src/services/token.ts", line: 67 }] }, durationMs: 3100 },
        { type: "observation", title: "Critical: Missing token expiry validation", content: "Line 45 in token.ts creates refresh tokens without validating the expiry of the old token. An attacker could use an expired refresh token to generate new access tokens indefinitely.", durationMs: 180 },
        { type: "tool_call", title: "Check test coverage", toolName: "coverage_analyzer", toolInput: { files: ["src/middleware/auth.ts", "src/services/token.ts"] }, toolOutput: { coverage: { "auth.ts": 82, "token.ts": 45 }, missingTests: ["refresh token expiry edge case", "concurrent rotation handling"] }, durationMs: 2200 },
        { type: "output", title: "Review comment posted", content: "Posted review with 2 critical findings (blocking) and 3 improvement suggestions. Test coverage for token.ts needs to reach at least 80%.", durationMs: 90 },
      ],
    },
    {
      agentName: traceAgents[2]?.[0],
      taskName: "Tier-1 support ticket resolution — billing inquiry",
      status: "completed",
      input: "Customer ticket #8842: 'I was charged twice for my Pro plan this month. Please refund the duplicate charge. Account: enterprise@techcorp.io'",
      output: "Resolved. Duplicate charge confirmed and $49.99 refund initiated. Customer notified via email. Root cause: webhook retry during payment gateway timeout.",
      durationMs: 6780,
      tokenCount: 2150,
      steps: [
        { type: "thought", title: "Classifying support request", content: "This is a billing issue — duplicate charge complaint. Priority: High. I need to verify the duplicate charge, initiate refund if confirmed, and identify root cause.", durationMs: 120 },
        { type: "tool_call", title: "Look up customer billing history", toolName: "stripe_lookup", toolInput: { email: "enterprise@techcorp.io", period: "last_30_days" }, toolOutput: { charges: [{ amount: 49.99, date: "2026-03-15", status: "succeeded", id: "ch_abc123" }, { amount: 49.99, date: "2026-03-15", status: "succeeded", id: "ch_def456" }], plan: "Pro", customerId: "cus_xyz789" }, durationMs: 1800 },
        { type: "observation", title: "Duplicate charge confirmed", content: "Two identical charges of $49.99 on March 15. Both succeeded. This confirms the customer's report. The second charge (ch_def456) appears to be a duplicate from a webhook retry.", durationMs: 140 },
        { type: "tool_call", title: "Initiate refund for duplicate charge", toolName: "stripe_refund", toolInput: { chargeId: "ch_def456", amount: 49.99, reason: "duplicate" }, toolOutput: { refundId: "re_uvw321", status: "pending", estimatedArrival: "3-5 business days" }, durationMs: 2100 },
        { type: "tool_call", title: "Send customer notification", toolName: "email_sender", toolInput: { to: "enterprise@techcorp.io", template: "refund_confirmation", variables: { amount: "$49.99", refundId: "re_uvw321", eta: "3-5 business days" } }, toolOutput: { messageId: "msg_abc", status: "sent" }, durationMs: 800 },
        { type: "output", title: "Ticket resolved and documented", content: "Ticket #8842 resolved. Refund of $49.99 initiated (re_uvw321). Customer notified. Tagged for engineering review: payment webhook retry logic.", durationMs: 60 },
      ],
    },
    {
      agentName: traceAgents[3]?.[0],
      taskName: "Compliance audit — GDPR data retention check",
      status: "completed",
      input: "Run quarterly GDPR compliance check. Verify data retention policies are enforced across all user data stores. Flag any records exceeding retention period.",
      output: "AUDIT COMPLETE: 3 data stores checked. 847 records flagged for deletion (exceeding 24-month retention). Auto-purge scheduled for midnight UTC.",
      durationMs: 18340,
      tokenCount: 4580,
      steps: [
        { type: "thought", title: "Planning compliance audit scope", content: "Need to check three primary data stores: user profiles DB, analytics events, and support ticket archives. Retention policy is 24 months for all PII data.", durationMs: 250 },
        { type: "tool_call", title: "Scan user profiles database", toolName: "db_retention_scanner", toolInput: { database: "user_profiles", retentionMonths: 24, scanType: "pii_fields" }, toolOutput: { totalRecords: 145000, expiredRecords: 312, oldestRecord: "2023-08-14", fields: ["email", "phone", "address"] }, durationMs: 5200 },
        { type: "tool_call", title: "Scan analytics events store", toolName: "db_retention_scanner", toolInput: { database: "analytics_events", retentionMonths: 24, scanType: "user_identifiers" }, toolOutput: { totalRecords: 2800000, expiredRecords: 498, oldestRecord: "2023-06-22", fields: ["user_id", "ip_address", "device_fingerprint"] }, durationMs: 8100 },
        { type: "tool_call", title: "Scan support ticket archives", toolName: "db_retention_scanner", toolInput: { database: "support_tickets", retentionMonths: 24, scanType: "pii_fields" }, toolOutput: { totalRecords: 34500, expiredRecords: 37, oldestRecord: "2023-11-03", fields: ["customer_email", "phone_number"] }, durationMs: 3200 },
        { type: "observation", title: "Retention violations found", content: "Total 847 records across 3 stores exceed the 24-month retention period. Breakdown: 312 user profiles, 498 analytics events, 37 support tickets. All contain PII fields.", durationMs: 200 },
        { type: "action", title: "Schedule auto-purge job", content: "Scheduled deletion job for 847 records at midnight UTC. Backup snapshots created before purge. Compliance report generated for audit trail.", durationMs: 150 },
      ],
    },
    {
      agentName: traceAgents[4]?.[0],
      taskName: "ETL pipeline — daily sales data ingestion",
      status: "running",
      input: "Execute daily ETL pipeline: extract sales data from Salesforce, transform and validate, load into analytics warehouse.",
      output: null,
      durationMs: null,
      tokenCount: 1820,
      steps: [
        { type: "thought", title: "Initializing pipeline run", content: "Starting daily sales ETL. Source: Salesforce API. Target: BigQuery analytics warehouse. Expected volume: ~5,000 records based on recent daily averages.", durationMs: 100 },
        { type: "tool_call", title: "Extract records from Salesforce", toolName: "salesforce_api", toolInput: { object: "Opportunity", filter: "CloseDate = TODAY", fields: ["Id", "Amount", "Stage", "Account.Name", "Owner.Name"] }, toolOutput: { recordCount: 4872, extractedAt: "2026-03-22T08:15:00Z", sizeBytes: 2340000 }, durationMs: 4500 },
        { type: "tool_call", title: "Validate and transform data", toolName: "data_validator", toolInput: { schema: "sales_opportunity_v3", rules: ["no_null_amounts", "valid_stages", "currency_normalization"] }, toolOutput: { valid: 4851, invalid: 21, warnings: 3, transformations: ["USD normalization: 142 records", "stage mapping: 4872 records"] }, durationMs: 2800 },
      ],
    },
    {
      agentName: traceAgents[5]?.[0],
      taskName: "Infrastructure alert investigation — high CPU on prod-web-03",
      status: "failed",
      input: "Investigate PagerDuty alert: prod-web-03 CPU at 98% for 15 minutes. Determine root cause and take corrective action.",
      output: "FAILED: Unable to SSH into prod-web-03. Connection refused. Escalating to on-call SRE team.",
      durationMs: 45200,
      tokenCount: 2890,
      steps: [
        { type: "thought", title: "Assessing alert severity", content: "CPU at 98% for 15 minutes on a production web server is critical. Need to check if this is isolated or affecting the cluster. Will attempt to diagnose remotely first.", durationMs: 150 },
        { type: "tool_call", title: "Check cluster health", toolName: "datadog_query", toolInput: { query: "avg:system.cpu.user{host:prod-web-*}", timeRange: "30m" }, toolOutput: { results: [{ host: "prod-web-01", cpu: 45 }, { host: "prod-web-02", cpu: 52 }, { host: "prod-web-03", cpu: 98 }, { host: "prod-web-04", cpu: 41 }] }, durationMs: 2100 },
        { type: "observation", title: "Issue isolated to single host", content: "Only prod-web-03 shows elevated CPU. Other hosts in the cluster are healthy (41-52%). This suggests a process-level issue rather than a traffic spike.", durationMs: 120 },
        { type: "tool_call", title: "Attempt remote diagnostics", toolName: "ssh_exec", toolInput: { host: "prod-web-03", command: "top -bn1 | head -20" }, toolOutput: { error: "Connection refused", exitCode: -1 }, durationMs: 30000 },
        { type: "error", title: "SSH connection failed", content: "Cannot connect to prod-web-03 via SSH. The host may be unresponsive due to resource exhaustion. Escalating to human operator.", durationMs: 200 },
      ],
    },
  ];

  let traceCount = 0;
  for (const traceDef of TRACE_DEFS) {
    if (!traceDef.agentName) continue;
    const agent = agentMap[traceDef.agentName];
    if (!agent) continue;

    const createdAt = daysAgo(randomBetween(0, 7));
    const [trace] = await db.insert(aosReasoningTraces).values({
      companyId,
      agentId: agent.id,
      taskName: traceDef.taskName,
      status: traceDef.status,
      input: traceDef.input,
      output: traceDef.output,
      durationMs: traceDef.durationMs,
      tokenCount: traceDef.tokenCount,
      completedAt: traceDef.status === "completed" ? new Date(createdAt.getTime() + (traceDef.durationMs || 0)) : undefined,
      createdAt,
    }).returning();

    for (let i = 0; i < traceDef.steps.length; i++) {
      const step = traceDef.steps[i];
      await db.insert(aosReasoningSteps).values({
        traceId: trace.id,
        stepNumber: i + 1,
        type: step.type,
        title: step.title,
        content: step.content || null,
        toolName: step.toolName || null,
        toolInput: step.toolInput || null,
        toolOutput: step.toolOutput || null,
        durationMs: step.durationMs || null,
      });
    }
    traceCount++;
  }

  const agentCount = Object.keys(agentMap).length;
  const driftCount = driftAlertDefs.filter(d => agentsByName[d.agentName]).length;
  const piiCount = piiEventDefs.filter(e => e.agentIdx < piiAgentIds.length).length;

  await db.insert(aosAuditLogs).values([
    { companyId, userId, action: "seed_demo_data", entityType: "company", entityId: companyId, metadata: { agentCount, telemetryCount: telemetryBatch.length } },
    ...(killAgentId ? [
      { companyId, userId, action: "kill_switch_activated", entityType: "agent", entityId: killAgentId, metadata: { reason: "Error threshold exceeded" } },
      { companyId, userId, action: "kill_switch_restored", entityType: "agent", entityId: killAgentId },
    ] : []),
  ]);

  return { success: true, message: `Seeded ${agentCount} agents with ${telemetryBatch.length} telemetry events, ${driftCount} drift alerts, 2 shadow agents, ${piiCount} PII events, ${traceCount} reasoning traces, and ${killAgentId ? 1 : 0} kill switch event(s).` };
}

const DEMO_AGENT_NAMES = AGENTS.map(a => a.name);
const DEMO_DEPT_NAMES = DEPARTMENTS.map(d => d.name);

export async function clearDemoData(companyId: string): Promise<{ success: boolean; message: string }> {
  const companyAgents = await db.select({ id: aosAgents.id, name: aosAgents.name, uid: aosAgents.uid })
    .from(aosAgents).where(eq(aosAgents.companyId, companyId));

  const demoAgents = companyAgents.filter(a => DEMO_AGENT_NAMES.includes(a.name));
  const demoAgentIds = demoAgents.map(a => a.id);

  if (demoAgentIds.length === 0) {
    return { success: false, message: "No demo data found to clear." };
  }

  for (const agentId of demoAgentIds) {
    await db.delete(aosTelemetryEvents).where(sql`${aosTelemetryEvents.agentId} = ${agentId}`);
    await db.delete(aosPerformanceRatings).where(sql`${aosPerformanceRatings.agentId} = ${agentId}`);
    await db.delete(aosDriftAlerts).where(sql`${aosDriftAlerts.agentId} = ${agentId}`);
    await db.delete(aosPiiEvents).where(sql`${aosPiiEvents.agentId} = ${agentId}`);
    await db.delete(aosKillSwitchEvents).where(sql`${aosKillSwitchEvents.agentId} = ${agentId}`);
    await db.delete(aosReasoningTraces).where(sql`${aosReasoningTraces.agentId} = ${agentId}`);
    await db.delete(aosAuditLogs).where(sql`${aosAuditLogs.entityId} = ${agentId}`);
    await db.delete(aosAgents).where(sql`${aosAgents.id} = ${agentId}`);
  }

  await db.delete(aosShadowAgents).where(eq(aosShadowAgents.companyId, companyId));

  const remainingAgents = await db.select({ count: sql<number>`count(*)` })
    .from(aosAgents).where(eq(aosAgents.companyId, companyId));
  const agentsLeft = parseInt(String(remainingAgents[0].count), 10);

  if (agentsLeft === 0) {
    for (const deptName of DEMO_DEPT_NAMES) {
      await db.delete(aosDepartments).where(
        sql`${aosDepartments.companyId} = ${companyId} AND ${aosDepartments.name} = ${deptName}`
      );
    }
  }

  return { success: true, message: `Cleared ${demoAgentIds.length} demo agents and all associated data.` };
}
