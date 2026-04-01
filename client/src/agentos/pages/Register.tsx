import { useState } from "react";
import { useLocation } from "wouter";
import { aosApi } from "../lib/api";
import AgentOSLogo from "../components/AgentOSLogo";

export default function Register() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ companyName: "", adminName: "", email: "", password: "", industry: "", country: "", website: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [peopleosLinked, setPeopleosLinked] = useState<{ linked: boolean; companyName: string | null; lookupFailed: boolean } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await aosApi.register(form);
      localStorage.setItem("aos_token", data.token);
      if (data.peopleosLinked) {
        setPeopleosLinked({ linked: true, companyName: data.peopleosCompanyName, lookupFailed: false });
        setTimeout(() => navigate("/agentos/dashboard"), 3000);
      } else if (data.peopleosLookupFailed) {
        setPeopleosLinked({ linked: false, companyName: null, lookupFailed: true });
        setTimeout(() => navigate("/agentos/dashboard"), 5000);
      } else {
        navigate("/agentos/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  if (peopleosLinked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 py-12 relative">
        <button
          data-testid="button-back-success"
          onClick={() => navigate("/agentos")}
          className="absolute top-6 left-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-800/50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </button>
        <div className="w-full max-w-lg p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              peopleosLinked.linked
                ? "bg-emerald-500/20 border border-emerald-500/30"
                : "bg-violet-500/20 border border-violet-500/30"
            }`}>
              {peopleosLinked.linked ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              )}
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2" data-testid="text-register-success">Account Created Successfully</h1>

          {peopleosLinked.linked ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-5 py-4 mb-4" data-testid="text-peopleos-linked">
              <div className="flex items-center justify-center gap-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span className="text-emerald-300 font-medium">PeopleOS Account Detected</span>
              </div>
              <p className="text-slate-300 text-sm">
                Your PeopleOS account{peopleosLinked.companyName ? ` (${peopleosLinked.companyName})` : ""} has been linked. During setup, you'll be able to import your active HR AI agents.
              </p>
            </div>
          ) : peopleosLinked.lookupFailed ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 mb-4" data-testid="text-peopleos-lookup-failed">
              <div className="flex items-center justify-center gap-2 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="text-amber-300 font-medium">PeopleOS Lookup Unavailable</span>
              </div>
              <p className="text-slate-300 text-sm">
                We couldn't verify your PeopleOS account at this time. If you have a PeopleOS account, you can link it later from Settings.
              </p>
            </div>
          ) : null}

          <p className="text-slate-500 text-sm">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 py-12 relative">
      <button
        data-testid="button-back"
        onClick={() => navigate("/agentos")}
        className="absolute top-6 left-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-800/50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        <span className="text-sm font-medium">Back</span>
      </button>
      <div className="w-full max-w-lg p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <button onClick={() => navigate("/agentos")} className="cursor-pointer" data-testid="link-logo-home">
              <AgentOSLogo size={48} className="text-violet-400" />
            </button>
          </div>
          <h1 className="text-2xl font-bold text-white" data-testid="text-register-title">Create AgentOS Account</h1>
          <p className="text-slate-400 mt-1">Register your organization to manage AI agents</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm" data-testid="text-register-error">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Organization Name *</label>
              <input data-testid="input-company-name" value={form.companyName} onChange={update("companyName")} className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50" placeholder="Acme Corp" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Your Name *</label>
              <input data-testid="input-admin-name" value={form.adminName} onChange={update("adminName")} className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50" placeholder="John Doe" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email *</label>
            <input data-testid="input-email" type="email" value={form.email} onChange={update("email")} className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50" placeholder="you@company.com" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password *</label>
            <input data-testid="input-password" type="password" value={form.password} onChange={update("password")} className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50" placeholder="Min 8 characters" required minLength={8} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Industry</label>
              <select data-testid="input-industry" value={form.industry} onChange={update("industry")} className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50">
                <option value="">Select...</option>
                <option value="Technology">Technology</option>
                <option value="Finance">Finance</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Retail">Retail</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Country</label>
              <input data-testid="input-country" value={form.country} onChange={update("country")} className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50" placeholder="e.g. United States" />
            </div>
          </div>

          <button data-testid="button-register" type="submit" disabled={loading} className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-slate-400 text-sm mt-6">
          Already have an account?{" "}
          <button data-testid="link-login" onClick={() => navigate("/agentos/login")} className="text-violet-400 hover:text-violet-300">Sign in</button>
        </p>
      </div>
    </div>
  );
}
