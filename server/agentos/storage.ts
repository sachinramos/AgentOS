import { db } from "../db";
import { eq, and, sql, desc, gte, lte, asc, gt, lt, ilike, or, inArray, SQL, count } from "drizzle-orm";
import { posEmployees, posDepartments } from "@shared/peopleos-schema";
import {
  aosCompanies, aosUsers, aosSessions, aosDepartments, aosAgents, aosAgentVersions, aosAuditLogs,
  aosTelemetryEvents, aosPerformanceRatings, aosCertificationConfigs, aosApiKeys, aosBudgetAlerts,
  aosKillSwitchEvents, aosPiiRules, aosPiiEvents, aosReasoningTraces, aosReasoningSteps,
  aosDriftAlerts, aosShadowAgents, aosNotifications, aosPolicyRules, aosPolicyViolations, aosRiskWeights,
  InsertAosCompany, InsertAosUser, InsertAosDepartment, InsertAosAgent, InsertAosAgentVersion, InsertAosAuditLog,
  InsertAosTelemetryEvent, InsertAosPerformanceRating, InsertAosCertificationConfig, InsertAosApiKey, InsertAosBudgetAlert,
  InsertAosKillSwitchEvent, InsertAosPiiRule, InsertAosPiiEvent, InsertAosReasoningTrace, InsertAosReasoningStep,
  InsertAosDriftAlert, InsertAosShadowAgent, InsertAosNotification, InsertAosPolicyRule, InsertAosPolicyViolation,
  AosCompany, AosUser, AosSession, AosDepartment, AosAgent, AosAgentVersion, AosAuditLog,
  AosTelemetryEvent, AosPerformanceRating, AosCertificationConfig, AosApiKey, AosBudgetAlert,
  AosKillSwitchEvent, AosPiiRule, AosPiiEvent, AosReasoningTrace, AosReasoningStep,
  AosDriftAlert, AosShadowAgent, AosNotification, AosPolicyRule, AosPolicyViolation, AosRiskWeight,
} from "@shared/agentos-schema";

export class AgentOSStorage {
  async createCompany(data: InsertAosCompany): Promise<AosCompany> {
    const [company] = await db.insert(aosCompanies).values(data).returning();
    return company;
  }

  async getCompany(id: string): Promise<AosCompany | undefined> {
    const [company] = await db.select().from(aosCompanies).where(eq(aosCompanies.id, id));
    return company;
  }

  async updateCompany(id: string, data: Partial<InsertAosCompany>): Promise<AosCompany | undefined> {
    const [company] = await db.update(aosCompanies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aosCompanies.id, id))
      .returning();
    return company;
  }

  async createUser(data: InsertAosUser): Promise<AosUser> {
    const [user] = await db.insert(aosUsers).values(data).returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<AosUser | undefined> {
    const [user] = await db.select().from(aosUsers).where(eq(aosUsers.email, email.toLowerCase()));
    return user;
  }

  async getUser(id: string): Promise<AosUser | undefined> {
    const [user] = await db.select().from(aosUsers).where(eq(aosUsers.id, id));
    return user;
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await db.update(aosUsers).set({ lastLoginAt: new Date() }).where(eq(aosUsers.id, id));
  }

  async getUsers(companyId: string): Promise<AosUser[]> {
    return db.select().from(aosUsers)
      .where(eq(aosUsers.companyId, companyId))
      .orderBy(aosUsers.name);
  }

  async updateUser(id: string, companyId: string, data: Partial<InsertAosUser>): Promise<AosUser | undefined> {
    const [user] = await db.update(aosUsers)
      .set(data)
      .where(and(eq(aosUsers.id, id), eq(aosUsers.companyId, companyId)))
      .returning();
    return user;
  }

  async deleteUser(id: string, companyId: string): Promise<boolean> {
    const result = await db.delete(aosUsers)
      .where(and(eq(aosUsers.id, id), eq(aosUsers.companyId, companyId)))
      .returning();
    return result.length > 0;
  }

  async createSession(userId: string, token: string, expiresAt: Date): Promise<AosSession> {
    const [session] = await db.insert(aosSessions).values({ userId, token, expiresAt }).returning();
    return session;
  }

  async getSessionByToken(token: string): Promise<AosSession | undefined> {
    const [session] = await db.select().from(aosSessions)
      .where(and(eq(aosSessions.token, token), gt(aosSessions.expiresAt, new Date())));
    return session;
  }

  async deleteSession(token: string): Promise<void> {
    await db.delete(aosSessions).where(eq(aosSessions.token, token));
  }

  async getDepartments(companyId: string): Promise<AosDepartment[]> {
    return db.select().from(aosDepartments)
      .where(eq(aosDepartments.companyId, companyId))
      .orderBy(aosDepartments.name);
  }

  async getDepartment(id: string, companyId: string): Promise<AosDepartment | undefined> {
    const [dept] = await db.select().from(aosDepartments)
      .where(and(eq(aosDepartments.id, id), eq(aosDepartments.companyId, companyId)));
    return dept;
  }

  async createDepartment(data: InsertAosDepartment): Promise<AosDepartment> {
    const [dept] = await db.insert(aosDepartments).values(data).returning();
    return dept;
  }

  async updateDepartment(id: string, companyId: string, data: Partial<InsertAosDepartment>): Promise<AosDepartment | undefined> {
    const [dept] = await db.update(aosDepartments)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(aosDepartments.id, id), eq(aosDepartments.companyId, companyId)))
      .returning();
    return dept;
  }

  async deleteDepartment(id: string, companyId: string): Promise<boolean> {
    const result = await db.delete(aosDepartments)
      .where(and(eq(aosDepartments.id, id), eq(aosDepartments.companyId, companyId)))
      .returning();
    return result.length > 0;
  }

  async getAgents(companyId: string, filters?: { status?: string; provider?: string; departmentId?: string; search?: string }): Promise<AosAgent[]> {
    const conditions: SQL[] = [eq(aosAgents.companyId, companyId)];
    if (filters?.status) conditions.push(eq(aosAgents.status, filters.status));
    if (filters?.provider) conditions.push(eq(aosAgents.provider, filters.provider));
    if (filters?.departmentId) conditions.push(eq(aosAgents.departmentId, filters.departmentId));
    if (filters?.search) conditions.push(or(ilike(aosAgents.name, `%${filters.search}%`), ilike(aosAgents.uid, `%${filters.search}%`))!);

    return db.select().from(aosAgents)
      .where(and(...conditions))
      .orderBy(desc(aosAgents.createdAt));
  }

  async getAgent(id: string, companyId?: string): Promise<AosAgent | undefined> {
    const conditions: SQL[] = [eq(aosAgents.id, id)];
    if (companyId) conditions.push(eq(aosAgents.companyId, companyId));
    const [agent] = await db.select().from(aosAgents).where(and(...conditions));
    return agent;
  }

  async createAgent(data: InsertAosAgent): Promise<AosAgent> {
    const [agent] = await db.insert(aosAgents).values(data).returning();
    return agent;
  }

  async updateAgent(id: string, companyId: string, data: Partial<InsertAosAgent>): Promise<AosAgent | undefined> {
    const [agent] = await db.update(aosAgents)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(aosAgents.id, id), eq(aosAgents.companyId, companyId)))
      .returning();
    return agent;
  }

  async deleteAgent(id: string, companyId: string): Promise<boolean> {
    const result = await db.delete(aosAgents)
      .where(and(eq(aosAgents.id, id), eq(aosAgents.companyId, companyId)))
      .returning();
    return result.length > 0;
  }

  async transitionAgent(id: string, companyId: string, status: string): Promise<AosAgent | undefined> {
    const validTransitions: Record<string, string[]> = {
      onboarding: ["active", "suspended", "retired"],
      active: ["suspended", "retired"],
      suspended: ["active", "retired"],
      retired: [],
    };

    const agent = await this.getAgent(id, companyId);
    if (!agent) return undefined;

    const allowed = validTransitions[agent.status] || [];
    if (!allowed.includes(status)) return undefined;

    const [updated] = await db.update(aosAgents)
      .set({ status, updatedAt: new Date(), ...(status === "active" && !agent.deploymentDate ? { deploymentDate: new Date() } : {}) })
      .where(and(eq(aosAgents.id, id), eq(aosAgents.companyId, companyId)))
      .returning();
    return updated;
  }

  async createAgentVersion(data: InsertAosAgentVersion): Promise<AosAgentVersion> {
    const [version] = await db.insert(aosAgentVersions).values(data).returning();
    return version;
  }

  async getAgentVersions(agentId: string): Promise<AosAgentVersion[]> {
    return db.select().from(aosAgentVersions)
      .where(eq(aosAgentVersions.agentId, agentId))
      .orderBy(desc(aosAgentVersions.version));
  }

  async getDashboardStats(companyId: string): Promise<{
    totalAgents: number;
    byStatus: { status: string; count: number }[];
    byProvider: { provider: string; count: number }[];
    recentAgents: AosAgent[];
  }> {
    const [totalResult] = await db.select({ count: sql<number>`count(*)` })
      .from(aosAgents).where(eq(aosAgents.companyId, companyId));

    const byStatus = await db
      .select({ status: aosAgents.status, count: sql<number>`count(*)` })
      .from(aosAgents)
      .where(eq(aosAgents.companyId, companyId))
      .groupBy(aosAgents.status);

    const byProvider = await db
      .select({ provider: aosAgents.provider, count: sql<number>`count(*)` })
      .from(aosAgents)
      .where(eq(aosAgents.companyId, companyId))
      .groupBy(aosAgents.provider);

    const recentAgents = await db.select().from(aosAgents)
      .where(eq(aosAgents.companyId, companyId))
      .orderBy(desc(aosAgents.createdAt))
      .limit(5);

    return {
      totalAgents: Number(totalResult.count),
      byStatus: byStatus.map(s => ({ status: s.status, count: Number(s.count) })),
      byProvider: byProvider.map(p => ({ provider: p.provider, count: Number(p.count) })),
      recentAgents,
    };
  }

  async logAudit(data: InsertAosAuditLog): Promise<void> {
    await db.insert(aosAuditLogs).values(data);
  }

  async getAuditLogs(companyId: string, limit = 50, filters?: {
    action?: string;
    entityType?: string;
    entityId?: string;
  }): Promise<AosAuditLog[]> {
    const conditions: SQL[] = [eq(aosAuditLogs.companyId, companyId)];
    if (filters?.action) conditions.push(eq(aosAuditLogs.action, filters.action));
    if (filters?.entityType) conditions.push(eq(aosAuditLogs.entityType, filters.entityType));
    if (filters?.entityId) conditions.push(eq(aosAuditLogs.entityId, filters.entityId));

    return db.select().from(aosAuditLogs)
      .where(and(...conditions))
      .orderBy(desc(aosAuditLogs.createdAt))
      .limit(limit);
  }

  async ingestTelemetry(data: InsertAosTelemetryEvent): Promise<AosTelemetryEvent> {
    const [event] = await db.insert(aosTelemetryEvents).values(data).returning();
    return event;
  }

  async ingestTelemetryBatch(events: InsertAosTelemetryEvent[]): Promise<AosTelemetryEvent[]> {
    if (events.length === 0) return [];
    return db.insert(aosTelemetryEvents).values(events).returning();
  }

  async getTelemetryEvents(companyId: string, filters?: { agentId?: string; provider?: string; from?: Date; to?: Date; limit?: number }): Promise<AosTelemetryEvent[]> {
    const conditions: SQL[] = [eq(aosTelemetryEvents.companyId, companyId)];
    if (filters?.agentId) conditions.push(eq(aosTelemetryEvents.agentId, filters.agentId));
    if (filters?.provider) conditions.push(eq(aosTelemetryEvents.provider, filters.provider));
    if (filters?.from) conditions.push(gte(aosTelemetryEvents.timestamp, filters.from));
    if (filters?.to) conditions.push(lte(aosTelemetryEvents.timestamp, filters.to));

    return db.select().from(aosTelemetryEvents)
      .where(and(...conditions))
      .orderBy(desc(aosTelemetryEvents.timestamp))
      .limit(filters?.limit || 500);
  }

  async getAgentCostSummary(companyId: string, from?: Date, to?: Date): Promise<any[]> {
    const conditions: SQL[] = [eq(aosTelemetryEvents.companyId, companyId)];
    if (from) conditions.push(gte(aosTelemetryEvents.timestamp, from));
    if (to) conditions.push(lte(aosTelemetryEvents.timestamp, to));

    return db.select({
      agentId: aosTelemetryEvents.agentId,
      provider: aosTelemetryEvents.provider,
      model: aosTelemetryEvents.model,
      totalCost: sql<string>`sum(${aosTelemetryEvents.costUsd}::numeric)`,
      totalInputTokens: sql<number>`sum(${aosTelemetryEvents.inputTokens})`,
      totalOutputTokens: sql<number>`sum(${aosTelemetryEvents.outputTokens})`,
      totalTokens: sql<number>`sum(${aosTelemetryEvents.totalTokens})`,
      eventCount: sql<number>`count(*)`,
      avgLatency: sql<number>`avg(${aosTelemetryEvents.latencyMs})`,
      successCount: sql<number>`sum(case when ${aosTelemetryEvents.taskOutcome} = 'success' then 1 else 0 end)`,
      failureCount: sql<number>`sum(case when ${aosTelemetryEvents.taskOutcome} = 'failure' then 1 else 0 end)`,
    })
      .from(aosTelemetryEvents)
      .where(and(...conditions))
      .groupBy(aosTelemetryEvents.agentId, aosTelemetryEvents.provider, aosTelemetryEvents.model);
  }

  async getDepartmentCostSummary(companyId: string, from?: Date, to?: Date): Promise<any[]> {
    const conditions: SQL[] = [eq(aosTelemetryEvents.companyId, companyId)];
    if (from) conditions.push(gte(aosTelemetryEvents.timestamp, from));
    if (to) conditions.push(lte(aosTelemetryEvents.timestamp, to));

    return db.select({
      departmentId: aosAgents.departmentId,
      totalCost: sql<string>`sum(${aosTelemetryEvents.costUsd}::numeric)`,
      totalTokens: sql<number>`sum(${aosTelemetryEvents.totalTokens})`,
      eventCount: sql<number>`count(*)`,
    })
      .from(aosTelemetryEvents)
      .innerJoin(aosAgents, eq(aosTelemetryEvents.agentId, aosAgents.id))
      .where(and(...conditions))
      .groupBy(aosAgents.departmentId);
  }

  async getProviderCostSummary(companyId: string, from?: Date, to?: Date): Promise<any[]> {
    const conditions: SQL[] = [eq(aosTelemetryEvents.companyId, companyId)];
    if (from) conditions.push(gte(aosTelemetryEvents.timestamp, from));
    if (to) conditions.push(lte(aosTelemetryEvents.timestamp, to));

    return db.select({
      provider: aosTelemetryEvents.provider,
      model: aosTelemetryEvents.model,
      totalCost: sql<string>`sum(${aosTelemetryEvents.costUsd}::numeric)`,
      totalTokens: sql<number>`sum(${aosTelemetryEvents.totalTokens})`,
      eventCount: sql<number>`count(*)`,
      avgLatency: sql<number>`avg(${aosTelemetryEvents.latencyMs})`,
      successCount: sql<number>`sum(case when ${aosTelemetryEvents.taskOutcome} = 'success' then 1 else 0 end)`,
      failureCount: sql<number>`sum(case when ${aosTelemetryEvents.taskOutcome} = 'failure' then 1 else 0 end)`,
      avgAccuracy: sql<number>`avg(${aosTelemetryEvents.accuracyScore})`,
    })
      .from(aosTelemetryEvents)
      .where(and(...conditions))
      .groupBy(aosTelemetryEvents.provider, aosTelemetryEvents.model);
  }

  async getRoleBenchmarkSummary(companyId: string): Promise<Record<string, any[]>> {
    const rows = await db.select({
      role: aosAgents.role,
      agentName: aosAgents.name,
      provider: aosTelemetryEvents.provider,
      model: aosTelemetryEvents.model,
      totalCost: sql<string>`sum(${aosTelemetryEvents.costUsd}::numeric)`,
      avgLatency: sql<number>`avg(${aosTelemetryEvents.latencyMs})`,
      eventCount: sql<number>`count(*)`,
      successCount: sql<number>`sum(case when ${aosTelemetryEvents.taskOutcome} = 'success' then 1 else 0 end)`,
    })
      .from(aosTelemetryEvents)
      .innerJoin(aosAgents, eq(aosTelemetryEvents.agentId, aosAgents.id))
      .where(and(eq(aosTelemetryEvents.companyId, companyId), sql`${aosAgents.role} is not null`))
      .groupBy(aosAgents.role, aosAgents.name, aosTelemetryEvents.provider, aosTelemetryEvents.model);

    const byRole: Record<string, any[]> = {};
    for (const row of rows) {
      const role = row.role!;
      if (!byRole[role]) byRole[role] = [];
      const successRate = row.eventCount > 0 ? ((row.successCount || 0) / row.eventCount) * 100 : 0;
      byRole[role].push({
        agentName: row.agentName,
        provider: row.provider,
        model: row.model,
        totalCost: parseFloat(row.totalCost || "0"),
        avgLatency: row.avgLatency || 0,
        successRate,
      });
    }
    return byRole;
  }

  async getDailyCostTrend(companyId: string, days: number = 30): Promise<any[]> {
    const from = new Date();
    from.setDate(from.getDate() - days);

    return db.select({
      date: sql<string>`date_trunc('day', ${aosTelemetryEvents.timestamp})::date`,
      totalCost: sql<string>`sum(${aosTelemetryEvents.costUsd}::numeric)`,
      totalTokens: sql<number>`sum(${aosTelemetryEvents.totalTokens})`,
      eventCount: sql<number>`count(*)`,
    })
      .from(aosTelemetryEvents)
      .where(and(eq(aosTelemetryEvents.companyId, companyId), gte(aosTelemetryEvents.timestamp, from)))
      .groupBy(sql`date_trunc('day', ${aosTelemetryEvents.timestamp})::date`)
      .orderBy(asc(sql`date_trunc('day', ${aosTelemetryEvents.timestamp})::date`));
  }

  async getAgentDailyCostTrend(agentId: string, days: number = 30): Promise<any[]> {
    const from = new Date();
    from.setDate(from.getDate() - days);

    return db.select({
      date: sql<string>`date_trunc('day', ${aosTelemetryEvents.timestamp})::date`,
      totalCost: sql<string>`sum(${aosTelemetryEvents.costUsd}::numeric)`,
      totalTokens: sql<number>`sum(${aosTelemetryEvents.totalTokens})`,
      inputTokens: sql<number>`sum(${aosTelemetryEvents.inputTokens})`,
      outputTokens: sql<number>`sum(${aosTelemetryEvents.outputTokens})`,
      eventCount: sql<number>`count(*)`,
      successCount: sql<number>`sum(case when ${aosTelemetryEvents.taskOutcome} = 'success' then 1 else 0 end)`,
      failureCount: sql<number>`sum(case when ${aosTelemetryEvents.taskOutcome} = 'failure' then 1 else 0 end)`,
    })
      .from(aosTelemetryEvents)
      .where(and(eq(aosTelemetryEvents.agentId, agentId), gte(aosTelemetryEvents.timestamp, from)))
      .groupBy(sql`date_trunc('day', ${aosTelemetryEvents.timestamp})::date`)
      .orderBy(asc(sql`date_trunc('day', ${aosTelemetryEvents.timestamp})::date`));
  }

  async getAgentPerformanceMetrics(agentId: string, from?: Date, to?: Date): Promise<any> {
    const conditions: SQL[] = [eq(aosTelemetryEvents.agentId, agentId)];
    if (from) conditions.push(gte(aosTelemetryEvents.timestamp, from));
    if (to) conditions.push(lte(aosTelemetryEvents.timestamp, to));

    const [metrics] = await db.select({
      totalTasks: sql<number>`count(*)`,
      successCount: sql<number>`sum(case when ${aosTelemetryEvents.taskOutcome} = 'success' then 1 else 0 end)`,
      failureCount: sql<number>`sum(case when ${aosTelemetryEvents.taskOutcome} = 'failure' then 1 else 0 end)`,
      avgLatency: sql<number>`avg(${aosTelemetryEvents.latencyMs})`,
      avgAccuracy: sql<number>`avg(${aosTelemetryEvents.accuracyScore})`,
      totalCost: sql<string>`sum(${aosTelemetryEvents.costUsd}::numeric)`,
      totalTokens: sql<number>`sum(${aosTelemetryEvents.totalTokens})`,
    })
      .from(aosTelemetryEvents)
      .where(and(...conditions));

    return metrics;
  }

  async createPerformanceRating(data: InsertAosPerformanceRating): Promise<AosPerformanceRating> {
    const [rating] = await db.insert(aosPerformanceRatings).values(data).returning();
    return rating;
  }

  async getPerformanceRatings(agentId: string): Promise<AosPerformanceRating[]> {
    return db.select().from(aosPerformanceRatings)
      .where(eq(aosPerformanceRatings.agentId, agentId))
      .orderBy(desc(aosPerformanceRatings.createdAt));
  }

  async getAverageRating(agentId: string): Promise<number | null> {
    const [result] = await db.select({
      avg: sql<number>`avg(${aosPerformanceRatings.rating})`,
    }).from(aosPerformanceRatings).where(eq(aosPerformanceRatings.agentId, agentId));
    return result?.avg ?? null;
  }

  async getCertificationConfig(companyId: string): Promise<AosCertificationConfig | undefined> {
    const [config] = await db.select().from(aosCertificationConfigs)
      .where(eq(aosCertificationConfigs.companyId, companyId));
    return config;
  }

  async upsertCertificationConfig(data: InsertAosCertificationConfig): Promise<AosCertificationConfig> {
    const existing = await this.getCertificationConfig(data.companyId);
    if (existing) {
      const [updated] = await db.update(aosCertificationConfigs)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(aosCertificationConfigs.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(aosCertificationConfigs).values(data).returning();
    return created;
  }

  async createApiKey(data: InsertAosApiKey): Promise<AosApiKey> {
    const [key] = await db.insert(aosApiKeys).values(data).returning();
    return key;
  }

  async getApiKeys(companyId: string): Promise<AosApiKey[]> {
    return db.select().from(aosApiKeys)
      .where(eq(aosApiKeys.companyId, companyId))
      .orderBy(desc(aosApiKeys.createdAt));
  }

  async getApiKeyByHash(keyHash: string): Promise<AosApiKey | undefined> {
    const [key] = await db.select().from(aosApiKeys)
      .where(and(eq(aosApiKeys.keyHash, keyHash), eq(aosApiKeys.isActive, true)));
    return key;
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    await db.update(aosApiKeys).set({ lastUsedAt: new Date() }).where(eq(aosApiKeys.id, id));
  }

  async deactivateApiKey(id: string): Promise<void> {
    await db.update(aosApiKeys).set({ isActive: false }).where(eq(aosApiKeys.id, id));
  }

  async reactivateApiKey(id: string): Promise<void> {
    await db.update(aosApiKeys).set({ isActive: true }).where(eq(aosApiKeys.id, id));
  }

  async createBudgetAlert(data: InsertAosBudgetAlert): Promise<AosBudgetAlert> {
    const [alert] = await db.insert(aosBudgetAlerts).values(data).returning();
    return alert;
  }

  async getBudgetAlerts(companyId: string, unreadOnly?: boolean): Promise<AosBudgetAlert[]> {
    const conditions: SQL[] = [eq(aosBudgetAlerts.companyId, companyId)];
    if (unreadOnly) conditions.push(eq(aosBudgetAlerts.isRead, false));
    return db.select().from(aosBudgetAlerts)
      .where(and(...conditions))
      .orderBy(desc(aosBudgetAlerts.createdAt))
      .limit(100);
  }

  async markAlertRead(id: string): Promise<void> {
    await db.update(aosBudgetAlerts).set({ isRead: true }).where(eq(aosBudgetAlerts.id, id));
  }

  async createKillSwitchEvent(data: InsertAosKillSwitchEvent): Promise<AosKillSwitchEvent> {
    const [event] = await db.insert(aosKillSwitchEvents).values(data).returning();
    return event;
  }

  async getKillSwitchEvents(companyId: string, agentId?: string): Promise<AosKillSwitchEvent[]> {
    const conditions: SQL[] = [eq(aosKillSwitchEvents.companyId, companyId)];
    if (agentId) conditions.push(eq(aosKillSwitchEvents.agentId, agentId));
    return db.select().from(aosKillSwitchEvents)
      .where(and(...conditions))
      .orderBy(desc(aosKillSwitchEvents.createdAt));
  }

  async restoreKillSwitch(eventId: string, companyId: string, restoredBy: string): Promise<AosKillSwitchEvent | undefined> {
    const [event] = await db.update(aosKillSwitchEvents)
      .set({ restoredAt: new Date(), restoredBy })
      .where(and(eq(aosKillSwitchEvents.id, eventId), eq(aosKillSwitchEvents.companyId, companyId)))
      .returning();
    return event;
  }

  async getPiiRules(companyId: string): Promise<AosPiiRule[]> {
    return db.select().from(aosPiiRules)
      .where(eq(aosPiiRules.companyId, companyId))
      .orderBy(aosPiiRules.category);
  }

  async createPiiRule(data: InsertAosPiiRule): Promise<AosPiiRule> {
    const [rule] = await db.insert(aosPiiRules).values(data).returning();
    return rule;
  }

  async updatePiiRule(id: string, companyId: string, data: Partial<InsertAosPiiRule>): Promise<AosPiiRule | undefined> {
    const [rule] = await db.update(aosPiiRules)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(aosPiiRules.id, id), eq(aosPiiRules.companyId, companyId)))
      .returning();
    return rule;
  }

  async deletePiiRule(id: string, companyId: string): Promise<boolean> {
    const result = await db.delete(aosPiiRules)
      .where(and(eq(aosPiiRules.id, id), eq(aosPiiRules.companyId, companyId)))
      .returning();
    return result.length > 0;
  }

  async createPiiEvent(data: InsertAosPiiEvent): Promise<AosPiiEvent> {
    const [event] = await db.insert(aosPiiEvents).values(data).returning();
    return event;
  }

  async getPiiEvents(companyId: string, limit = 100): Promise<AosPiiEvent[]> {
    return db.select().from(aosPiiEvents)
      .where(eq(aosPiiEvents.companyId, companyId))
      .orderBy(desc(aosPiiEvents.createdAt))
      .limit(limit);
  }

  async createReasoningTrace(data: InsertAosReasoningTrace): Promise<AosReasoningTrace> {
    const [trace] = await db.insert(aosReasoningTraces).values(data).returning();
    return trace;
  }

  async getReasoningTraces(companyId: string, agentId?: string, limit = 20): Promise<AosReasoningTrace[]> {
    const conditions: SQL[] = [eq(aosReasoningTraces.companyId, companyId)];
    if (agentId) conditions.push(eq(aosReasoningTraces.agentId, agentId));
    return db.select().from(aosReasoningTraces)
      .where(and(...conditions))
      .orderBy(desc(aosReasoningTraces.createdAt))
      .limit(limit);
  }

  async getReasoningTrace(id: string, companyId: string): Promise<AosReasoningTrace | undefined> {
    const [trace] = await db.select().from(aosReasoningTraces)
      .where(and(eq(aosReasoningTraces.id, id), eq(aosReasoningTraces.companyId, companyId)));
    return trace;
  }

  async createReasoningStep(data: InsertAosReasoningStep): Promise<AosReasoningStep> {
    const [step] = await db.insert(aosReasoningSteps).values(data).returning();
    return step;
  }

  async getReasoningSteps(traceId: string): Promise<AosReasoningStep[]> {
    return db.select().from(aosReasoningSteps)
      .where(eq(aosReasoningSteps.traceId, traceId))
      .orderBy(asc(aosReasoningSteps.stepNumber));
  }

  async createDriftAlert(data: InsertAosDriftAlert): Promise<AosDriftAlert> {
    const [alert] = await db.insert(aosDriftAlerts).values(data).returning();
    return alert;
  }

  async getDriftAlerts(companyId: string, filters?: { status?: string; agentId?: string }): Promise<AosDriftAlert[]> {
    const conditions: SQL[] = [eq(aosDriftAlerts.companyId, companyId)];
    if (filters?.status) conditions.push(eq(aosDriftAlerts.status, filters.status));
    if (filters?.agentId) conditions.push(eq(aosDriftAlerts.agentId, filters.agentId));
    return db.select().from(aosDriftAlerts)
      .where(and(...conditions))
      .orderBy(desc(aosDriftAlerts.createdAt));
  }

  async acknowledgeDriftAlert(id: string, companyId: string, userId: string): Promise<AosDriftAlert | undefined> {
    const [alert] = await db.update(aosDriftAlerts)
      .set({ status: "acknowledged", acknowledgedBy: userId, acknowledgedAt: new Date() })
      .where(and(eq(aosDriftAlerts.id, id), eq(aosDriftAlerts.companyId, companyId)))
      .returning();
    return alert;
  }

  async dismissDriftAlert(id: string, companyId: string): Promise<AosDriftAlert | undefined> {
    const [alert] = await db.update(aosDriftAlerts)
      .set({ status: "dismissed" })
      .where(and(eq(aosDriftAlerts.id, id), eq(aosDriftAlerts.companyId, companyId)))
      .returning();
    return alert;
  }

  async createShadowAgent(data: InsertAosShadowAgent): Promise<AosShadowAgent> {
    const [agent] = await db.insert(aosShadowAgents).values(data).returning();
    return agent;
  }

  async getShadowAgents(companyId: string, status?: string): Promise<AosShadowAgent[]> {
    const conditions: SQL[] = [eq(aosShadowAgents.companyId, companyId)];
    if (status) conditions.push(eq(aosShadowAgents.status, status));
    return db.select().from(aosShadowAgents)
      .where(and(...conditions))
      .orderBy(desc(aosShadowAgents.lastSeenAt));
  }

  async updateShadowAgent(id: string, companyId: string, data: Partial<InsertAosShadowAgent>): Promise<AosShadowAgent | undefined> {
    const [agent] = await db.update(aosShadowAgents)
      .set(data)
      .where(and(eq(aosShadowAgents.id, id), eq(aosShadowAgents.companyId, companyId)))
      .returning();
    return agent;
  }

  async getShadowAgentByIdentifier(companyId: string, identifier: string): Promise<AosShadowAgent | undefined> {
    const [agent] = await db.select().from(aosShadowAgents)
      .where(and(eq(aosShadowAgents.companyId, companyId), eq(aosShadowAgents.identifier, identifier)));
    return agent;
  }

  async createNotification(data: InsertAosNotification): Promise<AosNotification> {
    const [notif] = await db.insert(aosNotifications).values(data).returning();
    return notif;
  }

  async getNotifications(companyId: string, userId?: string, unreadOnly = false): Promise<AosNotification[]> {
    const conditions: SQL[] = [eq(aosNotifications.companyId, companyId)];
    if (userId) conditions.push(or(eq(aosNotifications.userId, userId), sql`${aosNotifications.userId} IS NULL`)!);
    if (unreadOnly) conditions.push(eq(aosNotifications.isRead, false));
    return db.select().from(aosNotifications)
      .where(and(...conditions))
      .orderBy(desc(aosNotifications.createdAt))
      .limit(50);
  }

  async markNotificationRead(id: string, companyId: string): Promise<void> {
    await db.update(aosNotifications)
      .set({ isRead: true })
      .where(and(eq(aosNotifications.id, id), eq(aosNotifications.companyId, companyId)));
  }

  async markAllNotificationsRead(companyId: string, userId?: string): Promise<void> {
    const conditions: SQL[] = [eq(aosNotifications.companyId, companyId), eq(aosNotifications.isRead, false)];
    if (userId) conditions.push(or(eq(aosNotifications.userId, userId), sql`${aosNotifications.userId} IS NULL`)!);
    await db.update(aosNotifications)
      .set({ isRead: true })
      .where(and(...conditions));
  }

  async getCommandCenterStats(companyId: string): Promise<{
    totalAgents: number;
    monthlySpend: number;
    fteEquivalent: number;
    activeAlerts: number;
    byStatus: { status: string; count: number }[];
    byProvider: { provider: string; count: number }[];
    costTrend: { date: string; cost: number }[];
    topAgentsByCost: { agentId: string; name: string; provider: string; model: string; totalCost: number }[];
    recentAlerts: { id: string; type: string; severity: string; message: string; agentName: string; createdAt: Date }[];
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      [totalResult],
      byStatus,
      byProvider,
      [spendResult],
      [salaryResult],
      costTrendRaw,
      topAgentsRaw,
      driftAlerts,
      shadowAlerts,
      budgetAlerts,
      policyViolationAlerts,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(aosAgents).where(eq(aosAgents.companyId, companyId)),
      db.select({ status: aosAgents.status, count: sql<number>`count(*)` })
        .from(aosAgents)
        .where(eq(aosAgents.companyId, companyId))
        .groupBy(aosAgents.status),
      db.select({ provider: aosAgents.provider, count: sql<number>`count(*)` })
        .from(aosAgents)
        .where(eq(aosAgents.companyId, companyId))
        .groupBy(aosAgents.provider),
      db.select({
        total: sql<string>`coalesce(sum(${aosTelemetryEvents.costUsd}::numeric), 0)`,
      }).from(aosTelemetryEvents)
        .where(and(eq(aosTelemetryEvents.companyId, companyId), gte(aosTelemetryEvents.timestamp, thirtyDaysAgo))),
      db.select({
        total: sql<string>`coalesce(sum(${aosAgents.humanEquivalentSalary}::numeric), 0)`,
      }).from(aosAgents)
        .where(and(eq(aosAgents.companyId, companyId), eq(aosAgents.status, "active"))),
      db.select({
        date: sql<string>`date_trunc('day', ${aosTelemetryEvents.timestamp})::date`,
        cost: sql<string>`sum(${aosTelemetryEvents.costUsd}::numeric)`,
      }).from(aosTelemetryEvents)
        .where(and(eq(aosTelemetryEvents.companyId, companyId), gte(aosTelemetryEvents.timestamp, thirtyDaysAgo)))
        .groupBy(sql`date_trunc('day', ${aosTelemetryEvents.timestamp})::date`)
        .orderBy(asc(sql`date_trunc('day', ${aosTelemetryEvents.timestamp})::date`)),
      db.select({
        agentId: aosTelemetryEvents.agentId,
        name: aosAgents.name,
        provider: sql<string>`mode() within group (order by ${aosTelemetryEvents.provider})`,
        model: sql<string>`mode() within group (order by ${aosTelemetryEvents.model})`,
        totalCost: sql<string>`sum(${aosTelemetryEvents.costUsd}::numeric)`,
      }).from(aosTelemetryEvents)
        .innerJoin(aosAgents, eq(aosTelemetryEvents.agentId, aosAgents.id))
        .where(and(eq(aosTelemetryEvents.companyId, companyId), gte(aosTelemetryEvents.timestamp, thirtyDaysAgo)))
        .groupBy(aosTelemetryEvents.agentId, aosAgents.name)
        .orderBy(desc(sql`sum(${aosTelemetryEvents.costUsd}::numeric)`))
        .limit(5),
      db.select({
        id: aosDriftAlerts.id,
        severity: aosDriftAlerts.severity,
        metric: aosDriftAlerts.metric,
        status: aosDriftAlerts.status,
        agentId: aosDriftAlerts.agentId,
        createdAt: aosDriftAlerts.createdAt,
      }).from(aosDriftAlerts)
        .where(and(eq(aosDriftAlerts.companyId, companyId), or(eq(aosDriftAlerts.status, "open"), eq(aosDriftAlerts.status, "acknowledged"))!))
        .orderBy(desc(aosDriftAlerts.createdAt))
        .limit(5),
      db.select({
        id: aosShadowAgents.id,
        identifier: aosShadowAgents.identifier,
        provider: aosShadowAgents.provider,
        callCount: aosShadowAgents.callCount,
        createdAt: aosShadowAgents.createdAt,
      }).from(aosShadowAgents)
        .where(and(eq(aosShadowAgents.companyId, companyId), eq(aosShadowAgents.status, "unmanaged")))
        .orderBy(desc(aosShadowAgents.createdAt))
        .limit(3),
      db.select({
        id: aosBudgetAlerts.id,
        alertType: aosBudgetAlerts.alertType,
        currentSpend: aosBudgetAlerts.currentSpend,
        budgetCap: aosBudgetAlerts.budgetCap,
        createdAt: aosBudgetAlerts.createdAt,
      }).from(aosBudgetAlerts)
        .where(and(eq(aosBudgetAlerts.companyId, companyId), eq(aosBudgetAlerts.isRead, false)))
        .orderBy(desc(aosBudgetAlerts.createdAt))
        .limit(3),
      db.select({
        id: aosPolicyViolations.id,
        policyName: aosPolicyViolations.policyName,
        severity: aosPolicyViolations.severity,
        conditionField: aosPolicyViolations.conditionField,
        actualValue: aosPolicyViolations.actualValue,
        threshold: aosPolicyViolations.threshold,
        actionTaken: aosPolicyViolations.actionTaken,
        agentId: aosPolicyViolations.agentId,
        createdAt: aosPolicyViolations.createdAt,
      }).from(aosPolicyViolations)
        .where(and(eq(aosPolicyViolations.companyId, companyId), eq(aosPolicyViolations.status, "open")))
        .orderBy(desc(aosPolicyViolations.createdAt))
        .limit(5),
    ]);

    const monthlySpend = parseFloat(spendResult?.total || "0");

    const annualSalaryTotal = parseFloat(salaryResult?.total || "0");
    const monthlySalaryEquiv = annualSalaryTotal / 12;
    const fteEquivalent = monthlySalaryEquiv > 0 ? Math.round((monthlySalaryEquiv / monthlySpend) * 10) / 10 : 0;

    const agentNameMap: Record<string, string> = {};
    const agentIds = [...new Set([...driftAlerts.map(d => d.agentId), ...policyViolationAlerts.map(v => v.agentId)])];
    if (agentIds.length > 0) {
      const agents = await db.select({ id: aosAgents.id, name: aosAgents.name })
        .from(aosAgents).where(inArray(aosAgents.id, agentIds));
      for (const a of agents) agentNameMap[a.id] = a.name;
    }

    const recentAlerts: any[] = [
      ...driftAlerts.map(d => ({
        id: d.id,
        type: "drift",
        severity: d.severity,
        message: `${d.metric.replace(/_/g, " ")} drift detected`,
        agentName: agentNameMap[d.agentId] || "Unknown",
        createdAt: d.createdAt,
      })),
      ...shadowAlerts.map(s => ({
        id: s.id,
        type: "shadow",
        severity: "warning",
        message: `Unmanaged agent "${s.identifier}" detected (${s.callCount} calls)`,
        agentName: s.identifier,
        createdAt: s.createdAt,
      })),
      ...budgetAlerts.map(b => ({
        id: b.id,
        type: "budget",
        severity: "warning",
        message: `Budget alert: $${parseFloat(b.currentSpend).toFixed(0)} / $${parseFloat(b.budgetCap).toFixed(0)} (${b.alertType})`,
        agentName: "",
        createdAt: b.createdAt,
      })),
      ...policyViolationAlerts.map(v => ({
        id: v.id,
        type: "policy_violation",
        severity: v.severity,
        message: `Policy "${v.policyName}" violated: ${v.conditionField} = ${v.actualValue} (threshold: ${v.threshold})`,
        agentName: agentNameMap[v.agentId] || "Unknown",
        createdAt: v.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);

    const activeAlertCount = driftAlerts.filter(d => d.status === "open").length + shadowAlerts.length + budgetAlerts.length + policyViolationAlerts.length;

    return {
      totalAgents: Number(totalResult.count),
      monthlySpend,
      fteEquivalent: isFinite(fteEquivalent) ? fteEquivalent : 0,
      activeAlerts: activeAlertCount,
      byStatus: byStatus.map(s => ({ status: s.status, count: Number(s.count) })),
      byProvider: byProvider.map(p => ({ provider: p.provider, count: Number(p.count) })),
      costTrend: costTrendRaw.map(c => ({ date: String(c.date), cost: parseFloat(c.cost) })),
      topAgentsByCost: topAgentsRaw.map(a => ({
        agentId: a.agentId,
        name: a.name,
        provider: a.provider,
        model: a.model,
        totalCost: parseFloat(a.totalCost),
      })),
      recentAlerts,
    };
  }

  async getComplianceStats(companyId: string): Promise<{
    totalAgents: number;
    activeAgents: number;
    suspendedAgents: number;
    killSwitchActivations: number;
    piiEventsToday: number;
    openDriftAlerts: number;
    unmanagedAgents: number;
    recentAuditLogs: AosAuditLog[];
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      [totalResult],
      [activeResult],
      [suspendedResult],
      [killResult],
      [piiResult],
      [driftResult],
      [shadowResult],
      recentAuditLogs,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(aosAgents).where(eq(aosAgents.companyId, companyId)),
      db.select({ count: sql<number>`count(*)` })
        .from(aosAgents).where(and(eq(aosAgents.companyId, companyId), eq(aosAgents.status, "active"))),
      db.select({ count: sql<number>`count(*)` })
        .from(aosAgents).where(and(eq(aosAgents.companyId, companyId), eq(aosAgents.status, "suspended"))),
      db.select({ count: sql<number>`count(*)` })
        .from(aosKillSwitchEvents).where(eq(aosKillSwitchEvents.companyId, companyId)),
      db.select({ count: sql<number>`count(*)` })
        .from(aosPiiEvents).where(and(eq(aosPiiEvents.companyId, companyId), gt(aosPiiEvents.createdAt, today))),
      db.select({ count: sql<number>`count(*)` })
        .from(aosDriftAlerts).where(and(eq(aosDriftAlerts.companyId, companyId), eq(aosDriftAlerts.status, "open"))),
      db.select({ count: sql<number>`count(*)` })
        .from(aosShadowAgents).where(and(eq(aosShadowAgents.companyId, companyId), eq(aosShadowAgents.status, "unmanaged"))),
      db.select().from(aosAuditLogs)
        .where(eq(aosAuditLogs.companyId, companyId))
        .orderBy(desc(aosAuditLogs.createdAt))
        .limit(10),
    ]);

    return {
      totalAgents: Number(totalResult.count),
      activeAgents: Number(activeResult.count),
      suspendedAgents: Number(suspendedResult.count),
      killSwitchActivations: Number(killResult.count),
      piiEventsToday: Number(piiResult.count),
      openDriftAlerts: Number(driftResult.count),
      unmanagedAgents: Number(shadowResult.count),
      recentAuditLogs,
    };
  }
  private static DEFAULT_WEIGHTS: Record<string, { weight: number; label: string }> = {
    autonomy: { weight: 0.2, label: "Autonomy Level" },
    dataSensitivity: { weight: 0.15, label: "Data Sensitivity" },
    costExposure: { weight: 0.15, label: "Cost Exposure" },
    failureRate: { weight: 0.15, label: "Failure Rate" },
    piiExposure: { weight: 0.15, label: "PII Exposure" },
    driftAlerts: { weight: 0.1, label: "Open Drift Alerts" },
    environment: { weight: 0.1, label: "Environment Risk" },
  };

  async getRiskWeights(companyId: string): Promise<Record<string, { weight: number; label: string }>> {
    const rows = await db.select().from(aosRiskWeights)
      .where(and(eq(aosRiskWeights.companyId, companyId), eq(aosRiskWeights.isActive, true)));
    if (rows.length === 0) return { ...AgentOSStorage.DEFAULT_WEIGHTS };
    const weights: Record<string, { weight: number; label: string }> = {};
    for (const r of rows) {
      weights[r.factorKey] = { weight: r.weight, label: r.label };
    }
    return weights;
  }

  async updateRiskWeights(companyId: string, weights: { factorKey: string; label: string; weight: number }[]): Promise<void> {
    for (const w of weights) {
      const [existing] = await db.select().from(aosRiskWeights)
        .where(and(eq(aosRiskWeights.companyId, companyId), eq(aosRiskWeights.factorKey, w.factorKey)));
      if (existing) {
        await db.update(aosRiskWeights).set({ weight: w.weight, label: w.label, updatedAt: new Date() })
          .where(eq(aosRiskWeights.id, existing.id));
      } else {
        await db.insert(aosRiskWeights).values({ companyId, factorKey: w.factorKey, label: w.label, weight: w.weight });
      }
    }
  }

  async calculateRiskScore(agentId: string, companyId: string): Promise<{ score: number; factors: Record<string, { weight: number; value: number; contribution: number; label: string }> }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [agent] = await db.select().from(aosAgents).where(and(eq(aosAgents.id, agentId), eq(aosAgents.companyId, companyId)));
    if (!agent) throw new Error("Agent not found");

    const weights = await this.getRiskWeights(companyId);

    const [telemetryAgg] = await db.select({
      totalTasks: sql<number>`count(*)`,
      failedTasks: sql<number>`count(*) filter (where ${aosTelemetryEvents.taskOutcome} = 'failure')`,
      totalCost: sql<string>`coalesce(sum(${aosTelemetryEvents.costUsd}::numeric), 0)`,
      avgLatency: sql<number>`coalesce(avg(${aosTelemetryEvents.latencyMs}), 0)`,
    }).from(aosTelemetryEvents).where(and(
      eq(aosTelemetryEvents.agentId, agentId),
      gte(aosTelemetryEvents.timestamp, thirtyDaysAgo),
    ));

    const [piiCount] = await db.select({ count: sql<number>`count(*)` })
      .from(aosPiiEvents).where(and(
        eq(aosPiiEvents.agentId, agentId),
        gte(aosPiiEvents.createdAt, thirtyDaysAgo),
      ));

    const [driftCount] = await db.select({ count: sql<number>`count(*)` })
      .from(aosDriftAlerts).where(and(
        eq(aosDriftAlerts.agentId, agentId),
        eq(aosDriftAlerts.status, "open"),
      ));

    const totalTasks = Number(telemetryAgg?.totalTasks || 0);
    const failedTasks = Number(telemetryAgg?.failedTasks || 0);
    const totalCost = parseFloat(telemetryAgg?.totalCost || "0");
    const monthlyCap = agent.monthlyCap ? parseFloat(agent.monthlyCap) : 0;
    const piiEvents = Number(piiCount?.count || 0);
    const openDrifts = Number(driftCount?.count || 0);
    const failureRate = totalTasks > 0 ? (failedTasks / totalTasks) * 100 : 0;
    const budgetUtilization = monthlyCap > 0 ? (totalCost / monthlyCap) * 100 : 0;

    const config = (agent.config || {}) as Record<string, unknown>;
    const hasApiKey = !!agent.apiKeyEncrypted;
    const isProduction = config.environment === "production";
    const autonomyLevel = typeof config.autonomyLevel === "number" ? config.autonomyLevel : 50;
    const hasPiiAccess = piiEvents > 0 || (Array.isArray(agent.tags) && agent.tags.some(t => ["pii", "sensitive", "phi", "financial"].includes(t?.toLowerCase() || "")));

    const rawValues: Record<string, number> = {
      autonomy: Math.min(100, autonomyLevel),
      dataSensitivity: hasPiiAccess ? 80 : 20,
      costExposure: monthlyCap > 0 ? Math.min(100, budgetUtilization) : (totalCost > 100 ? 60 : 20),
      failureRate: Math.min(100, failureRate * 2),
      piiExposure: Math.min(100, piiEvents * 10),
      driftAlerts: Math.min(100, openDrifts * 25),
      environment: isProduction ? 80 : (hasApiKey ? 50 : 20),
    };

    const operationalValues: Record<string, number> = {
      monthly_cost: totalCost,
      failure_rate: failureRate,
      pii_exposure: piiEvents,
      drift_alerts: openDrifts,
      autonomy_level: autonomyLevel,
      budget_utilization: budgetUtilization,
    };

    const factors: Record<string, { weight: number; value: number; contribution: number; label: string; rawMetric?: number }> = {};
    let totalScore = 0;

    for (const [key, val] of Object.entries(rawValues)) {
      const w = weights[key] || AgentOSStorage.DEFAULT_WEIGHTS[key];
      if (!w) continue;
      const contribution = Math.round(w.weight * val);
      factors[key] = { weight: w.weight, value: val, contribution, label: w.label };
      totalScore += contribution;
    }

    const score = Math.max(0, Math.min(100, Math.round(totalScore)));

    await db.update(aosAgents).set({
      riskScore: score,
      riskFactors: { ...factors, operationalValues },
      updatedAt: new Date(),
    }).where(eq(aosAgents.id, agentId));

    return { score, factors };
  }

  async recalculateAllRiskScores(companyId: string): Promise<{ updated: number; agentIds: string[] }> {
    const agents = await db.select({ id: aosAgents.id }).from(aosAgents).where(eq(aosAgents.companyId, companyId));
    let updated = 0;
    const agentIds: string[] = [];
    for (const agent of agents) {
      try {
        await this.calculateRiskScore(agent.id, companyId);
        updated++;
        agentIds.push(agent.id);
      } catch {}
    }
    return { updated, agentIds };
  }

  async getFleetRiskDistribution(companyId: string): Promise<{ buckets: { range: string; count: number; agents: { id: string; name: string; score: number }[] }[]; avgScore: number; highRiskCount: number; unscoredCount: number }> {
    const agents = await db.select({
      id: aosAgents.id,
      name: aosAgents.name,
      riskScore: aosAgents.riskScore,
    }).from(aosAgents).where(eq(aosAgents.companyId, companyId));

    const ranges = [
      { range: "0-10", min: 0, max: 10 },
      { range: "11-20", min: 11, max: 20 },
      { range: "21-30", min: 21, max: 30 },
      { range: "31-40", min: 31, max: 40 },
      { range: "41-50", min: 41, max: 50 },
      { range: "51-60", min: 51, max: 60 },
      { range: "61-70", min: 61, max: 70 },
      { range: "71-80", min: 71, max: 80 },
      { range: "81-90", min: 81, max: 90 },
      { range: "91-100", min: 91, max: 100 },
    ];

    const scored = agents.filter(a => a.riskScore !== null);
    const unscored = agents.filter(a => a.riskScore === null);

    const buckets = ranges.map(r => {
      const matching = scored.filter(a => {
        const s = a.riskScore!;
        return s >= r.min && s <= r.max;
      });
      return {
        range: r.range,
        count: matching.length,
        agents: matching.map(a => ({ id: a.id, name: a.name, score: a.riskScore! })),
      };
    });

    const avgScore = scored.length > 0 ? Math.round(scored.reduce((sum, a) => sum + (a.riskScore ?? 0), 0) / scored.length) : 0;
    const highRiskCount = scored.filter(a => a.riskScore! > 70).length;

    return { buckets, avgScore, highRiskCount, unscoredCount: unscored.length };
  }

  async createPolicyRule(data: InsertAosPolicyRule): Promise<AosPolicyRule> {
    const [rule] = await db.insert(aosPolicyRules).values(data).returning();
    return rule;
  }

  async getEvidencePackData(companyId: string, days: number): Promise<{
    generatedAt: string;
    periodDays: number;
    periodStart: string;
    periodEnd: string;
    companyName: string;
    stats: { totalAgents: number; activeAgents: number; suspendedAgents: number; retiredAgents: number; onboardingAgents: number; killSwitchActivations: number; piiEventsInPeriod: number; openDriftAlerts: number; closedDriftAlerts: number; unmanagedAgents: number; totalPiiRules: number; activePolicyRules: number; policyViolationsInPeriod: number; };
    totals: { agents: number; policyRules: number; killSwitchEvents: number; piiRules: number; piiEvents: number; driftAlerts: number; auditLogs: number; shadowAgents: number; policyViolations: number; };
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
  }> {
    const CAPS = { agents: 500, policyRules: 200, killSwitchEvents: 200, piiRules: 200, piiEvents: 200, driftAlerts: 200, auditLogs: 500, shadowAgents: 100, policyViolations: 200 };
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);

    const company = await this.getCompany(companyId);

    const [
      agents,
      policyRules,
      killEvents,
      piiRules,
      driftAlerts,
      shadowAgents,
      auditLogs,
      piiEvents,
    ] = await Promise.all([
      db.select().from(aosAgents).where(eq(aosAgents.companyId, companyId)).orderBy(aosAgents.name).limit(CAPS.agents),
      db.select().from(aosPolicyRules).where(eq(aosPolicyRules.companyId, companyId)).orderBy(aosPolicyRules.name).limit(CAPS.policyRules),
      db.select().from(aosKillSwitchEvents).where(and(eq(aosKillSwitchEvents.companyId, companyId), gte(aosKillSwitchEvents.createdAt, periodStart))).orderBy(desc(aosKillSwitchEvents.createdAt)).limit(CAPS.killSwitchEvents),
      db.select().from(aosPiiRules).where(eq(aosPiiRules.companyId, companyId)).orderBy(aosPiiRules.category).limit(CAPS.piiRules),
      db.select().from(aosDriftAlerts).where(and(eq(aosDriftAlerts.companyId, companyId), gte(aosDriftAlerts.createdAt, periodStart))).orderBy(desc(aosDriftAlerts.createdAt)).limit(CAPS.driftAlerts),
      db.select().from(aosShadowAgents).where(eq(aosShadowAgents.companyId, companyId)).orderBy(desc(aosShadowAgents.lastSeenAt)).limit(CAPS.shadowAgents),
      db.select().from(aosAuditLogs).where(and(eq(aosAuditLogs.companyId, companyId), gte(aosAuditLogs.createdAt, periodStart))).orderBy(desc(aosAuditLogs.createdAt)).limit(CAPS.auditLogs),
      db.select().from(aosPiiEvents).where(and(eq(aosPiiEvents.companyId, companyId), gte(aosPiiEvents.createdAt, periodStart))).orderBy(desc(aosPiiEvents.createdAt)).limit(CAPS.piiEvents),
    ]);

    const [totalAgentsRow, totalPiiEventsRow, totalDriftRow, totalAuditRow, totalShadowRow] = await Promise.all([
      db.select({ count: sql<string>`count(*)` }).from(aosAgents).where(eq(aosAgents.companyId, companyId)),
      db.select({ count: sql<string>`count(*)` }).from(aosPiiEvents).where(and(eq(aosPiiEvents.companyId, companyId), gte(aosPiiEvents.createdAt, periodStart))),
      db.select({ count: sql<string>`count(*)` }).from(aosDriftAlerts).where(and(eq(aosDriftAlerts.companyId, companyId), gte(aosDriftAlerts.createdAt, periodStart))),
      db.select({ count: sql<string>`count(*)` }).from(aosAuditLogs).where(and(eq(aosAuditLogs.companyId, companyId), gte(aosAuditLogs.createdAt, periodStart))),
      db.select({ count: sql<string>`count(*)` }).from(aosShadowAgents).where(eq(aosShadowAgents.companyId, companyId)),
    ]);

    const certConfig = await this.getCertificationConfig(companyId);

    const allKillEvents = await db.select().from(aosKillSwitchEvents).where(eq(aosKillSwitchEvents.companyId, companyId));
    const killSwitchUnrestoredCount = allKillEvents.filter(e => !e.restoredAt).length;

    const policyViolations = await db.select({
      id: aosPolicyViolations.id,
      agentId: aosPolicyViolations.agentId,
      policyId: aosPolicyViolations.policyId,
      severity: aosPolicyViolations.severity,
      conditionField: aosPolicyViolations.conditionField,
      actualValue: aosPolicyViolations.actualValue,
      threshold: aosPolicyViolations.threshold,
      actionTaken: aosPolicyViolations.actionTaken,
      status: aosPolicyViolations.status,
      createdAt: aosPolicyViolations.createdAt,
      agentName: aosAgents.name,
      policyName: aosPolicyRules.name,
    }).from(aosPolicyViolations)
      .leftJoin(aosAgents, eq(aosPolicyViolations.agentId, aosAgents.id))
      .leftJoin(aosPolicyRules, eq(aosPolicyViolations.policyId, aosPolicyRules.id))
      .where(and(eq(aosPolicyViolations.companyId, companyId), gte(aosPolicyViolations.createdAt, periodStart)))
      .orderBy(desc(aosPolicyViolations.createdAt))
      .limit(CAPS.policyViolations);

    const [totalPolicyViolationsRow] = await db.select({ count: sql<string>`count(*)` }).from(aosPolicyViolations).where(and(eq(aosPolicyViolations.companyId, companyId), gte(aosPolicyViolations.createdAt, periodStart)));
    const [totalKillEventsRow] = await db.select({ count: sql<string>`count(*)` }).from(aosKillSwitchEvents).where(and(eq(aosKillSwitchEvents.companyId, companyId), gte(aosKillSwitchEvents.createdAt, periodStart)));
    const [totalPolicyRulesRow] = await db.select({ count: sql<string>`count(*)` }).from(aosPolicyRules).where(eq(aosPolicyRules.companyId, companyId));
    const [totalPiiRulesRow] = await db.select({ count: sql<string>`count(*)` }).from(aosPiiRules).where(eq(aosPiiRules.companyId, companyId));

    const departments = await db.select().from(aosDepartments).where(eq(aosDepartments.companyId, companyId));
    const deptMap = new Map(departments.map(d => [d.id, d.name]));
    const agentMap = new Map(agents.map(a => [a.id, a.name]));

    const statusCounts = { active: 0, suspended: 0, retired: 0, onboarding: 0 };
    for (const a of agents) {
      if (a.status in statusCounts) statusCounts[a.status as keyof typeof statusCounts]++;
    }

    const totals = {
      agents: parseInt(String(totalAgentsRow[0]?.count ?? agents.length), 10),
      policyRules: parseInt(String(totalPolicyRulesRow?.count ?? policyRules.length), 10),
      killSwitchEvents: parseInt(String(totalKillEventsRow?.count ?? killEvents.length), 10),
      piiRules: parseInt(String(totalPiiRulesRow?.count ?? piiRules.length), 10),
      piiEvents: parseInt(String(totalPiiEventsRow[0]?.count ?? piiEvents.length), 10),
      driftAlerts: parseInt(String(totalDriftRow[0]?.count ?? driftAlerts.length), 10),
      auditLogs: parseInt(String(totalAuditRow[0]?.count ?? auditLogs.length), 10),
      shadowAgents: parseInt(String(totalShadowRow[0]?.count ?? shadowAgents.length), 10),
      policyViolations: parseInt(String(totalPolicyViolationsRow?.count ?? policyViolations.length), 10),
    };

    return {
      generatedAt: periodEnd.toISOString(),
      periodDays: days,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      companyName: company?.name || "Unknown",
      totals,
      stats: {
        totalAgents: totals.agents,
        activeAgents: statusCounts.active,
        suspendedAgents: statusCounts.suspended,
        retiredAgents: statusCounts.retired,
        onboardingAgents: statusCounts.onboarding,
        killSwitchActivations: totals.killSwitchEvents,
        piiEventsInPeriod: totals.piiEvents,
        openDriftAlerts: driftAlerts.filter(d => d.status === "open").length,
        closedDriftAlerts: driftAlerts.filter(d => d.status !== "open").length,
        unmanagedAgents: shadowAgents.filter(s => s.status === "unmanaged").length,
        totalPiiRules: totals.piiRules,
        activePolicyRules: policyRules.filter(p => p.isActive).length,
        policyViolationsInPeriod: totals.policyViolations,
      },
      agents: agents.map(a => ({
        name: a.name, uid: a.uid, provider: a.provider, model: a.llmModel, status: a.status,
        role: a.role, department: a.departmentId ? deptMap.get(a.departmentId) || null : null,
        version: a.version, riskScore: a.riskScore, deploymentDate: a.deploymentDate?.toISOString() || null,
        certifiedAt: a.certifiedAt?.toISOString() || null, createdAt: a.createdAt.toISOString(),
      })),
      policyRules: policyRules.map(p => ({
        name: p.name, description: p.description, conditionField: p.conditionField,
        operator: p.operator, threshold: p.threshold, actionType: p.actionType,
        severity: p.severity, isActive: p.isActive,
      })),
      killSwitchEvents: killEvents.map(e => ({
        agentName: agentMap.get(e.agentId) || e.agentId,
        reason: e.reason, triggeredAt: e.createdAt.toISOString(),
        restoredAt: e.restoredAt?.toISOString() || null,
      })),
      piiRules: piiRules.map(r => ({
        name: r.name, category: r.category, pattern: r.pattern, action: r.action, isActive: r.isActive,
      })),
      piiEvents: piiEvents.map(e => ({
        agentName: e.agentId ? agentMap.get(e.agentId) || e.agentId : null,
        category: e.category, direction: e.direction, action: e.action, createdAt: e.createdAt.toISOString(),
      })),
      driftAlerts: driftAlerts.map(a => ({
        agentName: agentMap.get(a.agentId) || a.agentId,
        metric: a.metric, baseline: a.baselineValue, current: a.currentValue,
        threshold: a.threshold, severity: a.severity, status: a.status, createdAt: a.createdAt.toISOString(),
      })),
      auditLogs: auditLogs.map(l => ({
        action: l.action, entityType: l.entityType, entityId: l.entityId,
        userId: l.userId, createdAt: l.createdAt.toISOString(),
      })),
      shadowAgents: shadowAgents.map(s => ({
        identifier: s.identifier, provider: s.provider, model: s.llmModel,
        department: s.department, callCount: s.callCount, status: s.status,
        firstSeen: s.firstSeenAt.toISOString(), lastSeen: s.lastSeenAt.toISOString(),
      })),
      policyViolations: policyViolations.map(v => ({
        agentName: v.agentName || v.agentId || "Unknown",
        policyName: v.policyName || v.policyId || "Unknown",
        severity: v.severity, conditionField: v.conditionField, actualValue: v.actualValue,
        threshold: v.threshold, actionTaken: v.actionTaken, status: v.status,
        createdAt: v.createdAt.toISOString(),
      })),
      governanceConfig: {
        certMinSuccessRate: certConfig?.minSuccessRate ?? 90,
        certMaxLatencyMs: certConfig?.maxAvgLatencyMs ?? 5000,
        certMinAccuracy: certConfig?.minAccuracyScore ?? 85,
        certMinRating: certConfig?.minHumanRating ?? 3.5,
        certProbationDays: certConfig?.probationDays ?? 30,
        certMinTasks: certConfig?.minTaskCount ?? 50,
        killSwitchEnabled: true,
        killSwitchTotalEvents: allKillEvents.length,
        killSwitchUnrestoredCount,
        activePiiRuleCount: piiRules.filter(r => r.isActive).length,
        activePolicyRuleCount: policyRules.filter(r => r.isActive).length,
      },
    };
  }

  async getPolicyRules(companyId: string): Promise<AosPolicyRule[]> {
    return db.select().from(aosPolicyRules)
      .where(eq(aosPolicyRules.companyId, companyId))
      .orderBy(desc(aosPolicyRules.createdAt));
  }

  async getPolicyRule(id: string, companyId: string): Promise<AosPolicyRule | undefined> {
    const [rule] = await db.select().from(aosPolicyRules)
      .where(and(eq(aosPolicyRules.id, id), eq(aosPolicyRules.companyId, companyId)));
    return rule;
  }

  async updatePolicyRule(id: string, companyId: string, data: Partial<InsertAosPolicyRule>): Promise<AosPolicyRule | undefined> {
    const [rule] = await db.update(aosPolicyRules)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(aosPolicyRules.id, id), eq(aosPolicyRules.companyId, companyId)))
      .returning();
    return rule;
  }

  async deletePolicyRule(id: string, companyId: string): Promise<boolean> {
    await db.delete(aosPolicyViolations)
      .where(and(eq(aosPolicyViolations.policyId, id), eq(aosPolicyViolations.companyId, companyId)));
    const result = await db.delete(aosPolicyRules)
      .where(and(eq(aosPolicyRules.id, id), eq(aosPolicyRules.companyId, companyId)))
      .returning();
    return result.length > 0;
  }

  async evaluatePoliciesForAgent(agentId: string, companyId: string): Promise<AosPolicyViolation[]> {
    const [agent] = await db.select().from(aosAgents).where(and(eq(aosAgents.id, agentId), eq(aosAgents.companyId, companyId)));
    if (!agent) return [];

    const policies = await db.select().from(aosPolicyRules)
      .where(and(eq(aosPolicyRules.companyId, companyId), eq(aosPolicyRules.isActive, true)));

    const violations: AosPolicyViolation[] = [];

    for (const policy of policies) {
      const actualValue = this.getAgentFieldValue(agent, policy.conditionField);
      const matches = this.evaluateCondition(actualValue, policy.operator, policy.threshold);

      let secondaryMatches = true;
      if (policy.secondaryField && policy.secondaryOperator && policy.secondaryThreshold) {
        const secondaryValue = this.getAgentFieldValue(agent, policy.secondaryField);
        secondaryMatches = this.evaluateCondition(secondaryValue, policy.secondaryOperator, policy.secondaryThreshold);
      }

      if (matches && secondaryMatches) {
        const [existing] = await db.select().from(aosPolicyViolations)
          .where(and(
            eq(aosPolicyViolations.policyId, policy.id),
            eq(aosPolicyViolations.agentId, agentId),
            eq(aosPolicyViolations.status, "open"),
          ));

        if (!existing) {
          const [violation] = await db.insert(aosPolicyViolations).values({
            companyId,
            policyId: policy.id,
            agentId,
            policyName: policy.name,
            conditionField: policy.conditionField,
            actualValue: String(actualValue),
            threshold: policy.threshold,
            actionTaken: policy.actionType,
            severity: policy.severity,
          }).returning();

          if (policy.actionType === "suspend") {
            await db.update(aosAgents).set({ status: "suspended", updatedAt: new Date() }).where(eq(aosAgents.id, agentId));
          }

          await db.insert(aosNotifications).values({
            companyId,
            type: "policy_violation",
            title: `Policy Violation: ${policy.name}`,
            message: `Agent "${agent.name}" violated policy "${policy.name}" — ${policy.conditionField} is ${actualValue} (threshold: ${policy.operator} ${policy.threshold})`,
            entityType: "agent",
            entityId: agentId,
          });

          violations.push(violation);
        }
      }
    }

    return violations;
  }

  private getAgentFieldValue(agent: AosAgent, field: string): number | string {
    const riskFactors = (agent.riskFactors || {}) as Record<string, unknown>;
    const opVals = (riskFactors.operationalValues || {}) as Record<string, number>;
    switch (field) {
      case "risk_score": return agent.riskScore ?? 0;
      case "status": return agent.status;
      case "provider": return agent.provider;
      case "environment": {
        const cfg = (agent.config || {}) as Record<string, unknown>;
        return (cfg.environment as string) || "development";
      }
      case "monthly_cost": return opVals.monthly_cost ?? 0;
      case "autonomy_level": return opVals.autonomy_level ?? 50;
      case "failure_rate": return opVals.failure_rate ?? 0;
      case "pii_exposure": return opVals.pii_exposure ?? 0;
      case "drift_alerts": return opVals.drift_alerts ?? 0;
      case "budget_utilization": return opVals.budget_utilization ?? 0;
      default: return 0;
    }
  }

  private evaluateCondition(actual: number | string, operator: string, threshold: string): boolean {
    const numActual = typeof actual === "number" ? actual : parseFloat(actual) || 0;
    const numThreshold = parseFloat(threshold);
    switch (operator) {
      case ">": return numActual > numThreshold;
      case ">=": return numActual >= numThreshold;
      case "<": return numActual < numThreshold;
      case "<=": return numActual <= numThreshold;
      case "==": return String(actual) === threshold;
      case "!=": return String(actual) !== threshold;
      default: return false;
    }
  }

  async getPolicyViolations(companyId: string, status?: string): Promise<(AosPolicyViolation & { agentName?: string })[]> {
    const conditions = [eq(aosPolicyViolations.companyId, companyId)];
    if (status) conditions.push(eq(aosPolicyViolations.status, status));

    const violations = await db.select().from(aosPolicyViolations)
      .where(and(...conditions))
      .orderBy(desc(aosPolicyViolations.createdAt))
      .limit(100);

    const agentIds = [...new Set(violations.map(v => v.agentId))];
    const agents = agentIds.length > 0
      ? await db.select({ id: aosAgents.id, name: aosAgents.name }).from(aosAgents).where(inArray(aosAgents.id, agentIds))
      : [];
    const agentMap = new Map(agents.map(a => [a.id, a.name]));

    return violations.map(v => ({ ...v, agentName: agentMap.get(v.agentId) || "Unknown" }));
  }

  async resolvePolicyViolation(id: string, companyId: string, userId: string): Promise<AosPolicyViolation | undefined> {
    const [violation] = await db.update(aosPolicyViolations)
      .set({ status: "resolved", resolvedAt: new Date(), resolvedBy: userId })
      .where(and(eq(aosPolicyViolations.id, id), eq(aosPolicyViolations.companyId, companyId)))
      .returning();
    return violation;
  }

  async getWorkforceReportData(companyId: string, days: number = 30, granularity: "daily" | "weekly" | "monthly" = "daily"): Promise<{
    dailyTrend: { date: string; totalCost: string; totalTokens: number; eventCount: number; successCount: number; failureCount: number; avgLatency: number }[];
    providerBreakdown: { provider: string | null; model: string | null; totalCost: string; eventCount: number; successCount: number; avgLatency: number; totalTokens: number }[];
    departmentBreakdown: { departmentId: string | null; departmentName: string | null; totalCost: string; eventCount: number; successCount: number; agentCount: number; totalTokens: number }[];
    agentBudgets: { agentId: string; agentName: string; departmentId: string | null; monthlyCap: string | null; totalSpent: string; eventCount: number }[];
  }> {
    const from = new Date();
    from.setDate(from.getDate() - days);

    const truncFn = granularity === "monthly" ? "month" : granularity === "weekly" ? "week" : "day";
    const dateTrunc = sql`date_trunc(${sql.raw(`'${truncFn}'`)}, ${aosTelemetryEvents.timestamp})::date`;

    const [dailyTrend, providerBreakdown, departmentBreakdown] = await Promise.all([
      db.select({
        date: sql<string>`${dateTrunc}`,
        totalCost: sql<string>`sum(${aosTelemetryEvents.costUsd}::numeric)`,
        totalTokens: sql<number>`sum(${aosTelemetryEvents.totalTokens})`,
        eventCount: sql<number>`count(*)`,
        successCount: sql<number>`sum(case when ${aosTelemetryEvents.taskOutcome} = 'success' then 1 else 0 end)`,
        failureCount: sql<number>`sum(case when ${aosTelemetryEvents.taskOutcome} = 'failure' then 1 else 0 end)`,
        avgLatency: sql<number>`avg(${aosTelemetryEvents.latencyMs})`,
      })
        .from(aosTelemetryEvents)
        .where(and(eq(aosTelemetryEvents.companyId, companyId), gte(aosTelemetryEvents.timestamp, from)))
        .groupBy(dateTrunc)
        .orderBy(asc(dateTrunc)),

      db.select({
        provider: aosTelemetryEvents.provider,
        model: aosTelemetryEvents.model,
        totalCost: sql<string>`sum(${aosTelemetryEvents.costUsd}::numeric)`,
        eventCount: sql<number>`count(*)`,
        successCount: sql<number>`sum(case when ${aosTelemetryEvents.taskOutcome} = 'success' then 1 else 0 end)`,
        avgLatency: sql<number>`avg(${aosTelemetryEvents.latencyMs})`,
        totalTokens: sql<number>`sum(${aosTelemetryEvents.totalTokens})`,
      })
        .from(aosTelemetryEvents)
        .where(and(eq(aosTelemetryEvents.companyId, companyId), gte(aosTelemetryEvents.timestamp, from)))
        .groupBy(aosTelemetryEvents.provider, aosTelemetryEvents.model),

      db.select({
        departmentId: aosAgents.departmentId,
        departmentName: aosDepartments.name,
        totalCost: sql<string>`sum(${aosTelemetryEvents.costUsd}::numeric)`,
        eventCount: sql<number>`count(*)`,
        successCount: sql<number>`sum(case when ${aosTelemetryEvents.taskOutcome} = 'success' then 1 else 0 end)`,
        agentCount: sql<number>`count(distinct ${aosTelemetryEvents.agentId})`,
        totalTokens: sql<number>`sum(${aosTelemetryEvents.totalTokens})`,
      })
        .from(aosTelemetryEvents)
        .innerJoin(aosAgents, and(eq(aosTelemetryEvents.agentId, aosAgents.id), eq(aosAgents.companyId, companyId)))
        .leftJoin(aosDepartments, and(eq(aosAgents.departmentId, aosDepartments.id), eq(aosDepartments.companyId, companyId)))
        .where(and(eq(aosTelemetryEvents.companyId, companyId), gte(aosTelemetryEvents.timestamp, from)))
        .groupBy(aosAgents.departmentId, aosDepartments.name),
    ]);

    const agentBudgets = await db.select({
      agentId: aosAgents.id,
      agentName: aosAgents.name,
      departmentId: aosAgents.departmentId,
      monthlyCap: aosAgents.monthlyCap,
      totalSpent: sql<string>`coalesce(sum(${aosTelemetryEvents.costUsd}::numeric), 0)`,
      eventCount: sql<number>`coalesce(count(${aosTelemetryEvents.id}), 0)`,
    })
      .from(aosAgents)
      .leftJoin(aosTelemetryEvents, and(
        eq(aosTelemetryEvents.agentId, aosAgents.id),
        eq(aosTelemetryEvents.companyId, companyId),
        gte(aosTelemetryEvents.timestamp, sql`date_trunc('month', now())`),
      ))
      .where(and(eq(aosAgents.companyId, companyId), sql`${aosAgents.monthlyCap} is not null`))
      .groupBy(aosAgents.id, aosAgents.name, aosAgents.departmentId, aosAgents.monthlyCap);

    return { dailyTrend, providerBreakdown, departmentBreakdown, agentBudgets };
  }

  async getPeopleOSWorkforceStats(posCompanyId: string): Promise<{
    totalHeadcount: number;
    totalMonthlySalary: number;
    departmentStats: { department: string; headcount: number; totalSalary: number }[];
  }> {
    try {
      const deptStats = await db.select({
        departmentName: posDepartments.name,
        headcount: sql<number>`count(*)`,
        totalSalary: sql<string>`coalesce(sum(${posEmployees.salary}::numeric), 0)`,
      })
        .from(posEmployees)
        .leftJoin(posDepartments, eq(posEmployees.departmentId, posDepartments.id))
        .where(and(eq(posEmployees.companyId, posCompanyId), eq(posEmployees.status, "active")))
        .groupBy(posDepartments.name);

      const totalHeadcount = deptStats.reduce((s, d) => s + parseInt(String(d.headcount || 0), 10), 0);
      const totalMonthlySalary = deptStats.reduce((s, d) => s + parseFloat(d.totalSalary || "0"), 0);
      const departmentStats = deptStats.map(d => ({
        department: d.departmentName || "Unassigned",
        headcount: parseInt(String(d.headcount || 0), 10),
        totalSalary: parseFloat(d.totalSalary || "0"),
      }));
      return { totalHeadcount, totalMonthlySalary, departmentStats };
    } catch {
      return { totalHeadcount: 0, totalMonthlySalary: 0, departmentStats: [] };
    }
  }

  async getAgentsMatchingPolicy(companyId: string, conditionField: string, operator: string, threshold: string, secondaryField?: string, secondaryOperator?: string, secondaryThreshold?: string): Promise<{ id: string; name: string; riskScore: number | null; matchValue: string }[]> {
    const agents = await db.select().from(aosAgents).where(eq(aosAgents.companyId, companyId));
    return agents.filter(a => {
      const val = this.getAgentFieldValue(a, conditionField);
      const primary = this.evaluateCondition(val, operator, threshold);
      if (!primary) return false;
      if (secondaryField && secondaryOperator && secondaryThreshold) {
        const secVal = this.getAgentFieldValue(a, secondaryField);
        return this.evaluateCondition(secVal, secondaryOperator, secondaryThreshold);
      }
      return true;
    }).map(a => ({
      id: a.id,
      name: a.name,
      riskScore: a.riskScore,
      matchValue: String(this.getAgentFieldValue(a, conditionField)),
    }));
  }

  async getAgentTelemetryStatus(agentId: string): Promise<{
    hasReceivedTelemetry: boolean;
    totalEvents: number;
    lastEventAt: Date | null;
    last24hEvents: number;
    last24hSuccessRate: number | null;
    avgLatencyMs: number | null;
  }> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalResult] = await db.select({
      count: sql<number>`count(*)`,
      lastEventAt: sql<Date | null>`max(${aosTelemetryEvents.timestamp})`,
    }).from(aosTelemetryEvents).where(eq(aosTelemetryEvents.agentId, agentId));

    const [recentResult] = await db.select({
      count: sql<number>`count(*)`,
      successCount: sql<number>`sum(case when ${aosTelemetryEvents.taskOutcome} = 'success' then 1 else 0 end)`,
      avgLatency: sql<number | null>`avg(${aosTelemetryEvents.latencyMs})`,
    }).from(aosTelemetryEvents).where(
      and(eq(aosTelemetryEvents.agentId, agentId), gte(aosTelemetryEvents.timestamp, dayAgo))
    );

    const totalEvents = Number(totalResult?.count || 0);
    const last24hEvents = Number(recentResult?.count || 0);
    const successCount = Number(recentResult?.successCount || 0);

    return {
      hasReceivedTelemetry: totalEvents > 0,
      totalEvents,
      lastEventAt: totalResult?.lastEventAt || null,
      last24hEvents,
      last24hSuccessRate: last24hEvents > 0 ? Math.round((successCount / last24hEvents) * 100) : null,
      avgLatencyMs: recentResult?.avgLatency ? Math.round(Number(recentResult.avgLatency)) : null,
    };
  }
}

export const agentOSStorage = new AgentOSStorage();
