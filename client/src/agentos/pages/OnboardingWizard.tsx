import { useState, useEffect, useRef } from "react";
import { aosApi } from "../lib/api";
import AgentOSLogo from "../components/AgentOSLogo";

interface OnboardingWizardProps {
  companyName: string;
  peopleosLinked?: boolean;
  onComplete: () => void;
}

interface PeopleosAgent {
  key: string;
  name: string;
  role: string;
  description: string;
  provider: string;
  llmModel: string;
  reason: string;
}

interface AgentForm {
  name: string;
  provider: string;
  llmModel: string;
  role: string;
  apiKey: string;
}

interface CreatedAgent {
  id: string;
  name: string;
  uid: string;
  provider: string;
  llmModel: string;
  role: string;
  status: string;
}

import { PROVIDER_MODELS, DEFAULT_MODEL } from "../lib/models";
const PROVIDERS = PROVIDER_MODELS;

const FEATURES = [
  {
    icon: "dollar",
    title: "Agent Payroll",
    description: "Track API costs per agent with budget alerts and spend forecasting",
    color: "emerald",
  },
  {
    icon: "zap",
    title: "Kill Switch",
    description: "Instantly revoke any agent's access with one click in emergencies",
    color: "red",
  },
  {
    icon: "shield",
    title: "Blast Shield",
    description: "PII detection and data loss prevention across all agent communications",
    color: "blue",
  },
  {
    icon: "search",
    title: "Shadow AI Detection",
    description: "Discover unauthorized AI agents running across your organization",
    color: "amber",
  },
];

const SHOWCASE_FEATURES = [
  {
    icon: "grid",
    title: "Command Center",
    description: "Real-time fleet health, alerts, and performance metrics in a single dashboard",
    color: "violet",
  },
  {
    icon: "dollar",
    title: "Agent Payroll",
    description: "Track API costs per agent with budget alerts and spend forecasting",
    color: "emerald",
  },
  {
    icon: "zap",
    title: "Kill Switch",
    description: "Instantly revoke any agent's access with one click in emergencies",
    color: "red",
  },
  {
    icon: "shield",
    title: "Blast Shield",
    description: "PII detection and data loss prevention across all agent communications",
    color: "blue",
  },
  {
    icon: "risk",
    title: "Risk Scoring",
    description: "7-factor weighted risk analysis with automated policy enforcement",
    color: "orange",
  },
  {
    icon: "search",
    title: "Shadow AI Detection",
    description: "Discover unauthorized AI agents running across your organization",
    color: "amber",
  },
  {
    icon: "compliance",
    title: "Compliance & Audit",
    description: "Generate audit-ready evidence packs and compliance reports instantly",
    color: "violet",
  },
  {
    icon: "chart",
    title: "AI Workforce Report",
    description: "Fleet-wide KPIs, ROI analysis, and human-AI cost comparison",
    color: "cyan",
  },
];

function FeatureIcon({ type, className }: { type: string; className?: string }) {
  const props = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className };
  switch (type) {
    case "dollar": return <svg {...props}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
    case "zap": return <svg {...props}><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>;
    case "shield": return <svg {...props}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>;
    case "search": return <svg {...props}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
    case "grid": return <svg {...props}><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>;
    case "risk": return <svg {...props}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>;
    case "compliance": return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>;
    case "chart": return <svg {...props}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
    default: return null;
  }
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400" },
  red: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400" },
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400" },
  violet: { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-400" },
  orange: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400" },
  cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-400" },
};

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 2000
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isRetryable =
        lastError.message.includes("503") ||
        lastError.message.includes("temporarily unavailable") ||
        lastError.message.includes("high server load") ||
        lastError.message.includes("Failed to fetch") ||
        lastError.message.includes("NetworkError") ||
        lastError.message.includes("Request failed");
      if (attempt < maxAttempts - 1 && isRetryable) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw lastError;
      }
    }
  }
  throw lastError;
}

function FeatureShowcaseOverlay({
  mode,
  error,
  onRetry,
}: {
  mode: "completing" | "seeding";
  error: string;
  onRetry: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [fadeState, setFadeState] = useState<"in" | "out">("in");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (error) return;
    timerRef.current = setInterval(() => {
      setFadeState("out");
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % SHOWCASE_FEATURES.length);
        setFadeState("in");
      }, 400);
    }, 3000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [error]);

  const feature = SHOWCASE_FEATURES[activeIndex];
  const colors = COLOR_MAP[feature.color] || COLOR_MAP.violet;
  const progressPercent = ((activeIndex + 1) / SHOWCASE_FEATURES.length) * 100;

  const statusText =
    mode === "seeding"
      ? "Loading demo agents, telemetry & governance data..."
      : "Preparing your dashboard...";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950"
      data-testid="showcase-overlay"
    >
      <style>{`
        @keyframes aos-pulse-ring {
          0% { transform: scale(0.9); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.2; }
          100% { transform: scale(0.9); opacity: 0.5; }
        }
        @keyframes aos-fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes aos-fade-out {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-12px); }
        }
        @keyframes aos-progress-glow {
          0%, 100% { box-shadow: 0 0 8px rgba(139, 92, 246, 0.4); }
          50% { box-shadow: 0 0 16px rgba(139, 92, 246, 0.7); }
        }
        @keyframes aos-dots {
          0%, 20% { content: ''; }
          40% { content: '.'; }
          60% { content: '..'; }
          80%, 100% { content: '...'; }
        }
        .aos-feature-enter { animation: aos-fade-in 0.4s ease-out forwards; }
        .aos-feature-exit { animation: aos-fade-out 0.4s ease-in forwards; }
        .aos-pulse-ring { animation: aos-pulse-ring 2s ease-in-out infinite; }
        .aos-progress-bar { animation: aos-progress-glow 2s ease-in-out infinite; }
      `}</style>

      <div className="w-full max-w-lg px-6 text-center">
        <div className="relative flex justify-center mb-8">
          <div className="aos-pulse-ring absolute w-24 h-24 rounded-full bg-violet-500/20 border border-violet-500/20" />
          <AgentOSLogo size={56} className="text-violet-400 relative z-10" />
        </div>

        {!error ? (
          <>
            <div
              className={`mb-8 min-h-[140px] flex flex-col items-center justify-center ${fadeState === "in" ? "aos-feature-enter" : "aos-feature-exit"}`}
              data-testid="showcase-feature-card"
            >
              <div
                className={`w-14 h-14 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center mb-4`}
              >
                <FeatureIcon type={feature.icon} className={colors.text} />
              </div>
              <h3
                className="text-xl font-bold text-white mb-2"
                data-testid="showcase-feature-title"
              >
                {feature.title}
              </h3>
              <p className="text-slate-400 text-sm max-w-sm">
                {feature.description}
              </p>
            </div>

            <div className="mb-4">
              <div className="w-full max-w-xs mx-auto h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full transition-all duration-700 ease-out aos-progress-bar"
                  style={{ width: `${progressPercent}%` }}
                  data-testid="showcase-progress"
                />
              </div>
            </div>

            <p className="text-slate-500 text-sm" data-testid="showcase-status">
              {statusText}
            </p>

            <div className="flex justify-center gap-1.5 mt-6">
              {SHOWCASE_FEATURES.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === activeIndex
                      ? "w-6 bg-violet-500"
                      : i < activeIndex
                        ? "w-2 bg-violet-500/40"
                        : "w-2 bg-slate-700"
                  }`}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="aos-feature-enter" data-testid="showcase-error">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-red-400"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Server is busy
            </h3>
            <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
              {(() => {
                const isServerBusy =
                  error.includes("503") ||
                  error.includes("temporarily unavailable") ||
                  error.includes("high server load");
                const isGeneric =
                  error === "Request failed" ||
                  error.includes("Failed to fetch") ||
                  error.includes("NetworkError") ||
                  error === "Something went wrong. Please try again.";
                if (isServerBusy || isGeneric) {
                  return "The server is under heavy load right now. Please wait a moment and try again.";
                }
                return error;
              })()}
            </p>
            <button
              onClick={onRetry}
              className="px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-colors text-lg"
              data-testid="button-retry"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardingWizard({ companyName, peopleosLinked, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [agentForm, setAgentForm] = useState<AgentForm>({
    name: "My-First-Agent",
    provider: "OpenAI",
    llmModel: DEFAULT_MODEL,
    role: "Assistant",
    apiKey: "",
  });
  const [createdAgent, setCreatedAgent] = useState<CreatedAgent | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [seedComplete, setSeedComplete] = useState(false);
  const [seedError, setSeedError] = useState("");
  const [completionError, setCompletionError] = useState("");
  const [showShowcase, setShowShowcase] = useState(false);
  const [showcaseMode, setShowcaseMode] = useState<"completing" | "seeding">("completing");
  const [showcaseError, setShowcaseError] = useState("");

  const [posAgents, setPosAgents] = useState<PeopleosAgent[]>([]);
  const [posAgentsLoading, setPosAgentsLoading] = useState(false);
  const [posSelectedKeys, setPosSelectedKeys] = useState<Set<string>>(new Set());
  const [posImporting, setPosImporting] = useState(false);
  const [posImportError, setPosImportError] = useState("");

  const hasPosStep = !!peopleosLinked;
  const totalSteps = hasPosStep ? 6 : 5;

  const runWithShowcase = async (
    mode: "completing" | "seeding",
    fn: () => Promise<void>
  ) => {
    setShowcaseMode(mode);
    setShowcaseError("");
    setShowShowcase(true);
    try {
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setShowcaseError(msg);
    }
  };

  const handleSkip = async () => {
    setCompletionError("");
    await runWithShowcase("completing", async () => {
      await retryWithBackoff(() => aosApi.completeOnboarding());
      onComplete();
    });
  };

  const handleFinish = async () => {
    setCompletionError("");
    await runWithShowcase("completing", async () => {
      await retryWithBackoff(() => aosApi.completeOnboarding());
      onComplete();
    });
  };

  const handleRetryShowcase = () => {
    setShowcaseError("");
    if (showcaseMode === "completing") {
      handleFinish();
    } else {
      handleSeedDemoWithShowcase();
    }
  };

  const handleCreateAgent = async () => {
    setCreating(true);
    setCreateError("");
    try {
      const agent = await aosApi.createAgent(agentForm);
      setCreatedAgent(agent);
      if (hasPosStep) {
        setPosAgentsLoading(true);
        setStep(2);
        try {
          const data = await aosApi.discoverPeopleosAgents();
          if (data.available && data.agents?.length > 0) {
            setPosAgents(data.agents);
            setPosSelectedKeys(new Set(data.agents.map((a: PeopleosAgent) => a.key)));
          }
        } catch (e) {
          console.warn("Failed to discover PeopleOS agents:", e);
        } finally {
          setPosAgentsLoading(false);
        }
      } else {
        setStep(2);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  };

  const handleImportPosAgents = async () => {
    setPosImporting(true);
    setPosImportError("");
    try {
      const keys = Array.from(posSelectedKeys);
      await aosApi.importPeopleosAgents(keys);
      setStep(3);
    } catch (err) {
      setPosImportError(err instanceof Error ? err.message : "Failed to import agents");
    } finally {
      setPosImporting(false);
    }
  };

  const handleSeedDemoWithShowcase = async () => {
    setSeedError("");
    await runWithShowcase("seeding", async () => {
      await retryWithBackoff(() => aosApi.seedDemoData());
      setSeedComplete(true);
      setShowShowcase(false);
    });
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    await handleSeedDemoWithShowcase();
    setSeeding(false);
  };

  const updateAgent = (field: keyof AgentForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value;
    setAgentForm((f) => {
      const updated = { ...f, [field]: val };
      if (field === "provider") {
        const models = PROVIDERS[val] || [];
        updated.llmModel = models[0] || "";
      }
      return updated;
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-4" data-testid="onboarding-wizard">
      {showShowcase && (
        <FeatureShowcaseOverlay
          mode={showcaseMode}
          error={showcaseError}
          onRetry={handleRetryShowcase}
        />
      )}

      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${i === step ? "w-8 bg-violet-500" : i < step ? "w-8 bg-violet-500/50" : "w-8 bg-slate-700"}`}
                data-testid={`progress-step-${i}`}
              />
            ))}
          </div>
          <button
            onClick={handleSkip}
            className="text-slate-400 hover:text-slate-300 text-sm transition-colors"
            data-testid="button-skip-onboarding"
          >
            Skip setup
          </button>
        </div>

        {completionError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm mb-4" data-testid="text-completion-error">
            {completionError}
          </div>
        )}

        <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-sm">
          {step === 0 && (
            <WelcomeStep companyName={companyName} onNext={() => setStep(1)} />
          )}

          {step === 1 && (
            <RegisterAgentStep
              form={agentForm}
              onChange={updateAgent}
              onSubmit={handleCreateAgent}
              creating={creating}
              error={createError}
              onBack={() => setStep(0)}
            />
          )}

          {step === 2 && hasPosStep && (
            <ImportPeopleosStep
              agents={posAgents}
              loading={posAgentsLoading}
              selectedKeys={posSelectedKeys}
              onToggle={(key) => {
                setPosSelectedKeys((prev) => {
                  const next = new Set(prev);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                });
              }}
              onSelectAll={() => setPosSelectedKeys(new Set(posAgents.map(a => a.key)))}
              onDeselectAll={() => setPosSelectedKeys(new Set())}
              onImport={handleImportPosAgents}
              onSkip={() => setStep(3)}
              importing={posImporting}
              error={posImportError}
              onBack={() => setStep(1)}
            />
          )}

          {step === (hasPosStep ? 3 : 2) && (
            <SeeItLiveStep
              agent={createdAgent}
              onNext={() => setStep(hasPosStep ? 4 : 3)}
              onBack={() => setStep(hasPosStep ? 2 : 1)}
            />
          )}

          {step === (hasPosStep ? 4 : 3) && (
            <ExploreStep onNext={() => setStep(hasPosStep ? 5 : 4)} onBack={() => setStep(hasPosStep ? 3 : 2)} />
          )}

          {step === (hasPosStep ? 5 : 4) && (
            <ReadyStep
              onFinish={handleFinish}
              onSeedDemo={handleSeedDemo}
              seeding={seeding}
              seedComplete={seedComplete}
              seedError={seedError}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function WelcomeStep({ companyName, onNext }: { companyName: string; onNext: () => void }) {
  return (
    <div className="text-center" data-testid="onboarding-step-welcome">
      <div className="flex justify-center mb-6">
        <AgentOSLogo size={64} className="text-violet-400" />
      </div>
      <h1 className="text-3xl font-bold text-white mb-3" data-testid="text-welcome-title">Welcome to AgentOS</h1>
      <p className="text-slate-400 text-lg mb-2" data-testid="text-welcome-company">{companyName}</p>
      <p className="text-slate-500 max-w-md mx-auto mb-8">
        Your centralized platform to register, govern, and optimize every AI agent across your organization. Let's get you set up in under 2 minutes.
      </p>
      <button
        onClick={onNext}
        className="px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-colors text-lg"
        data-testid="button-get-started"
      >
        Get Started
      </button>
    </div>
  );
}

function RegisterAgentStep({
  form,
  onChange,
  onSubmit,
  creating,
  error,
  onBack,
}: {
  form: AgentForm;
  onChange: (field: keyof AgentForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSubmit: () => void;
  creating: boolean;
  error: string;
  onBack: () => void;
}) {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div data-testid="onboarding-step-register">
      <h2 className="text-2xl font-bold text-white mb-2">Register Your First Agent</h2>
      <p className="text-slate-400 mb-6">Give your AI agent an identity. Smart defaults are pre-filled — customize as needed.</p>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm mb-4" data-testid="text-agent-create-error">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Agent Name</label>
          <input
            data-testid="input-agent-name"
            value={form.name}
            onChange={onChange("name")}
            className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            placeholder="e.g. CodeReview-Bot"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Provider</label>
            <select
              data-testid="input-agent-provider"
              value={form.provider}
              onChange={onChange("provider")}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            >
              {Object.keys(PROVIDERS).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Model</label>
            <select
              data-testid="input-agent-model"
              value={form.llmModel}
              onChange={onChange("llmModel")}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            >
              {(PROVIDERS[form.provider] || []).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Provider API Key</label>
          <div className="relative">
            <input
              data-testid="input-agent-api-key"
              type={showApiKey ? "text" : "password"}
              value={form.apiKey}
              onChange={onChange("apiKey")}
              className="w-full px-4 py-2.5 pr-12 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              placeholder="Enter your provider API key"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
              data-testid="button-toggle-api-key"
              tabIndex={-1}
            >
              {showApiKey ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                  <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">Your API key for the selected provider. Encrypted and stored securely.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Role</label>
          <input
            data-testid="input-agent-role"
            value={form.role}
            onChange={onChange("role")}
            className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            placeholder="e.g. Code Reviewer, Support Agent"
          />
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <button
          onClick={onBack}
          className="px-6 py-2.5 text-slate-400 hover:text-white transition-colors"
          data-testid="button-back-to-welcome"
        >
          Back
        </button>
        <button
          onClick={onSubmit}
          disabled={creating || !form.name.trim() || form.apiKey.trim().length < 8}
          className="px-8 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
          data-testid="button-create-agent"
        >
          {creating ? "Creating..." : "Register Agent"}
        </button>
      </div>
    </div>
  );
}

function ImportPeopleosStep({
  agents,
  loading,
  selectedKeys,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onImport,
  onSkip,
  importing,
  error,
  onBack,
}: {
  agents: PeopleosAgent[];
  loading: boolean;
  selectedKeys: Set<string>;
  onToggle: (key: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onImport: () => void;
  onSkip: () => void;
  importing: boolean;
  error: string;
  onBack: () => void;
}) {
  return (
    <div data-testid="onboarding-step-peopleos-import">
      <h2 className="text-2xl font-bold text-white mb-2">Import PeopleOS Agents</h2>
      <p className="text-slate-400 mb-6">
        We detected HR capabilities from your linked PeopleOS account. Select the agents you'd like to add to your fleet.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400"></div>
          <span className="ml-3 text-slate-400">Discovering agents...</span>
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-400 mb-4">No additional agents discovered for your account.</p>
          <button
            onClick={onSkip}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors"
            data-testid="button-pos-skip-empty"
          >
            Continue
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-400">{selectedKeys.size} of {agents.length} selected</span>
            <div className="flex gap-2">
              <button
                onClick={onSelectAll}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                data-testid="button-pos-select-all"
              >
                Select All
              </button>
              <span className="text-slate-600">|</span>
              <button
                onClick={onDeselectAll}
                className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                data-testid="button-pos-deselect-all"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 mb-6">
            {agents.map((agent) => (
              <label
                key={agent.key}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedKeys.has(agent.key)
                    ? "border-violet-500/50 bg-violet-500/10"
                    : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                }`}
                data-testid={`pos-agent-${agent.key}`}
              >
                <input
                  type="checkbox"
                  checked={selectedKeys.has(agent.key)}
                  onChange={() => onToggle(agent.key)}
                  className="mt-1 rounded border-slate-600 bg-slate-800 text-violet-500 focus:ring-violet-500/50"
                  data-testid={`checkbox-pos-${agent.key}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">{agent.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{agent.provider}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{agent.description}</p>
                  <p className="text-xs text-violet-400/70 mt-1">{agent.reason}</p>
                </div>
              </label>
            ))}
          </div>

          {error && (
            <div className="text-red-400 text-sm mb-4 p-2 bg-red-500/10 rounded-lg" data-testid="text-pos-import-error">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              data-testid="button-pos-back"
            >
              Back
            </button>
            <div className="flex gap-3">
              <button
                onClick={onSkip}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                data-testid="button-pos-skip"
              >
                Skip
              </button>
              <button
                onClick={onImport}
                disabled={selectedKeys.size === 0 || importing}
                className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                data-testid="button-pos-import"
              >
                {importing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Importing...
                  </>
                ) : (
                  `Import ${selectedKeys.size} Agent${selectedKeys.size !== 1 ? "s" : ""}`
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SeeItLiveStep({ agent, onNext, onBack }: { agent: CreatedAgent | null; onNext: () => void; onBack: () => void }) {
  return (
    <div data-testid="onboarding-step-live">
      <h2 className="text-2xl font-bold text-white mb-2">See It Live</h2>
      <p className="text-slate-400 mb-6">Your agent has been registered and assigned a unique Passport UID.</p>

      {agent && (
        <div className="bg-slate-800/70 border border-slate-700/50 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <AgentOSLogo size={40} className="text-violet-400 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white" data-testid="text-agent-name">{agent.name}</h3>
              <p className="text-sm text-violet-400 font-mono mt-0.5" data-testid="text-agent-uid">{agent.uid}</p>
              <div className="flex flex-wrap gap-3 mt-3">
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">{agent.provider}</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">{agent.llmModel}</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 capitalize">{agent.status}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-5">
        <h4 className="text-sm font-semibold text-white mb-3">Agent Lifecycle States</h4>
        <div className="grid grid-cols-2 gap-3">
          {[
            { state: "Onboarding", desc: "Initial setup & configuration", color: "bg-amber-500" },
            { state: "Active", desc: "Fully operational & monitored", color: "bg-emerald-500" },
            { state: "Suspended", desc: "Temporarily disabled via Kill Switch", color: "bg-red-500" },
            { state: "Retired", desc: "Decommissioned & archived", color: "bg-slate-500" },
          ].map((s) => (
            <div key={s.state} className="flex items-start gap-2.5">
              <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${s.color}`} />
              <div>
                <p className="text-sm text-white font-medium">{s.state}</p>
                <p className="text-xs text-slate-500">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <button onClick={onBack} className="px-6 py-2.5 text-slate-400 hover:text-white transition-colors" data-testid="button-back-to-register">
          Back
        </button>
        <button onClick={onNext} className="px-8 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-colors" data-testid="button-continue-to-features">
          Continue
        </button>
      </div>
    </div>
  );
}

function ExploreStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div data-testid="onboarding-step-explore">
      <h2 className="text-2xl font-bold text-white mb-2">Explore Key Features</h2>
      <p className="text-slate-400 mb-6">AgentOS gives you complete visibility and control over your AI fleet.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FEATURES.map((f) => {
          const colors = COLOR_MAP[f.color];
          return (
            <div key={f.title} className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-5 hover:border-slate-600/50 transition-colors" data-testid={`feature-card-${f.icon}`}>
              <div className={`w-10 h-10 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center mb-3`}>
                <FeatureIcon type={f.icon} className={colors.text} />
              </div>
              <h3 className="text-white font-semibold mb-1">{f.title}</h3>
              <p className="text-slate-500 text-sm">{f.description}</p>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-8">
        <button onClick={onBack} className="px-6 py-2.5 text-slate-400 hover:text-white transition-colors" data-testid="button-back-to-live">
          Back
        </button>
        <button onClick={onNext} className="px-8 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-colors" data-testid="button-continue-to-ready">
          Continue
        </button>
      </div>
    </div>
  );
}

function ReadyStep({
  onFinish,
  onSeedDemo,
  seeding,
  seedComplete,
  seedError,
}: {
  onFinish: () => void;
  onSeedDemo: () => void;
  seeding: boolean;
  seedComplete: boolean;
  seedError: string;
}) {
  return (
    <div className="text-center" data-testid="onboarding-step-ready">
      <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><path d="M20 6 9 17l-5-5"/></svg>
      </div>
      <h2 className="text-3xl font-bold text-white mb-3" data-testid="text-ready-title">You're Ready!</h2>
      <p className="text-slate-400 max-w-md mx-auto mb-8">
        Your AgentOS workspace is set up. Head to the dashboard to start managing your AI fleet.
      </p>

      <div className="space-y-3">
        <button
          onClick={onFinish}
          className="w-full max-w-xs mx-auto block px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-colors text-lg"
          data-testid="button-go-to-dashboard"
        >
          Go to Dashboard
        </button>

        {!seedComplete ? (
          <>
            <button
              onClick={onSeedDemo}
              disabled={seeding}
              className="w-full max-w-xs mx-auto block px-8 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium rounded-xl transition-colors disabled:opacity-50"
              data-testid="button-load-demo-data"
            >
              {seeding ? "Loading demo data..." : "Load Demo Data"}
            </button>
            {seedError && (
              <div className="text-red-400 text-sm mt-2" data-testid="text-seed-error">{seedError}</div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm" data-testid="text-demo-loaded">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            Demo data loaded — sample agents, telemetry & alerts added
          </div>
        )}
      </div>
    </div>
  );
}
