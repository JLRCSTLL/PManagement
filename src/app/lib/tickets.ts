import { TicketImpact, TicketPriority, TicketSource, TicketStatus, TicketUrgency } from '../types';

export const TICKET_STATUS_OPTIONS: TicketStatus[] = [
  'Open',
  'Assigned',
  'In Progress',
  'Pending User',
  'Pending Vendor',
  'Resolved',
  'Closed',
  'Cancelled',
];

export const TICKET_PRIORITY_OPTIONS: TicketPriority[] = ['Low', 'Medium', 'High', 'Critical'];
export const TICKET_IMPACT_OPTIONS: TicketImpact[] = ['Low', 'Medium', 'High'];
export const TICKET_URGENCY_OPTIONS: TicketUrgency[] = ['Low', 'Medium', 'High'];
export const TICKET_SOURCE_OPTIONS: TicketSource[] = ['Portal', 'Email', 'Phone', 'Walk-in', 'API'];

export const TICKET_STATUS_CLASS: Record<TicketStatus, string> = {
  Open: 'bg-blue-100 text-blue-800',
  Assigned: 'bg-indigo-100 text-indigo-800',
  'In Progress': 'bg-cyan-100 text-cyan-800',
  'Pending User': 'bg-amber-100 text-amber-800',
  'Pending Vendor': 'bg-orange-100 text-orange-800',
  Resolved: 'bg-emerald-100 text-emerald-800',
  Closed: 'bg-slate-100 text-slate-800',
  Cancelled: 'bg-red-100 text-red-800',
};

export const TICKET_PRIORITY_CLASS: Record<TicketPriority, string> = {
  Low: 'bg-blue-100 text-blue-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  High: 'bg-orange-100 text-orange-800',
  Critical: 'bg-red-100 text-red-800',
};

export const TICKET_SLA_CLASS: Record<string, string> = {
  'On Track': 'bg-green-100 text-green-800',
  'At Risk': 'bg-amber-100 text-amber-800',
  Breached: 'bg-red-100 text-red-800',
  Paused: 'bg-slate-100 text-slate-800',
  Completed: 'bg-indigo-100 text-indigo-800',
};
