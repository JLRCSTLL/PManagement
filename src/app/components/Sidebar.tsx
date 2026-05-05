import React from 'react';
import { Link, useLocation } from 'react-router';
import { CalendarDays, CheckSquare, Folder, LayoutDashboard, Settings, Shield, Target, Users, Users2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../components/ui/utils';
import { TabAccessKey } from '../lib/tabAccess';
import { useTabAccess } from '../contexts/TabAccessContext';

const baseItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, tabKey: 'dashboard' as TabAccessKey },
  { path: '/projects', label: 'Projects', icon: Folder, tabKey: 'projects' as TabAccessKey },
  { path: '/quota', label: 'Quota', icon: Target, tabKey: 'quota' as TabAccessKey },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare, tabKey: 'tasks' as TabAccessKey },
  { path: '/av-schedule', label: 'AV Schedule', icon: CalendarDays, tabKey: 'av_schedule' as TabAccessKey },
];

export function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const { canAccessTab } = useTabAccess();
  const navItems = baseItems.filter((item) => canAccessTab(item.tabKey));

  const items = user?.role === 'admin'
    ? [
        ...navItems,
        ...(canAccessTab('users') ? [{ path: '/users', label: 'Users', icon: Users }] : []),
        ...(canAccessTab('team_settings') ? [{ path: '/settings/team-department', label: 'Teams', icon: Users2 }] : []),
        ...(canAccessTab('workspace_settings') ? [{ path: '/settings', label: 'Workspace Settings', icon: Shield }] : []),
      ]
    : user?.role === 'team_lead'
    ? [
        ...navItems,
        ...(canAccessTab('team_settings') ? [{ path: '/settings/team-department', label: 'Team/Department Settings', icon: Shield }] : []),
      ]
    : navItems;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Project Management</h1>
        <p className="text-sm text-gray-500 mt-1">Project and Schedule Management</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100',
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-gray-200 flex justify-start">
        <Link
          to="/my-settings"
          aria-label="My Settings"
          title="My Settings"
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
            location.pathname === '/my-settings'
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-700 hover:bg-gray-100',
          )}
        >
          <Settings className="w-5 h-5" />
        </Link>
      </div>
    </aside>
  );
}
