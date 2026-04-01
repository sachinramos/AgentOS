import { useState, useEffect } from "react";
import { aosApi } from "../lib/api";
import { useAosTheme } from "../AgentOSApp";

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: "Admin", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  manager: { label: "Manager", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  viewer: { label: "Viewer", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
};

interface AosTeamUser { id: string; name: string; email: string; role: string; isActive: boolean; lastLoginAt: string | null; createdAt: string; }

export default function UserManagement() {
  const [users, setUsers] = useState<AosTeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "viewer", password: "" });
  const [inviteError, setInviteError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const { theme } = useAosTheme();
  const isDark = theme === "dark";

  const fetchUsers = async () => { try { const data = await aosApi.getUsers(); setUsers(data as AosTeamUser[]); } catch (err) { console.error(err); } finally { setLoading(false); } };
  useEffect(() => { fetchUsers(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault(); setInviteError(""); setInviteLoading(true);
    try { await aosApi.inviteUser(inviteForm); setShowInvite(false); setInviteForm({ name: "", email: "", role: "viewer", password: "" }); fetchUsers(); }
    catch (err) { setInviteError(err instanceof Error ? err.message : "Failed to invite"); } finally { setInviteLoading(false); }
  };

  const handleRoleChange = async (userId: string, role: string) => { try { await aosApi.updateUser(userId, { role }); fetchUsers(); } catch (err) { alert(err instanceof Error ? err.message : "Failed to update role"); } };
  const handleToggleActive = async (userId: string, isActive: boolean) => { try { await aosApi.updateUser(userId, { isActive: !isActive }); fetchUsers(); } catch (err) { alert(err instanceof Error ? err.message : "Failed to toggle status"); } };

  if (loading) { return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>; }

  const panelCls = `border rounded-xl ${isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-white border-gray-200"}`;
  const titleCls = isDark ? "text-white" : "text-gray-900";
  const subtitleCls = isDark ? "text-slate-400" : "text-gray-500";
  const mutedCls = isDark ? "text-slate-500" : "text-gray-400";
  const borderCls = isDark ? "border-slate-700/50" : "border-gray-200";
  const rowBorderCls = isDark ? "border-slate-700/30" : "border-gray-100";
  const hoverCls = isDark ? "hover:bg-slate-800/30" : "hover:bg-gray-50";
  const inputCls = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${isDark ? "bg-slate-800/50 border-slate-700 text-white" : "bg-white border-gray-300 text-gray-900"}`;
  const modalCls = isDark ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200";
  const labelCls = `block text-sm mb-1 ${isDark ? "text-slate-300" : "text-gray-700"}`;

  return (
    <div className="space-y-6" data-testid="user-management-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${titleCls}`} data-testid="text-users-title">Team Management</h1>
          <p className={`mt-1 ${subtitleCls}`}>{users.length} team member{users.length !== 1 ? "s" : ""}</p>
        </div>
        <button data-testid="button-invite-user" onClick={() => setShowInvite(true)}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
          Invite Member
        </button>
      </div>

      <div className={`${panelCls} overflow-hidden`}>
        <table className="w-full">
          <thead>
            <tr className={`border-b ${borderCls}`}>
              <th className={`text-left px-5 py-3 text-sm font-medium ${subtitleCls}`}>Name</th>
              <th className={`text-left px-5 py-3 text-sm font-medium ${subtitleCls}`}>Email</th>
              <th className={`text-left px-5 py-3 text-sm font-medium ${subtitleCls}`}>Role</th>
              <th className={`text-left px-5 py-3 text-sm font-medium ${subtitleCls}`}>Status</th>
              <th className={`text-left px-5 py-3 text-sm font-medium ${subtitleCls}`}>Last Login</th>
              <th className={`text-right px-5 py-3 text-sm font-medium ${subtitleCls}`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const roleInfo = ROLE_LABELS[user.role] || ROLE_LABELS.viewer;
              return (
                <tr key={user.id} className={`border-b ${rowBorderCls} last:border-0 ${hoverCls}`} data-testid={`row-user-${user.id}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 text-xs font-bold">{user.name.charAt(0)}</div>
                      <span className={`font-medium text-sm ${titleCls}`}>{user.name}</span>
                    </div>
                  </td>
                  <td className={`px-5 py-3 text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`}>{user.email}</td>
                  <td className="px-5 py-3">
                    <select data-testid={`select-role-${user.id}`} value={user.role} onChange={e => handleRoleChange(user.id, e.target.value)}
                      className={`text-xs px-2 py-1 border rounded focus:outline-none ${isDark ? "bg-slate-800/50 border-slate-700 text-white" : "bg-white border-gray-300 text-gray-900"}`}>
                      <option value="admin">Admin</option><option value="manager">Manager</option><option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${user.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{user.isActive ? "Active" : "Disabled"}</span>
                  </td>
                  <td className={`px-5 py-3 text-sm ${subtitleCls}`}>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}</td>
                  <td className="px-5 py-3 text-right">
                    <button data-testid={`button-toggle-${user.id}`} onClick={() => handleToggleActive(user.id, user.isActive)}
                      className={`text-xs px-3 py-1 rounded transition-colors ${user.isActive ? "text-red-400 hover:bg-red-500/10" : "text-emerald-400 hover:bg-emerald-500/10"}`}>
                      {user.isActive ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={`${panelCls} p-5`}>
        <h3 className={`font-semibold mb-3 ${titleCls}`}>Role Permissions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-4 border border-violet-500/20 rounded-lg ${isDark ? "bg-slate-800/50" : "bg-violet-50"}`}>
            <h4 className="text-violet-400 font-medium text-sm mb-2">Admin</h4>
            <ul className={`text-xs space-y-1 ${isDark ? "text-slate-300" : "text-gray-600"}`}><li>Full agent management</li><li>User management & invites</li><li>View audit logs</li><li>Company settings</li></ul>
          </div>
          <div className={`p-4 border border-blue-500/20 rounded-lg ${isDark ? "bg-slate-800/50" : "bg-blue-50"}`}>
            <h4 className="text-blue-400 font-medium text-sm mb-2">Manager</h4>
            <ul className={`text-xs space-y-1 ${isDark ? "text-slate-300" : "text-gray-600"}`}><li>Manage own agents</li><li>Create & edit agents</li><li>Status transitions (own)</li><li>View directory</li></ul>
          </div>
          <div className={`p-4 border rounded-lg ${isDark ? "bg-slate-800/50 border-slate-500/20" : "bg-gray-50 border-gray-200"}`}>
            <h4 className={`font-medium text-sm mb-2 ${subtitleCls}`}>Viewer</h4>
            <ul className={`text-xs space-y-1 ${isDark ? "text-slate-300" : "text-gray-600"}`}><li>View dashboard</li><li>Browse agent directory</li><li>View agent details</li><li>Read-only access</li></ul>
          </div>
        </div>
      </div>

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`border rounded-xl w-full max-w-md p-6 ${modalCls}`}>
            <h2 className={`text-lg font-semibold mb-4 ${titleCls}`}>Invite Team Member</h2>
            <form onSubmit={handleInvite} className="space-y-4">
              {inviteError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm">{inviteError}</div>}
              <div><label className={labelCls}>Name *</label><input data-testid="input-invite-name" value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))} className={inputCls} required /></div>
              <div><label className={labelCls}>Email *</label><input data-testid="input-invite-email" type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} className={inputCls} required /></div>
              <div><label className={labelCls}>Password *</label><input data-testid="input-invite-password" type="password" value={inviteForm.password} onChange={e => setInviteForm(f => ({ ...f, password: e.target.value }))} className={inputCls} required minLength={8} /></div>
              <div><label className={labelCls}>Role</label><select data-testid="select-invite-role" value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))} className={inputCls}><option value="admin">Admin</option><option value="manager">Manager</option><option value="viewer">Viewer</option></select></div>
              <div className="flex gap-3">
                <button data-testid="button-cancel-invite" type="button" onClick={() => setShowInvite(false)} className={`flex-1 py-2 rounded-lg transition-colors ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}>Cancel</button>
                <button data-testid="button-submit-invite" type="submit" disabled={inviteLoading} className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">{inviteLoading ? "Inviting..." : "Send Invite"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
