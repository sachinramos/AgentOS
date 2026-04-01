import { db } from "../db";
import { aosCompanies, aosAgents, aosDepartments } from "@shared/agentos-schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import { clearTelemetryCache } from "./telemetry";

const ZIPHIRE_COMPANY_NAME = "Ziphire";

const ZIPHIRE_DEPARTMENTS = [
  { name: "AI Services", description: "Core AI-powered platform services", color: "#6366f1" },
  { name: "Talent Intelligence", description: "AI for talent matching and career guidance", color: "#10b981" },
  { name: "Content & Automation", description: "AI content generation and job automation", color: "#f59e0b" },
  { name: "HR Platform", description: "PeopleOS HR management AI", color: "#3b82f6" },
];

const ZIPHIRE_AGENTS = [
  { name: "PeopleOS Orchestrator", role: "HR AI Orchestrator", dept: "HR Platform", model: "gpt-4o-mini", skills: ["hr-management", "employee-ops", "payroll"], tools: ["OpenAI Chat", "HR Tools"] },
  { name: "Blog Generator", role: "SEO Content Generator", dept: "Content & Automation", model: "gpt-4o", skills: ["seo-writing", "content-generation", "image-generation"], tools: ["OpenAI Chat", "DALL-E 3"] },
  { name: "Visa Intelligence", role: "UK Visa SOC Classifier", dept: "Talent Intelligence", model: "gpt-4o-mini", skills: ["visa-classification", "soc-estimation"], tools: ["OpenAI Chat"] },
  { name: "Skills Gap Analyzer", role: "Skills Gap Analyst", dept: "Talent Intelligence", model: "gpt-4o-mini", skills: ["skills-analysis", "career-recommendations"], tools: ["OpenAI Chat"] },
  { name: "WhatsApp CV Parser", role: "CV Document Parser", dept: "AI Services", model: "gpt-4o", skills: ["document-parsing", "data-extraction"], tools: ["OpenAI Chat"] },
  { name: "Job Ingestion Classifier", role: "Job Classification", dept: "Content & Automation", model: "gpt-4o-mini", skills: ["job-classification", "industry-tagging"], tools: ["OpenAI Chat"] },
  { name: "AI Memory Service", role: "User Memory Extraction", dept: "AI Services", model: "gpt-4o-mini", skills: ["memory-extraction", "profile-compilation", "embeddings"], tools: ["OpenAI Chat", "Embeddings"] },
  { name: "WhatsApp CV Bot", role: "Recruiter WhatsApp Bot", dept: "AI Services", model: "gpt-4o-mini", skills: ["document-classification", "candidate-search"], tools: ["OpenAI Chat"] },
  { name: "Bayt Scraper AI", role: "Job Classification (Bayt)", dept: "Content & Automation", model: "gpt-4o-mini", skills: ["job-classification", "data-enrichment"], tools: ["OpenAI Chat"] },
];

const DUPLICATE_AGENT_NAMES_TO_CLEANUP = [
  "Zaki Career Copilot",
  "Command Center AI",
  "Re-Ranker",
  "gpt4o-sales-outreach",
];

const SEEDED_DUPLICATE_NAMES_WITH_USER_EQUIVALENT = [
  "Interactive CV Manager",
  "Zaki",
];

export async function seedZiphireAgents(): Promise<void> {
  try {
    let [company] = await db
      .select()
      .from(aosCompanies)
      .where(eq(aosCompanies.name, ZIPHIRE_COMPANY_NAME))
      .limit(1);

    if (!company) {
      [company] = await db.insert(aosCompanies).values({
        name: ZIPHIRE_COMPANY_NAME,
        industry: "HR Technology",
        country: "Bahrain",
        website: "https://ziphire.hr",
        size: "startup",
        currency: "USD",
        hasCompletedOnboarding: true,
      }).returning();
      console.log(`[ZiphireAgents] Created Ziphire company: ${company.id}`);
    }

    const companyId = company.id;

    const existingDepts = await db
      .select()
      .from(aosDepartments)
      .where(eq(aosDepartments.companyId, companyId));
    const deptMap: Record<string, string> = {};
    for (const d of existingDepts) {
      deptMap[d.name] = d.id;
    }

    for (const dept of ZIPHIRE_DEPARTMENTS) {
      if (!deptMap[dept.name]) {
        const [created] = await db.insert(aosDepartments).values({
          companyId,
          name: dept.name,
          description: dept.description,
          color: dept.color,
        }).returning();
        deptMap[dept.name] = created.id;
      }
    }

    const allDupeNames = [
      ...DUPLICATE_AGENT_NAMES_TO_CLEANUP,
      ...SEEDED_DUPLICATE_NAMES_WITH_USER_EQUIVALENT,
    ];
    const dupeAgents = await db
      .select({ id: aosAgents.id, name: aosAgents.name, uid: aosAgents.uid })
      .from(aosAgents)
      .where(and(
        eq(aosAgents.companyId, companyId),
        inArray(aosAgents.name, allDupeNames),
      ));

    const agentsToDelete = dupeAgents.filter(a => {
      if (DUPLICATE_AGENT_NAMES_TO_CLEANUP.includes(a.name)) return true;
      if (SEEDED_DUPLICATE_NAMES_WITH_USER_EQUIVALENT.includes(a.name)) {
        return a.uid?.startsWith("AGT-ZPH-");
      }
      return false;
    });

    if (agentsToDelete.length > 0) {
      const dupeIds = agentsToDelete.map(a => a.id);
      const fkTables = [
        "aos_telemetry_events",
        "aos_agent_versions",
        "aos_agent_tasks",
        "aos_agent_schedules",
        "aos_knowledge_base",
        "aos_integration_configs",
        "aos_escalation_rules",
        "aos_agent_cost_alerts",
        "aos_agent_metrics",
        "aos_budget_alerts",
        "aos_drift_alerts",
        "aos_kill_switch_events",
        "aos_performance_ratings",
        "aos_pii_events",
        "aos_policy_violations",
        "aos_reasoning_traces",
      ];
      for (const agentId of dupeIds) {
        for (const table of fkTables) {
          try {
            await db.execute(sql`DELETE FROM ${sql.raw(table)} WHERE agent_id = ${agentId}`);
          } catch (_) {}
        }
      }
      await db.delete(aosAgents).where(inArray(aosAgents.id, dupeIds));
      clearTelemetryCache();
      console.log(`[ZiphireAgents] Cleaned up ${agentsToDelete.length} duplicate agents: ${agentsToDelete.map(a => a.name).join(", ")}`);
    }

    const existingAgents = await db
      .select()
      .from(aosAgents)
      .where(eq(aosAgents.companyId, companyId));
    const agentNames = new Set(existingAgents.map(a => a.name));

    let created = 0;
    for (const agent of ZIPHIRE_AGENTS) {
      if (agentNames.has(agent.name)) continue;

      const uid = `AGT-ZPH-${agent.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;

      await db.insert(aosAgents).values({
        companyId,
        uid,
        name: agent.name,
        role: agent.role,
        description: `${agent.role} — Ziphire internal AI agent powered by OpenAI ${agent.model}`,
        departmentId: deptMap[agent.dept] || null,
        provider: "OpenAI",
        llmModel: agent.model,
        status: "active",
        deploymentDate: new Date(),
        skills: agent.skills,
        tools: agent.tools,
        tags: ["ziphire", "internal", agent.dept.toLowerCase().replace(/\s+/g, "-")],
      });
      created++;
    }

    if (created > 0) {
      clearTelemetryCache();
      console.log(`[ZiphireAgents] Registered ${created} new Ziphire agents in Agent OS`);
    } else {
      console.log(`[ZiphireAgents] All ${ZIPHIRE_AGENTS.length} Ziphire agents already registered`);
    }
  } catch (err: any) {
    console.error(`[ZiphireAgents] Failed to seed agents: ${err.message}`);
  }
}
