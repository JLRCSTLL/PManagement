import React from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { apiClient, Ticket } from '../lib/api';
import { TicketForm, TicketFormData } from '../components/tickets/TicketForm';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { TICKET_PRIORITY_CLASS, TICKET_SLA_CLASS, TICKET_STATUS_CLASS } from '../lib/tickets';

interface TicketDetailPageProps {
  forceEdit?: boolean;
}

export function TicketDetailPage({ forceEdit = false }: TicketDetailPageProps) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ticket, setTicket] = React.useState<Ticket | null>(null);
  const [users, setUsers] = React.useState<any[]>([]);
  const [teams, setTeams] = React.useState<string[]>([]);
  const [categories, setCategories] = React.useState<any[]>([]);
  const [commentVisibility, setCommentVisibility] = React.useState<'public' | 'internal'>('public');
  const [commentBody, setCommentBody] = React.useState('');
  const [isSavingComment, setIsSavingComment] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [ticketResponse, usersResponse, teamsResponse, settingsResponse] = await Promise.all([
        apiClient.getTicketById(id),
        apiClient.getUsers(),
        apiClient.getTeams(),
        apiClient.getTicketSettings().catch(() => ({ categories: [] } as any)),
      ]);
      setTicket(ticketResponse.ticket || null);
      setUsers(usersResponse.users || []);
      setTeams((teamsResponse.teams || []).map((entry: any) => entry.name).filter((entry: any) => typeof entry === 'string' && entry.trim()));
      setCategories(Array.isArray((settingsResponse as any).categories) ? (settingsResponse as any).categories : []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load ticket');
    } finally {
      setIsLoading(false);
    }
  }

  const canManage = React.useMemo(() => {
    if (!ticket || !user?.id) return false;
    if (user.role === 'admin' || user.role === 'team_lead') return true;
    return ticket.assignedAgentId === user.id;
  }, [ticket, user?.id, user?.role]);

  const canClose = React.useMemo(() => {
    if (!ticket || !user?.id) return false;
    if (user.role === 'admin' || user.role === 'team_lead') return true;
    return ticket.requesterId === user.id || ticket.assignedAgentId === user.id;
  }, [ticket, user?.id, user?.role]);

  const canPostInternal = canManage;
  const isClosedReadOnly = ticket?.status === 'Closed' && user?.role !== 'admin';

  async function handleUpdate(form: TicketFormData) {
    const payload: any = {
      title: form.title,
      description: form.description,
      address: form.address,
      soNumber: form.soNumber,
      category: form.category,
      subcategory: form.subcategory,
      status: form.status,
      dueDate: form.dueDate || '',
    };

    if (canManage) {
      payload.priority = form.priority;
      payload.impact = form.impact;
      payload.urgency = form.urgency;
      payload.assignedAgentId = form.assignedAgentId || '';
      payload.assignedGroup = form.assignedGroup || '';
    }

    const { ticket: updated } = await apiClient.updateTicket(id, payload);
    setTicket(updated);
    toast.success('Ticket updated');
  }

  async function handleQuickClose() {
    if (!canClose) return;
    const { ticket: updated } = await apiClient.updateTicket(id, { status: 'Closed' });
    setTicket(updated);
    toast.success('Ticket closed');
  }

  async function handleAddComment() {
    if (!ticket || !commentBody.trim()) return;
    if (commentVisibility === 'internal' && !canPostInternal) {
      toast.error('You cannot add internal notes');
      return;
    }

    setIsSavingComment(true);
    try {
      const { ticket: updated } = await apiClient.addTicketComment(id, {
        visibility: commentVisibility,
        message: commentBody.trim(),
      });
      setTicket(updated);
      setCommentBody('');
      toast.success('Comment added');
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add comment');
    } finally {
      setIsSavingComment(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!ticket) {
    return <p className="text-gray-500">Ticket not found.</p>;
  }

  const showEditForm = forceEdit || canManage || (ticket.requesterId === user?.id && ticket.status !== 'Closed');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{ticket.ticketNumber}</h1>
          <p className="text-gray-500 mt-1">{ticket.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={TICKET_STATUS_CLASS[ticket.status] || ''}>{ticket.status}</Badge>
          <Badge className={TICKET_PRIORITY_CLASS[ticket.priority] || ''}>{ticket.priority}</Badge>
          <Badge className={TICKET_SLA_CLASS[ticket.sla?.resolutionStatus || 'On Track'] || 'bg-gray-100 text-gray-800'}>
            SLA {ticket.sla?.resolutionStatus || 'On Track'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {showEditForm ? (
            <div className="bg-white rounded-lg shadow p-5">
              <TicketForm
                mode="edit"
                initialData={ticket}
                users={users}
                categories={categories}
                teams={teams}
                canManageFields={canManage && !isClosedReadOnly}
                onSubmit={handleUpdate}
                onCancel={() => navigate(-1)}
              />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-5 space-y-2">
              <p className="text-sm text-gray-500">Description</p>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}

          <div className="bg-white rounded-lg shadow p-5 space-y-4">
            <h2 className="text-lg font-semibold">Conversation</h2>
            <div className="space-y-3 max-h-[380px] overflow-y-auto">
              {(ticket.comments || []).length === 0 ? (
                <p className="text-sm text-gray-500">No comments yet.</p>
              ) : (
                (ticket.comments || []).map((entry) => (
                  <div key={entry.id} className="rounded border p-3">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{entry.authorName || entry.authorId}</span>
                      <span>{new Date(entry.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-900 whitespace-pre-wrap">{entry.message}</p>
                    <p className="mt-1 text-xs text-gray-500">{entry.visibility === 'internal' ? 'Internal note' : 'Public comment'}</p>
                  </div>
                ))
              )}
            </div>

            {!isClosedReadOnly ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Select value={commentVisibility} onValueChange={(value) => setCommentVisibility(value as 'public' | 'internal')}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public Comment</SelectItem>
                      {canPostInternal ? <SelectItem value="internal">Internal Note</SelectItem> : null}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  rows={4}
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  placeholder="Type your reply or note..."
                />
                <div className="flex justify-end">
                  <Button onClick={handleAddComment} disabled={isSavingComment || !commentBody.trim()}>
                    {isSavingComment ? 'Posting...' : 'Post Comment'}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4 space-y-2 text-sm">
            <p><span className="text-gray-500">Requester:</span> {ticket.requesterName || ticket.requesterId}</p>
            <p><span className="text-gray-500">Assigned Agent:</span> {ticket.assignedAgentName || '-'}</p>
            <p><span className="text-gray-500">Assigned Group:</span> {ticket.assignedGroup || '-'}</p>
            <p><span className="text-gray-500">Address:</span> {ticket.address || '-'}</p>
            <p><span className="text-gray-500">SO#:</span> {ticket.soNumber || '-'}</p>
            <p><span className="text-gray-500">Source:</span> {ticket.source}</p>
            <p><span className="text-gray-500">Created:</span> {new Date(ticket.createdAt).toLocaleString()}</p>
            <p><span className="text-gray-500">Updated:</span> {new Date(ticket.updatedAt).toLocaleString()}</p>
            <p><span className="text-gray-500">First Response Due:</span> {new Date(ticket.firstResponseDueAt).toLocaleString()}</p>
            <p><span className="text-gray-500">Resolution Due:</span> {new Date(ticket.resolutionDueAt).toLocaleString()}</p>
            {ticket.resolvedAt ? <p><span className="text-gray-500">Resolved:</span> {new Date(ticket.resolvedAt).toLocaleString()}</p> : null}
            {ticket.closedAt ? <p><span className="text-gray-500">Closed:</span> {new Date(ticket.closedAt).toLocaleString()}</p> : null}
          </div>

          <div className="bg-white rounded-lg shadow p-4 flex flex-col gap-2">
            {canClose && ticket.status !== 'Closed' ? (
              <Button onClick={handleQuickClose}>Close Ticket</Button>
            ) : null}
            {!forceEdit ? (
              <Button asChild variant="outline">
                <Link to={`/tickets/${ticket.id}/edit`}>Edit Page</Link>
              </Button>
            ) : null}
          </div>

          <div className="bg-white rounded-lg shadow p-4 space-y-2">
            <h3 className="font-medium">Audit Trail</h3>
            <div className="max-h-[240px] overflow-y-auto space-y-2">
              {(ticket.audits || []).length === 0 ? (
                <p className="text-sm text-gray-500">No audit entries.</p>
              ) : (
                (ticket.audits || []).map((entry) => (
                  <div key={entry.id} className="rounded border p-2 text-xs">
                    <p className="font-medium text-gray-700">{entry.action}</p>
                    <p className="text-gray-500">{entry.actorName || entry.actorId} · {new Date(entry.createdAt).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
