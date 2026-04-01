import OpenAI from "openai";
import crypto from "crypto";
import { db } from "../db";
import { aosCompanies, aosAgents, aosTelemetryEvents } from "@shared/agentos-schema";
import { eq, and } from "drizzle-orm";

export const AGENT_TYPES = {
  CAREER_COPILOT: "Zaki",
  PEOPLEOS_ORCHESTRATOR: "PeopleOS Orchestrator",
  BLOG_GENERATOR: "Blog Generator",
  VISA_INTELLIGENCE: "Visa Intelligence",
  SKILLS_GAP_ANALYZER: "Skills Gap Analyzer",
  WHATSAPP_CV_PARSER: "WhatsApp CV Parser",
  JOB_INGESTION_CLASSIFIER: "Job Ingestion Classifier",
  AI_MEMORY_SERVICE: "AI Memory Service",
  WHATSAPP_CV_BOT: "WhatsApp CV Bot",
  BAYT_SCRAPER: "Bayt Scraper AI",
  VECTOR_STORE: "Rhea",
  RE_RANKER: "Rhea",
  INTERACTIVE_CV: "Zainab",
  COMMAND_CENTER: "Ruby",
  WHATSAPP_SCREENING: "Zara",
} as const;

export type AgentType = typeof AGENT_TYPES[keyof typeof AGENT_TYPES];

const SUPPORTED_PROVIDERS = new Set([
  "OpenAI", "Anthropic", "Google", "Mistral", "Cohere", "Meta", "Custom",
]);

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "dall-e-3": { input: 0.04, output: 0 },
};

const companyIdCache = new Map<string, string | null>();
const agentIdCache = new Map<string, string | null>();
const agentKeyCache = new Map<string, string | null>();

function cacheKey(companyId: string, agentName: string): string {
  return `${companyId}:${agentName}`;
}

async function getCompanyIdByName(companyName: string): Promise<string | null> {
  if (companyIdCache.has(companyName)) return companyIdCache.get(companyName) ?? null;
  try {
    const [company] = await db
      .select({ id: aosCompanies.id })
      .from(aosCompanies)
      .where(eq(aosCompanies.name, companyName))
      .limit(1);
    const id = company?.id ?? null;
    companyIdCache.set(companyName, id);
    return id;
  } catch {
    return null;
  }
}

async function getZiphireCompanyId(): Promise<string | null> {
  return getCompanyIdByName("Ziphire");
}

async function resolveAgentId(agentName: string, companyId?: string): Promise<string | null> {
  const resolvedCompanyId = companyId || await getZiphireCompanyId();
  if (!resolvedCompanyId) return null;

  const key = cacheKey(resolvedCompanyId, agentName);
  if (agentIdCache.has(key)) return agentIdCache.get(key) ?? null;

  try {
    const [agent] = await db
      .select({ id: aosAgents.id })
      .from(aosAgents)
      .where(and(eq(aosAgents.companyId, resolvedCompanyId), eq(aosAgents.name, agentName)))
      .limit(1);
    const id = agent?.id ?? null;
    agentIdCache.set(key, id);
    return id;
  } catch {
    agentIdCache.set(key, null);
    return null;
  }
}

async function resolveAgentApiKey(agentName: string, companyId?: string): Promise<string | null> {
  const resolvedCompanyId = companyId || await getZiphireCompanyId();
  if (!resolvedCompanyId) return null;

  const key = cacheKey(resolvedCompanyId, agentName);
  if (agentKeyCache.has(key)) return agentKeyCache.get(key) ?? null;

  try {
    const [agent] = await db
      .select({ apiKeyEncrypted: aosAgents.apiKeyEncrypted })
      .from(aosAgents)
      .where(and(eq(aosAgents.companyId, resolvedCompanyId), eq(aosAgents.name, agentName)))
      .limit(1);

    if (!agent?.apiKeyEncrypted) {
      agentKeyCache.set(key, null);
      return null;
    }

    const decrypted = decryptAgentApiKey(agent.apiKeyEncrypted);
    agentKeyCache.set(key, decrypted);
    return decrypted;
  } catch {
    agentKeyCache.set(key, null);
    return null;
  }
}

function decryptAgentApiKey(encryptedData: string): string {
  const secret = process.env.AGENT_KEY_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error("No encryption secret configured");
  const [ivHex, authTagHex, encrypted] = encryptedData.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = crypto.scryptSync(secret, "agentos-salt", 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING["gpt-4o-mini"];
  return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
}

interface TelemetryData {
  agentName: string;
  companyId?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
}

function logTelemetry(data: TelemetryData): void {
  (async () => {
    try {
      const companyId = data.companyId || await getZiphireCompanyId();
      if (!companyId) return;
      const agentId = await resolveAgentId(data.agentName, companyId);
      if (!agentId) return;

      const costUsd = calculateCost(data.model, data.inputTokens, data.outputTokens);

      await db.insert(aosTelemetryEvents).values({
        companyId,
        agentId,
        eventType: "task",
        provider: "OpenAI",
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.totalTokens,
        costUsd: costUsd.toFixed(6),
        latencyMs: data.latencyMs,
        taskOutcome: data.success ? "success" : "failure",
        errorMessage: data.errorMessage || null,
        timestamp: new Date(),
      });
    } catch (err) {
    }
  })();
}

export interface InstrumentedClientOptions {
  companyId?: string;
}

export function getInstrumentedOpenAIClient(agentName: string, options?: InstrumentedClientOptions): OpenAI | null {
  const companyId = options?.companyId;

  let apiKey: string | undefined = process.env.OPENAI_API_KEY;

  if (companyId) {
    resolveAgentApiKey(agentName, companyId).then((agentKey) => {
      if (agentKey && client) {
        (client as any).apiKey = agentKey;
      }
    }).catch(() => {});
  }

  if (!apiKey) return null;

  const client = new OpenAI({
    apiKey,
    timeout: 60000,
    maxRetries: 2,
  });

  const originalChatCreate = client.chat.completions.create.bind(client.chat.completions);
  (client.chat.completions as any).create = async function (...args: any[]) {
    if (companyId) {
      const agentKey = await resolveAgentApiKey(agentName, companyId);
      if (agentKey) {
        (client as any).apiKey = agentKey;
      }
    }
    const start = Date.now();
    let success = true;
    let errorMessage: string | undefined;
    let response: any;
    try {
      response = await originalChatCreate(...args);
      return response;
    } catch (err: any) {
      success = false;
      errorMessage = err.message || "Unknown error";
      throw err;
    } finally {
      const latencyMs = Date.now() - start;
      const model = args[0]?.model || "gpt-4o-mini";
      const usage = response?.usage;
      logTelemetry({
        agentName,
        companyId,
        model,
        inputTokens: usage?.prompt_tokens || 0,
        outputTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
        latencyMs,
        success,
        errorMessage,
      });
    }
  };

  const originalImagesGenerate = client.images.generate.bind(client.images);
  (client.images as any).generate = async function (...args: any[]) {
    if (companyId) {
      const agentKey = await resolveAgentApiKey(agentName, companyId);
      if (agentKey) {
        (client as any).apiKey = agentKey;
      }
    }
    const start = Date.now();
    let success = true;
    let errorMessage: string | undefined;
    try {
      const response = await originalImagesGenerate(...args);
      return response;
    } catch (err: any) {
      success = false;
      errorMessage = err.message || "Unknown error";
      throw err;
    } finally {
      const latencyMs = Date.now() - start;
      const model = args[0]?.model || "dall-e-3";
      logTelemetry({
        agentName,
        companyId,
        model,
        inputTokens: 1,
        outputTokens: 0,
        totalTokens: 1,
        latencyMs,
        success,
        errorMessage,
      });
    }
  };

  const originalEmbeddingsCreate = client.embeddings.create.bind(client.embeddings);
  (client.embeddings as any).create = async function (...args: any[]) {
    if (companyId) {
      const agentKey = await resolveAgentApiKey(agentName, companyId);
      if (agentKey) {
        (client as any).apiKey = agentKey;
      }
    }
    const start = Date.now();
    let success = true;
    let errorMessage: string | undefined;
    let response: any;
    try {
      response = await originalEmbeddingsCreate(...args);
      return response;
    } catch (err: any) {
      success = false;
      errorMessage = err.message || "Unknown error";
      throw err;
    } finally {
      const latencyMs = Date.now() - start;
      const model = args[0]?.model || "text-embedding-3-small";
      const usage = response?.usage;
      logTelemetry({
        agentName,
        companyId,
        model,
        inputTokens: usage?.prompt_tokens || usage?.total_tokens || 0,
        outputTokens: 0,
        totalTokens: usage?.total_tokens || 0,
        latencyMs,
        success,
        errorMessage,
      });
    }
  };

  return client;
}

export function getInstrumentedReplicAIClient(agentName: string, options?: InstrumentedClientOptions): OpenAI | null {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY || !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) return null;
  const companyId = options?.companyId;

  const client = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  const originalChatCreate = client.chat.completions.create.bind(client.chat.completions);
  (client.chat.completions as any).create = async function (...args: any[]) {
    const start = Date.now();
    let success = true;
    let errorMessage: string | undefined;
    let response: any;
    try {
      response = await originalChatCreate(...args);
      return response;
    } catch (err: any) {
      success = false;
      errorMessage = err.message || "Unknown error";
      throw err;
    } finally {
      const latencyMs = Date.now() - start;
      const model = args[0]?.model || "gpt-4o";
      const usage = response?.usage;
      logTelemetry({
        agentName,
        companyId,
        model,
        inputTokens: usage?.prompt_tokens || 0,
        outputTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
        latencyMs,
        success,
        errorMessage,
      });
    }
  };

  const originalImagesGenerate = client.images.generate.bind(client.images);
  (client.images as any).generate = async function (...args: any[]) {
    const start = Date.now();
    let success = true;
    let errorMessage: string | undefined;
    try {
      const response = await originalImagesGenerate(...args);
      return response;
    } catch (err: any) {
      success = false;
      errorMessage = err.message || "Unknown error";
      throw err;
    } finally {
      const latencyMs = Date.now() - start;
      const model = args[0]?.model || "dall-e-3";
      logTelemetry({
        agentName,
        companyId,
        model,
        inputTokens: 1,
        outputTokens: 0,
        totalTokens: 1,
        latencyMs,
        success,
        errorMessage,
      });
    }
  };

  return client;
}

export function clearTelemetryCache(): void {
  companyIdCache.clear();
  agentIdCache.clear();
  agentKeyCache.clear();
}

export interface AgentValidationResult {
  isValid: boolean;
  checks: {
    name: string;
    passed: boolean;
    message: string;
  }[];
}

export function validateAgentWiring(agent: {
  name: string;
  provider: string;
  llmModel: string;
  apiKeyEncrypted?: string | null;
  status: string;
}): AgentValidationResult {
  const checks: AgentValidationResult["checks"] = [];

  checks.push({
    name: "provider_configured",
    passed: !!agent.provider && SUPPORTED_PROVIDERS.has(agent.provider),
    message: !!agent.provider && SUPPORTED_PROVIDERS.has(agent.provider)
      ? `Provider "${agent.provider}" is supported`
      : `Provider "${agent.provider || "(none)"}" is not recognized. Supported: ${[...SUPPORTED_PROVIDERS].join(", ")}`,
  });

  checks.push({
    name: "model_set",
    passed: !!agent.llmModel && agent.llmModel.length > 0,
    message: agent.llmModel ? `Model "${agent.llmModel}" is configured` : "No model configured",
  });

  const hasKey = !!agent.apiKeyEncrypted;
  checks.push({
    name: "api_key_present",
    passed: hasKey,
    message: hasKey ? "API key is stored and encrypted" : "No API key configured — will use platform default key if available",
  });

  if (hasKey) {
    try {
      decryptAgentApiKey(agent.apiKeyEncrypted!);
      checks.push({
        name: "api_key_decryptable",
        passed: true,
        message: "API key can be decrypted successfully",
      });
    } catch {
      checks.push({
        name: "api_key_decryptable",
        passed: false,
        message: "API key is stored but cannot be decrypted — re-enter the key",
      });
    }
  }

  const isValid = checks.filter(c => c.name !== "api_key_present").every(c => c.passed);

  return { isValid, checks };
}

export { SUPPORTED_PROVIDERS };
