import { useState, useEffect, useCallback } from "react";
import AgentOSLogo from "../components/AgentOSLogo";

interface ProductTourProps {
  onClose: () => void;
}

interface TourSlide {
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  highlights: string[];
}

const TOUR_SLIDES: TourSlide[] = [
  {
    icon: "logo",
    title: "Welcome to AgentOS",
    subtitle: "AI Fleet Governance, Simplified",
    description: "The command center for every AI agent in your organization. Register, monitor, and govern your entire AI workforce from a single platform.",
    color: "violet",
    highlights: ["Centralized agent registry", "Real-time fleet monitoring", "Enterprise-grade governance"],
  },
  {
    icon: "grid",
    title: "Command Dashboard",
    subtitle: "Your Fleet at a Glance",
    description: "See the health, performance, and cost of every agent in real time. Alerts, risk scores, and compliance status — all in one view.",
    color: "blue",
    highlights: ["Live fleet health metrics", "Alert notifications", "Quick-action controls"],
  },
  {
    icon: "bot",
    title: "Agent Directory",
    subtitle: "Every Agent, Documented",
    description: "Each AI agent gets a unique Passport UID, version history, and full lifecycle tracking — from onboarding through retirement.",
    color: "emerald",
    highlights: ["Unique Passport UIDs", "Version history & audit trail", "Lifecycle state management"],
  },
  {
    icon: "dollar",
    title: "Agent Payroll",
    subtitle: "Know What Your AI Costs",
    description: "Track API costs per agent with budget caps, spend alerts, and provider-level breakdowns. No more surprise bills.",
    color: "emerald",
    highlights: ["Per-agent cost tracking", "Monthly budget caps", "Provider cost comparison"],
  },
  {
    icon: "zap",
    title: "Kill Switch",
    subtitle: "Instant Emergency Control",
    description: "Something wrong? Instantly revoke any agent's access with one click. Full audit trail of every activation and restoration.",
    color: "red",
    highlights: ["One-click agent suspension", "Reason tracking & audit logs", "Instant access revocation"],
  },
  {
    icon: "shield",
    title: "Blast Shield",
    subtitle: "PII Protection, Built In",
    description: "Automatic PII detection and data loss prevention across all agent communications. Define custom rules for your compliance needs.",
    color: "blue",
    highlights: ["Real-time PII scanning", "Custom detection rules", "Data loss prevention"],
  },
  {
    icon: "risk",
    title: "Risk & Policy Engine",
    subtitle: "Automated Compliance",
    description: "7-factor weighted risk scoring with automated policy enforcement. Set rules, and AgentOS monitors every agent continuously.",
    color: "orange",
    highlights: ["7-factor risk scoring", "Custom policy rules", "Automated violation detection"],
  },
  {
    icon: "launch",
    title: "You're in Control",
    subtitle: "Start Governing Your AI Fleet",
    description: "Your agents are registered and ready. Activate them to start monitoring costs, enforcing policies, and maintaining compliance.",
    color: "violet",
    highlights: ["Activate agents to begin", "Set budgets & policies", "Monitor from the dashboard"],
  },
];

const COLOR_SCHEMES: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  violet: { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-400", glow: "shadow-violet-500/20" },
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", glow: "shadow-blue-500/20" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", glow: "shadow-emerald-500/20" },
  red: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", glow: "shadow-red-500/20" },
  orange: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", glow: "shadow-orange-500/20" },
};

function SlideIcon({ type, className }: { type: string; className?: string }) {
  const props = { width: 40, height: 40, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className };
  switch (type) {
    case "grid": return <svg {...props}><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>;
    case "bot": return <AgentOSLogo size={40} className={className} />;
    case "dollar": return <svg {...props}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
    case "zap": return <svg {...props}><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>;
    case "shield": return <svg {...props}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>;
    case "risk": return <svg {...props}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>;
    case "launch": return <svg {...props}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>;
    case "logo": return <AgentOSLogo size={40} className={className} />;
    default: return null;
  }
}

export default function ProductTour({ onClose }: ProductTourProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [animState, setAnimState] = useState<"enter" | "exit">("enter");
  const [autoPlay, setAutoPlay] = useState(true);

  const slide = TOUR_SLIDES[currentSlide];
  const colors = COLOR_SCHEMES[slide.color] || COLOR_SCHEMES.violet;
  const isLastSlide = currentSlide === TOUR_SLIDES.length - 1;

  const goToSlide = useCallback((index: number) => {
    if (index === currentSlide) return;
    setAnimState("exit");
    setTimeout(() => {
      setCurrentSlide(index);
      setAnimState("enter");
    }, 350);
  }, [currentSlide]);

  const nextSlide = useCallback(() => {
    if (isLastSlide) {
      onClose();
    } else {
      goToSlide(currentSlide + 1);
    }
  }, [isLastSlide, currentSlide, goToSlide, onClose]);

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) goToSlide(currentSlide - 1);
  }, [currentSlide, goToSlide]);

  useEffect(() => {
    if (!autoPlay || isLastSlide) return;
    const timer = setTimeout(() => {
      nextSlide();
    }, 5000);
    return () => clearTimeout(timer);
  }, [autoPlay, currentSlide, isLastSlide, nextSlide]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        setAutoPlay(false);
        nextSlide();
      } else if (e.key === "ArrowLeft") {
        setAutoPlay(false);
        prevSlide();
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [nextSlide, prevSlide, onClose]);

  const progressPercent = ((currentSlide + 1) / TOUR_SLIDES.length) * 100;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950"
      data-testid="product-tour"
    >
      <style>{`
        @keyframes tour-slide-enter {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes tour-slide-exit {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(-40px); }
        }
        @keyframes tour-icon-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes tour-highlight-enter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tour-ring-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes tour-progress-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .tour-enter { animation: tour-slide-enter 0.4s ease-out forwards; }
        .tour-exit { animation: tour-slide-exit 0.35s ease-in forwards; }
        .tour-icon-pulse { animation: tour-icon-pulse 3s ease-in-out infinite; }
        .tour-highlight-enter { animation: tour-highlight-enter 0.4s ease-out forwards; }
        .tour-ring { animation: tour-ring-rotate 8s linear infinite; }
        .tour-progress-bar {
          background: linear-gradient(90deg, rgba(139,92,246,0.6), rgba(139,92,246,1), rgba(139,92,246,0.6));
          background-size: 200% 100%;
          animation: tour-progress-shimmer 2s ease-in-out infinite;
        }
      `}</style>

      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <AgentOSLogo size={24} className="text-violet-400" />
          <span className="text-sm font-medium text-slate-400">Product Tour</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 text-sm transition-colors px-4 py-1.5 rounded-lg hover:bg-slate-800/50"
          data-testid="button-skip-tour"
        >
          Skip tour
        </button>
      </div>

      <div className="px-6">
        <div className="w-full max-w-2xl mx-auto h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out tour-progress-bar"
            style={{ width: `${progressPercent}%` }}
            data-testid="tour-progress"
          />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-2xl">
          <div className={`${animState === "enter" ? "tour-enter" : "tour-exit"}`}>
            <div className="text-center mb-10">
              <div className="relative inline-flex items-center justify-center mb-8">
                <div className={`absolute w-28 h-28 rounded-full border-2 border-dashed ${colors.border} opacity-30 tour-ring`} />
                <div className={`w-20 h-20 rounded-2xl ${colors.bg} border ${colors.border} flex items-center justify-center shadow-lg ${colors.glow} tour-icon-pulse`}>
                  <SlideIcon type={slide.icon} className={colors.text} />
                </div>
              </div>

              <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${colors.text}`} data-testid="tour-slide-subtitle">
                {slide.subtitle}
              </p>
              <h2 className="text-4xl font-bold text-white mb-4" data-testid="tour-slide-title">
                {slide.title}
              </h2>
              <p className="text-slate-400 text-lg max-w-lg mx-auto leading-relaxed" data-testid="tour-slide-description">
                {slide.description}
              </p>
            </div>

            <div className="flex justify-center gap-4 mb-10">
              {slide.highlights.map((h, i) => (
                <div
                  key={h}
                  className={`px-4 py-2.5 rounded-xl ${colors.bg} border ${colors.border} tour-highlight-enter`}
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <span className="text-sm text-slate-300">{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8">
        <div className="w-full max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setAutoPlay(false); prevSlide(); }}
              disabled={currentSlide === 0}
              className="px-6 py-2.5 text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              data-testid="button-tour-prev"
            >
              Back
            </button>

            <div className="flex items-center gap-2">
              {TOUR_SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setAutoPlay(false); goToSlide(i); }}
                  className={`rounded-full transition-all duration-300 ${
                    i === currentSlide
                      ? "w-8 h-2.5 bg-violet-500"
                      : i < currentSlide
                        ? "w-2.5 h-2.5 bg-violet-500/40 hover:bg-violet-500/60"
                        : "w-2.5 h-2.5 bg-slate-700 hover:bg-slate-600"
                  }`}
                  data-testid={`tour-dot-${i}`}
                />
              ))}
            </div>

            <button
              onClick={() => { setAutoPlay(false); nextSlide(); }}
              className={`px-8 py-2.5 font-medium rounded-xl transition-colors ${
                isLastSlide
                  ? "bg-violet-600 hover:bg-violet-500 text-white text-lg"
                  : "bg-violet-600 hover:bg-violet-500 text-white"
              }`}
              data-testid="button-tour-next"
            >
              {isLastSlide ? "Get Started" : "Next"}
            </button>
          </div>

          <p className="text-center text-slate-600 text-xs mt-4">
            Use arrow keys to navigate
          </p>
        </div>
      </div>
    </div>
  );
}
