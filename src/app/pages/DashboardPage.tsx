import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FolderOpen,
  ListTodo,
  Shield,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';
import { DashboardStats } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#0f766e', '#4f46e5'];

export function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const { stats } = await apiClient.getDashboardStats();
      setStats(stats);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const taskStatusData = useMemo(
    () => Object.entries(stats?.tasksByStatus || {}).map(([name, value]) => ({ name, value })),
    [stats],
  );
  const taskPriorityData = useMemo(
    () => Object.entries(stats?.tasksByPriority || {}).map(([name, value]) => ({ name, value })),
    [stats],
  );
  const projectStatusData = useMemo(
    () => Object.entries(stats?.projectsByStatus || {}).map(([name, value]) => ({ name, value })),
    [stats],
  );
  const projectsByManagerData = useMemo(
    () => Object.entries(stats?.projectsByAccountManager || {}).map(([name, value]) => ({ name, value })),
    [stats],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load dashboard data</p>
      </div>
    );
  }

  const statCards = isAdmin
    ? [
        {
          title: 'Total Users',
          value: stats.totalUsers || 0,
          icon: Users,
          color: 'text-slate-700',
          bgColor: 'bg-slate-100',
        },
        {
          title: 'Total Projects',
          value: stats.totalProjects,
          icon: FolderOpen,
          color: 'text-blue-700',
          bgColor: 'bg-blue-100',
        },
        {
          title: 'Total Tasks',
          value: stats.totalTasks,
          icon: ListTodo,
          color: 'text-indigo-700',
          bgColor: 'bg-indigo-100',
        },
        {
          title: 'In Progress',
          value: stats.inProgressTasks,
          icon: TrendingUp,
          color: 'text-orange-700',
          bgColor: 'bg-orange-100',
        },
        {
          title: 'Completed',
          value: stats.completedTasks,
          icon: CheckCircle2,
          color: 'text-green-700',
          bgColor: 'bg-green-100',
        },
        {
          title: 'Overdue Tasks',
          value: stats.overdueTasks,
          icon: AlertCircle,
          color: 'text-red-700',
          bgColor: 'bg-red-100',
        },
      ]
    : [
        {
          title: 'Visible Projects',
          value: stats.totalProjects,
          icon: FolderOpen,
          color: 'text-blue-700',
          bgColor: 'bg-blue-100',
        },
        {
          title: 'Visible Tasks',
          value: stats.totalTasks,
          icon: ListTodo,
          color: 'text-indigo-700',
          bgColor: 'bg-indigo-100',
        },
        {
          title: 'Assigned Projects',
          value: stats.assignedProjects || 0,
          icon: Shield,
          color: 'text-cyan-700',
          bgColor: 'bg-cyan-100',
        },
        {
          title: 'Assigned Tasks',
          value: stats.assignedTasks || 0,
          icon: Clock,
          color: 'text-amber-700',
          bgColor: 'bg-amber-100',
        },
        {
          title: 'In Progress (Mine)',
          value: stats.inProgressAssignedTasks || 0,
          icon: TrendingUp,
          color: 'text-orange-700',
          bgColor: 'bg-orange-100',
        },
        {
          title: 'Overdue Tasks',
          value: stats.overdueTasks,
          icon: AlertCircle,
          color: 'text-red-700',
          bgColor: 'bg-red-100',
        },
      ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          {isAdmin ? 'Admin visibility and access overview' : 'Your visible projects and assigned work'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{card.title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{card.value}</p>
                  </div>
                  <div className={`${card.bgColor} p-3 rounded-lg`}>
                    <Icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className={`grid grid-cols-1 ${isAdmin ? 'xl:grid-cols-2' : 'lg:grid-cols-2'} gap-6`}>
        <Card>
          <CardHeader>
            <CardTitle>Tasks by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={taskStatusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" name="Tasks" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tasks by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={taskPriorityData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  nameKey="name"
                  label
                >
                  {taskPriorityData.map((entry, index) => (
                    <Cell key={`priority-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projects by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={projectStatusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#0f766e" name="Projects" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Projects by Account Manager</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={projectsByManagerData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#334155" name="Projects" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
