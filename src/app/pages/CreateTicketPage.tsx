import React from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';
import { TicketForm, TicketFormData } from '../components/tickets/TicketForm';

export function CreateTicketPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = React.useState<any[]>([]);
  const [teams, setTeams] = React.useState<string[]>([]);
  const [categories, setCategories] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [usersResponse, teamsResponse, settingsResponse] = await Promise.all([
        apiClient.getUsers(),
        apiClient.getTeams(),
        apiClient.getTicketSettings().catch(() => ({ categories: [] } as any)),
      ]);
      setUsers(usersResponse.users || []);
      setTeams((teamsResponse.teams || []).map((entry: any) => entry.name).filter((entry: any) => typeof entry === 'string' && entry.trim()));
      setCategories(Array.isArray((settingsResponse as any).categories) ? (settingsResponse as any).categories : []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load ticket form data');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(form: TicketFormData) {
    const payload = {
      title: form.title,
      description: form.description,
      address: form.address,
      soNumber: form.soNumber,
      category: form.category,
      subcategory: form.subcategory,
      priority: form.priority,
      impact: form.impact,
      urgency: form.urgency,
      source: form.source,
      assignedAgentId: form.assignedAgentId || undefined,
      assignedGroup: form.assignedGroup || undefined,
      dueDate: form.dueDate || undefined,
    };
    const { ticket } = await apiClient.createTicket(payload as any);
    toast.success('Ticket created');
    navigate(`/tickets/${ticket.id}`);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create Ticket</h1>
        <p className="text-gray-500 mt-1">Submit a service request or incident ticket.</p>
      </div>
      <div className="bg-white rounded-lg shadow p-5">
        <TicketForm
          mode="create"
          users={users}
          categories={categories}
          teams={teams}
          canManageFields={user?.role === 'admin' || user?.role === 'team_lead'}
          onSubmit={handleSubmit}
          onCancel={() => navigate(-1)}
        />
      </div>
    </div>
  );
}
