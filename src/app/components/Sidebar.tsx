import React from 'react';
import { Link, useLocation } from 'react-router';
import { CalendarDays, CheckSquare, Folder, LayoutDashboard, Settings, Shield, Target, Users, Users2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../components/ui/utils';

const baseItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/projects', label: 'Projects', icon: Folder },
  { path: '/quota', label: 'Quota', icon: Target },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare },
  { path: '/av-schedule', label: 'AV Schedule', icon: CalendarDays },
];

export function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();

  const items = user?.role === 'admin'
    ? [
        ...baseItems,
        { path: '/users', label: 'Users', icon: Users },
        { path: '/settings/team-department', label: 'Teams', icon: Users2 },
        { path: '/settings', label: 'Settings', icon: Settings },
      ]
    : user?.role === 'team_lead'
    ? [
        ...baseItems,
        { path: '/settings/team-department', label: 'Team/Department Settings', icon: Shield },
      ]
    : baseItems;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Project Management</h1>
        <p className="text-sm text-gray-500 mt-1">Project and Schedule Management</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
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
    </aside>
  );
}
