import React from 'react';
import { Outlet, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, Receipt, CreditCard, LogOut, User as UserIcon } from 'lucide-react';

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const { groupId } = useParams();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
  };

  const navItems = [
    { to: '/groups', label: 'Groups', icon: Users },
  ];

  // If a group is active, display group-specific navigation tabs in the sidebar for quick switching
  const groupNavItems = groupId ? [
    { to: `/groups/${groupId}`, label: 'Group Expenses', icon: Receipt, end: true },
    { to: `/groups/${groupId}/balances`, label: 'Group Balances', icon: LayoutDashboard },
    { to: `/groups/${groupId}/settlements`, label: 'Group Settlements', icon: CreditCard },
  ] : [];

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800">
        {/* Brand */}
        <div className="h-16 flex items-center gap-2 px-6 border-b border-slate-800 cursor-pointer" onClick={() => navigate('/groups')}>
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold text-lg">
            💸
          </div>
          <span className="font-display font-bold text-xl text-white tracking-wide">SharedSplit</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-6">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-3">Main</div>
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-brand-600 text-white shadow-md shadow-brand-600/10'
                          : 'hover:bg-slate-800 hover:text-white'
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          {groupId && (
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-3">Active Group</div>
              <ul className="space-y-1">
                {groupNavItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-slate-800 text-white border-l-4 border-brand-500 rounded-l-none pl-2'
                            : 'hover:bg-slate-800 hover:text-white'
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        {/* User profile section at the bottom */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center font-bold">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white truncate">{user?.name}</div>
              <div className="text-xs text-slate-500 truncate">{user?.email}</div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Welcome back, <span className="text-brand-600">{user?.name}</span>
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-600">{user?.name}</span>
            </div>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 overflow-y-auto p-8 max-w-6xl w-full mx-auto animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
export { Layout };
