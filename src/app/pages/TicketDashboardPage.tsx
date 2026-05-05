import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, LifeBuoy, Timer, UserCheck } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { apiClient, TicketDashboardStats } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function TicketDashboardPage() {
  const [stats, setStats] = React.useState<TicketDashboardStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const response = await apiClient.getTicketDashboard();
      setStats(response.stats);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load ticket dashboard');
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!stats) {
    return <p className="text-gray-500">Unable to load ticket dashboard.</p>;
  }

  const cards = [
    { title: 'Total Open Tickets', value: stats.totalOpenTickets, icon: LifeBuoy, color: 'text-blue-700', bg: 'bg-blue-100' },
    { title: 'Assigned To Me', value: stats.ticketsAssignedToMe, icon: UserCheck, color: 'text-indigo-700', bg: 'bg-indigo-100' },
    { title: 'Critical Tickets', value: stats.criticalTickets, icon: AlertTriangle, color: 'text-red-700', bg: 'bg-red-100' },
    { title: 'SLA Breached', value: stats.slaBreachedTickets, icon: Timer, color: 'text-red-700', bg: 'bg-red-100' },
    { title: 'SLA At Risk', value: stats.slaAtRiskTickets, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-100' },
    { title: 'Resolved Today', value: stats.ticketsResolvedToday, icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-100' },
  ];

  const statusData = Object.entries(stats.byStatus || {}).map(([name, value]) => ({ name, value }));
  const priorityData = Object.entries(stats.byPriority || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Ticket Dashboard</h1>
        <p className="text-gray-500 mt-1">Service desk and SLA overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{card.title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{card.value}</p>
                  </div>
                  <div className={`${card.bg} p-3 rounded-lg`}>
                    <Icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tickets by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tickets by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#0f766e" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-lg shadow p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-500">Average First Response</p>
          <p className="text-2xl font-bold text-gray-900">{stats.averageFirstResponseMinutes.toFixed(2)} min</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Average Resolution</p>
          <p className="text-2xl font-bold text-gray-900">{stats.averageResolutionMinutes.toFixed(2)} min</p>
        </div>
      </div>
    </div>
  );
}
