import { useState, useEffect, useMemo, createContext, useContext, Suspense, lazy } from "react";
import { Switch, Route, useLocation } from "wouter";
import { useDynamicFavicon } from "../hooks/useDynamicFavicon";
import { aosApi } from "./lib/api";
import AgentOSLogo from "./components/AgentOSLogo";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AgentDirectory from "./pages/AgentDirectory";
import AgentDetail from "./pages/AgentDetail";
import UserManagement from "./pages/UserManagement";
import Payroll from "./pages/Payroll";
import ArbitrageCalculator from "./pages/ArbitrageCalculator";
import Scorecard from "./pages/Scorecard";
import Benchmarking from "./pages/Benchmarking";
import Settings from "./pages/Settings";
import Governance from "./pages/Governance";
import BlastShield from "./pages/BlastShield";
import ReasoningTraces from "./pages/ReasoningTraces";
import DriftAlerts from "./pages/DriftAlerts";
import ShadowAI from "./pages/ShadowAI";
import ComplianceDashboard from "./pages/ComplianceDashboard";
import OrgChart from "./pages/OrgChart";
import OnboardingWizard from "./pages/OnboardingWizard";
import ProductTour from "./pages/ProductTour";
import RiskPolicies from "./pages/RiskPolicies";
import WorkforceReport from "./pages/WorkforceReport";
import AdminPanel from "./pages/AdminPanel";
import PlatformLogin from "./pages/platform/PlatformLogin";
import PlatformAdminLayout from "./pages/platform/PlatformAdminLayout";

const AgentOSLanding = lazy(() => import("./pages/AgentOSLanding"));

export type AosTheme = "dark" | "light";
export const AosThemeContext = createContext<{ theme: AosTheme; toggleTheme: () => void }>({ theme: "dark", toggleTheme: () => {} });
export function useAosTheme() { return useContext(AosThemeContext); }

interface AosUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
}

interface AosCompany {
  id: string;
  name: string;
  logoUrl: string | null;
  hasCompletedOnboarding: boolean;
  peopleosLinked?: boolean;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NavItem {
  key: string;
  label: string;
  icon: string;
  section: "main" | "governance";
  adminOnly?: boolean;
  managerUp?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "grid", section: "main" },
  { key: "agents", label: "Agent Directory", icon: "bot", section: "main" },
  { key: "org-chart", label: "Org Chart", icon: "org-chart", section: "main" },
  { key: "payroll", label: "Payroll", icon: "dollar", section: "main" },
  { key: "arbitrage", label: "Arbitrage", icon: "scale", section: "main" },
  { key: "scorecard", label: "Scorecard", icon: "chart", section: "main" },
  { key: "benchmarking", label: "Benchmarking", icon: "bar-chart", section: "main" },
  { key: "workforce-report", label: "AI Workforce", icon: "report", section: "main" },
  { key: "team", label: "Team", icon: "users", section: "main", adminOnly: true },
  { key: "settings", label: "Settings", icon: "settings", section: "main" },
  { key: "admin", label: "Admin Panel", icon: "admin", section: "governance", adminOnly: true },
  { key: "risk-policies", label: "Risk & Policies", icon: "risk", section: "governance", adminOnly: true },
  { key: "compliance", label: "Compliance", icon: "shield", section: "governance", adminOnly: true },
  { key: "governance", label: "Kill Switch", icon: "zap", section: "governance", adminOnly: true },
  { key: "blast-shield", label: "Blast Shield", icon: "eye", section: "governance", managerUp: true },
  { key: "traces", label: "Traces", icon: "timeline", section: "governance" },
  { key: "drift-alerts", label: "Drift Alerts", icon: "alert", section: "governance" },
  { key: "shadow-ai", label: "Shadow AI", icon: "search", section: "governance", managerUp: true },
];

function NavIcon({ type, className }: { type: string; className?: string }) {
  const props = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className };
  switch (type) {
    case "grid": return <svg {...props}><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>;
    case "bot": return <AgentOSLogo size={18} className={className} />;
    case "users": return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "dollar": return <svg {...props}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
    case "scale": return <svg {...props}><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>;
    case "chart": return <svg {...props}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
    case "bar-chart": return <svg {...props}><rect width="4" height="12" x="1" y="8"/><rect width="4" height="18" x="7" y="2"/><rect width="4" height="8" x="13" y="12"/><rect width="4" height="14" x="19" y="6"/></svg>;
    case "settings": return <svg {...props}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
    case "shield": return <svg {...props}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>;
    case "zap": return <svg {...props}><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>;
    case "eye": return <svg {...props}><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>;
    case "timeline": return <svg {...props}><path d="M12 3v17.4"/><path d="m4 11 4-4 4 4"/><path d="m16 7 4 4-4 4"/><rect width="4" height="6" x="2" y="9" rx="1"/><rect width="4" height="6" x="18" y="9" rx="1"/></svg>;
    case "alert": return <svg {...props}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case "search": return <svg {...props}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
    case "org-chart": return <svg {...props}><circle cx="12" cy="4" r="2"/><path d="M12 6v4"/><path d="M6 14v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/><circle cx="6" cy="16" r="2"/><circle cx="12" cy="16" r="2"/><circle cx="18" cy="16" r="2"/></svg>;
    case "bell": return <svg {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>;
    case "risk": return <svg {...props}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>;
    case "report": return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
    case "admin": return <svg {...props}><path d="M12 2 L3 7 v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7Z"/><path d="M9 12l2 2 4-4"/></svg>;
    default: return null;
  }
}

function AdminGuard({ role, children }: { role: string; children: React.ReactNode }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    if (role !== "admin") navigate("/agentos/dashboard");
  }, [role, navigate]);
  if (role !== "admin") return null;
  return <>{children}</>;
}

function AuthenticatedLayout() {
  const [location, navigate] = useLocation();
  const [user, setUser] = useState<AosUser | null>(null);
  const [company, setCompany] = useState<AosCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProductTour, setShowProductTour] = useState(false);
  const [theme, setTheme] = useState<AosTheme>(() => {
    return (localStorage.getItem("aos_theme") as AosTheme) || "dark";
  });

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("aos_theme", next);
      return next;
    });
  };

  useEffect(() => {
    const token = localStorage.getItem("aos_token");
    if (!token) {
      navigate("/agentos/login");
      return;
    }
    aosApi.me()
      .then((data) => { setUser(data.user); setCompany(data.company); })
      .catch(() => { localStorage.removeItem("aos_token"); navigate("/agentos/login"); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchNotifications = () => {
      aosApi.getNotifications(true)
        .then((data: Notification[]) => setNotifications(data || []))
        .catch(() => {});
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleMarkAllRead = async () => {
    try {
      await aosApi.markAllNotificationsRead();
      setNotifications([]);
      setShowNotifications(false);
    } catch {}
  };

  const handleLogout = async () => {
    try { await aosApi.logout(); } catch {}
    localStorage.removeItem("aos_token");
    navigate("/agentos/login");
  };

  const handleNavigate = (page: string) => {
    navigate(`/agentos/${page}`);
  };

  const activePage = useMemo(() => {
    const path = location.replace("/agentos/", "").split("/")[0];
    return path || "dashboard";
  }, [location]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading AgentOS...</p>
        </div>
      </div>
    );
  }

  if (!user || !company) return null;

  if (!company.hasCompletedOnboarding) {
    return (
      <OnboardingWizard
        companyName={company.name}
        peopleosLinked={!!company.peopleosLinked}
        onComplete={() => {
          setCompany({ ...company, hasCompletedOnboarding: true });
          const hasSeenTour = localStorage.getItem("aos_product_tour_seen");
          if (!hasSeenTour) {
            setShowProductTour(true);
          }
          navigate("/agentos/dashboard");
        }}
      />
    );
  }

  if (showProductTour) {
    return (
      <ProductTour
        onClose={() => {
          setShowProductTour(false);
          localStorage.setItem("aos_product_tour_seen", "1");
        }}
      />
    );
  }

  const isDark = theme === "dark";
  const unreadCount = notifications.length;

  const isAdminOrManager = user.role === "admin" || user.role === "manager";
  const mainItems = NAV_ITEMS.filter(i => i.section === "main" && (!i.adminOnly || user.role === "admin"));
  const govItems = NAV_ITEMS.filter(i => i.section === "governance" && (!i.adminOnly || user.role === "admin") && (!i.managerUp || isAdminOrManager));

  return (
    <AosThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={`min-h-screen flex ${isDark ? "bg-slate-950 text-white" : "bg-gray-50 text-gray-900"}`}>
        <aside className={`${sidebarCollapsed ? "w-16" : "w-56"} transition-all duration-200 flex flex-col border-r ${isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-gray-200"}`}>
          <div className="p-4 flex items-center gap-3">
            <AgentOSLogo size={28} className="text-violet-400 flex-shrink-0" />
            {!sidebarCollapsed && <span className="font-semibold text-sm" data-testid="text-sidebar-title">AgentOS</span>}
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} className={`ml-auto p-1.5 rounded text-xs flex-shrink-0 ${isDark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`} data-testid="button-toggle-sidebar">
              {sidebarCollapsed ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              )}
            </button>
          </div>

          <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
            {mainItems.map(item => {
              const isActive = activePage === item.key || (item.key === "agents" && location.includes("/agents"));
              return (
                <button
                  key={item.key}
                  data-testid={`nav-${item.key}`}
                  onClick={() => handleNavigate(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? isDark ? "bg-violet-600/20 text-violet-400" : "bg-violet-50 text-violet-600"
                      : isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <NavIcon type={item.icon} />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}

            {!sidebarCollapsed && (
              <div className={`pt-3 mt-3 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                <p className={`px-3 text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-slate-600" : "text-slate-400"}`}>Governance</p>
              </div>
            )}
            {sidebarCollapsed && <div className={`my-2 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`} />}

            {govItems.map(item => {
              const isActive = activePage === item.key;
              return (
                <button
                  key={item.key}
                  data-testid={`nav-${item.key}`}
                  onClick={() => handleNavigate(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? isDark ? "bg-violet-600/20 text-violet-400" : "bg-violet-50 text-violet-600"
                      : isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <NavIcon type={item.icon} />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>
          <div className={`p-3 border-t ${isDark ? "border-slate-800" : "border-gray-200"}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{user.name}</p>
                  <p className={`text-[10px] truncate ${isDark ? "text-slate-500" : "text-gray-400"}`}>{company.name}</p>
                </div>
              )}
            </div>
            <div className="flex gap-1">
              <button onClick={toggleTheme} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"} title={isDark ? "Switch to light mode" : "Switch to dark mode"} className={`flex-1 p-1.5 rounded text-xs flex items-center justify-center gap-1 ${isDark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`} data-testid="button-toggle-theme">
                {isDark ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                )}
                {!sidebarCollapsed && (isDark ? "Light" : "Dark")}
              </button>
              <button onClick={handleLogout} aria-label="Logout" title="Logout" className={`flex-1 p-1.5 rounded text-xs flex items-center justify-center gap-1 ${isDark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`} data-testid="button-logout">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                {!sidebarCollapsed && "Logout"}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className={`h-14 shrink-0 flex items-center justify-between px-6 border-b ${isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200"}`}>
            <div>
              <span className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}>{company.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  data-testid="button-notifications"
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}
                >
                  <NavIcon type="bell" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold" data-testid="text-notification-count">{unreadCount > 9 ? "9+" : unreadCount}</span>
                  )}
                </button>
                {showNotifications && (
                  <div className={`absolute right-0 top-10 w-80 rounded-xl border shadow-xl z-50 ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200"}`}>
                    <div className={`flex items-center justify-between p-3 border-b ${isDark ? "border-slate-700/50" : "border-gray-200"}`}>
                      <span className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>Notifications</span>
                      {unreadCount > 0 && (
                        <button data-testid="button-mark-all-read" onClick={handleMarkAllRead} className="text-violet-400 text-xs hover:text-violet-300">Mark all read</button>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length > 0 ? notifications.map(n => (
                        <div key={n.id} className={`p-3 border-b last:border-0 ${isDark ? "border-slate-700/30" : "border-gray-100"}`} data-testid={`notification-${n.id}`}>
                          <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{n.title}</p>
                          <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-gray-500"}`}>{n.message}</p>
                          <p className={`text-xs mt-1 ${isDark ? "text-slate-600" : "text-gray-400"}`}>{new Date(n.createdAt).toLocaleString()}</p>
                        </div>
                      )) : (
                        <p className="p-4 text-slate-500 text-sm text-center">No unread notifications</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">
            <Switch>
              <Route path="/agentos/dashboard">
                <Dashboard onNavigate={handleNavigate} />
              </Route>
              <Route path="/agentos/agents/:id">
                {(params) => <AgentDetail params={params} onNavigate={handleNavigate} />}
              </Route>
              <Route path="/agentos/agents">
                <AgentDirectory onNavigate={handleNavigate} userRole={user.role} />
              </Route>
              <Route path="/agentos/org-chart">
                <OrgChart onNavigate={handleNavigate} companyName={company.name} />
              </Route>
              <Route path="/agentos/payroll">
                <Payroll />
              </Route>
              <Route path="/agentos/arbitrage">
                <ArbitrageCalculator />
              </Route>
              <Route path="/agentos/scorecard">
                <Scorecard />
              </Route>
              <Route path="/agentos/benchmarking">
                <Benchmarking />
              </Route>
              <Route path="/agentos/workforce-report">
                <WorkforceReport />
              </Route>
              <Route path="/agentos/team">
                {user.role === "admin" ? <UserManagement /> : <Dashboard onNavigate={handleNavigate} />}
              </Route>
              <Route path="/agentos/admin">
                <AdminGuard role={user.role}><AdminPanel onNavigate={handleNavigate} /></AdminGuard>
              </Route>
              <Route path="/agentos/settings">
                <Settings onShowProductTour={() => setShowProductTour(true)} />
              </Route>
              <Route path="/agentos/risk-policies">
                <RiskPolicies onNavigate={handleNavigate} />
              </Route>
              <Route path="/agentos/compliance">
                <ComplianceDashboard onNavigate={handleNavigate} />
              </Route>
              <Route path="/agentos/governance">
                <Governance onNavigate={handleNavigate} />
              </Route>
              <Route path="/agentos/blast-shield">
                <BlastShield />
              </Route>
              <Route path="/agentos/traces">
                <ReasoningTraces />
              </Route>
              <Route path="/agentos/drift-alerts">
                <DriftAlerts />
              </Route>
              <Route path="/agentos/shadow-ai">
                <ShadowAI />
              </Route>
              <Route>
                <Dashboard onNavigate={handleNavigate} />
              </Route>
            </Switch>
          </main>
        </div>
      </div>
    </AosThemeContext.Provider>
  );
}

function Landing() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse">
          <AgentOSLogo size={48} className="text-violet-400" />
        </div>
      </div>
    }>
      <AgentOSLanding />
    </Suspense>
  );
}

export default function AgentOSApp() {
  const [location] = useLocation();
  useDynamicFavicon("agentos");

  if (location === "/agentos") return <Landing />;
  if (location === "/agentos/login") return <Login />;
  if (location === "/agentos/register") return <Register />;
  if (location === "/agentos/platform/login") return <PlatformLogin />;
  if (location.startsWith("/agentos/platform/admin")) return <PlatformAdminLayout />;

  return <AuthenticatedLayout />;
}
