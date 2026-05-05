-- Ticketing module schema (relational mirror for future migration from KV storage)

create table if not exists public.tickets (
  id uuid primary key,
  ticket_number text not null unique,
  title text not null,
  description text not null,
  address text not null default '',
  so_number text not null default '',
  category text not null,
  subcategory text not null default '',
  priority text not null check (priority in ('Low','Medium','High','Critical')),
  impact text not null check (impact in ('Low','Medium','High')),
  urgency text not null check (urgency in ('Low','Medium','High')),
  status text not null check (status in ('Open','Assigned','In Progress','Pending User','Pending Vendor','Resolved','Closed','Cancelled')),
  requester_id uuid not null,
  assigned_agent_id uuid,
  assigned_group text not null default '',
  source text not null check (source in ('Portal','Email','Phone','Walk-in','API')),
  attachments jsonb not null default '[]'::jsonb,
  due_date timestamptz,
  first_response_due_at timestamptz not null,
  resolution_due_at timestamptz not null,
  sla jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz
);

create table if not exists public.ticket_comments (
  id uuid primary key,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid not null,
  visibility text not null check (visibility in ('public','internal')),
  message text not null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_audit_entries (
  id uuid primary key,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  actor_id uuid not null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_settings (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists tickets_status_idx on public.tickets (status);
create index if not exists tickets_priority_idx on public.tickets (priority);
create index if not exists tickets_requester_idx on public.tickets (requester_id);
create index if not exists tickets_assigned_agent_idx on public.tickets (assigned_agent_id);
create index if not exists tickets_assigned_group_idx on public.tickets (assigned_group);
create index if not exists ticket_comments_ticket_idx on public.ticket_comments (ticket_id, created_at);
create index if not exists ticket_audit_ticket_idx on public.ticket_audit_entries (ticket_id, created_at);
