import React from 'react';
import { Link } from 'react-router';
import { Ticket } from '../../types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { TICKET_PRIORITY_CLASS, TICKET_PRIORITY_OPTIONS, TICKET_SLA_CLASS, TICKET_STATUS_CLASS, TICKET_STATUS_OPTIONS } from '../../lib/tickets';

interface TicketTableProps {
  tickets: Ticket[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  status: string;
  priority: string;
  category: string;
  assignedAgentId: string;
  categories: string[];
  agents: Array<{ id: string; name: string }>;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onAssignedAgentChange: (value: string) => void;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  onPageChange: (nextPage: number) => void;
  basePath: string;
}

function formatDate(value: string) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function TicketTable(props: TicketTableProps) {
  const {
    tickets,
    total,
    page,
    pageSize,
    search,
    status,
    priority,
    category,
    assignedAgentId,
    categories,
    agents,
    sortBy,
    sortOrder,
    onSearchChange,
    onStatusChange,
    onPriorityChange,
    onCategoryChange,
    onAssignedAgentChange,
    onSortChange,
    onPageChange,
    basePath,
  } = props;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Input
          placeholder="Search ticket number/title"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="md:col-span-2"
        />

        <Select value={status || '__all__'} onValueChange={(value) => onStatusChange(value === '__all__' ? '' : value)}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Status</SelectItem>
            {TICKET_STATUS_OPTIONS.map((entry) => (
              <SelectItem key={entry} value={entry}>{entry}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priority || '__all__'} onValueChange={(value) => onPriorityChange(value === '__all__' ? '' : value)}>
          <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Priority</SelectItem>
            {TICKET_PRIORITY_OPTIONS.map((entry) => (
              <SelectItem key={entry} value={entry}>{entry}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={assignedAgentId || '__all__'} onValueChange={(value) => onAssignedAgentChange(value === '__all__' ? '' : value)}>
          <SelectTrigger><SelectValue placeholder="Assigned Agent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Agents</SelectItem>
            {agents.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={category || '__all__'} onValueChange={(value) => onCategoryChange(value === '__all__' ? '' : value)}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Categories</SelectItem>
            {categories.map((entry) => (
              <SelectItem key={entry} value={entry}>{entry}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button className="font-medium" onClick={() => onSortChange('createdAt', sortBy === 'createdAt' && sortOrder === 'desc' ? 'asc' : 'desc')}>
                  Ticket
                </button>
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>
                <button className="font-medium" onClick={() => onSortChange('slaDue', sortBy === 'slaDue' && sortOrder === 'desc' ? 'asc' : 'desc')}>
                  SLA
                </button>
              </TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-500">No tickets found.</TableCell>
              </TableRow>
            ) : (
              tickets.map((ticket) => {
                const slaValue = ticket.sla?.resolutionStatus || 'On Track';
                return (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">{ticket.ticketNumber}</TableCell>
                    <TableCell className="max-w-[280px] truncate" title={ticket.title}>{ticket.title}</TableCell>
                    <TableCell>
                      <Badge className={TICKET_STATUS_CLASS[ticket.status] || ''}>{ticket.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={TICKET_PRIORITY_CLASS[ticket.priority] || ''}>{ticket.priority}</Badge>
                    </TableCell>
                    <TableCell>{ticket.category}</TableCell>
                    <TableCell>{ticket.assignedAgentName || '-'}</TableCell>
                    <TableCell>
                      <Badge className={TICKET_SLA_CLASS[slaValue] || 'bg-gray-100 text-gray-800'}>{slaValue}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(ticket.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`${basePath}/${ticket.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Showing {tickets.length} of {total}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>Previous</Button>
          <span>Page {page} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>Next</Button>
        </div>
      </div>
    </div>
  );
}
