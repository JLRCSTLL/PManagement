import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/server`;

interface ApiOptions {
  requiresAuth?: boolean;
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
    let response: Response;

    try {
      response = await fetch(requestUrl, {
        ...fetchOptions,
        headers: this.getHeaders(requiresAuth),
      });
    } catch (error: any) {
      const reason =
        typeof error?.message === 'string' && error.message.trim()
          ? error.message.trim()
          : 'Network request failed';
      throw new Error(
        `Cannot reach backend API (${requestUrl}). ${reason}. Deploy the Supabase Edge Function \`server\` and verify your Supabase project settings.`,
      );
    }

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
      throw new Error(`[${response.status}] ${message} (${requestUrl})`);
    }

    return response.json();
  }

  // Auth
  async getMe() {
    return this.request<{ user: any }>('/me', {
      method: 'GET',
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
}

export const apiClient = new ApiClient();
