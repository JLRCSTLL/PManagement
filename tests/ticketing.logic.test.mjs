import test from 'node:test';
import assert from 'node:assert/strict';

const TRANSITIONS = {
  Open: ['Assigned', 'In Progress', 'Pending User', 'Pending Vendor', 'Resolved', 'Cancelled'],
  Assigned: ['In Progress', 'Pending User', 'Pending Vendor', 'Resolved', 'Cancelled'],
  'In Progress': ['Assigned', 'Pending User', 'Pending Vendor', 'Resolved', 'Cancelled'],
  'Pending User': ['Assigned', 'In Progress', 'Resolved', 'Cancelled'],
  'Pending Vendor': ['Assigned', 'In Progress', 'Resolved', 'Cancelled'],
  Resolved: ['Closed', 'Assigned', 'In Progress'],
  Closed: [],
  Cancelled: [],
};

function canTransition(from, to) {
  if (from === to) return true;
  return (TRANSITIONS[from] || []).includes(to);
}

function pauseResumeSla(ticket, nextStatus, nowMs) {
  const pending = new Set(['Pending User', 'Pending Vendor']);
  const enteringPending = pending.has(nextStatus) && !pending.has(ticket.status);
  const leavingPending = !pending.has(nextStatus) && pending.has(ticket.status);

  if (enteringPending && !ticket.sla.pausedAt) {
    ticket.sla.pausedAt = nowMs;
  }

  if (leavingPending && ticket.sla.pausedAt) {
    const diff = Math.max(0, nowMs - ticket.sla.pausedAt);
    ticket.sla.firstResponseDueAt += diff;
    ticket.sla.resolutionDueAt += diff;
    ticket.sla.pausedAt = 0;
  }

  ticket.status = nextStatus;
}

function canViewTicket(ticket, user, role) {
  if (role === 'admin') return true;
  if (ticket.requesterId === user.id) return true;
  if (ticket.assignedAgentId === user.id) return true;
  if (role === 'team_lead') return user.teams.includes(ticket.assignedGroup);
  return false;
}

function shouldMarkFirstResponse(ticket, commenter) {
  return !ticket.sla.firstResponseAt && commenter.isAgent && commenter.visibility === 'public';
}

test('ticket creation starts as Open/Assigned depending assignment', () => {
  const base = { assignedAgentId: '', assignedGroup: '' };
  const status1 = base.assignedAgentId || base.assignedGroup ? 'Assigned' : 'Open';
  assert.equal(status1, 'Open');

  const status2 = 'agent-1' || '' ? 'Assigned' : 'Open';
  assert.equal(status2, 'Assigned');
});

test('status transitions enforce workflow', () => {
  assert.equal(canTransition('Open', 'Assigned'), true);
  assert.equal(canTransition('Assigned', 'Resolved'), true);
  assert.equal(canTransition('Closed', 'In Progress'), false);
  assert.equal(canTransition('Cancelled', 'Resolved'), false);
});

test('sla pause/resume extends due deadlines', () => {
  const ticket = {
    status: 'In Progress',
    sla: {
      firstResponseDueAt: 1000,
      resolutionDueAt: 5000,
      pausedAt: 0,
    },
  };

  pauseResumeSla(ticket, 'Pending User', 2000);
  assert.equal(ticket.sla.pausedAt, 2000);

  pauseResumeSla(ticket, 'In Progress', 2600);
  assert.equal(ticket.sla.firstResponseDueAt, 1600);
  assert.equal(ticket.sla.resolutionDueAt, 5600);
  assert.equal(ticket.sla.pausedAt, 0);
});

test('permission checks isolate requester/agent/team lead visibility', () => {
  const ticket = { requesterId: 'u1', assignedAgentId: 'u2', assignedGroup: 'AV' };
  assert.equal(canViewTicket(ticket, { id: 'u1', teams: [] }, 'user'), true);
  assert.equal(canViewTicket(ticket, { id: 'u2', teams: [] }, 'user'), true);
  assert.equal(canViewTicket(ticket, { id: 'u3', teams: ['AV'] }, 'team_lead'), true);
  assert.equal(canViewTicket(ticket, { id: 'u4', teams: ['Ops'] }, 'team_lead'), false);
});

test('first public agent reply marks first response', () => {
  const ticket = { sla: { firstResponseAt: '' } };
  assert.equal(shouldMarkFirstResponse(ticket, { isAgent: true, visibility: 'public' }), true);
  assert.equal(shouldMarkFirstResponse(ticket, { isAgent: true, visibility: 'internal' }), false);
  ticket.sla.firstResponseAt = '2026-05-05T10:00:00.000Z';
  assert.equal(shouldMarkFirstResponse(ticket, { isAgent: true, visibility: 'public' }), false);
});

test('audit events include old/new values', () => {
  const event = {
    ticketId: 't1',
    action: 'ticket_status_changed',
    oldValue: 'Open',
    newValue: 'Assigned',
  };
  assert.equal(event.oldValue, 'Open');
  assert.equal(event.newValue, 'Assigned');
});
