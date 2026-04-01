import { Router, Request, Response, NextFunction } from "express";
import { agentOSStorage } from "./storage";
import { insertAosAgentSchema, insertAosDepartmentSchema, insertAosTelemetryEventSchema, insertAosPerformanceRatingSchema, aosPlatformAdmins, aosPlatformSessions, aosCompanies, aosAgents, aosTelemetryEvents, aosDepartments, aosUsers, aosBudgetAlerts, aosDriftAlerts, aosPolicyViolations, aosPiiEvents, aosKillSwitchEvents, aosAuditLogs, aosShadowAgents } from "@shared/agentos-schema";
import { posAdminUsers, posCompanies } from "@shared/peopleos-schema";
import { recruiterSubscriptionTiers, recruiterSubscriptions, recruiters, agentActivityLogs, users, applications, jobs } from "@shared/schema";
import { seedDemoData, clearDemoData } from "./seed";
import { validateAgentWiring } from "./telemetry";
import { z } from "zod";
import crypto from "crypto";
import { promisify } from "util";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import multer from "multer";
import { ObjectStorageService } from "../objectStorage";
import { sendAgentOSInviteEmail } from "../services/resendEmailService";
import { db } from "../db";
import { eq, sql, desc, gte, count as drizzleCount, sum } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePassword(password: string, stored: string): Promise<boolean> {
  const [hash, salt] = stored.split(".");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(Buffer.from(hash, "hex"), buf);
}

function sanitizeAgentResponse<T extends { apiKeyEncrypted?: string | null }>(agent: T): Omit<T, 'apiKeyEncrypted'> & { hasApiKey: boolean } {
  const { apiKeyEncrypted, ...safe } = agent;
  return { ...safe, hasApiKey: !!apiKeyEncrypted };
}

function getAgentKeySecret(): string {
  const secret = process.env.AGENT_KEY_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("[AgentOS] AGENT_KEY_SECRET or SESSION_SECRET environment variable is required for agent API key encryption");
  }
  return secret;
}

function encryptAgentApiKey(plainKey: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(getAgentKeySecret(), "agentos-salt", 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plainKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decryptAgentApiKey(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = crypto.scryptSync(getAgentKeySecret(), "agentos-salt", 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function generateUID(provider: string, name: string): string {
  const prefix = provider.slice(0, 3).toUpperCase();
  const namePart = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `AGT-${prefix}-${namePart}-${rand}`;
}

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

const router = Router();

const agentAvatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

interface AuthRequest extends Request {
  aosCompanyId?: string;
  aosUserId?: string;
  aosUserRole?: string;
}

async function aosAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.aos_token;
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  const session = await agentOSStorage.getSessionByToken(token);
  if (!session) return res.status(401).json({ message: "Session expired" });

  const user = await agentOSStorage.getUser(session.userId);
  if (!user || !user.isActive) return res.status(401).json({ message: "Account disabled" });

  req.aosCompanyId = user.companyId;
  req.aosUserId = user.id;
  req.aosUserRole = user.role;
  next();
}

function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.aosUserRole || !roles.includes(req.aosUserRole)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

router.post("/auth/register", async (req: Request, res: Response) => {
  try {
    const { companyName, adminName, email, password, industry, country, website } = req.body;
    if (!companyName || !adminName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const existing = await agentOSStorage.getUserByEmail(email);
    if (existing) return res.status(400).json({ message: "Email already registered" });

    let posCompanyId: string | undefined;
    let posCompanyName: string | undefined;
    let peopleosLookupFailed = false;
    try {
      const [posAdmin] = await db.select({ companyId: posAdminUsers.companyId })
        .from(posAdminUsers)
        .where(eq(posAdminUsers.email, email.toLowerCase()))
        .limit(1);
      if (posAdmin) {
        const [posCompany] = await db.select({ id: posCompanies.id, name: posCompanies.name })
          .from(posCompanies)
          .where(eq(posCompanies.id, posAdmin.companyId))
          .limit(1);
        if (posCompany) {
          posCompanyId = posCompany.id;
          posCompanyName = posCompany.name;
          console.log(`[AgentOS] PeopleOS account detected for ${email} — company: ${posCompanyName}`);
        }
      }
    } catch (e) {
      console.warn("[AgentOS] PeopleOS lookup failed (non-blocking):", e);
      peopleosLookupFailed = true;
    }

    const company = await agentOSStorage.createCompany({
      name: companyName,
      industry: industry || undefined,
      country: country || undefined,
      website: website || undefined,
      posCompanyId: posCompanyId || undefined,
    });

    const passwordHash = await hashPassword(password);
    const user = await agentOSStorage.createUser({
      companyId: company.id,
      email: email.toLowerCase(),
      passwordHash,
      name: adminName,
      role: "admin",
    });

    const defaultDepts = ["Engineering", "Product", "Data Science", "Operations", "Customer Support"];
    for (const deptName of defaultDepts) {
      try {
        await agentOSStorage.createDepartment({ companyId: company.id, name: deptName });
      } catch {}
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await agentOSStorage.createSession(user.id, token, expiresAt);
    await agentOSStorage.updateUserLastLogin(user.id);

    res.cookie("aos_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      company: { id: company.id, name: company.name },
      peopleosLinked: !!posCompanyId,
      peopleosCompanyName: posCompanyName || null,
      peopleosLookupFailed,
    });
  } catch (error: any) {
    console.error("[AgentOS] Register error:", error);
    res.status(500).json({ message: error.message || "Registration failed" });
  }
});

router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const user = await agentOSStorage.getUserByEmail(email.toLowerCase());
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    await agentOSStorage.updateUserLastLogin(user.id);
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await agentOSStorage.createSession(user.id, token, expiresAt);

    const company = await agentOSStorage.getCompany(user.companyId);

    res.cookie("aos_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      company: company ? { id: company.id, name: company.name } : null,
    });
  } catch (error: any) {
    console.error("[AgentOS] Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

router.post("/auth/logout", aosAuth, async (req: AuthRequest, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.aos_token;
  if (token) await agentOSStorage.deleteSession(token);
  res.clearCookie("aos_token");
  res.json({ message: "Logged out" });
});

router.get("/auth/me", aosAuth, async (req: AuthRequest, res: Response) => {
  const user = await agentOSStorage.getUser(req.aosUserId!);
  const company = await agentOSStorage.getCompany(req.aosCompanyId!);
  if (!user || !company) return res.status(404).json({ message: "Not found" });
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl },
    company: { id: company.id, name: company.name, logoUrl: company.logoUrl, hasCompletedOnboarding: company.hasCompletedOnboarding, peopleosLinked: !!company.posCompanyId },
  });
});

router.post("/onboarding/complete", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    await agentOSStorage.updateCompany(req.aosCompanyId!, { hasCompletedOnboarding: true } as any);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[AgentOS] Complete onboarding error:", error);
    res.status(500).json({ message: "Failed to complete onboarding" });
  }
});

router.get("/onboarding/peopleos-agents", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const company = await agentOSStorage.getCompany(req.aosCompanyId!);
    if (!company?.posCompanyId) {
      return res.json({ available: false, agents: [] });
    }

    const posCompanyId = company.posCompanyId;
    const suggestedAgents: { key: string; name: string; role: string; description: string; provider: string; llmModel: string; reason: string }[] = [];

    let hasZakiAI = false;
    let hasInterviewCopilot = false;
    let hasWhatsApp = false;

    try {
      const tierResults = await db
        .select({
          hasZakiAI: recruiterSubscriptionTiers.hasZakiAI,
          hasInterviewCopilot: recruiterSubscriptionTiers.hasInterviewCopilot,
          hasWhatsApp: recruiterSubscriptionTiers.hasWhatsApp,
        })
        .from(recruiterSubscriptions)
        .innerJoin(recruiters, eq(recruiters.id, recruiterSubscriptions.recruiterId))
        .innerJoin(recruiterSubscriptionTiers, eq(recruiterSubscriptionTiers.id, recruiterSubscriptions.tierId))
        .innerJoin(posAdminUsers, eq(posAdminUsers.email, recruiters.email))
        .where(eq(posAdminUsers.companyId, posCompanyId))
        .limit(100);

      for (const tier of tierResults) {
        if (tier.hasZakiAI) hasZakiAI = true;
        if (tier.hasInterviewCopilot) hasInterviewCopilot = true;
        if (tier.hasWhatsApp) hasWhatsApp = true;
      }
    } catch (e) {
      console.warn("[AgentOS] PeopleOS tier lookup failed (non-blocking):", e);
    }

    let hasScreeningActivity = false;
    let hasJobPostingActivity = false;
    try {
      const companyRecruiters = await db
        .select({ id: recruiters.id })
        .from(recruiters)
        .where(eq(recruiters.posCompanyId, posCompanyId))
        .limit(100);

      if (companyRecruiters.length > 0) {
        const recruiterIds = companyRecruiters.map(r => r.id);

        const jobCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(jobs)
          .where(sql`${jobs.recruiterId} = ANY(${recruiterIds})`);
        hasJobPostingActivity = Number(jobCount[0]?.count || 0) > 0;

        if (hasJobPostingActivity) {
          const activityCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(agentActivityLogs)
            .innerJoin(users, eq(users.id, agentActivityLogs.userId))
            .innerJoin(applications, eq(applications.userId, users.id))
            .innerJoin(jobs, eq(jobs.id, applications.jobId))
            .where(sql`${jobs.recruiterId} = ANY(${recruiterIds}) AND ${agentActivityLogs.activityType} IN ('scan', 'match')`)
            .limit(1);
          hasScreeningActivity = Number(activityCount[0]?.count || 0) > 0;
        }
      }
    } catch (e) {
      console.warn("[AgentOS] PeopleOS activity lookup failed (non-blocking):", e);
    }

    if (hasZakiAI || hasScreeningActivity) {
      suggestedAgents.push({
        key: "hr-assistant",
        name: "HR Assistant",
        role: "General HR Operations",
        description: "Handles general HR queries, employee onboarding workflows, and policy lookups",
        provider: "OpenAI",
        llmModel: "gpt-4o-mini",
        reason: hasZakiAI ? "Zaki AI is enabled — core HR automation detected" : "Active candidate processing detected in your account",
      });

      suggestedAgents.push({
        key: "screening-agent",
        name: "Screening Agent",
        role: "Candidate Screening",
        description: "Automates initial candidate screening and qualification assessment",
        provider: "OpenAI",
        llmModel: "gpt-4o-mini",
        reason: hasZakiAI ? "Zaki AI is enabled in your plan" : "Active candidate screening activity detected",
      });

      suggestedAgents.push({
        key: "cv-parser",
        name: "CV Parser",
        role: "Resume Parsing & Analysis",
        description: "Extracts structured data from CVs and resumes for candidate profiles",
        provider: "OpenAI",
        llmModel: "gpt-4o-mini",
        reason: hasZakiAI ? "Zaki AI is enabled in your plan" : "Active resume processing detected",
      });
    }

    if (hasInterviewCopilot) {
      suggestedAgents.push({
        key: "interview-copilot",
        name: "Interview Copilot",
        role: "Interview Question Generation",
        description: "Generates role-specific interview questions and evaluates candidate responses",
        provider: "OpenAI",
        llmModel: "gpt-4o-mini",
        reason: "Interview Copilot is enabled in your plan",
      });
    }

    if (hasWhatsApp) {
      suggestedAgents.push({
        key: "whatsapp-agent",
        name: "WhatsApp Outreach Agent",
        role: "WhatsApp Candidate Communication",
        description: "Automates candidate outreach and communication via WhatsApp",
        provider: "OpenAI",
        llmModel: "gpt-4o-mini",
        reason: "WhatsApp integration is enabled in your plan",
      });
    }

    if (hasJobPostingActivity) {
      suggestedAgents.push({
        key: "jd-writer",
        name: "Job Description Writer",
        role: "Job Description Generation",
        description: "Creates compelling, compliant job descriptions tailored to your roles",
        provider: "OpenAI",
        llmModel: "gpt-4o",
        reason: "Active job postings detected in your account",
      });
    }

    res.json({ available: true, agents: suggestedAgents });
  } catch (error: any) {
    console.error("[AgentOS] PeopleOS agent discovery error:", error);
    res.status(500).json({ message: "Failed to discover PeopleOS agents" });
  }
});

router.post("/onboarding/import-peopleos-agents", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const VALID_KEYS = ["hr-assistant", "screening-agent", "cv-parser", "interview-copilot", "whatsapp-agent", "jd-writer"] as const;
    const schema = z.object({
      agentKeys: z.array(z.enum(VALID_KEYS)).min(1, "At least one agent must be selected"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
    }

    const { agentKeys } = parsed.data;
    const companyId = req.aosCompanyId!;
    const userId = req.aosUserId!;

    const company = await agentOSStorage.getCompany(companyId);
    if (!company?.posCompanyId) {
      return res.status(400).json({ message: "No linked PeopleOS account" });
    }

    const posCompanyId = company.posCompanyId;
    const allowedKeys = new Set<string>();

    try {
      const tierResults = await db
        .select({
          hasZakiAI: recruiterSubscriptionTiers.hasZakiAI,
          hasInterviewCopilot: recruiterSubscriptionTiers.hasInterviewCopilot,
          hasWhatsApp: recruiterSubscriptionTiers.hasWhatsApp,
        })
        .from(recruiterSubscriptions)
        .innerJoin(recruiters, eq(recruiters.id, recruiterSubscriptions.recruiterId))
        .innerJoin(recruiterSubscriptionTiers, eq(recruiterSubscriptionTiers.id, recruiterSubscriptions.tierId))
        .innerJoin(posAdminUsers, eq(posAdminUsers.email, recruiters.email))
        .where(eq(posAdminUsers.companyId, posCompanyId))
        .limit(100);

      for (const tier of tierResults) {
        if (tier.hasZakiAI) {
          allowedKeys.add("hr-assistant");
          allowedKeys.add("screening-agent");
          allowedKeys.add("cv-parser");
        }
        if (tier.hasInterviewCopilot) {
          allowedKeys.add("interview-copilot");
        }
        if (tier.hasWhatsApp) {
          allowedKeys.add("whatsapp-agent");
        }
      }
    } catch (e) {
      console.warn("[AgentOS] Tier check during import failed:", e);
    }

    try {
      const companyRecruiters = await db
        .select({ id: recruiters.id })
        .from(recruiters)
        .where(eq(recruiters.posCompanyId, posCompanyId))
        .limit(100);

      if (companyRecruiters.length > 0) {
        const recruiterIds = companyRecruiters.map(r => r.id);
        const jobCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(jobs)
          .where(sql`${jobs.recruiterId} = ANY(${recruiterIds})`);
        if (Number(jobCount[0]?.count || 0) > 0) {
          allowedKeys.add("jd-writer");
        }

        const activityCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(agentActivityLogs)
          .innerJoin(users, eq(users.id, agentActivityLogs.userId))
          .innerJoin(applications, eq(applications.userId, users.id))
          .innerJoin(jobs, eq(jobs.id, applications.jobId))
          .where(sql`${jobs.recruiterId} = ANY(${recruiterIds}) AND ${agentActivityLogs.activityType} IN ('scan', 'match')`)
          .limit(1);
        if (Number(activityCount[0]?.count || 0) > 0) {
          allowedKeys.add("hr-assistant");
          allowedKeys.add("screening-agent");
          allowedKeys.add("cv-parser");
        }
      }
    } catch (e) {
      console.warn("[AgentOS] Activity check during import failed:", e);
    }

    const disallowed = agentKeys.filter(k => !allowedKeys.has(k));
    if (disallowed.length > 0) {
      return res.status(403).json({ message: `Not entitled to import: ${disallowed.join(", ")}. Upgrade your PeopleOS plan to unlock these agents.` });
    }

    const AGENT_CATALOG: Record<string, { name: string; role: string; provider: string; llmModel: string; uidSuffix: string }> = {
      "hr-assistant": { name: "HR Assistant", role: "General HR Operations", provider: "OpenAI", llmModel: "gpt-4o-mini", uidSuffix: "HRAST" },
      "screening-agent": { name: "Screening Agent", role: "Candidate Screening", provider: "OpenAI", llmModel: "gpt-4o-mini", uidSuffix: "SCREEN" },
      "cv-parser": { name: "CV Parser", role: "Resume Parsing & Analysis", provider: "OpenAI", llmModel: "gpt-4o-mini", uidSuffix: "CVPARSE" },
      "interview-copilot": { name: "Interview Copilot", role: "Interview Question Generation", provider: "OpenAI", llmModel: "gpt-4o-mini", uidSuffix: "INTCOP" },
      "whatsapp-agent": { name: "WhatsApp Outreach Agent", role: "WhatsApp Candidate Communication", provider: "OpenAI", llmModel: "gpt-4o-mini", uidSuffix: "WHTSAP" },
      "jd-writer": { name: "Job Description Writer", role: "Job Description Generation", provider: "OpenAI", llmModel: "gpt-4o", uidSuffix: "JDWRITE" },
    };

    let hrDeptId: string | null = null;
    const existingDepts = await agentOSStorage.getDepartments(companyId);
    const hrDept = existingDepts.find(d => d.name === "HR Operations");
    if (hrDept) {
      hrDeptId = hrDept.id;
    } else {
      try {
        const created = await agentOSStorage.createDepartment({ companyId, name: "HR Operations" });
        hrDeptId = created.id;
      } catch (e) {
        console.warn("[AgentOS] Failed to create HR Operations department:", e);
      }
    }

    const imported: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];

    for (const key of agentKeys) {
      const agentDef = AGENT_CATALOG[key];
      if (!agentDef) continue;

      try {
        const uid = `AGT-POS-${agentDef.uidSuffix}-${companyId.slice(0, 6).toUpperCase()}`;
        await agentOSStorage.createAgent({
          companyId,
          name: agentDef.name,
          role: agentDef.role,
          provider: agentDef.provider,
          llmModel: agentDef.llmModel,
          uid,
          departmentId: hrDeptId,
          status: "active",
          skills: [],
          ownerId: userId,
        });
        imported.push(agentDef.name);
      } catch (e: any) {
        if (e?.message?.includes("duplicate") || e?.code === "23505") {
          skipped.push(agentDef.name);
        } else {
          failed.push(agentDef.name);
          console.warn(`[AgentOS] Failed to import PeopleOS agent ${agentDef.name}:`, e);
        }
      }
    }

    console.log(`[AgentOS] Import result for company ${companyId}: imported=${imported.length}, skipped=${skipped.length}, failed=${failed.length}`);
    res.json({ success: true, imported, skipped, failed, count: imported.length });
  } catch (error: any) {
    console.error("[AgentOS] PeopleOS agent import error:", error);
    res.status(500).json({ message: "Failed to import agents" });
  }
});

router.post("/onboarding/seed-demo", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.aosCompanyId!;
    const userId = req.aosUserId!;

    const departments = await agentOSStorage.getDepartments(companyId);
    const deptMap: Record<string, string> = {};
    for (const d of departments) {
      deptMap[d.name] = d.id;
    }

    const demoAgents = [
      { name: "CodeReview-Bot", provider: "OpenAI", llmModel: "gpt-4o", role: "Code Reviewer", description: "Automated code review and quality analysis", status: "active" },
      { name: "CustomerSupport-AI", provider: "Anthropic", llmModel: "claude-3.5-sonnet", role: "Support Agent", description: "Handles customer inquiries and ticket routing", status: "active" },
      { name: "DataPipeline-Agent", provider: "Google", llmModel: "gemini-1.5-pro", role: "Data Engineer", description: "Manages ETL pipelines and data transformations", status: "active" },
      { name: "SecurityScanner", provider: "OpenAI", llmModel: "gpt-4o-mini", role: "Security Analyst", description: "Continuous security vulnerability scanning", status: "onboarding" },
      { name: "ContentWriter-AI", provider: "Anthropic", llmModel: "claude-3.5-sonnet", role: "Content Creator", description: "Generates marketing copy and documentation", status: "active" },
      { name: "QA-TestBot", provider: "Mistral", llmModel: "mistral-large", role: "QA Engineer", description: "Automated testing and regression analysis", status: "suspended" },
      { name: "HR-Assistant", provider: "OpenAI", llmModel: "gpt-4o", role: "HR Coordinator", description: "Screens resumes and schedules interviews", status: "active" },
      { name: "FinanceAnalyzer", provider: "Google", llmModel: "gemini-1.5-pro", role: "Financial Analyst", description: "Budget forecasting and expense analysis", status: "active" },
    ];

    const deptAssignments = ["Engineering", "Customer Support", "Data Science", "Engineering", "Product", "Engineering", "Operations", "Operations"];
    const createdAgents = [];

    for (let i = 0; i < demoAgents.length; i++) {
      const a = demoAgents[i];
      const uid = generateUID(a.provider, a.name);
      const departmentId = deptMap[deptAssignments[i]] || undefined;
      const agent = await agentOSStorage.createAgent({
        ...a,
        uid,
        companyId,
        departmentId,
        ownerId: userId,
        skills: [],
        tools: [],
      });
      createdAgents.push(agent);

      await agentOSStorage.createAgentVersion({
        agentId: agent.id,
        version: 1,
        changes: "Demo data - initial registration",
        snapshot: agent as any,
        changedBy: userId,
      });
    }

    res.json({ success: true, agentsCreated: createdAgents.length });
  } catch (error: any) {
    console.error("[AgentOS] Seed demo data error:", error);
    res.status(500).json({ message: error.message || "Failed to seed demo data" });
  }
});

router.get("/dashboard/stats", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await agentOSStorage.getDashboardStats(req.aosCompanyId!);
    res.json({ ...stats, recentAgents: stats.recentAgents.map(a => sanitizeAgentResponse(a)) });
  } catch (error: any) {
    console.error("[AgentOS] Dashboard stats error:", error?.message || error);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
});

const commandCenterCache = new Map<string, { data: any; timestamp: number }>();
const COMMAND_CENTER_CACHE_TTL = 2 * 60 * 1000;

router.get("/dashboard/command-center", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = req.aosCompanyId!;
    const cached = commandCenterCache.get(companyId);
    if (cached && Date.now() - cached.timestamp < COMMAND_CENTER_CACHE_TTL) {
      return res.json(cached.data);
    }
    const stats = await agentOSStorage.getCommandCenterStats(companyId);
    commandCenterCache.set(companyId, { data: stats, timestamp: Date.now() });
    res.json(stats);
  } catch (error: any) {
    console.error("[AgentOS] Command center stats error:", error?.message || error);
    res.status(500).json({ message: "Failed to load command center" });
  }
});

router.post("/seed-demo", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const result = await seedDemoData(req.aosCompanyId!, req.aosUserId!);
    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }
    res.json(result);
  } catch (error: any) {
    console.error("[AgentOS] Seed demo error:", error?.message || error);
    res.status(500).json({ message: "Failed to seed demo data" });
  }
});

router.post("/clear-demo", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const result = await clearDemoData(req.aosCompanyId!);
    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }
    res.json(result);
  } catch (error: any) {
    console.error("[AgentOS] Clear demo error:", error?.message || error);
    res.status(500).json({ message: "Failed to clear demo data" });
  }
});

router.get("/departments", aosAuth, async (req: AuthRequest, res: Response) => {
  const departments = await agentOSStorage.getDepartments(req.aosCompanyId!);
  res.json(departments);
});

router.post("/departments", aosAuth, requireRole("admin", "manager"), async (req: AuthRequest, res: Response) => {
  try {
    const dept = await agentOSStorage.createDepartment({ ...req.body, companyId: req.aosCompanyId! });

    agentOSStorage.logAudit({
      companyId: req.aosCompanyId!,
      userId: req.aosUserId,
      action: "department_created",
      entityType: "department",
      entityId: dept.id,
      metadata: { name: dept.name },
    });

    res.status(201).json(dept);
  } catch (error) {
    res.status(500).json({ message: "Failed to create department" });
  }
});

router.put("/departments/:id", aosAuth, requireRole("admin", "manager"), async (req: AuthRequest, res: Response) => {
  const dept = await agentOSStorage.updateDepartment(req.params.id, req.aosCompanyId!, req.body);
  if (!dept) return res.status(404).json({ message: "Department not found" });
  res.json(dept);
});

router.delete("/departments/:id", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const deleted = await agentOSStorage.deleteDepartment(req.params.id, req.aosCompanyId!);
  if (!deleted) return res.status(404).json({ message: "Department not found" });
  res.json({ message: "Deleted" });
});

router.get("/agents", aosAuth, async (req: AuthRequest, res: Response) => {
  const filters = {
    status: req.query.status as string | undefined,
    provider: req.query.provider as string | undefined,
    departmentId: req.query.departmentId as string | undefined,
    search: req.query.search as string | undefined,
  };
  const agents = await agentOSStorage.getAgents(req.aosCompanyId!, filters);
  res.json(agents.map(({ apiKeyEncrypted, ...a }) => ({ ...a, hasApiKey: !!apiKeyEncrypted })));
});

router.get("/agents/:id", aosAuth, async (req: AuthRequest, res: Response) => {
  const agent = await agentOSStorage.getAgent(req.params.id, req.aosCompanyId!);
  if (!agent) return res.status(404).json({ message: "Agent not found" });
  res.json(sanitizeAgentResponse(agent));
});

router.post("/agents", aosAuth, requireRole("admin", "manager"), async (req: AuthRequest, res: Response) => {
  try {
    const { apiKey, ...agentData } = req.body;
    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 8) {
      return res.status(400).json({ message: "Provider API key is required and must be at least 8 characters" });
    }

    const trimmedKey = apiKey.trim();
    const encrypted = encryptAgentApiKey(trimmedKey);
    const last4 = trimmedKey.slice(-4);
    const maskedKey = `****${last4}`;

    const uid = generateUID(agentData.provider || "UNK", agentData.name || "AGENT");
    const agent = await agentOSStorage.createAgent({
      ...agentData,
      uid,
      companyId: req.aosCompanyId!,
      apiKeyEncrypted: encrypted,
      apiKeyPrefix: maskedKey,
    });

    await agentOSStorage.createAgentVersion({
      agentId: agent.id,
      version: 1,
      changes: "Initial registration",
      snapshot: agent as any,
      changedBy: req.aosUserId,
    });

    agentOSStorage.logAudit({
      companyId: req.aosCompanyId!,
      userId: req.aosUserId,
      action: "agent_created",
      entityType: "agent",
      entityId: agent.id,
      metadata: { name: agent.name, provider: agent.provider, uid },
    });

    try {
      await agentOSStorage.calculateRiskScore(agent.id, req.aosCompanyId!);
    } catch (riskErr) {
      console.warn("[AgentOS] Risk score calculation failed for new agent:", agent.id, riskErr);
    }

    res.status(201).json(sanitizeAgentResponse(agent));
  } catch (error: any) {
    console.error("[AgentOS] Create agent error:", error);
    res.status(500).json({ message: error.message || "Failed to create agent" });
  }
});

router.put("/agents/:id", aosAuth, requireRole("admin", "manager"), async (req: AuthRequest, res: Response) => {
  try {
    const current = await agentOSStorage.getAgent(req.params.id, req.aosCompanyId!);
    if (!current) return res.status(404).json({ message: "Agent not found" });

    const agent = await agentOSStorage.updateAgent(req.params.id, req.aosCompanyId!, req.body);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    const newVersion = (current.version || 1) + 1;
    await agentOSStorage.updateAgent(req.params.id, req.aosCompanyId!, { version: newVersion } as any);

    await agentOSStorage.createAgentVersion({
      agentId: agent.id,
      version: newVersion,
      changes: `Updated: ${Object.keys(req.body).join(", ")}`,
      snapshot: agent as any,
      changedBy: req.aosUserId,
    });

    agentOSStorage.logAudit({
      companyId: req.aosCompanyId!,
      userId: req.aosUserId,
      action: "agent_updated",
      entityType: "agent",
      entityId: agent.id,
      metadata: { changes: Object.keys(req.body) },
    });

    try {
      await agentOSStorage.calculateRiskScore(agent.id, req.aosCompanyId!);
      await agentOSStorage.evaluatePoliciesForAgent(agent.id, req.aosCompanyId!);
    } catch (riskErr) {
      console.warn("[AgentOS] Risk recalculation failed on agent update:", agent.id, riskErr);
    }

    res.json(sanitizeAgentResponse({ ...agent, version: newVersion }));
  } catch (error) {
    res.status(500).json({ message: "Failed to update agent" });
  }
});

router.post("/agents/:id/avatar", aosAuth, requireRole("admin", "manager"), agentAvatarUpload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    const agent = await agentOSStorage.getAgent(req.params.id, req.aosCompanyId!);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    const objectStorageService = new ObjectStorageService();
    const avatarUrl = await objectStorageService.uploadBuffer(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    await agentOSStorage.updateAgent(req.params.id, req.aosCompanyId!, { avatarUrl });

    res.json({ avatarUrl });
  } catch (error: any) {
    console.error("[AgentOS] Agent avatar upload error:", error);
    res.status(500).json({ message: error.message || "Failed to upload avatar" });
  }
});

router.delete("/agents/:id/avatar", aosAuth, requireRole("admin", "manager"), async (req: AuthRequest, res: Response) => {
  try {
    const agent = await agentOSStorage.getAgent(req.params.id, req.aosCompanyId!);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    await agentOSStorage.updateAgent(req.params.id, req.aosCompanyId!, { avatarUrl: null });

    res.json({ message: "Avatar removed" });
  } catch (error: any) {
    console.error("[AgentOS] Agent avatar remove error:", error);
    res.status(500).json({ message: error.message || "Failed to remove avatar" });
  }
});

router.delete("/agents/:id", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const deleted = await agentOSStorage.deleteAgent(req.params.id, req.aosCompanyId!);
  if (!deleted) return res.status(404).json({ message: "Agent not found" });

  agentOSStorage.logAudit({
    companyId: req.aosCompanyId!,
    userId: req.aosUserId,
    action: "agent_deleted",
    entityType: "agent",
    entityId: req.params.id,
  });

  res.json({ message: "Deleted" });
});

router.post("/agents/:id/transition", aosAuth, requireRole("admin", "manager"), async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ message: "Status is required" });

  const currentAgent = await agentOSStorage.getAgent(req.params.id, req.aosCompanyId!);
  if (!currentAgent) return res.status(404).json({ message: "Agent not found" });

  if (status === "active") {
    const validation = validateAgentWiring(currentAgent);
    if (!validation.isValid) {
      return res.status(400).json({
        message: "Agent activation validation failed",
        validation,
      });
    }
  }

  const agent = await agentOSStorage.transitionAgent(req.params.id, req.aosCompanyId!, status);
  if (!agent) return res.status(400).json({ message: "Invalid transition or agent not found" });

  const validation = status === "active" ? validateAgentWiring(currentAgent) : undefined;

  agentOSStorage.logAudit({
    companyId: req.aosCompanyId!,
    userId: req.aosUserId,
    action: "agent_transitioned",
    entityType: "agent",
    entityId: agent.id,
    metadata: { newStatus: status, ...(validation ? { validation } : {}) },
  });

  res.json({ ...sanitizeAgentResponse(agent), ...(validation ? { validation } : {}) });
});

router.get("/agents/:id/wiring-status", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const agent = await agentOSStorage.getAgent(req.params.id, req.aosCompanyId!);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    const validation = validateAgentWiring(agent);
    const telemetryStatus = await agentOSStorage.getAgentTelemetryStatus(req.params.id);

    res.json({
      validation,
      telemetry: telemetryStatus,
    });
  } catch (error: any) {
    console.error("[AgentOS] Wiring status error:", error);
    res.status(500).json({ message: "Failed to get wiring status" });
  }
});

router.post("/agents/:id/validate", aosAuth, requireRole("admin", "manager"), async (req: AuthRequest, res: Response) => {
  try {
    const agent = await agentOSStorage.getAgent(req.params.id, req.aosCompanyId!);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    const validation = validateAgentWiring(agent);
    res.json(validation);
  } catch (error: any) {
    console.error("[AgentOS] Validate agent error:", error);
    res.status(500).json({ message: "Failed to validate agent" });
  }
});

router.get("/agents/:id/versions", aosAuth, async (req: AuthRequest, res: Response) => {
  const agent = await agentOSStorage.getAgent(req.params.id, req.aosCompanyId!);
  if (!agent) return res.status(404).json({ message: "Agent not found" });
  const versions = await agentOSStorage.getAgentVersions(req.params.id);
  res.json(versions);
});

router.get("/agents/:id/usage", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const agent = await agentOSStorage.getAgent(req.params.id, req.aosCompanyId!);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    const days = parseInt(req.query.days as string) || 30;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [allTimeMetrics, monthlyMetrics, trend, recentEvents] = await Promise.all([
      agentOSStorage.getAgentPerformanceMetrics(req.params.id),
      agentOSStorage.getAgentPerformanceMetrics(req.params.id, monthStart),
      agentOSStorage.getAgentDailyCostTrend(req.params.id, days),
      agentOSStorage.getTelemetryEvents(req.aosCompanyId!, { agentId: req.params.id, limit: 20 }),
    ]);

    const totalCost = parseFloat(allTimeMetrics?.totalCost || "0");
    const monthlySpend = parseFloat(monthlyMetrics?.totalCost || "0");
    const monthlyCap = agent.monthlyCap ? parseFloat(agent.monthlyCap) : null;
    const capUsagePercent = monthlyCap && monthlyCap > 0 ? Math.min((monthlySpend / monthlyCap) * 100, 100) : null;

    res.json({
      metrics: {
        totalTasks: Number(allTimeMetrics?.totalTasks || 0),
        successCount: Number(allTimeMetrics?.successCount || 0),
        failureCount: Number(allTimeMetrics?.failureCount || 0),
        successRate: allTimeMetrics?.totalTasks > 0 ? Math.round((Number(allTimeMetrics.successCount) / Number(allTimeMetrics.totalTasks)) * 1000) / 10 : 0,
        avgLatency: Math.round(Number(allTimeMetrics?.avgLatency || 0)),
        avgAccuracy: allTimeMetrics?.avgAccuracy ? Math.round(Number(allTimeMetrics.avgAccuracy) * 10) / 10 : null,
        totalCost: Math.round(totalCost * 10000) / 10000,
        totalTokens: Number(allTimeMetrics?.totalTokens || 0),
      },
      budget: {
        monthlyCap,
        monthlySpend: Math.round(monthlySpend * 10000) / 10000,
        remaining: monthlyCap !== null ? Math.round(Math.max(monthlyCap - monthlySpend, 0) * 10000) / 10000 : null,
        capUsagePercent: capUsagePercent ? Math.round(capUsagePercent * 10) / 10 : null,
        costPerToken: agent.costPerToken ? parseFloat(agent.costPerToken) : null,
      },
      trend,
      recentEvents: recentEvents.map(e => ({
        id: e.id,
        eventType: e.eventType,
        provider: e.provider,
        model: e.model,
        inputTokens: e.inputTokens,
        outputTokens: e.outputTokens,
        totalTokens: e.totalTokens,
        costUsd: e.costUsd,
        latencyMs: e.latencyMs,
        taskOutcome: e.taskOutcome,
        timestamp: e.timestamp,
      })),
    });
  } catch (error: any) {
    console.error("[AgentOS] Agent usage error:", error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/agents/:id/api-key", aosAuth, requireRole("admin", "manager"), async (req: AuthRequest, res: Response) => {
  try {
    const agent = await agentOSStorage.getAgent(req.params.id, req.aosCompanyId!);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== "string" || apiKey.length < 8) {
      return res.status(400).json({ message: "API key must be at least 8 characters" });
    }

    const encrypted = encryptAgentApiKey(apiKey);
    const last4 = apiKey.slice(-4);
    const maskedKey = `****${last4}`;

    const updated = await agentOSStorage.updateAgent(req.params.id, req.aosCompanyId!, {
      apiKeyEncrypted: encrypted,
      apiKeyPrefix: maskedKey,
    });

    agentOSStorage.logAudit({
      companyId: req.aosCompanyId!,
      userId: req.aosUserId,
      action: "agent_api_key_set",
      entityType: "agent",
      entityId: req.params.id,
      metadata: { maskedKey },
    });

    res.json({ maskedKey, hasKey: true });
  } catch (error: any) {
    console.error("[AgentOS] Set agent API key error:", error);
    res.status(500).json({ message: "Failed to set API key" });
  }
});

router.delete("/agents/:id/api-key", aosAuth, requireRole("admin", "manager"), async (req: AuthRequest, res: Response) => {
  try {
    const agent = await agentOSStorage.getAgent(req.params.id, req.aosCompanyId!);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    await agentOSStorage.updateAgent(req.params.id, req.aosCompanyId!, {
      apiKeyEncrypted: null,
      apiKeyPrefix: null,
    });

    agentOSStorage.logAudit({
      companyId: req.aosCompanyId!,
      userId: req.aosUserId,
      action: "agent_api_key_removed",
      entityType: "agent",
      entityId: req.params.id,
    });

    res.json({ hasKey: false });
  } catch (error: any) {
    console.error("[AgentOS] Remove agent API key error:", error);
    res.status(500).json({ message: "Failed to remove API key" });
  }
});

router.get("/team-members", aosAuth, async (req: AuthRequest, res: Response) => {
  const users = await agentOSStorage.getUsers(req.aosCompanyId!);
  res.json(users.map(u => ({
    id: u.id,
    name: u.name,
    role: u.role,
  })));
});

router.get("/users", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const users = await agentOSStorage.getUsers(req.aosCompanyId!);
  res.json(users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
  })));
});

router.post("/users/invite", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, role, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email, and password are required" });

    const existing = await agentOSStorage.getUserByEmail(email);
    if (existing) return res.status(400).json({ message: "Email already in use" });

    const validRoles = ["admin", "manager", "viewer"];
    if (role && !validRoles.includes(role)) return res.status(400).json({ message: "Invalid role" });

    const passwordHash = await hashPassword(password);
    const user = await agentOSStorage.createUser({
      companyId: req.aosCompanyId!,
      email: email.toLowerCase(),
      passwordHash,
      name,
      role: role || "viewer",
    });

    agentOSStorage.logAudit({
      companyId: req.aosCompanyId!,
      userId: req.aosUserId,
      action: "user_invited",
      entityType: "user",
      entityId: user.id,
      metadata: { email, role },
    });

    let emailSent = false;
    try {
      const inviter = await agentOSStorage.getUser(req.aosUserId!);
      const company = await agentOSStorage.getCompany(req.aosCompanyId!);
      const result = await sendAgentOSInviteEmail(
        email,
        name,
        password,
        role || "viewer",
        inviter?.name || "An admin",
        company?.name || "Your organization"
      );
      emailSent = result.success;
      if (!result.success) {
        console.error("[AgentOS] Invite email failed (user still created):", result.error);
      }
    } catch (emailError: any) {
      console.error("[AgentOS] Invite email error (user still created):", emailError.message);
    }

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      emailSent,
    });
  } catch (error) {
    console.error("[AgentOS] Invite user error:", error);
    res.status(500).json({ message: "Failed to invite user" });
  }
});

router.put("/users/:id", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { role, isActive } = req.body;
    const updateData: { role?: string; isActive?: boolean } = {};
    if (role && ["admin", "manager", "viewer"].includes(role)) updateData.role = role;
    if (typeof isActive === "boolean") updateData.isActive = isActive;

    const user = await agentOSStorage.updateUser(req.params.id, req.aosCompanyId!, updateData);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update user" });
  }
});

router.get("/audit-logs", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const { action, entityType, entityId, limit } = req.query;
  const logs = await agentOSStorage.getAuditLogs(
    req.aosCompanyId!,
    limit ? parseInt(limit as string) : 100,
    {
      action: action as string,
      entityType: entityType as string,
      entityId: entityId as string,
    }
  );
  res.json(logs);
});

router.post("/telemetry", async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers["x-api-key"] as string;
    if (!apiKey) return res.status(401).json({ message: "API key required" });

    const keyHash = hashApiKey(apiKey);
    const key = await agentOSStorage.getApiKeyByHash(keyHash);
    if (!key) return res.status(401).json({ message: "Invalid API key" });

    await agentOSStorage.updateApiKeyLastUsed(key.id);
    const companyId = key.companyId;

    const events = Array.isArray(req.body) ? req.body : [req.body];
    const validated: any[] = [];

    for (const event of events) {
      const agent = await agentOSStorage.getAgent(event.agentId, companyId);
      if (!agent) return res.status(400).json({ message: `Agent ${event.agentId} not found or not owned by this organization` });
      validated.push({ ...event, companyId });
    }

    const result = validated.length === 1
      ? [await agentOSStorage.ingestTelemetry(validated[0])]
      : await agentOSStorage.ingestTelemetryBatch(validated);

    const affectedAgentIds = [...new Set(validated.map(e => e.agentId))];
    for (const aid of affectedAgentIds) {
      try {
        await agentOSStorage.calculateRiskScore(aid, companyId);
        await agentOSStorage.evaluatePoliciesForAgent(aid, companyId);
      } catch (riskErr) {
        console.warn("[AgentOS] Risk recalculation failed on telemetry ingest:", aid, riskErr);
      }
    }

    res.status(201).json({ ingested: result.length });
  } catch (error: any) {
    console.error("[AgentOS] Telemetry error:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/analytics/costs", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { from, to, groupBy } = req.query;
    const fromDate = from ? new Date(from as string) : undefined;
    const toDate = to ? new Date(to as string) : undefined;

    let data;
    switch (groupBy) {
      case "department":
        data = await agentOSStorage.getDepartmentCostSummary(req.aosCompanyId!, fromDate, toDate);
        break;
      case "provider":
        data = await agentOSStorage.getProviderCostSummary(req.aosCompanyId!, fromDate, toDate);
        break;
      default:
        data = await agentOSStorage.getAgentCostSummary(req.aosCompanyId!, fromDate, toDate);
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/analytics/trend", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const trend = await agentOSStorage.getDailyCostTrend(req.aosCompanyId!, days);
    res.json(trend);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/analytics/arbitrage", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const rawHourlyRate = req.query.hourlyRate ? parseFloat(req.query.hourlyRate as string) : null;
    const rawWorkingHours = req.query.workingHours ? parseFloat(req.query.workingHours as string) : 160;
    const rawPlatformFee = req.query.platformFee ? parseFloat(req.query.platformFee as string) : 20;

    if ((rawHourlyRate !== null && (!isFinite(rawHourlyRate) || rawHourlyRate < 0)) ||
        !isFinite(rawWorkingHours) || rawWorkingHours <= 0 ||
        !isFinite(rawPlatformFee) || rawPlatformFee < 0 || rawPlatformFee > 100) {
      return res.status(400).json({ message: "Invalid parameters: hourlyRate must be >= 0, workingHours must be > 0, platformFee must be 0-100" });
    }

    const hourlyRateOverride = rawHourlyRate;
    const workingHoursPerMonth = rawWorkingHours;
    const platformFeePercent = rawPlatformFee;

    const agents = await agentOSStorage.getAgents(req.aosCompanyId!);
    const departments = await agentOSStorage.getDepartments(req.aosCompanyId!);
    const costSummary = await agentOSStorage.getAgentCostSummary(req.aosCompanyId!);

    const deptMap: Record<string, string> = {};
    for (const d of departments) {
      deptMap[d.id] = d.name;
    }

    const costMap: Record<string, number> = {};
    for (const c of costSummary) {
      costMap[c.agentId] = (costMap[c.agentId] || 0) + parseFloat(c.totalCost || "0");
    }

    const comparisons = agents
      .filter((a) => a.humanEquivalentSalary || hourlyRateOverride)
      .map((agent) => {
        const rawTokenCost = costMap[agent.id] || 0;
        const platformFee = rawTokenCost * (platformFeePercent / 100);
        const agentCostMonthly = rawTokenCost + platformFee;

        const effectiveHourlyRate = hourlyRateOverride || (parseFloat(agent.humanEquivalentSalary || "0") / workingHoursPerMonth);
        const humanCostMonthly = effectiveHourlyRate * workingHoursPerMonth;
        const netSavings = humanCostMonthly - agentCostMonthly;
        const roi = agentCostMonthly > 0 ? ((humanCostMonthly - agentCostMonthly) / agentCostMonthly) * 100 : 0;
        const fteEquivalent = humanCostMonthly > 0 ? agentCostMonthly / humanCostMonthly : 0;

        return {
          agentId: agent.id,
          agentName: agent.name,
          humanEquivalentRole: agent.humanEquivalentRole || agent.role || "General",
          department: agent.departmentId ? (deptMap[agent.departmentId] || "Unassigned") : "Unassigned",
          departmentId: agent.departmentId || null,
          provider: agent.provider,
          model: agent.llmModel,
          tokenCost: Math.round(rawTokenCost * 100) / 100,
          platformFee: Math.round(platformFee * 100) / 100,
          agentCostMonthly: Math.round(agentCostMonthly * 100) / 100,
          humanHourlyRate: Math.round(effectiveHourlyRate * 100) / 100,
          humanCostMonthly: Math.round(humanCostMonthly * 100) / 100,
          netSavings: Math.round(netSavings * 100) / 100,
          roi: Math.round(roi * 10) / 10,
          fteEquivalent: Math.round(fteEquivalent * 100) / 100,
        };
      });

    const totalAgentCost = comparisons.reduce((s, c) => s + c.agentCostMonthly, 0);
    const totalHumanCost = comparisons.reduce((s, c) => s + c.humanCostMonthly, 0);
    const totalSavings = totalHumanCost - totalAgentCost;
    const totalFteEquivalent = comparisons.reduce((s, c) => s + (1 - c.fteEquivalent), 0);

    const departmentRollup: Record<string, { department: string; agentCount: number; totalAgentCost: number; totalHumanCost: number; totalSavings: number; avgRoi: number }> = {};
    for (const c of comparisons) {
      const key = c.department;
      if (!departmentRollup[key]) {
        departmentRollup[key] = { department: key, agentCount: 0, totalAgentCost: 0, totalHumanCost: 0, totalSavings: 0, avgRoi: 0 };
      }
      departmentRollup[key].agentCount++;
      departmentRollup[key].totalAgentCost += c.agentCostMonthly;
      departmentRollup[key].totalHumanCost += c.humanCostMonthly;
      departmentRollup[key].totalSavings += c.netSavings;
    }
    for (const key of Object.keys(departmentRollup)) {
      const d = departmentRollup[key];
      d.totalAgentCost = Math.round(d.totalAgentCost * 100) / 100;
      d.totalHumanCost = Math.round(d.totalHumanCost * 100) / 100;
      d.totalSavings = Math.round(d.totalSavings * 100) / 100;
      d.avgRoi = d.totalAgentCost > 0 ? Math.round(((d.totalHumanCost - d.totalAgentCost) / d.totalAgentCost) * 1000) / 10 : 0;
    }

    const topPerformer = comparisons.length > 0 ? comparisons.reduce((best, c) => c.netSavings > best.netSavings ? c : best, comparisons[0]) : null;

    res.json({
      agents: comparisons,
      departmentRollup: Object.values(departmentRollup),
      topPerformer: topPerformer ? { agentName: topPerformer.agentName, netSavings: topPerformer.netSavings, role: topPerformer.humanEquivalentRole } : null,
      totals: {
        totalAgentCost: Math.round(totalAgentCost * 100) / 100,
        totalHumanCost: Math.round(totalHumanCost * 100) / 100,
        totalNetSavings: Math.round(totalSavings * 100) / 100,
        savingsPercent: totalHumanCost > 0 ? Math.round((totalSavings / totalHumanCost) * 1000) / 10 : 0,
        totalFteEquivalent: Math.round(totalFteEquivalent * 10) / 10,
        agentCount: comparisons.length,
      },
      config: {
        hourlyRate: hourlyRateOverride,
        workingHoursPerMonth,
        platformFeePercent,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/analytics/workforce-stats", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const aosCompany = await agentOSStorage.getCompany(req.aosCompanyId!);
    const settings = aosCompany?.settings as Record<string, unknown> | null;
    const posCompanyId = typeof settings?.posCompanyId === "string" ? settings.posCompanyId : null;

    if (!posCompanyId) {
      return res.json({
        linked: false,
        dataAvailable: false,
        humanHeadcount: 0,
        humanMonthlySalary: 0,
        departmentStats: [],
      });
    }

    const stats = await agentOSStorage.getPeopleOSWorkforceStats(posCompanyId);
    const dataAvailable = stats.totalHeadcount > 0 || stats.totalMonthlySalary > 0;
    res.json({
      linked: true,
      dataAvailable,
      humanHeadcount: stats.totalHeadcount,
      humanMonthlySalary: stats.totalMonthlySalary,
      departmentStats: stats.departmentStats,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.get("/analytics/workforce-report", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    if (days < 1 || days > 365) return res.status(400).json({ message: "Days must be 1-365" });

    const granularity = (req.query.granularity as string) || "daily";
    const validGranularity = (["daily", "weekly", "monthly"] as const).includes(granularity as "daily" | "weekly" | "monthly")
      ? (granularity as "daily" | "weekly" | "monthly") : "daily";

    const aosCompany = await agentOSStorage.getCompany(req.aosCompanyId!);
    const settings = aosCompany?.settings as Record<string, unknown> | null;
    const posCompanyId = typeof settings?.posCompanyId === "string" ? settings.posCompanyId : null;

    const [reportData, agents, departments, peopleOSStats] = await Promise.all([
      agentOSStorage.getWorkforceReportData(req.aosCompanyId!, days, validGranularity),
      agentOSStorage.getAgents(req.aosCompanyId!),
      agentOSStorage.getDepartments(req.aosCompanyId!),
      posCompanyId ? agentOSStorage.getPeopleOSWorkforceStats(posCompanyId) : Promise.resolve({ totalHeadcount: 0, totalMonthlySalary: 0, departmentStats: [] }),
    ]);

    const { dailyTrend, providerBreakdown, departmentBreakdown, agentBudgets } = reportData;
    const deptMap: Record<string, string> = {};
    for (const d of departments) deptMap[d.id] = d.name;

    const totalSpendPeriod = dailyTrend.reduce((s, d) => s + parseFloat(d.totalCost || "0"), 0);
    const totalTasks = dailyTrend.reduce((s, d) => s + parseInt(String(d.eventCount || 0), 10), 0);
    const totalSuccess = dailyTrend.reduce((s, d) => s + parseInt(String(d.successCount || 0), 10), 0);
    const costPerTask = totalTasks > 0 ? totalSpendPeriod / totalTasks : 0;
    const successRate = totalTasks > 0 ? (totalSuccess / totalTasks) * 100 : 0;

    const agentHumanEquiv = agents.reduce((s, a) => s + parseFloat(a.humanEquivalentSalary || "0"), 0);
    const hasPosLink = posCompanyId && peopleOSStats.totalMonthlySalary > 0;
    const monthlyHumanCost = hasPosLink ? peopleOSStats.totalMonthlySalary : agentHumanEquiv;
    const months = days / 30;
    const humanEquivForPeriod = monthlyHumanCost * months;
    const monthlyAiSpend = months > 0 ? totalSpendPeriod / months : 0;
    const netROI = monthlyAiSpend > 0 ? ((monthlyHumanCost - monthlyAiSpend) / monthlyAiSpend) * 100 : 0;

    const activeAgents = agents.filter(a => a.status === "active").length;

    const dailyHumanCost = monthlyHumanCost / 30;
    const bucketDays = validGranularity === "monthly" ? 30 : validGranularity === "weekly" ? 7 : 1;

    let cumulativeCost = 0;
    let cumulativeTasks = 0;
    let totalBucketDays = 0;
    const trend = dailyTrend.map((d) => {
      const cost = parseFloat(d.totalCost || "0");
      const tasks = parseInt(String(d.eventCount || 0), 10);
      const success = parseInt(String(d.successCount || 0), 10);
      cumulativeCost += cost;
      cumulativeTasks += tasks;
      totalBucketDays += bucketDays;
      const avgDailyCost = cumulativeCost / totalBucketDays;
      const roiPct = avgDailyCost > 0 ? ((dailyHumanCost - avgDailyCost) / avgDailyCost) * 100 : 0;
      const costEff = cumulativeTasks > 0 ? cumulativeCost / cumulativeTasks : 0;
      return {
        date: d.date,
        cost: Math.round(cost * 100) / 100,
        tasks,
        successRate: tasks > 0 ? Math.round((success / tasks) * 1000) / 10 : 0,
        costPerTask: tasks > 0 ? Math.round((cost / tasks) * 10000) / 10000 : 0,
        tokens: parseInt(String(d.totalTokens || 0), 10),
        roi: Math.round(roiPct * 10) / 10,
        costEfficiency: Math.round(costEff * 10000) / 10000,
      };
    });

    const providers = providerBreakdown.map(p => {
      const cost = parseFloat(p.totalCost || "0");
      const tasks = parseInt(String(p.eventCount || 0), 10);
      const success = parseInt(String(p.successCount || 0), 10);
      return {
        provider: p.provider ?? "Unknown",
        model: p.model ?? "Unknown",
        totalCost: Math.round(cost * 100) / 100,
        tasks,
        costPerTask: tasks > 0 ? Math.round((cost / tasks) * 10000) / 10000 : 0,
        successRate: tasks > 0 ? Math.round((success / tasks) * 1000) / 10 : 0,
        avgLatency: Math.round(p.avgLatency || 0),
        tokens: parseInt(String(p.totalTokens || 0), 10),
        share: totalSpendPeriod > 0 ? Math.round((cost / totalSpendPeriod) * 1000) / 10 : 0,
      };
    }).sort((a, b) => b.totalCost - a.totalCost);

    const deptBreakdown = departmentBreakdown.map(d => {
      const cost = parseFloat(d.totalCost || "0");
      const tasks = parseInt(String(d.eventCount || 0), 10);
      const success = parseInt(String(d.successCount || 0), 10);
      return {
        department: d.departmentName || "Unassigned",
        departmentId: d.departmentId,
        totalCost: Math.round(cost * 100) / 100,
        tasks,
        agentCount: parseInt(String(d.agentCount || 0), 10),
        costPerTask: tasks > 0 ? Math.round((cost / tasks) * 10000) / 10000 : 0,
        successRate: tasks > 0 ? Math.round((success / tasks) * 1000) / 10 : 0,
        share: totalSpendPeriod > 0 ? Math.round((cost / totalSpendPeriod) * 1000) / 10 : 0,
      };
    }).sort((a, b) => b.totalCost - a.totalCost);

    const workforce = {
      aiAgents: activeAgents,
      aiMonthlyCost: Math.round(monthlyAiSpend * 100) / 100,
      humanHeadcount: peopleOSStats.totalHeadcount,
      humanMonthlySalary: Math.round(monthlyHumanCost * 100) / 100,
      humanEquivSalary: Math.round(agentHumanEquiv * 100) / 100,
      savings: Math.round((monthlyHumanCost - monthlyAiSpend) * 100) / 100,
      efficiencyRatio: monthlyAiSpend > 0 ? Math.round((monthlyHumanCost / monthlyAiSpend) * 10) / 10 : 0,
      posDepartmentStats: peopleOSStats.departmentStats,
      dataSource: hasPosLink ? "peopleos" : "agent-estimates",
    };

    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dayOfMonth = new Date().getDate();
    const dailyRunRate = dayOfMonth > 0 ? (agentBudgets.reduce((s, b) => s + parseFloat(b.totalSpent || "0"), 0) / dayOfMonth) : 0;

    const budgets = agentBudgets.map(b => {
      const spent = parseFloat(b.totalSpent || "0");
      const cap = parseFloat(b.monthlyCap || "0");
      const projected = dailyRunRate > 0 ? (spent / dayOfMonth) * daysInMonth : spent;
      return {
        agentId: b.agentId,
        agentName: b.agentName,
        department: b.departmentId ? (deptMap[b.departmentId] || "Unassigned") : "Unassigned",
        monthlyCap: Math.round(cap * 100) / 100,
        spent: Math.round(spent * 100) / 100,
        utilization: cap > 0 ? Math.round((spent / cap) * 1000) / 10 : 0,
        projected: Math.round(projected * 100) / 100,
        projectedUtilization: cap > 0 ? Math.round((projected / cap) * 1000) / 10 : 0,
        tasks: b.eventCount || 0,
      };
    }).sort((a, b) => b.utilization - a.utilization);

    const deptBudgetMap: Record<string, { department: string; monthlyCap: number; spent: number; tasks: number; agentCount: number }> = {};
    for (const b of budgets) {
      const dName = b.department;
      if (!deptBudgetMap[dName]) {
        deptBudgetMap[dName] = { department: dName, monthlyCap: 0, spent: 0, tasks: 0, agentCount: 0 };
      }
      deptBudgetMap[dName].monthlyCap += b.monthlyCap;
      deptBudgetMap[dName].spent += b.spent;
      deptBudgetMap[dName].tasks += b.tasks;
      deptBudgetMap[dName].agentCount += 1;
    }
    const departmentBudgets = Object.values(deptBudgetMap).map(db => ({
      ...db,
      monthlyCap: Math.round(db.monthlyCap * 100) / 100,
      spent: Math.round(db.spent * 100) / 100,
      utilization: db.monthlyCap > 0 ? Math.round((db.spent / db.monthlyCap) * 1000) / 10 : 0,
      projected: Math.round((db.spent / dayOfMonth) * daysInMonth * 100) / 100,
      projectedUtilization: db.monthlyCap > 0 ? Math.round(((db.spent / dayOfMonth) * daysInMonth / db.monthlyCap) * 1000) / 10 : 0,
    })).sort((a, b) => b.utilization - a.utilization);

    res.json({
      kpis: {
        totalSpend: Math.round(totalSpendPeriod * 100) / 100,
        humanEquivSaved: Math.round(humanEquivForPeriod * 100) / 100,
        netROI: Math.round(netROI * 10) / 10,
        tasksCompleted: totalTasks,
        costPerTask: Math.round(costPerTask * 10000) / 10000,
        successRate: Math.round(successRate * 10) / 10,
        activeAgents,
      },
      trend,
      providers,
      departments: deptBreakdown,
      workforce,
      budgets,
      departmentBudgets,
      period: days,
      granularity: validGranularity,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/analytics/benchmarking", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const providerSummary = await agentOSStorage.getProviderCostSummary(req.aosCompanyId!);
    const byRole = await agentOSStorage.getRoleBenchmarkSummary(req.aosCompanyId!);
    res.json({ providerSummary, byRole });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/agents/:id/performance", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const agent = await agentOSStorage.getAgent(req.params.id, req.aosCompanyId!);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    const metrics = await agentOSStorage.getAgentPerformanceMetrics(req.params.id);
    const avgRating = await agentOSStorage.getAverageRating(req.params.id);
    const ratings = await agentOSStorage.getPerformanceRatings(req.params.id);

    const successRate = metrics?.totalTasks > 0
      ? Math.round((metrics.successCount / metrics.totalTasks) * 10000) / 100
      : 0;

    res.json({
      agent: { id: agent.id, name: agent.name, status: agent.status, certifiedAt: agent.certifiedAt },
      metrics: {
        totalTasks: metrics?.totalTasks || 0,
        successRate,
        avgLatencyMs: Math.round(metrics?.avgLatency || 0),
        avgAccuracy: Math.round((metrics?.avgAccuracy || 0) * 100) / 100,
        totalCost: parseFloat(metrics?.totalCost || "0"),
        totalTokens: metrics?.totalTokens || 0,
      },
      humanRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      recentRatings: ratings.slice(0, 10),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/agents/:id/rate", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be 1-5" });

    const agent = await agentOSStorage.getAgent(req.params.id, req.aosCompanyId!);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    const result = await agentOSStorage.createPerformanceRating({
      companyId: req.aosCompanyId!,
      agentId: req.params.id,
      ratedBy: req.aosUserId!,
      rating,
      comment,
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/certification/config", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const config = await agentOSStorage.getCertificationConfig(req.aosCompanyId!);
    res.json(config || {
      minSuccessRate: 90,
      maxAvgLatencyMs: 5000,
      minAccuracyScore: 85,
      minHumanRating: 3.5,
      probationDays: 30,
      minTaskCount: 50,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/certification/config", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const config = await agentOSStorage.upsertCertificationConfig({
      ...req.body,
      companyId: req.aosCompanyId!,
    });
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/agents/:id/evaluate-certification", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const agent = await agentOSStorage.getAgent(req.params.id, req.aosCompanyId!);
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    const config = await agentOSStorage.getCertificationConfig(req.aosCompanyId!);
    const thresholds = config || {
      minSuccessRate: 90,
      maxAvgLatencyMs: 5000,
      minAccuracyScore: 85,
      minHumanRating: 3.5,
      probationDays: 30,
      minTaskCount: 50,
    };

    const metrics = await agentOSStorage.getAgentPerformanceMetrics(req.params.id);
    const avgRating = await agentOSStorage.getAverageRating(req.params.id);

    const totalTasks = metrics?.totalTasks || 0;
    const successRate = totalTasks > 0 ? (metrics.successCount / totalTasks) * 100 : 0;
    const avgLatency = metrics?.avgLatency || 99999;
    const avgAccuracy = (metrics?.avgAccuracy || 0) * 100;

    const probationStart = agent.probationStartDate || agent.createdAt;
    const daysSinceStart = Math.floor((Date.now() - new Date(probationStart).getTime()) / (1000 * 60 * 60 * 24));

    const checks = {
      successRate: { passed: successRate >= (thresholds.minSuccessRate || 90), value: Math.round(successRate * 10) / 10, threshold: thresholds.minSuccessRate },
      latency: { passed: avgLatency <= (thresholds.maxAvgLatencyMs || 5000), value: Math.round(avgLatency), threshold: thresholds.maxAvgLatencyMs },
      accuracy: { passed: avgAccuracy >= (thresholds.minAccuracyScore || 85), value: Math.round(avgAccuracy * 10) / 10, threshold: thresholds.minAccuracyScore },
      humanRating: { passed: (avgRating || 0) >= (thresholds.minHumanRating || 3.5), value: avgRating || 0, threshold: thresholds.minHumanRating },
      probation: { passed: daysSinceStart >= (thresholds.probationDays || 30), value: daysSinceStart, threshold: thresholds.probationDays },
      taskCount: { passed: totalTasks >= (thresholds.minTaskCount || 50), value: totalTasks, threshold: thresholds.minTaskCount },
    };

    const certified = Object.values(checks).every((c) => c.passed);

    if (certified && !agent.certifiedAt) {
      await agentOSStorage.updateAgent(req.params.id, req.aosCompanyId!, { certifiedAt: new Date() } as any);
    }

    res.json({ certified, checks, agentId: agent.id, agentName: agent.name });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/api-keys", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Name is required" });

    const rawKey = `aos_${crypto.randomBytes(32).toString("hex")}`;
    const keyHash = hashApiKey(rawKey);
    const prefix = rawKey.substring(0, 12);

    const apiKey = await agentOSStorage.createApiKey({
      companyId: req.aosCompanyId!,
      name,
      keyHash,
      prefix,
    });

    res.status(201).json({ ...apiKey, key: rawKey });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/api-keys", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const keys = await agentOSStorage.getApiKeys(req.aosCompanyId!);
  res.json(keys);
});

router.delete("/api-keys/:id", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  await agentOSStorage.deactivateApiKey(req.params.id);
  res.json({ message: "API key deactivated" });
});

router.get("/budget-alerts", aosAuth, async (req: AuthRequest, res: Response) => {
  const unreadOnly = req.query.unread === "true";
  const alerts = await agentOSStorage.getBudgetAlerts(req.aosCompanyId!, unreadOnly);
  res.json(alerts);
});

router.put("/budget-alerts/:id/read", aosAuth, async (req: AuthRequest, res: Response) => {
  await agentOSStorage.markAlertRead(req.params.id);
  res.json({ message: "Marked as read" });
});

router.get("/analytics/forecast", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 60;
    const trend = await agentOSStorage.getDailyCostTrend(req.aosCompanyId!, days);

    if (trend.length < 7) {
      return res.json({ trend, forecast: [], message: "Not enough data for forecasting" });
    }

    const recentDays = trend.slice(-14);
    const avgDailyCost = recentDays.reduce((s: number, d: any) => s + parseFloat(d.totalCost || "0"), 0) / recentDays.length;
    const avgDailyTokens = recentDays.reduce((s: number, d: any) => s + (d.totalTokens || 0), 0) / recentDays.length;

    const costs = recentDays.map((d: any, i: number) => ({ x: i, y: parseFloat(d.totalCost || "0") }));
    const n = costs.length;
    const sumX = costs.reduce((s, c) => s + c.x, 0);
    const sumY = costs.reduce((s, c) => s + c.y, 0);
    const sumXY = costs.reduce((s, c) => s + c.x * c.y, 0);
    const sumX2 = costs.reduce((s, c) => s + c.x * c.x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
    const intercept = (sumY - slope * sumX) / n;

    const forecast = [];
    const lastDate = new Date(recentDays[recentDays.length - 1].date);
    for (let i = 1; i <= 30; i++) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + i);
      const predictedCost = Math.max(0, intercept + slope * (n + i - 1));
      forecast.push({
        date: d.toISOString().split("T")[0],
        predictedCost: Math.round(predictedCost * 100) / 100,
        predictedTokens: Math.round(avgDailyTokens),
      });
    }

    const monthlyForecast = forecast.reduce((s, f) => s + f.predictedCost, 0);

    res.json({
      trend,
      forecast,
      summary: {
        avgDailyCost: Math.round(avgDailyCost * 100) / 100,
        avgDailyTokens: Math.round(avgDailyTokens),
        monthlyForecast: Math.round(monthlyForecast * 100) / 100,
        trendDirection: slope > 0.01 ? "increasing" : slope < -0.01 ? "decreasing" : "stable",
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/agents/:id/kill-switch", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: "Reason is required" });

    const agent = await agentOSStorage.getAgent(req.params.id, req.aosCompanyId!);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    const apiKeys = await agentOSStorage.getApiKeys(req.aosCompanyId!);
    const agentProvider = agent.provider?.toLowerCase() || "";
    const agentName = agent.name?.toLowerCase() || "";
    const revokedKeyIds: string[] = [];
    for (const key of apiKeys.filter(k => k.isActive)) {
      const keyName = (key.name || "").toLowerCase();
      const isAgentScoped = keyName.includes(agentName) || keyName.includes(agentProvider) || keyName.includes(agent.uid || "");
      if (isAgentScoped) {
        await agentOSStorage.deactivateApiKey(key.id);
        revokedKeyIds.push(key.id);
      }
    }

    await agentOSStorage.updateAgent(req.params.id, req.aosCompanyId!, {
      status: "suspended",
      config: { ...(agent.config as Record<string, unknown> || {}), _killSwitchActive: true, _revokedKeyIds: revokedKeyIds },
    });

    const event = await agentOSStorage.createKillSwitchEvent({
      companyId: req.aosCompanyId!,
      agentId: req.params.id,
      triggeredBy: req.aosUserId!,
      reason,
      revokedKeys: revokedKeyIds,
    });

    agentOSStorage.logAudit({
      companyId: req.aosCompanyId!,
      userId: req.aosUserId,
      action: "kill_switch_activated",
      entityType: "agent",
      entityId: req.params.id,
      metadata: { reason, eventId: event.id },
    });

    await agentOSStorage.createNotification({
      companyId: req.aosCompanyId!,
      type: "kill_switch",
      title: "Kill Switch Activated",
      message: `Kill switch activated for agent "${agent.name}" (${agent.uid}). Reason: ${reason}`,
      entityType: "agent",
      entityId: agent.id,
    });

    res.json({ event, message: "Kill switch activated" });
  } catch (error) {
    console.error("[AgentOS] Kill switch error:", error);
    res.status(500).json({ message: "Failed to activate kill switch" });
  }
});

router.post("/agents/:id/kill-switch/restore", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const agent = await agentOSStorage.getAgent(req.params.id, req.aosCompanyId!);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    const events = await agentOSStorage.getKillSwitchEvents(req.aosCompanyId!, req.params.id);
    const activeEvent = events.find(e => !e.restoredAt);
    if (!activeEvent) return res.status(400).json({ message: "No active kill switch event" });

    await agentOSStorage.restoreKillSwitch(activeEvent.id, req.aosCompanyId!, req.aosUserId!);

    const config = agent.config as Record<string, unknown> || {};
    const revokedKeyIds = (config._revokedKeyIds as string[]) || (activeEvent.revokedKeys as string[]) || [];
    for (const keyId of revokedKeyIds) {
      await agentOSStorage.reactivateApiKey(keyId);
    }

    delete config._killSwitchActive;
    delete config._revokedKeyIds;
    await agentOSStorage.updateAgent(req.params.id, req.aosCompanyId!, {
      status: "active",
      config,
    });

    agentOSStorage.logAudit({
      companyId: req.aosCompanyId!,
      userId: req.aosUserId,
      action: "kill_switch_restored",
      entityType: "agent",
      entityId: req.params.id,
      metadata: { restoredKeys: revokedKeyIds },
    });

    res.json({ message: "Kill switch restored, agent reactivated", restoredKeys: revokedKeyIds });
  } catch (error) {
    console.error("[AgentOS] Kill switch restore error:", error);
    res.status(500).json({ message: "Failed to restore kill switch" });
  }
});

router.get("/kill-switch/events", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const { agentId } = req.query;
  const events = await agentOSStorage.getKillSwitchEvents(req.aosCompanyId!, agentId as string);
  res.json(events);
});

router.get("/pii/rules", aosAuth, requireRole("admin", "manager"), async (req: AuthRequest, res: Response) => {
  const rules = await agentOSStorage.getPiiRules(req.aosCompanyId!);
  res.json(rules);
});

router.post("/pii/rules", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, category, pattern, action } = req.body;
    if (!name || !category || !pattern) {
      return res.status(400).json({ message: "Name, category, and pattern are required" });
    }

    const rule = await agentOSStorage.createPiiRule({
      companyId: req.aosCompanyId!,
      name,
      category,
      pattern,
      action: action || "redact",
    });

    agentOSStorage.logAudit({
      companyId: req.aosCompanyId!,
      userId: req.aosUserId,
      action: "pii_rule_created",
      entityType: "pii_rule",
      entityId: rule.id,
      metadata: { name, category },
    });

    res.status(201).json(rule);
  } catch (error) {
    res.status(500).json({ message: "Failed to create PII rule" });
  }
});

router.put("/pii/rules/:id", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const rule = await agentOSStorage.updatePiiRule(req.params.id, req.aosCompanyId!, req.body);
    if (!rule) return res.status(404).json({ message: "Rule not found" });
    res.json(rule);
  } catch (error) {
    res.status(500).json({ message: "Failed to update PII rule" });
  }
});

router.delete("/pii/rules/:id", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const deleted = await agentOSStorage.deletePiiRule(req.params.id, req.aosCompanyId!);
  if (!deleted) return res.status(404).json({ message: "Rule not found" });
  agentOSStorage.logAudit({
    companyId: req.aosCompanyId!,
    userId: req.aosUserId,
    action: "pii_rule_deleted",
    entityType: "pii_rule",
    entityId: req.params.id,
  });
  res.json({ message: "Rule deleted" });
});

router.get("/pii/events", aosAuth, requireRole("admin", "manager"), async (req: AuthRequest, res: Response) => {
  const events = await agentOSStorage.getPiiEvents(req.aosCompanyId!);
  res.json(events);
});

router.post("/pii/scan", aosAuth, requireRole("admin", "manager"), async (req: AuthRequest, res: Response) => {
  try {
    const { text, agentId, direction } = req.body;
    if (!text) return res.status(400).json({ message: "Text is required" });

    const rules = await agentOSStorage.getPiiRules(req.aosCompanyId!);
    const activeRules = rules.filter(r => r.isActive);
    const findings: { rule: string; category: string; action: string; matches: number }[] = [];

    for (const rule of activeRules) {
      try {
        const regex = new RegExp(rule.pattern, "gi");
        const matches = text.match(regex);
        if (matches && matches.length > 0) {
          findings.push({
            rule: rule.name,
            category: rule.category,
            action: rule.action,
            matches: matches.length,
          });

          await agentOSStorage.createPiiEvent({
            companyId: req.aosCompanyId!,
            agentId: agentId || null,
            ruleId: rule.id,
            category: rule.category,
            direction: direction || "output",
            action: rule.action,
            sample: matches[0].slice(0, 4) + "***",
          });
        }
      } catch {}
    }

    let redactedText = text;
    if (findings.some(f => f.action === "redact" || f.action === "block")) {
      for (const rule of activeRules) {
        try {
          const regex = new RegExp(rule.pattern, "gi");
          redactedText = redactedText.replace(regex, `[${rule.category.toUpperCase()} REDACTED]`);
        } catch {}
      }
    }

    const blocked = findings.some(f => f.action === "block");

    res.json({
      findings,
      blocked,
      redactedText: findings.length > 0 ? redactedText : null,
      totalFindings: findings.reduce((sum, f) => sum + f.matches, 0),
    });
  } catch (error) {
    res.status(500).json({ message: "PII scan failed" });
  }
});

router.get("/reasoning/traces", aosAuth, async (req: AuthRequest, res: Response) => {
  const { agentId, limit } = req.query;
  const traces = await agentOSStorage.getReasoningTraces(
    req.aosCompanyId!,
    agentId as string,
    limit ? parseInt(limit as string) : 20
  );
  res.json(traces);
});

router.get("/reasoning/traces/:id", aosAuth, async (req: AuthRequest, res: Response) => {
  const trace = await agentOSStorage.getReasoningTrace(req.params.id, req.aosCompanyId!);
  if (!trace) return res.status(404).json({ message: "Trace not found" });
  const steps = await agentOSStorage.getReasoningSteps(req.params.id);
  res.json({ trace, steps });
});

router.post("/reasoning/traces", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { agentId, taskName, input, output, status, durationMs, tokenCount, steps } = req.body;
    if (!agentId || !taskName) return res.status(400).json({ message: "agentId and taskName are required" });

    const trace = await agentOSStorage.createReasoningTrace({
      companyId: req.aosCompanyId!,
      agentId,
      taskName,
      input,
      output,
      status: status || "completed",
      durationMs,
      tokenCount,
      completedAt: status === "completed" ? new Date() : undefined,
    });

    if (steps && Array.isArray(steps)) {
      for (const step of steps) {
        await agentOSStorage.createReasoningStep({
          traceId: trace.id,
          stepNumber: step.stepNumber,
          type: step.type,
          title: step.title,
          content: step.content,
          toolName: step.toolName,
          toolInput: step.toolInput,
          toolOutput: step.toolOutput,
          durationMs: step.durationMs,
        });
      }
    }

    res.status(201).json(trace);
  } catch (error) {
    console.error("[AgentOS] Create trace error:", error);
    res.status(500).json({ message: "Failed to create reasoning trace" });
  }
});

router.get("/drift/alerts", aosAuth, async (req: AuthRequest, res: Response) => {
  const { status, agentId } = req.query;
  const alerts = await agentOSStorage.getDriftAlerts(req.aosCompanyId!, {
    status: status as string,
    agentId: agentId as string,
  });
  res.json(alerts);
});

router.post("/drift/alerts", aosAuth, requireRole("admin", "manager"), async (req: AuthRequest, res: Response) => {
  try {
    const { agentId, metric, baselineValue, currentValue, threshold, severity } = req.body;
    if (!agentId || !metric || baselineValue === undefined || baselineValue === null || currentValue === undefined || currentValue === null || threshold === undefined || threshold === null) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const alert = await agentOSStorage.createDriftAlert({
      companyId: req.aosCompanyId!,
      agentId,
      metric,
      baselineValue,
      currentValue,
      threshold,
      severity: severity || "warning",
    });

    const agent = await agentOSStorage.getAgent(agentId, req.aosCompanyId!);
    await agentOSStorage.createNotification({
      companyId: req.aosCompanyId!,
      userId: agent?.ownerId || undefined,
      type: "drift_alert",
      title: "Agent Drift Detected",
      message: `${metric} drifted for agent "${agent?.name}": ${baselineValue} → ${currentValue} (threshold: ${threshold})`,
      entityType: "agent",
      entityId: agentId,
    });

    agentOSStorage.logAudit({
      companyId: req.aosCompanyId!,
      userId: req.aosUserId,
      action: "drift_alert_created",
      entityType: "drift_alert",
      entityId: alert.id,
      metadata: { agentId, metric },
    });

    res.status(201).json(alert);
  } catch (error) {
    res.status(500).json({ message: "Failed to create drift alert" });
  }
});

router.post("/drift/alerts/:id/acknowledge", aosAuth, requireRole("admin", "manager"), async (req: AuthRequest, res: Response) => {
  const alert = await agentOSStorage.acknowledgeDriftAlert(req.params.id, req.aosCompanyId!, req.aosUserId!);
  if (!alert) return res.status(404).json({ message: "Alert not found" });
  res.json(alert);
});

router.post("/drift/alerts/:id/dismiss", aosAuth, requireRole("admin", "manager"), async (req: AuthRequest, res: Response) => {
  const alert = await agentOSStorage.dismissDriftAlert(req.params.id, req.aosCompanyId!);
  if (!alert) return res.status(404).json({ message: "Alert not found" });
  res.json(alert);
});

router.get("/shadow-agents", aosAuth, requireRole("admin", "manager"), async (req: AuthRequest, res: Response) => {
  const { status } = req.query;
  const agents = await agentOSStorage.getShadowAgents(req.aosCompanyId!, status as string);
  res.json(agents);
});

router.post("/shadow-agents/report", async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers["x-api-key"] as string;
    const { companyId, identifier, provider, llmModel, sourceIp } = req.body;

    if (!companyId || !identifier) {
      return res.status(400).json({ message: "companyId and identifier are required" });
    }

    if (apiKey) {
      const keyHash = hashApiKey(apiKey);
      const key = await agentOSStorage.getApiKeyByHash(keyHash);
      if (!key || key.companyId !== companyId) {
        return res.status(401).json({ message: "Invalid API key or company mismatch" });
      }
      await agentOSStorage.updateApiKeyLastUsed(key.id);
    } else {
      return res.status(401).json({ message: "API key required (x-api-key header)" });
    }

    const company = await agentOSStorage.getCompany(companyId);
    if (!company) {
      return res.status(403).json({ message: "Invalid company" });
    }

    const existing = await agentOSStorage.getShadowAgentByIdentifier(companyId, identifier);
    if (existing) {
      await agentOSStorage.updateShadowAgent(existing.id, companyId, {
        lastSeenAt: new Date(),
        callCount: (existing.callCount || 0) + 1,
        provider: provider || existing.provider,
        llmModel: llmModel || existing.llmModel,
      });
      return res.json({ message: "Updated existing shadow agent", id: existing.id });
    }

    const shadowAgent = await agentOSStorage.createShadowAgent({
      companyId,
      identifier,
      provider,
      llmModel,
      sourceIp,
    });

    await agentOSStorage.createNotification({
      companyId,
      type: "shadow_agent",
      title: "New Unmanaged Agent Discovered",
      message: `An unmanaged agent "${identifier}" was discovered making LLM API calls via ${provider || "unknown provider"}.`,
      entityType: "shadow_agent",
      entityId: shadowAgent.id,
    });

    res.status(201).json({ message: "Shadow agent registered", id: shadowAgent.id });
  } catch (error) {
    console.error("[AgentOS] Shadow agent report error:", error);
    res.status(500).json({ message: "Failed to report shadow agent" });
  }
});

router.post("/shadow-agents/:id/dismiss", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const agent = await agentOSStorage.updateShadowAgent(req.params.id, req.aosCompanyId!, { status: "dismissed" });
  if (!agent) return res.status(404).json({ message: "Shadow agent not found" });
  agentOSStorage.logAudit({
    companyId: req.aosCompanyId!,
    userId: req.aosUserId,
    action: "shadow_agent_dismissed",
    entityType: "shadow_agent",
    entityId: req.params.id,
  });
  res.json(sanitizeAgentResponse(agent));
});

router.post("/shadow-agents/:id/register", aosAuth, requireRole("admin", "manager"), async (req: AuthRequest, res: Response) => {
  try {
    const shadow = await agentOSStorage.getShadowAgents(req.aosCompanyId!);
    const found = shadow.find(s => s.id === req.params.id);
    if (!found) return res.status(404).json({ message: "Shadow agent not found" });

    const uid = generateUID(found.provider || "UNK", found.identifier);
    const agent = await agentOSStorage.createAgent({
      companyId: req.aosCompanyId!,
      uid,
      name: found.identifier,
      provider: found.provider || "Unknown",
      llmModel: found.llmModel || "Unknown",
      status: "onboarding",
      ownerId: req.aosUserId,
    });

    await agentOSStorage.updateShadowAgent(req.params.id, req.aosCompanyId!, {
      status: "registered",
      registeredAgentId: agent.id,
    });

    agentOSStorage.logAudit({
      companyId: req.aosCompanyId!,
      userId: req.aosUserId,
      action: "shadow_agent_registered",
      entityType: "shadow_agent",
      entityId: req.params.id,
      metadata: { newAgentId: agent.id },
    });

    res.json({ agent: sanitizeAgentResponse(agent), message: "Shadow agent registered as managed agent" });
  } catch (error) {
    res.status(500).json({ message: "Failed to register shadow agent" });
  }
});

router.get("/notifications", aosAuth, async (req: AuthRequest, res: Response) => {
  const { unreadOnly } = req.query;
  const notifications = await agentOSStorage.getNotifications(
    req.aosCompanyId!,
    req.aosUserId,
    unreadOnly === "true"
  );
  res.json(notifications);
});

router.post("/notifications/:id/read", aosAuth, async (req: AuthRequest, res: Response) => {
  await agentOSStorage.markNotificationRead(req.params.id, req.aosCompanyId!);
  res.json({ message: "Notification marked as read" });
});

router.post("/notifications/read-all", aosAuth, async (req: AuthRequest, res: Response) => {
  await agentOSStorage.markAllNotificationsRead(req.aosCompanyId!, req.aosUserId);
  res.json({ message: "All notifications marked as read" });
});

router.get("/compliance/stats", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const stats = await agentOSStorage.getComplianceStats(req.aosCompanyId!);
    res.json(stats);
  } catch (error) {
    console.error("[AgentOS] Compliance stats error:", error);
    res.status(500).json({ message: "Failed to get compliance stats" });
  }
});

router.get("/compliance/export", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const stats = await agentOSStorage.getComplianceStats(req.aosCompanyId!);
    const auditLogs = await agentOSStorage.getAuditLogs(req.aosCompanyId!, 500);
    const killEvents = await agentOSStorage.getKillSwitchEvents(req.aosCompanyId!);
    const piiEvents = await agentOSStorage.getPiiEvents(req.aosCompanyId!);
    const piiRules = await agentOSStorage.getPiiRules(req.aosCompanyId!);
    const driftAlerts = await agentOSStorage.getDriftAlerts(req.aosCompanyId!);
    const agents = await agentOSStorage.getAgents(req.aosCompanyId!);
    const policyRules = await agentOSStorage.getPolicyRules(req.aosCompanyId!);
    const policyViolations = await agentOSStorage.getPolicyViolations(req.aosCompanyId!);
    const shadowAgents = await agentOSStorage.getShadowAgents(req.aosCompanyId!);
    const certConfig = await agentOSStorage.getCertificationConfig(req.aosCompanyId!);

    const esc = (v: string | null | undefined) => {
      if (!v) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csvRows = [
      "COMPLIANCE REPORT",
      `Generated: ${new Date().toISOString()}`,
      "",
      "FLEET SUMMARY",
      `Total Agents,${stats.totalAgents}`,
      `Active Agents,${stats.activeAgents}`,
      `Suspended Agents,${stats.suspendedAgents}`,
      `Kill Switch Activations,${stats.killSwitchActivations}`,
      `PII Events Today,${stats.piiEventsToday}`,
      `Open Drift Alerts,${stats.openDriftAlerts}`,
      `Unmanaged Agents,${stats.unmanagedAgents}`,
      "",
      "GOVERNANCE CONFIGURATION",
      "Certification Thresholds",
      `Min Success Rate,${certConfig?.minSuccessRate ?? 90}%`,
      `Max Avg Latency,${certConfig?.maxAvgLatencyMs ?? 5000}ms`,
      `Min Accuracy Score,${certConfig?.minAccuracyScore ?? 85}%`,
      `Min Human Rating,${certConfig?.minHumanRating ?? 3.5}/5`,
      `Probation Days,${certConfig?.probationDays ?? 30}`,
      `Min Task Count,${certConfig?.minTaskCount ?? 50}`,
      "",
      "Kill Switch Configuration",
      `Kill Switch Status,Enabled`,
      `Total Kill Switch Events (All Time),${killEvents.length}`,
      `Currently Unrestored Agents,${killEvents.filter(e => !e.restoredAt).length}`,
      "",
      "AGENT REGISTRY",
      "Name,UID,Provider,Model,Status,Role,Risk Score,Version,Created",
      ...agents.map(a => `${esc(a.name)},${esc(a.uid)},${esc(a.provider)},${esc(a.llmModel)},${a.status},${esc(a.role)},${a.riskScore ?? ""},v${a.version},${a.createdAt}`),
      "",
      "GOVERNANCE POLICY RULES",
      "Name,Description,Condition Field,Operator,Threshold,Action Type,Severity,Active",
      ...policyRules.map(p => `${esc(p.name)},${esc(p.description)},${esc(p.conditionField)},${esc(p.operator)},${esc(p.threshold)},${p.actionType},${p.severity},${p.isActive}`),
      "",
      "POLICY VIOLATIONS",
      "Timestamp,Agent ID,Policy Name,Condition,Actual Value,Threshold,Action Taken,Severity,Status",
      ...policyViolations.map(v => `${v.createdAt},${v.agentId},${esc(v.policyName)},${esc(v.conditionField)},${esc(v.actualValue)},${esc(v.threshold)},${v.actionTaken},${v.severity},${v.status}`),
      "",
      "AUDIT LOG (Last 500 entries)",
      "Timestamp,Action,Entity Type,Entity ID,User ID",
      ...auditLogs.map(l => `${l.createdAt},${l.action},${l.entityType || ""},${l.entityId || ""},${l.userId || ""}`),
      "",
      "KILL SWITCH EVENTS",
      "Timestamp,Agent ID,Triggered By,Reason,Restored At",
      ...killEvents.map(e => `${e.createdAt},${e.agentId},${e.triggeredBy},${esc(e.reason)},${e.restoredAt || "N/A"}`),
      "",
      "PII PROTECTION RULES",
      "Name,Category,Pattern,Action,Active",
      ...piiRules.map(r => `${esc(r.name)},${r.category},${esc(r.pattern)},${r.action},${r.isActive}`),
      "",
      "PII DETECTION EVENTS",
      "Timestamp,Agent ID,Category,Direction,Action",
      ...piiEvents.map(e => `${e.createdAt},${e.agentId || ""},${e.category},${e.direction},${e.action}`),
      "",
      "DRIFT ALERTS",
      "Timestamp,Agent ID,Metric,Baseline,Current,Threshold,Severity,Status",
      ...driftAlerts.map(a => `${a.createdAt},${a.agentId},${a.metric},${a.baselineValue},${a.currentValue},${a.threshold},${a.severity},${a.status}`),
      "",
      "SHADOW AI REPORT",
      "Identifier,Provider,Model,Department,Call Count,Status,First Seen,Last Seen",
      ...shadowAgents.map(s => `${esc(s.identifier)},${esc(s.provider)},${esc(s.llmModel)},${esc(s.department)},${s.callCount},${s.status},${s.firstSeenAt},${s.lastSeenAt}`),
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=compliance-report-${new Date().toISOString().split("T")[0]}.csv`);
    res.send(csvRows.join("\n"));
  } catch (error) {
    console.error("[AgentOS] Export error:", error);
    res.status(500).json({ message: "Failed to generate compliance report" });
  }
});

router.get("/compliance/evidence-pack", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const days = Math.min(Math.max(parseInt(String(req.query.days || "90"), 10) || 90, 1), 365);
    const data = await agentOSStorage.getEvidencePackData(req.aosCompanyId!, days);
    res.json(data);
  } catch (error) {
    console.error("[AgentOS] Evidence pack error:", error);
    res.status(500).json({ message: "Failed to generate evidence pack" });
  }
});

router.get("/sdk/snippet", aosAuth, async (req: AuthRequest, res: Response) => {
  const snippet = `
// AgentOS Shadow AI Discovery SDK
// Add this to your application to automatically register unmanaged AI agents

const AGENTOS_ENDPOINT = "${req.protocol}://${req.get("host")}/api/agentos/shadow-agents/report";
const COMPANY_ID = "${req.aosCompanyId}";
const API_KEY = "YOUR_API_KEY_HERE"; // Generate via AgentOS Settings > API Keys

function wrapLLMClient(client, identifier) {
  const originalCreate = client.chat.completions.create.bind(client.chat.completions);
  client.chat.completions.create = async function(...args) {
    try {
      fetch(AGENTOS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({
          companyId: COMPANY_ID,
          identifier: identifier || "unknown-agent",
          provider: "OpenAI",
          llmModel: args[0]?.model || "unknown",
        }),
      }).catch(() => {});
    } catch {}
    return originalCreate(...args);
  };
  return client;
}

module.exports = { wrapLLMClient };
`.trim();

  res.json({ snippet, language: "javascript" });
});

router.get("/risk/fleet-distribution", aosAuth, requireRole("admin", "manager"), async (req: AuthRequest, res: Response) => {
  try {
    const distribution = await agentOSStorage.getFleetRiskDistribution(req.aosCompanyId!);
    res.json(distribution);
  } catch (error) {
    console.error("[AgentOS] Fleet risk distribution error:", error);
    res.status(500).json({ message: "Failed to get fleet risk distribution" });
  }
});

router.post("/risk/recalculate", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const result = await agentOSStorage.recalculateAllRiskScores(req.aosCompanyId!);
    const allViolations = [];
    for (const agentId of result.agentIds || []) {
      const violations = await agentOSStorage.evaluatePoliciesForAgent(agentId, req.aosCompanyId!);
      allViolations.push(...violations);
    }
    await agentOSStorage.logAudit({
      companyId: req.aosCompanyId!,
      userId: req.aosUserId!,
      action: "risk_scores_recalculated",
      metadata: { updated: result.updated, violations: allViolations.length },
    });
    res.json({ ...result, violationsTriggered: allViolations.length });
  } catch (error) {
    console.error("[AgentOS] Risk recalculate error:", error);
    res.status(500).json({ message: "Failed to recalculate risk scores" });
  }
});

router.get("/agents/:id/risk-breakdown", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await agentOSStorage.calculateRiskScore(req.params.id, req.aosCompanyId!);
    res.json(result);
  } catch (error) {
    console.error("[AgentOS] Risk breakdown error:", error);
    res.status(500).json({ message: "Failed to get risk breakdown" });
  }
});

router.get("/risk/weights", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const weights = await agentOSStorage.getRiskWeights(req.aosCompanyId!);
    res.json(weights);
  } catch (error) {
    console.error("[AgentOS] Get risk weights error:", error);
    res.status(500).json({ message: "Failed to get risk weights" });
  }
});

router.put("/risk/weights", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { weights } = req.body;
    if (!Array.isArray(weights)) return res.status(400).json({ message: "weights array required" });
    const totalWeight = weights.reduce((sum: number, w: { factorKey: string; label: string; weight: number }) => sum + (w.weight || 0), 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) return res.status(400).json({ message: "Weights must sum to 1.0" });
    await agentOSStorage.updateRiskWeights(req.aosCompanyId!, weights);
    await agentOSStorage.logAudit({
      companyId: req.aosCompanyId!,
      userId: req.aosUserId!,
      action: "risk_weights_updated",
      metadata: { weights },
    });
    const updated = await agentOSStorage.getRiskWeights(req.aosCompanyId!);
    res.json(updated);
  } catch (error) {
    console.error("[AgentOS] Update risk weights error:", error);
    res.status(500).json({ message: "Failed to update risk weights" });
  }
});

router.get("/risk/policies", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const policies = await agentOSStorage.getPolicyRules(req.aosCompanyId!);
    res.json(policies);
  } catch (error) {
    console.error("[AgentOS] Get policies error:", error);
    res.status(500).json({ message: "Failed to get policies" });
  }
});

router.post("/risk/policies", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, conditionField, operator, threshold, secondaryField, secondaryOperator, secondaryThreshold, actionType, severity } = req.body;
    if (!name || !conditionField || !operator || (threshold === undefined || threshold === null || threshold === "")) {
      return res.status(400).json({ message: "Name, conditionField, operator, and threshold are required" });
    }
    const policy = await agentOSStorage.createPolicyRule({
      companyId: req.aosCompanyId!,
      name,
      description,
      conditionField,
      operator,
      threshold: String(threshold),
      secondaryField,
      secondaryOperator,
      secondaryThreshold: secondaryThreshold ? String(secondaryThreshold) : undefined,
      actionType: actionType || "alert",
      severity: severity || "warning",
      createdBy: req.aosUserId!,
    });
    await agentOSStorage.logAudit({
      companyId: req.aosCompanyId!,
      userId: req.aosUserId!,
      action: "policy_rule_created",
      entityType: "policy",
      entityId: policy.id,
      metadata: { name, conditionField, operator, threshold, actionType },
    });
    res.json(policy);
  } catch (error) {
    console.error("[AgentOS] Create policy error:", error);
    res.status(500).json({ message: "Failed to create policy" });
  }
});

router.put("/risk/policies/:id", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, conditionField, operator, threshold, secondaryField, secondaryOperator, secondaryThreshold, actionType, severity, isActive } = req.body;
    const allowedUpdates: Record<string, unknown> = {};
    if (name !== undefined) allowedUpdates.name = name;
    if (description !== undefined) allowedUpdates.description = description;
    if (conditionField !== undefined) allowedUpdates.conditionField = conditionField;
    if (operator !== undefined) allowedUpdates.operator = operator;
    if (threshold !== undefined) allowedUpdates.threshold = String(threshold);
    if (secondaryField !== undefined) allowedUpdates.secondaryField = secondaryField;
    if (secondaryOperator !== undefined) allowedUpdates.secondaryOperator = secondaryOperator;
    if (secondaryThreshold !== undefined) allowedUpdates.secondaryThreshold = secondaryThreshold ? String(secondaryThreshold) : null;
    if (actionType !== undefined) allowedUpdates.actionType = actionType;
    if (severity !== undefined) allowedUpdates.severity = severity;
    if (isActive !== undefined) allowedUpdates.isActive = isActive;
    const policy = await agentOSStorage.updatePolicyRule(req.params.id, req.aosCompanyId!, allowedUpdates);
    if (!policy) return res.status(404).json({ message: "Policy not found" });
    res.json(policy);
  } catch (error) {
    console.error("[AgentOS] Update policy error:", error);
    res.status(500).json({ message: "Failed to update policy" });
  }
});

router.delete("/risk/policies/:id", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await agentOSStorage.deletePolicyRule(req.params.id, req.aosCompanyId!);
    if (!deleted) return res.status(404).json({ message: "Policy not found" });
    await agentOSStorage.logAudit({
      companyId: req.aosCompanyId!,
      userId: req.aosUserId!,
      action: "policy_rule_deleted",
      entityType: "policy",
      entityId: req.params.id,
    });
    res.json({ success: true });
  } catch (error) {
    console.error("[AgentOS] Delete policy error:", error);
    res.status(500).json({ message: "Failed to delete policy" });
  }
});

router.post("/risk/policies/preview", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { conditionField, operator, threshold, secondaryField, secondaryOperator, secondaryThreshold } = req.body;
    if (!conditionField || !operator || (threshold === undefined || threshold === null || threshold === "")) {
      return res.status(400).json({ message: "conditionField, operator, and threshold required" });
    }
    const matches = await agentOSStorage.getAgentsMatchingPolicy(
      req.aosCompanyId!, conditionField, operator, String(threshold),
      secondaryField, secondaryOperator, secondaryThreshold ? String(secondaryThreshold) : undefined,
    );
    res.json({ matches, count: matches.length });
  } catch (error) {
    console.error("[AgentOS] Policy preview error:", error);
    res.status(500).json({ message: "Failed to preview policy" });
  }
});

router.get("/risk/violations", aosAuth, async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const violations = await agentOSStorage.getPolicyViolations(req.aosCompanyId!, status);
    res.json(violations);
  } catch (error) {
    console.error("[AgentOS] Get violations error:", error);
    res.status(500).json({ message: "Failed to get policy violations" });
  }
});

router.post("/risk/violations/:id/resolve", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const violation = await agentOSStorage.resolvePolicyViolation(req.params.id, req.aosCompanyId!, req.aosUserId!);
    if (!violation) return res.status(404).json({ message: "Violation not found" });
    res.json(violation);
  } catch (error) {
    console.error("[AgentOS] Resolve violation error:", error);
    res.status(500).json({ message: "Failed to resolve violation" });
  }
});

router.post("/risk/evaluate/:agentId", aosAuth, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    await agentOSStorage.calculateRiskScore(req.params.agentId, req.aosCompanyId!);
    const violations = await agentOSStorage.evaluatePoliciesForAgent(req.params.agentId, req.aosCompanyId!);
    res.json({ violations, count: violations.length });
  } catch (error) {
    console.error("[AgentOS] Evaluate agent error:", error);
    res.status(500).json({ message: "Failed to evaluate agent" });
  }
});

interface PlatformAuthRequest extends Request {
  aosPlatformAdminId?: string;
}

async function aosPlatformAuth(req: PlatformAuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const token = authHeader.slice(7);
  const [session] = await db.select().from(aosPlatformSessions)
    .where(eq(aosPlatformSessions.token, token));
  if (!session || new Date(session.expiresAt) < new Date()) {
    return res.status(401).json({ message: "Session expired" });
  }
  const [admin] = await db.select().from(aosPlatformAdmins)
    .where(eq(aosPlatformAdmins.id, session.adminId));
  if (!admin || !admin.isActive) {
    return res.status(401).json({ message: "Account disabled" });
  }
  req.aosPlatformAdminId = admin.id;
  next();
}

router.post("/platform/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    const [admin] = await db.select().from(aosPlatformAdmins)
      .where(eq(aosPlatformAdmins.email, email.toLowerCase()));
    if (!admin) return res.status(401).json({ message: "Invalid credentials" });

    const [hashed, salt] = admin.passwordHash.split(".");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    if (buf.toString("hex") !== hashed) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.insert(aosPlatformSessions).values({ adminId: admin.id, token, expiresAt });
    await db.update(aosPlatformAdmins).set({ lastLoginAt: new Date() }).where(eq(aosPlatformAdmins.id, admin.id));

    res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  } catch (error) {
    console.error("[AgentOS Platform] Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

router.get("/platform/auth/me", aosPlatformAuth as any, async (req: PlatformAuthRequest, res: Response) => {
  const [admin] = await db.select().from(aosPlatformAdmins).where(eq(aosPlatformAdmins.id, req.aosPlatformAdminId!));
  if (!admin) return res.status(401).json({ message: "Not found" });
  res.json({ id: admin.id, name: admin.name, email: admin.email, role: admin.role });
});

router.post("/platform/auth/logout", aosPlatformAuth as any, async (req: PlatformAuthRequest, res: Response) => {
  const token = req.headers.authorization?.slice(7);
  if (token) await db.delete(aosPlatformSessions).where(eq(aosPlatformSessions.token, token));
  res.json({ success: true });
});

router.get("/platform/stats", aosPlatformAuth as any, async (_req: Request, res: Response) => {
  try {
    const [companiesCount] = await db.select({ count: sql<number>`count(*)` }).from(aosCompanies);
    const [agentsCount] = await db.select({ count: sql<number>`count(*)` }).from(aosAgents);
    const [usersCount] = await db.select({ count: sql<number>`count(*)` }).from(aosUsers);

    const [telemetryCount] = await db.select({ count: sql<number>`count(*)` }).from(aosTelemetryEvents);
    const spendRows = await db.execute(sql`SELECT COALESCE(SUM(cost_usd), 0) as total FROM aos_telemetry_events WHERE "timestamp" >= NOW() - INTERVAL '30 days'`);
    const totalSpend = parseFloat(String((spendRows as any).rows?.[0]?.total ?? (spendRows as any)[0]?.total ?? 0));

    const recentCompanies = await db.select({
      id: aosCompanies.id,
      name: aosCompanies.name,
      industry: aosCompanies.industry,
      country: aosCompanies.country,
      posCompanyId: aosCompanies.posCompanyId,
      createdAt: aosCompanies.createdAt,
    }).from(aosCompanies).orderBy(desc(aosCompanies.createdAt)).limit(5);

    const agentsByStatusRows = await db.execute(sql`
      SELECT status, COUNT(*) as cnt FROM aos_agents GROUP BY status
    `);
    const agentsByStatus: Record<string, number> = {};
    ((agentsByStatusRows as any).rows ?? agentsByStatusRows).forEach((r: any) => {
      agentsByStatus[r.status] = parseInt(String(r.cnt), 10);
    });

    const topCompaniesRows = await db.execute(sql`
      SELECT c.id, c.name, COALESCE(SUM(t.cost_usd), 0) as total_spend
      FROM aos_companies c
      LEFT JOIN aos_telemetry_events t ON t.company_id = c.id
      GROUP BY c.id, c.name
      ORDER BY total_spend DESC
      LIMIT 5
    `);
    const topCompaniesBySpend = ((topCompaniesRows as any).rows ?? topCompaniesRows).map((r: any) => ({
      id: r.id,
      name: r.name,
      totalSpend: parseFloat(String(r.total_spend)),
    }));

    res.json({
      totalCompanies: parseInt(String(companiesCount.count), 10),
      totalAgents: parseInt(String(agentsCount.count), 10),
      totalUsers: parseInt(String(usersCount.count), 10),
      totalTelemetryEvents: parseInt(String(telemetryCount.count), 10),
      monthlySpend: totalSpend,
      recentCompanies,
      agentsByStatus,
      topCompaniesBySpend,
    });
  } catch (error) {
    console.error("[AgentOS Platform] Stats error:", error);
    res.status(500).json({ message: "Failed to load stats" });
  }
});

router.get("/platform/companies", aosPlatformAuth as any, async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT c.id, c.name, c.industry, c.country, c.website, c.pos_company_id, c.created_at,
        COALESCE(ag.cnt, 0) as agent_count,
        COALESCE(u.cnt, 0) as user_count,
        COALESCE(t.total, 0) as total_spend
      FROM aos_companies c
      LEFT JOIN (SELECT company_id, COUNT(*) as cnt FROM aos_agents GROUP BY company_id) ag ON ag.company_id = c.id
      LEFT JOIN (SELECT company_id, COUNT(*) as cnt FROM aos_users GROUP BY company_id) u ON u.company_id = c.id
      LEFT JOIN (SELECT company_id, SUM(cost_usd) as total FROM aos_telemetry_events GROUP BY company_id) t ON t.company_id = c.id
      ORDER BY c.created_at DESC
    `);
    const companiesData = ((rows as any).rows ?? rows) as any[];
    const enriched = companiesData.map((r: any) => ({
      id: r.id,
      name: r.name,
      industry: r.industry,
      country: r.country,
      website: r.website,
      posCompanyId: r.pos_company_id,
      createdAt: r.created_at,
      agentCount: parseInt(String(r.agent_count), 10),
      userCount: parseInt(String(r.user_count), 10),
      totalSpend: parseFloat(String(r.total_spend)),
      peopleosLinked: !!r.pos_company_id,
    }));

    res.json(enriched);
  } catch (error) {
    console.error("[AgentOS Platform] Companies error:", error);
    res.status(500).json({ message: "Failed to load companies" });
  }
});

router.get("/platform/companies/:id", aosPlatformAuth as any, async (req: Request, res: Response) => {
  try {
    const [company] = await db.select().from(aosCompanies).where(eq(aosCompanies.id, req.params.id));
    if (!company) return res.status(404).json({ message: "Company not found" });

    const agents = await db.select().from(aosAgents).where(eq(aosAgents.companyId, company.id));
    const users = await db.select({ id: aosUsers.id, name: aosUsers.name, email: aosUsers.email, role: aosUsers.role, lastLoginAt: aosUsers.lastLoginAt, isActive: aosUsers.isActive })
      .from(aosUsers).where(sql`${aosUsers.companyId} = ${company.id} AND ${aosUsers.role} IN ('admin', 'manager')`);
    const departments = await db.select().from(aosDepartments).where(eq(aosDepartments.companyId, company.id));
    const [spend] = await db.select({ total: sql<string>`COALESCE(SUM(cost_usd), 0)` }).from(aosTelemetryEvents).where(eq(aosTelemetryEvents.companyId, company.id));

    const telemetryEvents = await db.select().from(aosTelemetryEvents)
      .where(eq(aosTelemetryEvents.companyId, company.id))
      .orderBy(desc(aosTelemetryEvents.timestamp)).limit(50);

    const telemetrySummaryRows = await db.execute(sql`
      SELECT
        COALESCE(SUM(cost_usd), 0) as total_cost,
        COALESCE(AVG(latency_ms), 0) as avg_latency,
        COALESCE(AVG(accuracy_score), 0) as avg_accuracy,
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE task_outcome = 'success') as successful_tasks
      FROM aos_telemetry_events WHERE company_id = ${company.id}
    `);
    const summaryRow = ((telemetrySummaryRows as any).rows ?? telemetrySummaryRows)?.[0] ?? {};
    const totalTasks = parseInt(String(summaryRow.total_tasks || 0), 10);
    const successfulTasks = parseInt(String(summaryRow.successful_tasks || 0), 10);
    const telemetrySummary = {
      totalCost: parseFloat(String(summaryRow.total_cost || 0)),
      avgLatency: Math.round(parseFloat(String(summaryRow.avg_latency || 0))),
      avgAccuracy: parseFloat(parseFloat(String(summaryRow.avg_accuracy || 0)).toFixed(2)),
      taskSuccessRate: totalTasks > 0 ? parseFloat(((successfulTasks / totalTasks) * 100).toFixed(1)) : 0,
    };

    const spendByAgentRows = await db.execute(sql`
      SELECT a.name as agent_name, a.id as agent_id, COALESCE(SUM(t.cost_usd), 0) as total_cost
      FROM aos_agents a
      LEFT JOIN aos_telemetry_events t ON t.agent_id = a.id
      WHERE a.company_id = ${company.id}
      GROUP BY a.id, a.name
      ORDER BY total_cost DESC
      LIMIT 10
    `);
    const spendByAgent = ((spendByAgentRows as any).rows ?? spendByAgentRows).map((r: any) => ({
      agentId: r.agent_id,
      agentName: r.agent_name,
      totalCost: parseFloat(String(r.total_cost)),
    }));

    const deptSpendRows = await db.execute(sql`
      SELECT d.id as dept_id, COALESCE(SUM(t.cost_usd), 0) as current_spend
      FROM aos_departments d
      LEFT JOIN aos_agents a ON a.department_id = d.id
      LEFT JOIN aos_telemetry_events t ON t.agent_id = a.id
      WHERE d.company_id = ${company.id}
      GROUP BY d.id
    `);
    const deptSpendMap: Record<string, number> = {};
    ((deptSpendRows as any).rows ?? deptSpendRows).forEach((r: any) => {
      deptSpendMap[r.dept_id] = parseFloat(String(r.current_spend));
    });
    const departmentsWithSpend = departments.map(d => ({
      ...d,
      currentSpend: deptSpendMap[d.id] || 0,
    }));

    const budgetAlerts = await db.select().from(aosBudgetAlerts)
      .where(eq(aosBudgetAlerts.companyId, company.id))
      .orderBy(desc(aosBudgetAlerts.createdAt)).limit(50);

    const driftAlerts = await db.select().from(aosDriftAlerts)
      .where(eq(aosDriftAlerts.companyId, company.id))
      .orderBy(desc(aosDriftAlerts.createdAt)).limit(50);

    const policyViolations = await db.select().from(aosPolicyViolations)
      .where(eq(aosPolicyViolations.companyId, company.id))
      .orderBy(desc(aosPolicyViolations.createdAt)).limit(50);

    const [piiEventCount] = await db.select({ count: sql<number>`count(*)` }).from(aosPiiEvents)
      .where(eq(aosPiiEvents.companyId, company.id));

    const killSwitchEvents = await db.select().from(aosKillSwitchEvents)
      .where(eq(aosKillSwitchEvents.companyId, company.id))
      .orderBy(desc(aosKillSwitchEvents.createdAt)).limit(50);

    const auditLogs = await db.select().from(aosAuditLogs)
      .where(eq(aosAuditLogs.companyId, company.id))
      .orderBy(desc(aosAuditLogs.createdAt)).limit(50);

    const shadowAgents = await db.select().from(aosShadowAgents)
      .where(eq(aosShadowAgents.companyId, company.id));

    res.json({
      ...company,
      agents,
      users,
      departments: departmentsWithSpend,
      totalSpend: parseFloat(String(spend.total)),
      peopleosLinked: !!company.posCompanyId,
      telemetryEvents,
      telemetrySummary,
      spendByAgent,
      budgetAlerts,
      driftAlerts,
      policyViolations,
      piiEventCount: parseInt(String(piiEventCount.count), 10),
      killSwitchEvents,
      auditLogs,
      shadowAgents,
    });
  } catch (error) {
    console.error("[AgentOS Platform] Company detail error:", error);
    res.status(500).json({ message: "Failed to load company" });
  }
});

router.get("/platform/health", aosPlatformAuth as any, async (_req: Request, res: Response) => {
  try {
    const mem = process.memoryUsage();
    const uptime = process.uptime();

    const dbResult = await db.execute(sql`SELECT 1 as ok`);
    const dbOk = !!(dbResult as any).rows?.length || !!(dbResult as any).length || !!(dbResult as any)[0];

    res.json({
      status: "healthy",
      uptime: Math.floor(uptime),
      memory: {
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        rss: Math.round(mem.rss / 1024 / 1024),
        external: Math.round(mem.external / 1024 / 1024),
      },
      database: dbOk ? "connected" : "disconnected",
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[AgentOS Platform] Health error:", error);
    res.status(500).json({ status: "unhealthy", message: "Health check failed" });
  }
});

router.post("/admin/github/sync-repo", aosPlatformAuth as any, async (req: PlatformAuthRequest, res: Response) => {
  try {
    const { syncAgentOSRepo } = await import("../services/githubRepoSync");
    const result = await syncAgentOSRepo();
    res.json({
      message: "Repository synced successfully",
      commitSha: result.commitSha,
      filesCount: result.filesCount,
      filesPushed: result.filesPushed,
      metadataUpdated: result.metadataUpdated,
    });
  } catch (error: any) {
    console.error("[AgentOS] GitHub sync error:", error);
    res.status(500).json({ message: "Failed to sync repository" });
  }
});

export default router;
