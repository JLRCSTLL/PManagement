import { projectId, publicAnonKey } from '../../../utils/supabase/info';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/server`;

interface ApiOptions {
  requiresAuth?: boolean;
}

export interface AppSettings {
  organizationName: string;
  dashboardSubtitle: string;
  timezone: string;
  defaultCurrency: 'PHP' | 'USD' | 'EUR';
  dateFormat: 'YYYY-MM-DD' | 'MMM dd, yyyy' | 'dd/MM/yyyy';
  weekStartsOn: 'monday' | 'sunday';
  defaultProjectVisibility: 'team_only' | 'all_teams';
  enableTaskDueReminders: boolean;
  reminderLeadDays: number;
  enableDailySummary: boolean;
  dailySummaryTime: string;
  tabAccess: {
    dashboard: string[];
    projects: string[];
    quota: string[];
    tasks: string[];
    tickets_dashboard: string[];
    tickets_my: string[];
    tickets_queue: string[];
    tickets_sla: string[];
    tickets_settings: string[];
    av_schedule: string[];
    users: string[];
    team_settings: string[];
    workspace_settings: string[];
  };
  updatedAt?: string;
  updatedBy?: string;
}

export type AppSettingsPayload = Omit<AppSettings, 'updatedAt' | 'updatedBy'>;

export interface UserSettings {
  preferredTheme: 'system' | 'light' | 'dark';
  themePreset: 'default' | 'ocean' | 'forest' | 'sunset' | 'slate';
  backgroundPreset: 'clean' | 'soft-grid' | 'mesh' | 'dots' | 'waves';
  timezone: string;
  dateFormat: 'YYYY-MM-DD' | 'MMM dd, yyyy' | 'dd/MM/yyyy';
  emailNotificationsEnabled: boolean;
  taskReminderEmailEnabled: boolean;
  dailySummaryEmailEnabled: boolean;
  updatedAt?: string;
}

export type UserSettingsPayload = Omit<UserSettings, 'updatedAt'>;

export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TicketImpact = 'Low' | 'Medium' | 'High';
export type TicketUrgency = 'Low' | 'Medium' | 'High';
export type TicketStatus =
  | 'Open'
  | 'Assigned'
  | 'In Progress'
  | 'Pending User'
  | 'Pending Vendor'
  | 'Resolved'
  | 'Closed'
  | 'Cancelled';
export type TicketSource = 'Portal' | 'Email' | 'Phone' | 'Walk-in' | 'API';
export type TicketSlaStatus = 'On Track' | 'At Risk' | 'Breached' | 'Paused' | 'Completed';

export interface TicketAttachment {
  id: string;
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  authorName?: string;
  visibility: 'public' | 'internal';
  message: string;
  attachments: TicketAttachment[];
  createdAt: string;
}

export interface TicketAuditEntry {
  id: string;
  ticketId: string;
  actorId: string;
  actorName?: string;
  action: string;
  oldValue: any;
  newValue: any;
  createdAt: string;
}

export interface TicketSla {
  firstResponseDueAt: string;
  resolutionDueAt: string;
  firstResponseAt?: string;
  resolutionAt?: string;
  pausedAt?: string;
  firstResponseStatus: TicketSlaStatus;
  resolutionStatus: TicketSlaStatus;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  address: string;
  soNumber: string;
  category: string;
  subcategory: string;
  priority: TicketPriority;
  impact: TicketImpact;
  urgency: TicketUrgency;
  status: TicketStatus;
  requesterId: string;
  requesterName?: string;
  assignedAgentId: string;
  assignedAgentName?: string;
  assignedGroup: string;
  source: TicketSource;
  attachments: TicketAttachment[];
  dueDate: string;
  firstResponseDueAt: string;
  resolutionDueAt: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
  sla: TicketSla;
  comments?: TicketComment[];
  audits?: TicketAuditEntry[];
}

export type TicketCreatePayload = {
  title: string;
  description: string;
  address?: string;
  soNumber?: string;
  category: string;
  subcategory?: string;
  priority: TicketPriority;
  impact: TicketImpact;
  urgency: TicketUrgency;
  source?: TicketSource;
  assignedAgentId?: string;
  assignedGroup?: string;
  dueDate?: string;
  attachments?: TicketAttachment[];
};

export type TicketUpdatePayload = Partial<{
  title: string;
  description: string;
  address: string;
  soNumber: string;
  category: string;
  subcategory: string;
  priority: TicketPriority;
  impact: TicketImpact;
  urgency: TicketUrgency;
  status: TicketStatus;
  assignedAgentId: string;
  assignedGroup: string;
  dueDate: string;
  attachments: TicketAttachment[];
}>;

export interface TicketSettings {
  categories: Array<{
    id: string;
    name: string;
    subcategories: string[];
    isActive: boolean;
  }>;
  slaRules: Record<TicketPriority, { firstResponseMinutes: number; resolutionMinutes: number; businessDays: boolean }>;
}

export interface TicketDashboardStats {
  totalOpenTickets: number;
  ticketsAssignedToMe: number;
  criticalTickets: number;
  slaBreachedTickets: number;
  slaAtRiskTickets: number;
  ticketsResolvedToday: number;
  averageFirstResponseMinutes: number;
  averageResolutionMinutes: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

export class ApiClient {
  private normalizeProjectPayload(project: any) {
    if (!project || typeof project !== 'object') return project;

    const next = { ...project };
    if (typeof next.client === 'string' && next.client.trim() && !next.projectId) {
      next.projectId = next.client.trim();
    }
    return next;
  }

  private getHeaders(requiresAuth: boolean = false): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (requiresAuth) {
      const token = localStorage.getItem('access_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } else {
      headers['Authorization'] = `Bearer ${publicAnonKey}`;
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit & ApiOptions = {}
  ): Promise<T> {
    const { requiresAuth = true, ...fetchOptions } = options;
    const requestUrl = `${API_BASE_URL}${endpoint}`;
    const method = (fetchOptions.method || 'GET').toUpperCase();
    const isRetryable = method === 'GET' || method === 'HEAD';
    const maxAttempts = isRetryable ? 2 : 1;
    const timeoutMs = 15000;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(requestUrl, {
          ...fetchOptions,
          headers: this.getHeaders(requiresAuth),
          signal: controller.signal,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Request failed' }));
          let message = 'Request failed';
          if (typeof error?.error === 'string') {
            message = error.error;
          } else if (typeof error?.message === 'string') {
            message = error.message;
          } else if (error?.error && typeof error.error === 'object') {
            message = JSON.stringify(error.error);
          }

          const requestError = new Error(`[${response.status}] ${message} (${requestUrl})`);
          const shouldRetry = isRetryable && attempt < maxAttempts && response.status >= 500;
          if (shouldRetry) {
            await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
            continue;
          }
          throw requestError;
        }

        return response.json();
      } catch (error: any) {
        const timedOut = error?.name === 'AbortError';
        const reason =
          timedOut
            ? `Request timed out after ${Math.round(timeoutMs / 1000)}s`
            : typeof error?.message === 'string' && error.message.trim()
            ? error.message.trim()
            : 'Network request failed';
        lastError = new Error(
          `Cannot reach backend API (${requestUrl}). ${reason}. Deploy the Supabase Edge Function \`server\` and verify your Supabase project settings.`,
        );

        const shouldRetry = isRetryable && attempt < maxAttempts;
        if (!shouldRetry) {
          throw lastError;
        }
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      } finally {
        clearTimeout(timeoutHandle);
      }
    }

    throw lastError || new Error(`Cannot reach backend API (${requestUrl}).`);
  }

  // Auth
  async getMe() {
    return this.request<{ user: any }>('/me', {
      method: 'GET',
    });
  }

  async updateMe(payload: { name?: string; password?: string }) {
    return this.request<{ user: any }>('/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async signup(email: string, password: string, name: string) {
    return this.request('/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
      requiresAuth: false,
    });
  }

  async setupDemoAccount() {
    return this.request<{ message: string; exists: boolean }>('/setup-demo', {
      method: 'POST',
      requiresAuth: false,
    });
  }

  async getUsers() {
    return this.request<{ users: any[] }>('/users', {
      method: 'GET',
    });
  }

  async getAdminUsers() {
    return this.request<{ users: any[] }>('/admin/users', {
      method: 'GET',
    });
  }

  async createAdminUser(payload: {
    email: string;
    password: string;
    fullName: string;
    role: 'admin' | 'team_lead' | 'user';
    isActive: boolean;
  }) {
    return this.request<{ user: any }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateAdminUser(
    userId: string,
    payload: {
      fullName?: string;
      role?: 'admin' | 'team_lead' | 'user';
      isActive?: boolean;
    },
  ) {
    return this.request<{ user: any }>(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteAdminUser(userId: string) {
    return this.request<{ success: boolean }>(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // Projects
  async getProjects() {
    return this.request<{ projects: any[]; groupedServerSide?: boolean; clientGroups?: any[] }>('/projects', {
      method: 'GET',
    });
  }

  async getQuotaData() {
    return this.request<{
      summary: any;
      quotaMetrics: any;
      userQuotaTarget?: number;
      userQuotaProgressPercent?: number;
      statusBreakdown: { all: Record<string, number>; proposals: Record<string, number>; projects: Record<string, number> };
      groupedTotals: { byClient: any[]; byAccountManager: any[]; byTeam: any[] };
      monthlyTrend: any[];
      records: any[];
      proposals: any[];
      projects: any[];
    }>('/quota', {
      method: 'GET',
    });
  }

  async updateQuotaTarget(amount: number) {
    return this.request<{ userId: string; amount: number; updatedAt: string }>('/quota-target', {
      method: 'PUT',
      body: JSON.stringify({ amount }),
    });
  }

  async getQuotaTarget() {
    return this.request<{ amount: number; updatedAt: string }>('/quota-target', {
      method: 'GET',
    });
  }

  async getQuotaTargets() {
    return this.request<{
      targets: Array<{
        userId: string;
        email: string;
        name: string;
        role: 'admin' | 'team_lead' | 'user';
        teams: string[];
        amount: number;
        updatedAt: string;
      }>;
    }>('/quota-targets', {
      method: 'GET',
    });
  }

  async createProject(project: any) {
    return this.request<{ project: any }>('/projects', {
      method: 'POST',
      body: JSON.stringify(this.normalizeProjectPayload(project)),
    });
  }

  async updateProject(id: string, updates: any) {
    return this.request<{ project: any }>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(this.normalizeProjectPayload(updates)),
    });
  }

  async deleteProject(id: string) {
    return this.request<{ success: boolean }>(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  async addProjectNote(id: string, note: string) {
    return this.request<{ project: any }>(`/projects/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  }

  // Settings
  async getSettings() {
    return this.request<{ settings: AppSettings }>('/settings', {
      method: 'GET',
    });
  }

  async updateSettings(payload: AppSettingsPayload) {
    return this.request<{ settings: AppSettings }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async getNavigationSettings() {
    return this.request<{ tabAccess: AppSettings['tabAccess'] }>('/navigation-settings', {
      method: 'GET',
    });
  }

  async getUserSettings() {
    return this.request<{ settings: UserSettings }>('/user-settings', {
      method: 'GET',
    });
  }

  async updateUserSettings(payload: UserSettingsPayload) {
    return this.request<{ settings: UserSettings }>('/user-settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  // Teams
  async getTeams() {
    return this.request<{ teams: any[] }>('/teams', {
      method: 'GET',
    });
  }

  async createTeam(payload: { name: string; description?: string }) {
    return this.request<{ team: any }>('/teams', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateTeam(id: string, payload: { name: string; description?: string }) {
    return this.request<{ team: any }>(`/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async updateTeamMembers(id: string, memberIds: string[]) {
    return this.request<{ team: any }>(`/teams/${id}/members`, {
      method: 'PUT',
      body: JSON.stringify({ memberIds }),
    });
  }

  async deleteTeam(id: string) {
    return this.request<{ success: boolean }>(`/teams/${id}`, {
      method: 'DELETE',
    });
  }

  // Tasks
  async getTasks() {
    return this.request<{ tasks: any[] }>('/tasks', {
      method: 'GET',
    });
  }

  async createTask(task: any) {
    return this.request<{ task: any }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async updateTask(id: string, updates: any) {
    return this.request<{ task: any }>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTask(id: string) {
    return this.request<{ success: boolean }>(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  // AV Schedule
  async getAvSchedule() {
    return this.request<{ entries: any[] }>('/av-schedule', {
      method: 'GET',
    });
  }

  async createAvScheduleEntry(payload: {
    date: string;
    whereabouts: string;
    workMode: 'In Office' | 'WFH';
    note?: string;
  }) {
    return this.request<{ entry: any }>('/av-schedule', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateAvScheduleEntry(
    id: string,
    payload: {
      date: string;
      whereabouts: string;
      workMode: 'In Office' | 'WFH';
      note?: string;
    },
  ) {
    return this.request<{ entry: any }>(`/av-schedule/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteAvScheduleEntry(id: string) {
    return this.request<{ success: boolean }>(`/av-schedule/${id}`, {
      method: 'DELETE',
    });
  }

  // Dashboard
  async getDashboardStats() {
    return this.request<{ stats: any }>('/dashboard/stats', {
      method: 'GET',
    });
  }

  // Tickets
  async getTickets(params?: Record<string, string | number | boolean | undefined>) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params || {})) {
      if (value === undefined || value === null || value === '') continue;
      search.set(key, String(value));
    }
    const query = search.toString();
    return this.request<{ tickets: Ticket[]; total: number; page: number; pageSize: number }>(`/tickets${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }

  async getTicketById(id: string) {
    return this.request<{ ticket: Ticket }>(`/tickets/${id}`, {
      method: 'GET',
    });
  }

  async createTicket(payload: TicketCreatePayload) {
    return this.request<{ ticket: Ticket }>('/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateTicket(id: string, payload: TicketUpdatePayload) {
    return this.request<{ ticket: Ticket }>(`/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async addTicketComment(id: string, payload: { visibility: 'public' | 'internal'; message: string; attachments?: TicketAttachment[] }) {
    return this.request<{ comment: TicketComment; ticket: Ticket }>(`/tickets/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getTicketDashboard() {
    return this.request<{ stats: TicketDashboardStats }>('/tickets/dashboard', {
      method: 'GET',
    });
  }

  async getTicketSettings() {
    return this.request<TicketSettings>('/tickets/settings', {
      method: 'GET',
    });
  }

  async updateTicketSettings(payload: TicketSettings) {
    return this.request<TicketSettings>('/tickets/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }
}

export const apiClient = new ApiClient();
