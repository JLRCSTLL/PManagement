import React from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient, Ticket } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { TicketTable } from '../../components/tickets/TicketTable';

interface TicketListPageBaseProps {
  title: string;
  subtitle: string;
  mineOnly?: boolean;
  queue?: '' | 'breached' | 'at-risk';
  basePath?: string;
}

export function TicketListPageBase({ title, subtitle, mineOnly = false, queue = '', basePath = '/tickets/queue' }: TicketListPageBaseProps) {
  const { user } = useAuth();
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [priority, setPriority] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [assignedAgentId, setAssignedAgentId] = React.useState('');
  const [sortBy, setSortBy] = React.useState('createdAt');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = React.useState(true);

  const [categories, setCategories] = React.useState<string[]>([]);
  const [agents, setAgents] = React.useState<Array<{ id: string; name: string }>>([]);

  React.useEffect(() => {
    loadMetadata();
  }, []);

  React.useEffect(() => {
    loadTickets();
  }, [page, pageSize, search, status, priority, category, assignedAgentId, sortBy, sortOrder, mineOnly, queue]);

  async function loadMetadata() {
    try {
      const [settings, users] = await Promise.all([
        apiClient.getTicketSettings().catch(() => ({ categories: [] as any[] } as any)),
        apiClient.getUsers(),
      ]);
      const nextCategories = Array.isArray((settings as any).categories)
        ? (settings as any).categories.map((entry: any) => entry?.name).filter((value: any) => typeof value === 'string' && value.trim())
        : [];
      setCategories(nextCategories);
      const nextAgents = (users.users || []).map((entry: any) => ({
        id: entry.id,
        name: entry.name || entry.fullName || entry.email || 'User',
      }));
      setAgents(nextAgents);
    } catch {
      // no-op
    }
  }

  async function loadTickets() {
    setIsLoading(true);
    try {
      const response = await apiClient.getTickets({
        page,
        pageSize,
        search: search.trim() || undefined,
        status: status || undefined,
        priority: priority || undefined,
        category: category || undefined,
        assignedAgentId: assignedAgentId || undefined,
        mine: mineOnly || undefined,
        queue: queue || undefined,
        sortBy,
        sortOrder,
      });
      setTickets(response.tickets || []);
      setTotal(response.total || 0);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load tickets');
    } finally {
      setIsLoading(false);
    }
  }

  const canCreate = user?.role === 'admin' || user?.role === 'team_lead' || user?.role === 'user';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-500 mt-1">{subtitle}</p>
        </div>
        {canCreate ? (
          <Button asChild className="gap-2">
            <Link to="/tickets/create">
              <Plus className="w-4 h-4" />
              Create Ticket
            </Link>
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      ) : (
        <TicketTable
          tickets={tickets}
          total={total}
          page={page}
          pageSize={pageSize}
          search={search}
          status={status}
          priority={priority}
          category={category}
          assignedAgentId={assignedAgentId}
          categories={categories}
          agents={agents}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSearchChange={(value) => {
            setPage(1);
            setSearch(value);
          }}
          onStatusChange={(value) => {
            setPage(1);
            setStatus(value);
          }}
          onPriorityChange={(value) => {
            setPage(1);
            setPriority(value);
          }}
          onCategoryChange={(value) => {
            setPage(1);
            setCategory(value);
          }}
          onAssignedAgentChange={(value) => {
            setPage(1);
            setAssignedAgentId(value);
          }}
          onSortChange={(nextSortBy, nextOrder) => {
            setSortBy(nextSortBy);
            setSortOrder(nextOrder);
          }}
          onPageChange={(nextPage) => setPage(Math.max(1, nextPage))}
          basePath={basePath}
        />
      )}
    </div>
  );
}
