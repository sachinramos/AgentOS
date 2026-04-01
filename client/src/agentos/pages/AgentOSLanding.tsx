import { useRef, useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, useInView } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Shield, DollarSign, Activity, Users, Zap,
  ArrowRight, ChevronDown, Database, Eye, Lock,
  BarChart3, Cpu, Network, Layers, GitBranch,
  Github, Copy, Check, Play, Terminal, MessageCircle, Star
} from "lucide-react";
import AgentOSLogo from "../components/AgentOSLogo";

const GITHUB_URL = "https://github.com/sachinramos/AgentOS";
const DISCORD_URL = "https://discord.gg/vbdV7YyW";
const DEMO_VIDEO: { type: "youtube" | "mp4" | "embed"; url: string } = {
  type: "youtube",
  url: "https://www.youtube-nocookie.com/embed/Sgnu2XwWniA",
};

function OctopusLogo({ variant }: { variant: "desktop" | "mobile" }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center" aria-hidden="true">
      <video
        src="/agentos-octopus-3d.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        data-testid="video-octopus-logo"
        className="w-full h-full object-contain select-none"
        draggable={false}
      />
    </div>
  );
}

function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 60 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
      transition={{ duration: 0.8, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FeatureCard({ icon: Icon, title, description, delay = 0 }: { icon: LucideIcon; title: string; description: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 40, scale: 0.95 }}
      transition={{ duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="group relative"
      data-testid={`card-feature-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 to-indigo-600/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-md hover:border-violet-300 transition-all duration-500 hover:-translate-y-1">
        <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center mb-5 group-hover:bg-violet-100 transition-colors">
          <Icon className="w-6 h-6 text-violet-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

function StepCard({ number, title, description, icon: Icon, delay = 0 }: { number: string; title: string; description: string; icon: LucideIcon; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -30 }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
      transition={{ duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="flex gap-5 md:gap-6"
      data-testid={`step-${number}`}
    >
      <div className="flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-violet-50 border border-violet-200 flex items-center justify-center">
          <span className="text-violet-600 font-bold text-lg">{number}</span>
        </div>
      </div>
      <div className="pt-1">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-5 h-5 text-violet-600" />
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        </div>
        <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

function StatCard({ value, label, delay = 0 }: { value: string; label: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-30px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.5, delay }}
      className="text-center"
      data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="text-3xl md:text-4xl font-bold text-slate-900 mb-1" data-testid={`text-stat-value-${label.toLowerCase().replace(/\s+/g, '-')}`}>{value}</div>
      <div className="text-slate-500 text-sm" data-testid={`text-stat-label-${label.toLowerCase().replace(/\s+/g, '-')}`}>{label}</div>
    </motion.div>
  );
}

interface TerminalLine {
  type: "prompt" | "command" | "output" | "blank";
  text: string;
  color?: string;
  delay: number;
}

const terminalLines: TerminalLine[] = [
  { type: "prompt", text: "$ ", delay: 0 },
  { type: "command", text: "pip install agentos", delay: 0 },
  { type: "output", text: "Successfully installed agentos-1.0.0", color: "text-green-400", delay: 1200 },
  { type: "blank", text: "", delay: 1600 },
  { type: "prompt", text: "$ ", delay: 1800 },
  { type: "command", text: "agentos onboard", delay: 1800 },
  { type: "output", text: "\u2713 Connected to AgentOS Cloud", color: "text-green-400", delay: 3000 },
  { type: "output", text: "\u2713 Organization: acme-corp registered", color: "text-green-400", delay: 3300 },
  { type: "output", text: "\u2713 3 agents discovered across 2 providers", color: "text-cyan-400", delay: 3600 },
  { type: "blank", text: "", delay: 3900 },
  { type: "prompt", text: "$ ", delay: 4100 },
  { type: "command", text: "agentos spawn hiring-agent", delay: 4100 },
  { type: "output", text: "\u26A1 Spawning hiring-agent...", color: "text-yellow-400", delay: 5300 },
  { type: "output", text: "\u2713 Agent hiring-agent is LIVE (id: ag-7f3k9)", color: "text-green-400", delay: 5800 },
  { type: "output", text: "  Provider: anthropic/claude-3.5  Budget: $50/day", color: "text-slate-400", delay: 6100 },
  { type: "output", text: "  Dashboard \u2192 https://app.agentos.dev/agents/ag-7f3k9", color: "text-violet-400", delay: 6400 },
];

const copyableCommands = "pip install agentos\nagentos onboard\nagentos spawn hiring-agent";

function AnimatedTerminal() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [typingIndex, setTypingIndex] = useState<number>(-1);
  const [currentCommandText, setCurrentCommandText] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (isInView && !started) {
      setStarted(true);
    }
  }, [isInView, started]);

  useEffect(() => {
    if (!started) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    let lineIdx = 0;

    while (lineIdx < terminalLines.length) {
      const line = terminalLines[lineIdx];

      if (line.type === "command") {
        const promptIdx = lineIdx - 1;
        const cmdStartDelay = line.delay;
        const fullText = line.text;

        timers.push(setTimeout(() => {
          setVisibleLines(promptIdx + 1);
        }, terminalLines[promptIdx]?.delay ?? 0));

        for (let charIdx = 0; charIdx <= fullText.length; charIdx++) {
          const charDelay = cmdStartDelay + charIdx * 60;
          const capturedLineIdx = lineIdx;
          timers.push(setTimeout(() => {
            setTypingIndex(capturedLineIdx);
            setCurrentCommandText(fullText.slice(0, charIdx));
          }, charDelay));
        }

        const finishDelay = cmdStartDelay + fullText.length * 60 + 50;
        const capturedLineIdx2 = lineIdx;
        timers.push(setTimeout(() => {
          setVisibleLines(capturedLineIdx2 + 1);
          setTypingIndex(-1);
          setCurrentCommandText("");
        }, finishDelay));

        lineIdx++;
      } else {
        const capturedIdx = lineIdx;
        timers.push(setTimeout(() => {
          setVisibleLines(capturedIdx + 1);
        }, line.delay));
        lineIdx++;
      }
    }

    return () => timers.forEach(clearTimeout);
  }, [started]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(copyableCommands).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      const textarea = document.createElement("textarea");
      textarea.value = copyableCommands;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
      data-testid="terminal-quickstart"
    >
      <div className="relative rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl shadow-violet-900/20">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <span className="text-xs text-slate-400 ml-2 font-mono">~/agentos-quickstart</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-all"
            data-testid="button-terminal-copy"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="bg-slate-900 p-4 md:p-6 font-mono text-sm md:text-base min-h-[320px] md:min-h-[360px]">
          {terminalLines.slice(0, visibleLines).map((line, i) => {
            if (line.type === "blank") return <div key={i} className="h-4" />;
            if (line.type === "prompt") return null;
            if (line.type === "command") {
              const promptLine = terminalLines[i - 1];
              return (
                <div key={i} className="flex">
                  <span className="text-green-400">{promptLine?.text}</span>
                  <span className="text-white">{line.text}</span>
                </div>
              );
            }
            return (
              <div key={i} className={line.color || "text-slate-300"}>
                {line.text}
              </div>
            );
          })}
          {typingIndex >= 0 && typingIndex < terminalLines.length && (
            <div className="flex">
              <span className="text-green-400">$ </span>
              <span className="text-white">{currentCommandText}</span>
              <span className="inline-block w-2 h-5 bg-white/80 ml-0.5 animate-pulse" />
            </div>
          )}
          {visibleLines >= terminalLines.length && (
            <div className="flex mt-1">
              <span className="text-green-400">$ </span>
              <span className="inline-block w-2 h-5 bg-white/80 ml-0.5 animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function DemoVideoSection() {
  const [playing, setPlaying] = useState(false);

  return (
    <section id="demo" className="relative z-10 py-20 md:py-32 px-4 md:px-8">
      <div className="max-w-5xl mx-auto">
        <AnimatedSection className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-sm mb-6">
            <Play className="w-4 h-4" />
            See It In Action
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-slate-900">
            Watch the{" "}
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              Demo
            </span>
          </h2>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            See how AgentOS gives you full visibility and control over your AI agent fleet in under 3 minutes.
          </p>
        </AnimatedSection>

        <AnimatedSection delay={0.2}>
          <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-violet-900/20 bg-black aspect-video" data-testid="section-demo-video">
            {!playing ? (
              <button
                onClick={() => setPlaying(true)}
                className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 group cursor-pointer"
                data-testid="button-play-demo"
              >
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-violet-600/90 group-hover:bg-violet-500 flex items-center justify-center transition-all group-hover:scale-110 shadow-2xl shadow-violet-600/40">
                  <Play className="w-8 h-8 md:w-10 md:h-10 text-white ml-1" fill="white" />
                </div>
                <span className="mt-4 text-white/70 text-sm font-medium group-hover:text-white/90 transition-colors">Watch Demo</span>
              </button>
            ) : DEMO_VIDEO.type === "mp4" ? (
              <video
                src={DEMO_VIDEO.url}
                controls
                autoPlay
                className="absolute inset-0 w-full h-full object-contain bg-black"
                data-testid="video-demo-mp4"
              />
            ) : (
              <iframe
                src={DEMO_VIDEO.type === "youtube"
                  ? `${DEMO_VIDEO.url}?autoplay=1&rel=0&modestbranding=1&showinfo=0&controls=1&color=white&iv_load_policy=3&playsinline=1&fs=1`
                  : DEMO_VIDEO.url}
                title="AgentOS Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                frameBorder={0}
                className="absolute inset-0 w-full h-full border-0"
                style={{ border: 'none' }}
                data-testid="iframe-demo-video"
              />
            )}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

function SocialProofStrip() {
  return (
    <section className="relative z-10 py-12 px-4 md:px-8 border-y border-slate-100">
      <AnimatedSection>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 text-center md:text-left" data-testid="section-social-proof">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center flex-shrink-0">
              <img src="/favicon.png" alt="Ziphire" className="w-6 h-6 rounded-sm" />
            </div>
            <div>
              <p className="text-slate-700 text-sm md:text-base font-medium" data-testid="text-social-proof-tagline">
                From the team behind{" "}
                <a href="/" className="font-semibold text-violet-600 hover:text-violet-700 transition-colors font-display">Ziphire</a>
              </p>
              <p className="text-slate-500 text-xs md:text-sm">
                Powering AI-driven hiring across the GCC
              </p>
            </div>
          </div>
          <div className="hidden md:block w-px h-8 bg-slate-200" />
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {["A", "Z", "M", "S"].map((letter, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 border-2 border-white flex items-center justify-center">
                  <span className="text-[10px] text-white font-bold">{letter}</span>
                </div>
              ))}
            </div>
            <p className="text-slate-500 text-xs md:text-sm">Trusted by teams shipping AI at scale</p>
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
}

export default function AgentOSLanding() {
  const [, navigate] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative bg-white text-slate-900 overflow-x-hidden min-h-screen">
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-shimmer, .animate-ping, .animate-pulse {
            animation: none !important;
          }
        }
      `}</style>

      <div className="fixed inset-0 z-0 bg-white" />

      <nav className="fixed top-0 left-0 right-0 z-50 px-4 md:px-8 py-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-7xl mx-auto flex items-center justify-between bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl px-5 py-3 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <AgentOSLogo size={28} className="text-violet-600" />
            <span className="text-lg font-bold text-slate-900">AgentOS</span>
            <a href="/" className="hidden sm:inline-flex items-center gap-1 text-xs text-violet-600 border border-violet-200 px-2.5 py-0.5 rounded-full hover:text-violet-800 hover:border-violet-400 transition-colors" data-testid="link-landing-ziphire">by <img src="/favicon.png" alt="Ziphire" className="w-3.5 h-3.5 rounded-sm" /><span className="font-display font-semibold">Ziphire</span></a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg transition-all"
              data-testid="link-nav-github"
            >
              <Github className="w-3.5 h-3.5" />
              GitHub
            </a>
            <button
              data-testid="button-landing-login"
              onClick={() => navigate("/agentos/login")}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign In
            </button>
            <button
              data-testid="button-landing-register"
              onClick={() => navigate("/agentos/register")}
              className="px-5 py-2 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-violet-600/25"
            >
              Get Started
            </button>
          </div>
        </motion.div>
      </nav>

      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 md:px-8 pt-24 overflow-visible">
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center overflow-visible">
          <div className="order-2 lg:order-1 flex flex-col items-center lg:items-start text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-sm mb-6">
                <Zap className="w-4 h-4" />
                Vendor-Neutral AI Agent Management
              </span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-slate-900"
              data-testid="text-landing-title"
            >
              The{" "}
              <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Operating System
              </span>
              <br />
              for AI Agents
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="text-lg md:text-xl text-slate-600 max-w-xl mb-8"
            >
              Register, monitor, and govern your enterprise AI agent fleet.
              One platform for payroll, performance, and compliance — across every provider.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start flex-wrap"
            >
              <button
                onClick={() => navigate("/agentos/register")}
                className="group px-8 py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold transition-all hover:shadow-xl hover:shadow-violet-600/25 flex items-center justify-center gap-2"
                data-testid="button-hero-cta"
              >
                Start Managing Agents
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group px-6 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold transition-all hover:shadow-xl hover:shadow-slate-900/25 flex items-center justify-center gap-2"
                data-testid="button-hero-github"
              >
                <Github className="w-5 h-5" />
                <Star className="w-4 h-4 group-hover:text-yellow-400 transition-colors" />
                Star on GitHub
              </a>
              <button
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl font-semibold transition-all border border-slate-200 hover:border-slate-300 flex items-center justify-center gap-2"
                data-testid="button-hero-learn"
              >
                Learn More
                <ChevronDown className="w-5 h-5" />
              </button>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="order-1 lg:order-2 relative flex items-center justify-center lg:justify-end overflow-visible"
            aria-hidden="true"
          >
            <div className="w-[350px] h-[350px] sm:w-[440px] sm:h-[440px] lg:w-[clamp(500px,calc(100vh-10rem),750px)] lg:h-[clamp(500px,calc(100vh-10rem),750px)] xl:w-[clamp(550px,calc(100vh-8rem),850px)] xl:h-[clamp(550px,calc(100vh-8rem),850px)]" data-testid="octopus-float-wrapper">
              <OctopusLogo variant="desktop" />
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
            <ChevronDown className="w-6 h-6 text-slate-400" />
          </motion.div>
        </motion.div>
      </section>

      <section className="relative z-10 py-20 px-4 md:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            <StatCard value="100%" label="Vendor Neutral" delay={0} />
            <StatCard value="<5ms" label="Decision Latency" delay={0.1} />
            <StatCard value="24/7" label="Agent Monitoring" delay={0.2} />
            <StatCard value="SOC2" label="Compliance Ready" delay={0.3} />
          </div>
        </div>
      </section>

      <section className="relative z-10 py-16 px-4 md:px-8" data-testid="section-dashboard-preview">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
              See it in action
            </h2>
            <p className="text-slate-500">Your command center for every AI agent in the organisation</p>
          </AnimatedSection>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/20 border border-slate-200"
          >
            <img
              src="/docs/screenshots/hero.png"
              alt="AgentOS Dashboard — Command Center with real-time KPIs"
              className="w-full"
              loading="lazy"
              data-testid="img-dashboard-preview"
            />
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {[
              { src: "/docs/screenshots/agent-directory.png", alt: "Agent Directory", label: "Agent Directory" },
              { src: "/docs/screenshots/compliance.png", alt: "Compliance Dashboard", label: "Compliance" },
              { src: "/docs/screenshots/workforce-report.png", alt: "AI Workforce Report", label: "Workforce Report" },
            ].map((item) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="rounded-xl overflow-hidden border border-slate-200 shadow-md hover:shadow-lg transition-shadow"
              >
                <img src={item.src} alt={item.alt} className="w-full" loading="lazy" data-testid={`img-preview-${item.label.toLowerCase().replace(/ /g, "-")}`} />
                <div className="px-3 py-2 bg-white border-t border-slate-100">
                  <span className="text-xs font-medium text-slate-500">{item.label}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-20 md:py-32 px-4 md:px-8 bg-slate-50/50" data-testid="section-quickstart">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-sm mb-6">
              <Terminal className="w-4 h-4" />
              Quick Start
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-slate-900">
              Up and running in{" "}
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                seconds
              </span>
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              Install the CLI, connect your org, and spawn your first managed agent — all from your terminal.
            </p>
          </AnimatedSection>

          <div className="max-w-3xl mx-auto">
            <AnimatedTerminal />
          </div>
        </div>
      </section>

      <section id="features" className="relative z-10 py-20 md:py-32 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-sm mb-6">
              <Layers className="w-4 h-4" />
              Core Capabilities
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-slate-900">
              Everything you need to
              <br />
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                manage AI at scale
              </span>
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              From onboarding to retirement, AgentOS gives you complete visibility and control over every AI agent in your organization.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            <FeatureCard icon={Database} title="Agent Registry" description="Onboard, catalog, and lifecycle-manage every AI agent. Track providers, versions, and capabilities in one unified directory." delay={0} />
            <FeatureCard icon={DollarSign} title="Token Payroll" description="Metered cost tracking per agent. See per-token spend, set budget caps, get alerts before costs spiral. Compare providers instantly." delay={0.1} />
            <FeatureCard icon={BarChart3} title="Performance Scorecard" description="Measure success rates, latency, accuracy, and human ratings. Certify agents that meet your quality bar. Suspend those that don't." delay={0.2} />
            <FeatureCard icon={Shield} title="Governance & Kill Switch" description="Instant shutdown for misbehaving agents. Blast radius containment, drift detection, and shadow-AI surveillance built in." delay={0.3} />
            <FeatureCard icon={Eye} title="Reasoning Traces" description="Full transparency into how every agent reached its decision. Audit trails for compliance teams and regulators." delay={0.4} />
            <FeatureCard icon={Activity} title="Drift Alerts" description="Real-time monitoring for behavioral drift, hallucination spikes, and cost anomalies. Catch problems before users do." delay={0.5} />
          </div>
        </div>
      </section>

      <DemoVideoSection />

      <section className="relative z-10 py-20 md:py-32 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <AnimatedSection>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-sm mb-6">
                <GitBranch className="w-4 h-4" />
                How It Works
              </span>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
                From zero to{" "}
                <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                  full fleet control
                </span>
              </h2>
              <p className="text-slate-600 text-lg">
                Get your AI agent fleet managed and governed in four simple steps.
              </p>
            </AnimatedSection>

            <div className="space-y-8">
              <StepCard number="1" icon={Users} title="Register Your Organization" description="Create your workspace. Invite team members with role-based access: admins, managers, and viewers." delay={0.1} />
              <StepCard number="2" icon={Cpu} title="Onboard Your Agents" description="Register agents from any provider — OpenAI, Anthropic, Google, custom models. Assign departments, owners, and budgets." delay={0.2} />
              <StepCard number="3" icon={Network} title="Connect Telemetry" description="Plug in our lightweight SDK to stream usage data. Costs, latencies, and outcomes flow in automatically." delay={0.3} />
              <StepCard number="4" icon={Lock} title="Govern & Optimize" description="Set policies, review traces, compare providers. Kill underperformers. Promote your best agents." delay={0.4} />
            </div>
          </div>
        </div>
      </section>

      <SocialProofStrip />

      <section className="relative z-10 py-20 md:py-32 px-4 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <AnimatedSection>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-200/30 via-indigo-200/30 to-violet-200/30 rounded-3xl blur-2xl" />
              <div className="relative bg-violet-50 border border-violet-200 rounded-3xl p-8 md:p-16">
                <h2 className="text-3xl md:text-5xl font-bold mb-4 text-slate-900" data-testid="text-cta-title">
                  Ready to take control of
                  <br />
                  <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                    your AI fleet?
                  </span>
                </h2>
                <p className="text-slate-600 text-lg max-w-xl mx-auto mb-8">
                  Join forward-thinking enterprises that manage their AI agents with confidence, transparency, and control.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
                  <button
                    onClick={() => navigate("/agentos/register")}
                    className="group px-8 py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold transition-all hover:shadow-xl hover:shadow-violet-600/25 flex items-center justify-center gap-2"
                    data-testid="button-cta-register"
                  >
                    Get Started Free
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <a
                    href={DISCORD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all hover:shadow-xl hover:shadow-indigo-600/25 flex items-center justify-center gap-2"
                    data-testid="button-cta-discord"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Join the Community
                  </a>
                  <button
                    onClick={() => navigate("/agentos/login")}
                    className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-900 rounded-xl font-semibold transition-all border border-slate-200 hover:border-slate-300"
                    data-testid="button-cta-login"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <footer className="relative z-10 py-8 px-4 md:px-8 border-t border-slate-200" data-testid="footer-landing">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AgentOSLogo size={20} className="text-violet-600" />
            <span className="text-sm text-slate-500 flex items-center gap-1.5" data-testid="text-footer-brand">AgentOS by <a href="/" className="inline-flex items-center gap-1 hover:text-violet-600 transition-colors"><img src="/favicon.png" alt="Ziphire" className="w-4 h-4 rounded-sm" /><span className="font-display font-semibold">Ziphire</span></a></span>
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-center md:justify-end">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5"
              data-testid="link-footer-github"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5"
              data-testid="link-footer-discord"
            >
              <MessageCircle className="w-4 h-4" />
              Community
            </a>
            <p className="text-sm text-slate-400">
              &copy; {new Date().getFullYear()} Ziphire. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
