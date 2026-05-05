import { User } from '../types';

export type TabAccessKey =
  | 'dashboard'
  | 'projects'
  | 'quota'
  | 'tasks'
  | 'tickets_dashboard'
  | 'tickets_my'
  | 'tickets_queue'
  | 'tickets_sla'
  | 'tickets_settings'
  | 'av_schedule'
  | 'users'
  | 'team_settings'
  | 'workspace_settings';

export type TabAccessSettings = Record<TabAccessKey, string[]>;

export const DEFAULT_TAB_ACCESS: TabAccessSettings = {
  dashboard: [],
  projects: [],
  quota: [],
  tasks: [],
  tickets_dashboard: [],
  tickets_my: [],
  tickets_queue: [],
  tickets_sla: [],
  tickets_settings: [],
  av_schedule: ['av'],
  users: [],
  team_settings: [],
  workspace_settings: [],
};

export const TAB_ACCESS_METADATA: Array<{ key: TabAccessKey; label: string; path: string; description: string }> = [
  { key: 'dashboard', label: 'Dashboard', path: '/', description: 'Main overview and metrics.' },
  { key: 'projects', label: 'Projects', path: '/projects', description: 'Project records and pipeline.' },
  { key: 'quota', label: 'Quota', path: '/quota', description: 'Quota summary and target tracking.' },
  { key: 'tasks', label: 'Tasks', path: '/tasks', description: 'Task list and work updates.' },
  { key: 'tickets_dashboard', label: 'Ticket Dashboard', path: '/tickets/dashboard', description: 'Helpdesk dashboard and SLA summary.' },
  { key: 'tickets_my', label: 'My Tickets', path: '/tickets/my', description: 'Personal ticket list and creation access.' },
  { key: 'tickets_queue', label: 'Ticket Queue', path: '/tickets/queue', description: 'Team queue for agents and leads.' },
  { key: 'tickets_sla', label: 'SLA Queue', path: '/tickets/sla', description: 'At-risk and breached SLA tickets.' },
  { key: 'tickets_settings', label: 'Ticket Settings', path: '/settings/tickets', description: 'Ticket categories and SLA rule settings.' },
  { key: 'av_schedule', label: 'AV Schedule', path: '/av-schedule', description: 'AV team schedule tab.' },
  { key: 'users', label: 'Users', path: '/users', description: 'User administration tab.' },
  { key: 'team_settings', label: 'Team Settings', path: '/settings/team-department', description: 'Team and department management.' },
  { key: 'workspace_settings', label: 'Workspace Settings', path: '/settings', description: 'Global workspace settings.' },
];

function normalizeTeamName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function dedupeTeamNames(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const teamName = normalizeTeamName(value);
    if (!teamName || seen.has(teamName)) continue;
    seen.add(teamName);
    normalized.push(teamName);
  }
  return normalized;
}

export function normalizeTabAccess(raw: Partial<Record<TabAccessKey, unknown>> | null | undefined): TabAccessSettings {
  const source = raw || {};
  return {
    dashboard: Array.isArray(source.dashboard) ? dedupeTeamNames(source.dashboard) : [...DEFAULT_TAB_ACCESS.dashboard],
    projects: Array.isArray(source.projects) ? dedupeTeamNames(source.projects) : [...DEFAULT_TAB_ACCESS.projects],
    quota: Array.isArray(source.quota) ? dedupeTeamNames(source.quota) : [...DEFAULT_TAB_ACCESS.quota],
    tasks: Array.isArray(source.tasks) ? dedupeTeamNames(source.tasks) : [...DEFAULT_TAB_ACCESS.tasks],
    tickets_dashboard: Array.isArray(source.tickets_dashboard) ? dedupeTeamNames(source.tickets_dashboard) : [...DEFAULT_TAB_ACCESS.tickets_dashboard],
    tickets_my: Array.isArray(source.tickets_my) ? dedupeTeamNames(source.tickets_my) : [...DEFAULT_TAB_ACCESS.tickets_my],
    tickets_queue: Array.isArray(source.tickets_queue) ? dedupeTeamNames(source.tickets_queue) : [...DEFAULT_TAB_ACCESS.tickets_queue],
    tickets_sla: Array.isArray(source.tickets_sla) ? dedupeTeamNames(source.tickets_sla) : [...DEFAULT_TAB_ACCESS.tickets_sla],
    tickets_settings: Array.isArray(source.tickets_settings) ? dedupeTeamNames(source.tickets_settings) : [...DEFAULT_TAB_ACCESS.tickets_settings],
    av_schedule: Array.isArray(source.av_schedule) ? dedupeTeamNames(source.av_schedule) : [...DEFAULT_TAB_ACCESS.av_schedule],
    users: Array.isArray(source.users) ? dedupeTeamNames(source.users) : [...DEFAULT_TAB_ACCESS.users],
    team_settings: Array.isArray(source.team_settings) ? dedupeTeamNames(source.team_settings) : [...DEFAULT_TAB_ACCESS.team_settings],
    workspace_settings: Array.isArray(source.workspace_settings) ? dedupeTeamNames(source.workspace_settings) : [...DEFAULT_TAB_ACCESS.workspace_settings],
  };
}

function getUserTeamKeys(user: User | null | undefined): string[] {
  if (!user) return [];
  return dedupeTeamNames([
    ...(Array.isArray(user.teams) ? user.teams : []),
    typeof user.team === 'string' ? user.team : '',
  ]);
}

export function canUserAccessTab(tabKey: TabAccessKey, tabAccess: TabAccessSettings, user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const allowedTeamKeys = Array.isArray(tabAccess[tabKey]) ? tabAccess[tabKey] : [];
  if (allowedTeamKeys.length === 0) return true;

  const userTeamKeys = getUserTeamKeys(user);
  return allowedTeamKeys.some((allowedTeam) => userTeamKeys.includes(allowedTeam));
}
