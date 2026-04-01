import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, boolean, uuid, index, real, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const aosCompanies = pgTable("aos_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  industry: text("industry"),
  country: text("country"),
  website: text("website"),
  logoUrl: text("logo_url"),
  size: text("size"),
  currency: text("currency").default("USD"),
  settings: jsonb("settings"),
  posCompanyId: varchar("pos_company_id"),
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  nameIdx: index("idx_aos_companies_name").on(table.name),
}));

export const insertAosCompanySchema = createInsertSchema(aosCompanies).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAosCompany = z.infer<typeof insertAosCompanySchema>;
export type AosCompany = typeof aosCompanies.$inferSelect;

export const aosUsers = pgTable("aos_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("viewer"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("idx_aos_users_company").on(table.companyId),
  emailIdx: index("idx_aos_users_email").on(table.email),
}));

export const insertAosUserSchema = createInsertSchema(aosUsers).omit({ id: true, createdAt: true });
export type InsertAosUser = z.infer<typeof insertAosUserSchema>;
export type AosUser = typeof aosUsers.$inferSelect;

export const aosSessions = pgTable("aos_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => aosUsers.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tokenIdx: index("idx_aos_sessions_token").on(table.token),
  userIdx: index("idx_aos_sessions_user").on(table.userId),
}));

export type AosSession = typeof aosSessions.$inferSelect;

export const aosDepartments = pgTable("aos_departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"),
  budgetCap: numeric("budget_cap"),
  budgetPeriod: text("budget_period").default("monthly"),
  alertThreshold: real("alert_threshold").default(80),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("idx_aos_departments_company").on(table.companyId),
}));

export const insertAosDepartmentSchema = createInsertSchema(aosDepartments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAosDepartment = z.infer<typeof insertAosDepartmentSchema>;
export type AosDepartment = typeof aosDepartments.$inferSelect;

export const aosAgents = pgTable("aos_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  uid: text("uid").notNull().unique(),
  name: text("name").notNull(),
  role: text("role"),
  description: text("description"),
  departmentId: varchar("department_id").references(() => aosDepartments.id),
  provider: text("provider").notNull(),
  llmModel: text("llm_model").notNull(),
  status: text("status").notNull().default("onboarding"),
  ownerId: varchar("owner_id").references(() => aosUsers.id),
  deploymentDate: timestamp("deployment_date"),
  skills: text("skills").array(),
  tools: text("tools").array(),
  avatarUrl: text("avatar_url"),
  config: jsonb("config"),
  version: integer("version").default(1),
  certifiedAt: timestamp("certified_at"),
  probationStartDate: timestamp("probation_start_date").defaultNow(),
  probationDays: integer("probation_days").default(30),
  humanEquivalentRole: text("human_equivalent_role"),
  humanEquivalentSalary: numeric("human_equivalent_salary"),
  costPerToken: numeric("cost_per_token"),
  monthlyCap: numeric("monthly_cap"),
  apiKeyEncrypted: text("api_key_encrypted"),
  apiKeyPrefix: text("api_key_prefix"),
  riskScore: integer("risk_score"),
  riskFactors: jsonb("risk_factors"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("idx_aos_agents_company").on(table.companyId),
  statusIdx: index("idx_aos_agents_status").on(table.status),
  providerIdx: index("idx_aos_agents_provider").on(table.provider),
  ownerIdx: index("idx_aos_agents_owner").on(table.ownerId),
  departmentIdx: index("idx_aos_agents_department").on(table.departmentId),
  uidIdx: index("idx_aos_agents_uid").on(table.uid),
}));

export const insertAosAgentSchema = createInsertSchema(aosAgents).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAosAgent = z.infer<typeof insertAosAgentSchema>;
export type AosAgent = typeof aosAgents.$inferSelect;

export const aosAgentVersions = pgTable("aos_agent_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => aosAgents.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  changes: text("changes"),
  snapshot: jsonb("snapshot"),
  changedBy: varchar("changed_by").references(() => aosUsers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  agentIdx: index("idx_aos_agent_versions_agent").on(table.agentId),
  versionIdx: index("idx_aos_agent_versions_version").on(table.version),
}));

export const insertAosAgentVersionSchema = createInsertSchema(aosAgentVersions).omit({ id: true, createdAt: true });
export type InsertAosAgentVersion = z.infer<typeof insertAosAgentVersionSchema>;
export type AosAgentVersion = typeof aosAgentVersions.$inferSelect;

export const aosAuditLogs = pgTable("aos_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  userId: varchar("user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("idx_aos_audit_logs_company").on(table.companyId),
  actionIdx: index("idx_aos_audit_logs_action").on(table.action),
  entityIdx: index("idx_aos_audit_logs_entity").on(table.entityType, table.entityId),
  createdAtIdx: index("idx_aos_audit_logs_created_at").on(table.createdAt),
}));

export const insertAosAuditLogSchema = createInsertSchema(aosAuditLogs).omit({ id: true, createdAt: true });
export type InsertAosAuditLog = z.infer<typeof insertAosAuditLogSchema>;
export type AosAuditLog = typeof aosAuditLogs.$inferSelect;

export const aosTelemetryEvents = pgTable("aos_telemetry_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  agentId: varchar("agent_id").notNull().references(() => aosAgents.id),
  eventType: text("event_type").notNull().default("task"),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  totalTokens: integer("total_tokens").default(0),
  costUsd: numeric("cost_usd").default("0"),
  latencyMs: integer("latency_ms"),
  taskOutcome: text("task_outcome"),
  accuracyScore: real("accuracy_score"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("idx_aos_telemetry_company").on(table.companyId),
  agentIdx: index("idx_aos_telemetry_agent").on(table.agentId),
  tsIdx: index("idx_aos_telemetry_ts").on(table.timestamp),
  providerIdx: index("idx_aos_telemetry_provider").on(table.provider),
  agentTsIdx: index("idx_aos_telemetry_agent_ts").on(table.agentId, table.timestamp),
  companyTsIdx: index("idx_aos_telemetry_company_ts").on(table.companyId, table.timestamp),
}));

export const insertAosTelemetryEventSchema = createInsertSchema(aosTelemetryEvents).omit({ id: true });
export type InsertAosTelemetryEvent = z.infer<typeof insertAosTelemetryEventSchema>;
export type AosTelemetryEvent = typeof aosTelemetryEvents.$inferSelect;

export const aosPerformanceRatings = pgTable("aos_performance_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  agentId: varchar("agent_id").notNull().references(() => aosAgents.id),
  ratedBy: varchar("rated_by").references(() => aosUsers.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("idx_aos_perf_ratings_company").on(table.companyId),
  agentIdx: index("idx_aos_perf_ratings_agent").on(table.agentId),
}));

export const insertAosPerformanceRatingSchema = createInsertSchema(aosPerformanceRatings).omit({ id: true, createdAt: true });
export type InsertAosPerformanceRating = z.infer<typeof insertAosPerformanceRatingSchema>;
export type AosPerformanceRating = typeof aosPerformanceRatings.$inferSelect;

export const aosCertificationConfigs = pgTable("aos_certification_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  minSuccessRate: real("min_success_rate").default(90),
  maxAvgLatencyMs: integer("max_avg_latency_ms").default(5000),
  minAccuracyScore: real("min_accuracy_score").default(85),
  minHumanRating: real("min_human_rating").default(3.5),
  probationDays: integer("probation_days").default(30),
  minTaskCount: integer("min_task_count").default(50),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("idx_aos_cert_config_company").on(table.companyId),
}));

export const insertAosCertificationConfigSchema = createInsertSchema(aosCertificationConfigs).omit({ id: true, updatedAt: true });
export type InsertAosCertificationConfig = z.infer<typeof insertAosCertificationConfigSchema>;
export type AosCertificationConfig = typeof aosCertificationConfigs.$inferSelect;

export const aosApiKeys = pgTable("aos_api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  prefix: text("prefix").notNull(),
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("idx_aos_api_keys_company").on(table.companyId),
  keyHashIdx: index("idx_aos_api_keys_hash").on(table.keyHash),
}));

export const insertAosApiKeySchema = createInsertSchema(aosApiKeys).omit({ id: true, createdAt: true });
export type InsertAosApiKey = z.infer<typeof insertAosApiKeySchema>;
export type AosApiKey = typeof aosApiKeys.$inferSelect;

export const aosBudgetAlerts = pgTable("aos_budget_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  agentId: varchar("agent_id").references(() => aosAgents.id),
  departmentId: varchar("department_id").references(() => aosDepartments.id),
  alertType: text("alert_type").notNull(),
  threshold: real("threshold").notNull(),
  currentSpend: numeric("current_spend").notNull(),
  budgetCap: numeric("budget_cap").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("idx_aos_budget_alerts_company").on(table.companyId),
}));

export const insertAosBudgetAlertSchema = createInsertSchema(aosBudgetAlerts).omit({ id: true, createdAt: true });
export type InsertAosBudgetAlert = z.infer<typeof insertAosBudgetAlertSchema>;
export type AosBudgetAlert = typeof aosBudgetAlerts.$inferSelect;

export const aosKillSwitchEvents = pgTable("aos_kill_switch_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  agentId: varchar("agent_id").notNull().references(() => aosAgents.id),
  triggeredBy: varchar("triggered_by").notNull().references(() => aosUsers.id),
  reason: text("reason").notNull(),
  revokedKeys: jsonb("revoked_keys"),
  restoredAt: timestamp("restored_at"),
  restoredBy: varchar("restored_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("idx_aos_kill_switch_company").on(table.companyId),
  agentIdx: index("idx_aos_kill_switch_agent").on(table.agentId),
}));

export const insertAosKillSwitchEventSchema = createInsertSchema(aosKillSwitchEvents).omit({ id: true, createdAt: true });
export type InsertAosKillSwitchEvent = z.infer<typeof insertAosKillSwitchEventSchema>;
export type AosKillSwitchEvent = typeof aosKillSwitchEvents.$inferSelect;

export const aosPiiRules = pgTable("aos_pii_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  name: text("name").notNull(),
  category: text("category").notNull(),
  pattern: text("pattern").notNull(),
  action: text("action").notNull().default("redact"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("idx_aos_pii_rules_company").on(table.companyId),
}));

export const insertAosPiiRuleSchema = createInsertSchema(aosPiiRules).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAosPiiRule = z.infer<typeof insertAosPiiRuleSchema>;
export type AosPiiRule = typeof aosPiiRules.$inferSelect;

export const aosPiiEvents = pgTable("aos_pii_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  agentId: varchar("agent_id").references(() => aosAgents.id),
  ruleId: varchar("rule_id").references(() => aosPiiRules.id),
  category: text("category").notNull(),
  direction: text("direction").notNull(),
  action: text("action").notNull(),
  sample: text("sample"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("idx_aos_pii_events_company").on(table.companyId),
  agentIdx: index("idx_aos_pii_events_agent").on(table.agentId),
}));

export const insertAosPiiEventSchema = createInsertSchema(aosPiiEvents).omit({ id: true, createdAt: true });
export type InsertAosPiiEvent = z.infer<typeof insertAosPiiEventSchema>;
export type AosPiiEvent = typeof aosPiiEvents.$inferSelect;

export const aosReasoningTraces = pgTable("aos_reasoning_traces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  agentId: varchar("agent_id").notNull().references(() => aosAgents.id),
  taskName: text("task_name").notNull(),
  status: text("status").notNull().default("running"),
  input: text("input"),
  output: text("output"),
  durationMs: integer("duration_ms"),
  tokenCount: integer("token_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  companyIdx: index("idx_aos_reasoning_traces_company").on(table.companyId),
  agentIdx: index("idx_aos_reasoning_traces_agent").on(table.agentId),
}));

export const insertAosReasoningTraceSchema = createInsertSchema(aosReasoningTraces).omit({ id: true, createdAt: true });
export type InsertAosReasoningTrace = z.infer<typeof insertAosReasoningTraceSchema>;
export type AosReasoningTrace = typeof aosReasoningTraces.$inferSelect;

export const aosReasoningSteps = pgTable("aos_reasoning_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  traceId: varchar("trace_id").notNull().references(() => aosReasoningTraces.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  toolName: text("tool_name"),
  toolInput: jsonb("tool_input"),
  toolOutput: jsonb("tool_output"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  traceIdx: index("idx_aos_reasoning_steps_trace").on(table.traceId),
  stepIdx: index("idx_aos_reasoning_steps_step").on(table.stepNumber),
}));

export const insertAosReasoningStepSchema = createInsertSchema(aosReasoningSteps).omit({ id: true, createdAt: true });
export type InsertAosReasoningStep = z.infer<typeof insertAosReasoningStepSchema>;
export type AosReasoningStep = typeof aosReasoningSteps.$inferSelect;

export const aosDriftAlerts = pgTable("aos_drift_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  agentId: varchar("agent_id").notNull().references(() => aosAgents.id),
  metric: text("metric").notNull(),
  baselineValue: text("baseline_value").notNull(),
  currentValue: text("current_value").notNull(),
  threshold: text("threshold").notNull(),
  severity: text("severity").notNull().default("warning"),
  status: text("status").notNull().default("open"),
  acknowledgedBy: varchar("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("idx_aos_drift_alerts_company").on(table.companyId),
  agentIdx: index("idx_aos_drift_alerts_agent").on(table.agentId),
  statusIdx: index("idx_aos_drift_alerts_status").on(table.status),
}));

export const insertAosDriftAlertSchema = createInsertSchema(aosDriftAlerts).omit({ id: true, createdAt: true });
export type InsertAosDriftAlert = z.infer<typeof insertAosDriftAlertSchema>;
export type AosDriftAlert = typeof aosDriftAlerts.$inferSelect;

export const aosShadowAgents = pgTable("aos_shadow_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  identifier: text("identifier").notNull(),
  provider: text("provider"),
  llmModel: text("llm_model"),
  sourceIp: text("source_ip"),
  department: text("department"),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  callCount: integer("call_count").default(1),
  status: text("status").notNull().default("unmanaged"),
  registeredAgentId: varchar("registered_agent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("idx_aos_shadow_agents_company").on(table.companyId),
  identifierIdx: index("idx_aos_shadow_agents_identifier").on(table.identifier),
  statusIdx: index("idx_aos_shadow_agents_status").on(table.status),
}));

export const insertAosShadowAgentSchema = createInsertSchema(aosShadowAgents).omit({ id: true, createdAt: true });
export type InsertAosShadowAgent = z.infer<typeof insertAosShadowAgentSchema>;
export type AosShadowAgent = typeof aosShadowAgents.$inferSelect;

export const aosNotifications = pgTable("aos_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  userId: varchar("user_id").references(() => aosUsers.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("idx_aos_notifications_company").on(table.companyId),
  userIdx: index("idx_aos_notifications_user").on(table.userId),
  readIdx: index("idx_aos_notifications_read").on(table.isRead),
}));

export const insertAosNotificationSchema = createInsertSchema(aosNotifications).omit({ id: true, createdAt: true });
export type InsertAosNotification = z.infer<typeof insertAosNotificationSchema>;
export type AosNotification = typeof aosNotifications.$inferSelect;

export const aosRiskWeights = pgTable("aos_risk_weights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  factorKey: text("factor_key").notNull(),
  label: text("label").notNull(),
  weight: real("weight").notNull(),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("idx_aos_risk_weights_company").on(table.companyId),
  uniqueIdx: index("idx_aos_risk_weights_company_factor").on(table.companyId, table.factorKey),
}));

export const insertAosRiskWeightSchema = createInsertSchema(aosRiskWeights).omit({ id: true, updatedAt: true });
export type InsertAosRiskWeight = z.infer<typeof insertAosRiskWeightSchema>;
export type AosRiskWeight = typeof aosRiskWeights.$inferSelect;

export const aosPolicyRules = pgTable("aos_policy_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  name: text("name").notNull(),
  description: text("description"),
  conditionField: text("condition_field").notNull(),
  operator: text("operator").notNull(),
  threshold: text("threshold").notNull(),
  secondaryField: text("secondary_field"),
  secondaryOperator: text("secondary_operator"),
  secondaryThreshold: text("secondary_threshold"),
  actionType: text("action_type").notNull().default("alert"),
  severity: text("severity").notNull().default("warning"),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => aosUsers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("idx_aos_policy_rules_company").on(table.companyId),
  activeIdx: index("idx_aos_policy_rules_active").on(table.isActive),
}));

export const insertAosPolicyRuleSchema = createInsertSchema(aosPolicyRules).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAosPolicyRule = z.infer<typeof insertAosPolicyRuleSchema>;
export type AosPolicyRule = typeof aosPolicyRules.$inferSelect;

export const aosPolicyViolations = pgTable("aos_policy_violations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => aosCompanies.id),
  policyId: varchar("policy_id").notNull().references(() => aosPolicyRules.id),
  agentId: varchar("agent_id").notNull().references(() => aosAgents.id),
  policyName: text("policy_name").notNull(),
  conditionField: text("condition_field").notNull(),
  actualValue: text("actual_value").notNull(),
  threshold: text("threshold").notNull(),
  actionTaken: text("action_taken").notNull(),
  severity: text("severity").notNull().default("warning"),
  status: text("status").notNull().default("open"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("idx_aos_policy_violations_company").on(table.companyId),
  policyIdx: index("idx_aos_policy_violations_policy").on(table.policyId),
  agentIdx: index("idx_aos_policy_violations_agent").on(table.agentId),
  statusIdx: index("idx_aos_policy_violations_status").on(table.status),
}));

export const insertAosPolicyViolationSchema = createInsertSchema(aosPolicyViolations).omit({ id: true, createdAt: true });
export type InsertAosPolicyViolation = z.infer<typeof insertAosPolicyViolationSchema>;
export type AosPolicyViolation = typeof aosPolicyViolations.$inferSelect;

export const aosPlatformAdmins = pgTable("aos_platform_admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("platform_admin"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAosPlatformAdminSchema = createInsertSchema(aosPlatformAdmins).omit({ id: true, createdAt: true, lastLoginAt: true });
export type InsertAosPlatformAdmin = z.infer<typeof insertAosPlatformAdminSchema>;
export type AosPlatformAdmin = typeof aosPlatformAdmins.$inferSelect;

export const aosPlatformSessions = pgTable("aos_platform_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull().references(() => aosPlatformAdmins.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAosPlatformSessionSchema = createInsertSchema(aosPlatformSessions).omit({ id: true, createdAt: true });
export type InsertAosPlatformSession = z.infer<typeof insertAosPlatformSessionSchema>;
export type AosPlatformSession = typeof aosPlatformSessions.$inferSelect;
