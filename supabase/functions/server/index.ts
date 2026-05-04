import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.ts";
import { z } from "npm:zod@3.23.8";

const app = new Hono();

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

type AppRole = "admin" | "team_lead" | "user";

const URL_PROTOCOLS = new Set(["http:", "https:"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RANGE_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/;
const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const HttpUrlSchema = z
  .string()
  .trim()
  .url("Valid URL is required")
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return URL_PROTOCOLS.has(parsed.protocol);
    } catch {
      return false;
    }
  }, "URL must use http or https");

const OptionalHttpUrlSchema = z
  .string()
  .optional()
  .default("")
  .transform((value) => value.trim())
  .refine((value) => value === "" || HttpUrlSchema.safeParse(value).success, "Valid URL is required");

const OptionalDateStringSchema = z
  .string()
  .optional()
  .default("")
  .refine((value) => value === "" || DATE_PATTERN.test(value), "Date must use YYYY-MM-DD format");

const RequiredDateStringSchema = z
  .string()
  .trim()
  .refine((value) => DATE_PATTERN.test(value), "Date must use YYYY-MM-DD format");

const ProjectReferenceLinkSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, "Link label is required"),
  url: HttpUrlSchema,
  note: z.string().optional().default(""),
  sortOrder: z.number().int().min(0).optional(),
});

const ProjectNoteSchema = z.object({
  id: z.string().optional(),
  body: z.string().min(1, "Note cannot be empty"),
  createdBy: z.string().optional().default(""),
  createdByName: z.string().optional().default(""),
  createdAt: z.string().optional(),
});

const ProjectPayloadSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  client: z.string().min(1, "Client is required"),
  projectType: z.enum(["proposal", "project"]),
  description: z.string().optional().default(""),
  driveLink: OptionalHttpUrlSchema,
  accountManager: z.string().min(1, "Account Manager is required"),
  techAssignedIds: z.array(z.string()).optional().default([]),
  visibleTeams: z.array(z.string()).optional().default([]),
  team: z.string().optional().default(""),
  amount: z.number().min(0, "Amount cannot be negative"),
  startDate: OptionalDateStringSchema,
  targetEndDate: OptionalDateStringSchema,
  priority: z.enum(["Low", "Medium", "High", "Critical"]),
  status: z.enum(["Not Started", "In Progress", "On Hold", "Completed", "Cancelled"]),
  riskLevel: z.enum(["Low", "Medium", "High"]),
  progress: z.number().int().min(0).max(100),
  referenceLinks: z.array(ProjectReferenceLinkSchema).optional().default([]),
  notes: z.array(ProjectNoteSchema).optional().default([]),
});

const ProjectNotePayloadSchema = z.object({
  note: z.string().trim().min(1, "Note cannot be empty").max(2000, "Note is too long"),
});

const TaskPayloadSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  title: z.string().min(1, "Task title is required"),
  taskId: z.string().optional().default(""),
  description: z.string().optional().default(""),
  assignedTo: z.string().optional().default(""),
  requestedBy: z.string().optional().default(""),
  priority: z.enum(["Low", "Medium", "High", "Critical"]),
  status: z.enum(["Not Started", "In Progress", "Pending", "Completed", "Blocked"]),
  startDate: OptionalDateStringSchema,
  dueDate: OptionalDateStringSchema,
  progress: z.number().int().min(0).max(100),
  dependencies: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  referenceLink: z.string().optional().default(""),
  visibleUserIds: z.array(z.string()).optional().default([]),
});

const AdminCreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  role: z.enum(["admin", "team_lead", "user"]).default("user"),
  isActive: z.boolean().default(true),
});

const AdminUpdateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  role: z.enum(["admin", "team_lead", "user"]).optional(),
  isActive: z.boolean().optional(),
});

const TeamPayloadSchema = z.object({
  name: z.string().trim().min(1, "Team name is required").max(100, "Team name is too long"),
  description: z.string().optional().default(""),
});

const TeamMembersPayloadSchema = z.object({
  memberIds: z.array(z.string()).default([]),
});

const AvSchedulePayloadSchema = z.object({
  date: RequiredDateStringSchema,
  whereabouts: z
    .string()
    .optional()
    .default("")
    .transform((value) => value.trim())
    .refine((value) => value === "" || TIME_RANGE_PATTERN.test(value), "Schedule time must use HH:mm-HH:mm"),
  workMode: z.enum(["In Office", "WFH"]),
  note: z.string().optional().default(""),
});

const QuotaTargetPayloadSchema = z.object({
  amount: z.number().min(0).max(1_000_000_000_000),
});

const DEFAULT_APP_SETTINGS = {
  organizationName: "Project Management",
  dashboardSubtitle: "Project and Schedule Management",
  timezone: "Asia/Manila",
  defaultCurrency: "PHP" as "PHP" | "USD" | "EUR",
  dateFormat: "YYYY-MM-DD" as "YYYY-MM-DD" | "MMM dd, yyyy" | "dd/MM/yyyy",
  weekStartsOn: "monday" as "monday" | "sunday",
  defaultProjectVisibility: "team_only" as "team_only" | "all_teams",
  enableTaskDueReminders: true,
  reminderLeadDays: 3,
  enableDailySummary: false,
  dailySummaryTime: "09:00",
};

const AppSettingsPayloadSchema = z.object({
  organizationName: z.string().trim().min(1).max(120).default(DEFAULT_APP_SETTINGS.organizationName),
  dashboardSubtitle: z.string().trim().min(1).max(160).default(DEFAULT_APP_SETTINGS.dashboardSubtitle),
  timezone: z.string().trim().min(1).max(80).default(DEFAULT_APP_SETTINGS.timezone),
  defaultCurrency: z.enum(["PHP", "USD", "EUR"]).default(DEFAULT_APP_SETTINGS.defaultCurrency),
  dateFormat: z.enum(["YYYY-MM-DD", "MMM dd, yyyy", "dd/MM/yyyy"]).default(DEFAULT_APP_SETTINGS.dateFormat),
  weekStartsOn: z.enum(["monday", "sunday"]).default(DEFAULT_APP_SETTINGS.weekStartsOn),
  defaultProjectVisibility: z.enum(["team_only", "all_teams"]).default(DEFAULT_APP_SETTINGS.defaultProjectVisibility),
  enableTaskDueReminders: z.boolean().default(DEFAULT_APP_SETTINGS.enableTaskDueReminders),
  reminderLeadDays: z.number().int().min(1).max(30).default(DEFAULT_APP_SETTINGS.reminderLeadDays),
  enableDailySummary: z.boolean().default(DEFAULT_APP_SETTINGS.enableDailySummary),
  dailySummaryTime: z
    .string()
    .trim()
    .refine((value) => TIME_OF_DAY_PATTERN.test(value), "Daily summary time must use HH:mm format")
    .default(DEFAULT_APP_SETTINGS.dailySummaryTime),
});

const AppSettingsStorageSchema = AppSettingsPayloadSchema.extend({
  updatedAt: z.string().optional().default(() => new Date().toISOString()),
  updatedBy: z.string().optional().default(""),
});

function normalizeDate(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return DATE_PATTERN.test(trimmed) ? trimmed : "";
}

function normalizeProjectType(value: unknown): "proposal" | "project" {
  if (typeof value !== "string") return "project";
  const normalized = value.trim().toLowerCase();
  if (normalized === "proposal") return "proposal";
  return "project";
}

function normalizeScheduleTime(value: unknown): string {
  if (typeof value !== "string") return "";
  const compact = value.trim().replace(/\s+/g, "");
  if (!compact) return "";
  const match = compact.match(TIME_RANGE_PATTERN);
  if (!match) return "";
  const start = `${match[1]}:${match[2]}`;
  const end = `${match[3]}:${match[4]}`;
  return `${start}-${end}`;
}

function sanitizeHttpUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (!URL_PROTOCOLS.has(parsed.protocol)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function normalizeStringArray(values: unknown[]): string[] {
  const unique = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    unique.add(trimmed);
  }
  return Array.from(unique);
}

const DEFAULT_TEAMS = ["AV", "Project Manager"];
const DEFAULT_TEAM_NAME_SET = new Set(
  DEFAULT_TEAMS.map((team) => normalizeTeamName(team).toLowerCase()),
);

function normalizeTeamName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function isDefaultTeamName(value: unknown): boolean {
  const normalized = normalizeTeamName(value).toLowerCase();
  if (!normalized) return false;
  return DEFAULT_TEAM_NAME_SET.has(normalized);
}

const getRoleFromUser = (user: any): AppRole => {
  if (user?.user_metadata?.role === "admin") return "admin";
  if (user?.user_metadata?.role === "team_lead") return "team_lead";
  return "user";
};

const isUserActive = (user: any): boolean =>
  user?.user_metadata?.isActive !== false;

const getUserTeams = (user: any): string[] => {
  const teams = normalizeStringArray([
    ...(Array.isArray(user?.user_metadata?.teams) ? user.user_metadata.teams : []),
    typeof user?.user_metadata?.team === "string" ? user.user_metadata.team : "",
  ]);
  if (teams.length > 0) return teams;
  return user?.user_metadata?.role === "admin" ? [] : ["AV"];
};

function resolveUserName(userId: string, directory: Record<string, string>, fallback = ""): string {
  if (!userId) return fallback;
  return directory[userId] || fallback || userId;
}

async function buildUserDirectory(includeInactive = false): Promise<Record<string, string>> {
  const directory: Record<string, string> = {};
  const usersResult = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersResult.error) return directory;

  for (const user of usersResult.data.users || []) {
    if (!includeInactive && user.user_metadata?.isActive === false) continue;
    directory[user.id] = user.user_metadata?.name || user.email || "User";
  }

  return directory;
}

async function getUserDirectoryFast(timeoutMs = 2500): Promise<Record<string, string>> {
  try {
    return await Promise.race([
      buildUserDirectory(false),
      new Promise<Record<string, string>>((resolve) => {
        setTimeout(() => resolve({}), timeoutMs);
      }),
    ]);
  } catch {
    return {};
  }
}

async function listAuthUsers(includeInactive = false): Promise<any[]> {
  const usersResult = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersResult.error) return [];
  const users = usersResult.data.users || [];
  if (includeInactive) return users;
  return users.filter((authUser) => authUser.user_metadata?.isActive !== false);
}

const normalizeProjectForStorage = (project: any, userId: string) => {
  const techAssignedIds = normalizeStringArray(Array.isArray(project.techAssignedIds) ? project.techAssignedIds : []);
  const team = typeof project.team === "string" ? project.team.trim() : "";
  const visibleTeams = normalizeStringArray([
    ...(Array.isArray(project.visibleTeams) ? project.visibleTeams : []),
    team,
  ]);
  const links = Array.isArray(project.referenceLinks) ? project.referenceLinks : [];
  const notes = Array.isArray(project.notes) ? project.notes : [];

  const referenceLinks = links
    .map((link: any, index: number) => ({
      id: typeof link?.id === "string" && link.id.trim() ? link.id.trim() : crypto.randomUUID(),
      label: typeof link?.label === "string" ? link.label.trim() : "",
      url: sanitizeHttpUrl(link?.url),
      note: typeof link?.note === "string" ? link.note.trim() : "",
      sortOrder: typeof link?.sortOrder === "number" ? link.sortOrder : index,
    }))
    .filter((link: any) => link.label && link.url)
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
    .map((link: any, index: number) => ({ ...link, sortOrder: index }));

  const normalizedNotes = notes
    .map((entry: any) => ({
      id: typeof entry?.id === "string" && entry.id.trim() ? entry.id.trim() : crypto.randomUUID(),
      body: typeof entry?.body === "string" ? entry.body.trim() : "",
      createdBy: typeof entry?.createdBy === "string" ? entry.createdBy.trim() : userId,
      createdByName: typeof entry?.createdByName === "string" ? entry.createdByName.trim() : "",
      createdAt: typeof entry?.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
    }))
    .filter((entry: any) => entry.body.length > 0);

  return {
    project_name: project.projectName.trim(),
    client: project.client.trim(),
    project_type: normalizeProjectType(project.projectType),
    description: project.description?.trim() || "",
    drive_link: sanitizeHttpUrl(project.driveLink),
    account_manager: project.accountManager.trim(),
    tech_assigned: techAssignedIds,
    visible_teams: visibleTeams,
    team,
    amount: Math.max(0, Number(project.amount) || 0),
    start_date: normalizeDate(project.startDate),
    target_end_date: normalizeDate(project.targetEndDate),
    priority: project.priority,
    status: project.status,
    risk_level: project.riskLevel,
    progress: Math.max(0, Math.min(100, Math.round(project.progress || 0))),
    reference_links: referenceLinks,
    notes: normalizedNotes,
  };
};

const normalizeTaskForStorage = (task: any) => ({
  projectId: task.projectId.trim(),
  title: task.title.trim(),
  taskId: typeof task.taskId === "string" ? task.taskId.trim() : "",
  description: task.description?.trim() || "",
  assignedTo: task.assignedTo?.trim() || "",
  requestedBy: task.requestedBy?.trim() || "",
  priority: task.priority,
  status: task.status,
  startDate: normalizeDate(task.startDate),
  dueDate: normalizeDate(task.dueDate),
  progress: Math.max(0, Math.min(100, Math.round(task.progress || 0))),
  dependencies: task.dependencies?.trim() || "",
  notes: task.notes?.trim() || "",
  referenceLink: sanitizeHttpUrl(task.referenceLink),
  visibleUserIds: normalizeStringArray(Array.isArray(task.visibleUserIds) ? task.visibleUserIds : []),
});

function generateTaskIdentifier(tasks: any[], projectId: string): string {
  const targetProjectId = typeof projectId === "string" ? projectId.trim() : "";
  const existingIds = new Set(
    tasks
      .filter((task) => task?.projectId === targetProjectId)
      .map((task) => (typeof task?.taskId === "string" ? task.taskId.trim().toUpperCase() : ""))
      .filter(Boolean),
  );

  let maxSuffix = 0;
  for (const taskId of existingIds) {
    const match = taskId.match(/(\d+)$/);
    if (!match) continue;
    const numeric = Number(match[1]);
    if (Number.isFinite(numeric)) {
      maxSuffix = Math.max(maxSuffix, numeric);
    }
  }

  let next = maxSuffix + 1;
  while (true) {
    const candidate = `TASK-${String(next).padStart(3, "0")}`;
    if (!existingIds.has(candidate.toUpperCase())) {
      return candidate;
    }
    next += 1;
  }
}

const normalizeTeamForStorage = (team: any, userId: string) => ({
  name: normalizeTeamName(team.name),
  description: typeof team.description === "string" ? team.description.trim() : "",
  createdBy: typeof team.createdBy === "string" ? team.createdBy : userId,
  createdAt: typeof team.createdAt === "string" ? team.createdAt : new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

function getProjectTeams(project: any): string[] {
  return normalizeStringArray([
    ...(Array.isArray(project?.visibleTeams) ? project.visibleTeams : []),
    ...(Array.isArray(project?.visible_teams) ? project.visible_teams : []),
    typeof project?.team === "string" ? project.team : "",
  ]);
}

async function resolveTeamMemberIds(project: any): Promise<string[]> {
  try {
    const projectTeams = getProjectTeams(project);
    if (projectTeams.length === 0) return [];

    const users = await listAuthUsers(false);
    const memberIds = users
      .filter((authUser) => getUserTeams(authUser).some((team) => projectTeams.includes(team)))
      .map((authUser) => authUser.id);
    return normalizeStringArray(memberIds);
  } catch (error) {
    console.error("Resolve team member ids error:", error);
    return [];
  }
}

const canViewProject = (project: any, user: any, role: AppRole) => {
  if (role === "admin" || role === "team_lead") return true;
  const userId = typeof user?.id === "string" ? user.id : "";
  const visibleTeams: string[] = Array.isArray(project.visibleTeams) ? project.visibleTeams : [];
  const techAssignedIds: string[] = Array.isArray(project.techAssignedIds) ? project.techAssignedIds : [];
  const userTeams = getUserTeams(user);
  const hasTeamAccess =
    visibleTeams.length > 0 &&
    visibleTeams.some((team) => userTeams.includes(team));

  return (
    project.createdBy === userId ||
    project.userId === userId ||
    techAssignedIds.includes(userId) ||
    hasTeamAccess
  );
};

const canCreateProject = (role: AppRole) =>
  role === "admin" || role === "team_lead" || role === "user";

const canEditProject = (project: any, user: any, role: AppRole) => {
  if (role === "admin") return true;
  if (!canViewProject(project, user, role)) return false;
  if (role === "team_lead" || role === "user") return true;
  return false;
};

const canDeleteProject = (project: any, user: any, role: AppRole) =>
  canEditProject(project, user, role);

const canViewTask = (task: any, project: any, user: any, role: AppRole) => {
  if (!canViewProject(project, user, role)) return false;
  if (role === "admin" || role === "team_lead") return true;
  const userId = typeof user?.id === "string" ? user.id : "";
  const userTeams = getUserTeams(user);
  const projectTeams = getProjectTeams(project);
  const sharesProjectTeam = projectTeams.some((team) => userTeams.includes(team));

  const taskVisibleUserIds: string[] = Array.isArray(task.visibleUserIds) ? task.visibleUserIds : [];
  if (taskVisibleUserIds.length === 0) return true;

  return (
    sharesProjectTeam ||
    taskVisibleUserIds.includes(userId) ||
    task.assignedTo === userId ||
    task.requestedBy === userId ||
    task.createdBy === userId
  );
};

const canCreateTask = (role: AppRole) =>
  role === "admin" || role === "team_lead" || role === "user";

const canEditTask = (task: any, project: any, user: any, role: AppRole) => {
  if (role === "admin") return true;
  if (!canViewTask(task, project, user, role)) return false;
  if (role === "team_lead" || role === "user") return true;
  return false;
};

const canDeleteTask = (task: any, project: any, user: any, role: AppRole) =>
  canEditTask(task, project, user, role);

const canViewAvSchedule = (user: any, role: AppRole) => {
  if (role === "admin" || role === "team_lead") return true;
  const teams = getUserTeams(user).map((team) => normalizeTeamName(team).toLowerCase());
  return teams.includes("av");
};

const canManageAvScheduleEntry = (entry: any, user: any, role: AppRole) => {
  if (role === "admin" || role === "team_lead") return true;
  const userId = typeof user?.id === "string" ? user.id : "";
  return entry.userId === userId;
};

const canManageUsers = (role: AppRole) => role === "admin";
const canManageTeams = (role: AppRole) => role === "admin" || role === "team_lead";
const canManageSystemSettings = (role: AppRole) => role === "admin";

const PROJECT_PRIORITY_ORDER: Record<string, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

function getHighestProjectPriority(priorities: string[]): "Low" | "Medium" | "High" | "Critical" {
  let highest: "Low" | "Medium" | "High" | "Critical" = "Low";
  for (const value of priorities) {
    if (
      (value === "Low" || value === "Medium" || value === "High" || value === "Critical") &&
      PROJECT_PRIORITY_ORDER[value] > PROJECT_PRIORITY_ORDER[highest]
    ) {
      highest = value;
    }
  }
  return highest;
}

function buildClientGroups(projects: any[]) {
  const groups = new Map<
    string,
    {
      client: string;
      projectIds: string[];
      totalProjects: number;
      totalAmount: number;
      highestPriority: "Low" | "Medium" | "High" | "Critical";
      totalProgress: number;
    }
  >();

  for (const project of projects) {
    const client = typeof project.client === "string" && project.client.trim()
      ? project.client.trim()
      : "Unassigned Client";
    const existing = groups.get(client);
    const amount = typeof project.amount === "number" ? project.amount : Number(project.amount) || 0;
    const progress = typeof project.progress === "number" ? project.progress : Number(project.progress) || 0;
    const priority = typeof project.priority === "string" ? project.priority : "Low";

    if (!existing) {
      groups.set(client, {
        client,
        projectIds: [project.id],
        totalProjects: 1,
        totalAmount: amount,
        highestPriority: getHighestProjectPriority([priority]),
        totalProgress: progress,
      });
      continue;
    }

    existing.projectIds.push(project.id);
    existing.totalProjects += 1;
    existing.totalAmount += amount;
    existing.highestPriority = getHighestProjectPriority([existing.highestPriority, priority]);
    existing.totalProgress += progress;
  }

  return Array.from(groups.values())
    .map((group) => ({
      client: group.client,
      projectIds: group.projectIds,
      totalProjects: group.totalProjects,
      totalAmount: group.totalAmount,
      highestPriority: group.highestPriority,
      overallProgress: group.totalProjects > 0 ? Math.round(group.totalProgress / group.totalProjects) : 0,
    }))
    .sort((a, b) => a.client.localeCompare(b.client));
}

function getProjectAmount(project: any): number {
  const raw = typeof project?.amount === "number" ? project.amount : Number(project?.amount || 0);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, raw);
}

function buildStatusCounts(projects: any[]): Record<string, number> {
  return projects.reduce((acc, project) => {
    const status = typeof project?.status === "string" && project.status.trim()
      ? project.status.trim()
      : "Unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function buildGroupedTotals(projects: any[], selector: (project: any) => string): Array<{ key: string; count: number; amount: number }> {
  const groups = new Map<string, { key: string; count: number; amount: number }>();
  for (const project of projects) {
    const key = selector(project).trim() || "Unassigned";
    const current = groups.get(key) || { key, count: 0, amount: 0 };
    current.count += 1;
    current.amount += getProjectAmount(project);
    groups.set(key, current);
  }
  return Array.from(groups.values()).sort((a, b) => b.amount - a.amount);
}

function toMonthKey(value: string): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

const computeTaskDerived = (task: any) => {
  if (!task?.dueDate || task.status === "Completed") {
    return { daysRemaining: null, isOverdue: false };
  }

  const dueDate = new Date(`${task.dueDate}T00:00:00Z`);
  if (Number.isNaN(dueDate.getTime())) {
    return { daysRemaining: null, isOverdue: false };
  }

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayMs = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / dayMs);

  return {
    daysRemaining,
    isOverdue: daysRemaining < 0,
  };
};

async function getAuthUser(c: any) {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  if (!accessToken) return null;

  const authResult = await Promise.race([
    supabase.auth.getUser(accessToken),
    new Promise<{ data: { user: null }; error: Error }>((resolve) => {
      setTimeout(() => {
        resolve({
          data: { user: null },
          error: new Error("Auth lookup timeout"),
        });
      }, 3000);
    }),
  ]);

  const { data: { user }, error } = authResult;
  if (error || !user?.id) return null;
  if (!isUserActive(user)) return null;

  return user;
}

function unwrapStoredValue<T = any>(input: any): T | null {
  let current = input;
  let depth = 0;

  while (depth < 8) {
    if (current && typeof current === "object" && "value" in current) {
      current = (current as { value: unknown }).value;
      depth++;
      continue;
    }

    if (typeof current === "string") {
      try {
        current = JSON.parse(current);
        depth++;
        continue;
      } catch {
        break;
      }
    }

    break;
  }

  if (!current || typeof current !== "object") {
    return null;
  }

  return current as T;
}

function normalizeProjectRecord(project: any) {
  if (!project || typeof project !== "object") return null;
  const projectName = typeof project.project_name === "string"
    ? project.project_name.trim()
    : typeof project.projectName === "string"
    ? project.projectName.trim()
    : "";
  if (typeof project.id !== "string" || !projectName) {
    return null;
  }

  const client = typeof project.client === "string"
    ? project.client.trim()
    : typeof project.projectId === "string"
    ? project.projectId.trim()
    : "";
  const projectType = normalizeProjectType(project.project_type || project.projectType);
  const driveLink = sanitizeHttpUrl(project.drive_link || project.driveLink);
  const accountManager = typeof project.account_manager === "string"
    ? project.account_manager.trim()
    : typeof project.accountManager === "string"
    ? project.accountManager.trim()
    : typeof project.accountManagerName === "string"
    ? project.accountManagerName.trim()
    : typeof project.owner === "string"
    ? project.owner.trim()
    : "";
  const techAssignedIds = normalizeStringArray([
    ...(Array.isArray(project.techAssignedIds) ? project.techAssignedIds : []),
    ...(Array.isArray(project.tech_assigned) ? project.tech_assigned : []),
  ]);
  const visibleTeams = normalizeStringArray([
    ...(Array.isArray(project.visibleTeams) ? project.visibleTeams : []),
    ...(Array.isArray(project.visible_teams) ? project.visible_teams : []),
    typeof project.team === "string" ? project.team : "",
  ]);
  const existingReferenceLinks = Array.isArray(project.referenceLinks)
    ? project.referenceLinks
    : Array.isArray(project.reference_links)
    ? project.reference_links
    : [];

  const normalizedReferenceLinks = existingReferenceLinks
    .map((link: any, index: number) => ({
      id: typeof link?.id === "string" && link.id.trim() ? link.id.trim() : crypto.randomUUID(),
      label: typeof link?.label === "string" ? link.label.trim() : "",
      url: sanitizeHttpUrl(link?.url),
      note: typeof link?.note === "string" ? link.note.trim() : "",
      sortOrder: typeof link?.sortOrder === "number" ? link.sortOrder : index,
    }))
    .filter((link: any) => link.label && link.url)
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
    .map((link: any, index: number) => ({ ...link, sortOrder: index }));

  if (
    normalizedReferenceLinks.length === 0 &&
    typeof project.referenceLink === "string" &&
    sanitizeHttpUrl(project.referenceLink)
  ) {
    normalizedReferenceLinks.push({
      id: crypto.randomUUID(),
      label: "Reference",
      url: sanitizeHttpUrl(project.referenceLink),
      note: "",
      sortOrder: 0,
    });
  }

  const notes = Array.isArray(project.notes)
    ? project.notes
        .map((entry: any) => ({
          id: typeof entry?.id === "string" && entry.id.trim() ? entry.id.trim() : crypto.randomUUID(),
          body: typeof entry?.body === "string" ? entry.body.trim() : "",
          createdBy: typeof entry?.createdBy === "string" ? entry.createdBy : "",
          createdByName: typeof entry?.createdByName === "string" ? entry.createdByName : "",
          createdAt: typeof entry?.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
        }))
        .filter((entry: any) => entry.body.length > 0)
    : [];

  const amountRaw = typeof project.amount === "number"
    ? project.amount
    : typeof project.amount === "string"
    ? Number(project.amount)
    : 0;
  const amount = Number.isFinite(amountRaw) ? Math.max(0, amountRaw) : 0;

  return {
    ...project,
    projectName,
    client,
    projectType,
    driveLink,
    accountManager,
    techAssignedIds,
    visibleTeams,
    referenceLinks: normalizedReferenceLinks,
    notes,
    team: typeof project.team === "string" ? project.team.trim() : "",
    amount,
    startDate: normalizeDate(project.start_date || project.startDate),
    targetEndDate: normalizeDate(project.target_end_date || project.targetEndDate),
    priority: typeof project.priority === "string" ? project.priority : "Medium",
    status: typeof project.status === "string" ? project.status : "Not Started",
    progress: Math.max(0, Math.min(100, Math.round(project.progress || 0))),
    riskLevel: typeof project.risk_level === "string"
      ? project.risk_level
      : (typeof project.riskLevel === "string" ? project.riskLevel : "Low"),
    createdBy: typeof project.createdBy === "string"
      ? project.createdBy
      : (typeof project.created_by === "string"
          ? project.created_by
          : (typeof project.userId === "string" ? project.userId : "")),
    createdAt: typeof project.createdAt === "string"
      ? project.createdAt
      : (typeof project.created_at === "string" ? project.created_at : new Date().toISOString()),
    updatedAt: typeof project.updatedAt === "string"
      ? project.updatedAt
      : (typeof project.updated_at === "string"
          ? project.updated_at
          : (typeof project.createdAt === "string" ? project.createdAt : new Date().toISOString())),
  };
}

function normalizeTaskRecord(task: any) {
  if (!task || typeof task !== "object") return null;
  if (typeof task.id !== "string" || typeof task.projectId !== "string" || typeof task.taskId !== "string" || typeof task.title !== "string") {
    return null;
  }

  return {
    ...task,
    description: typeof task.description === "string" ? task.description : "",
    assignedTo: typeof task.assignedTo === "string" ? task.assignedTo : "",
    requestedBy: typeof task.requestedBy === "string" ? task.requestedBy : "",
    startDate: normalizeDate(task.startDate),
    dueDate: normalizeDate(task.dueDate),
    progress: Math.max(0, Math.min(100, Math.round(task.progress || 0))),
    dependencies: typeof task.dependencies === "string" ? task.dependencies : "",
    notes: typeof task.notes === "string" ? task.notes : "",
    referenceLink: sanitizeHttpUrl(task.referenceLink),
    visibleUserIds: normalizeStringArray(Array.isArray(task.visibleUserIds) ? task.visibleUserIds : []),
    createdBy: typeof task.createdBy === "string" ? task.createdBy : (typeof task.userId === "string" ? task.userId : ""),
    createdAt: typeof task.createdAt === "string" ? task.createdAt : new Date().toISOString(),
    updatedAt: typeof task.updatedAt === "string"
      ? task.updatedAt
      : (typeof task.createdAt === "string" ? task.createdAt : new Date().toISOString()),
  };
}

function normalizeAvScheduleRecord(entry: any) {
  if (!entry || typeof entry !== "object") return null;
  if (typeof entry.id !== "string" || typeof entry.userId !== "string") return null;

  const date = normalizeDate(entry.date);
  if (!date) return null;

  const whereabouts = normalizeScheduleTime(entry.whereabouts);

  return {
    ...entry,
    id: entry.id,
    userId: entry.userId,
    date,
    whereabouts,
    workMode: entry.workMode === "WFH" ? "WFH" : "In Office",
    note: typeof entry.note === "string" ? entry.note.trim() : "",
    createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
    updatedAt: typeof entry.updatedAt === "string"
      ? entry.updatedAt
      : (typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString()),
  };
}

function normalizeTeamRecord(team: any) {
  if (!team || typeof team !== "object") return null;
  if (typeof team.id !== "string") return null;
  const name = normalizeTeamName(team.name);
  if (!name) return null;

  return {
    ...team,
    id: team.id,
    name,
    description: typeof team.description === "string" ? team.description : "",
    createdBy: typeof team.createdBy === "string" ? team.createdBy : "",
    createdAt: typeof team.createdAt === "string" ? team.createdAt : new Date().toISOString(),
    updatedAt: typeof team.updatedAt === "string"
      ? team.updatedAt
      : (typeof team.createdAt === "string" ? team.createdAt : new Date().toISOString()),
  };
}

function normalizeQuotaTargetRecord(raw: any) {
  const source = unwrapStoredValue(raw) ?? raw;
  if (!source || typeof source !== "object") return null;

  const userId = typeof source.userId === "string" ? source.userId : "";
  const amountRaw = typeof source.amount === "number" ? source.amount : Number(source.amount);
  const amount = Number.isFinite(amountRaw) ? Math.max(0, amountRaw) : 0;
  const updatedAt = typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString();

  if (!userId) return null;
  return {
    userId,
    amount,
    updatedAt,
  };
}

function normalizeAppSettingsRecord(settings: any) {
  const source = unwrapStoredValue(settings) ?? settings;
  const parsed = AppSettingsStorageSchema.safeParse(source);
  if (!parsed.success) {
    return {
      ...DEFAULT_APP_SETTINGS,
      updatedAt: new Date().toISOString(),
      updatedBy: "",
    };
  }

  return parsed.data;
}

function dedupeById<T extends { id: string; createdAt?: string; updatedAt?: string }>(records: T[]): T[] {
  const map = new Map<string, T>();
  for (const record of records) {
    const existing = map.get(record.id);
    if (!existing) {
      map.set(record.id, record);
      continue;
    }

    const recordTs = new Date(record.updatedAt || record.createdAt || 0).getTime();
    const existingTs = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
    if (recordTs >= existingTs) {
      map.set(record.id, record);
    }
  }

  return Array.from(map.values());
}

async function readProjects() {
  const rows = await kv.getByPrefixAndLength("project:", 44, 10000);
  const projects = rows
    .map((row) => normalizeProjectRecord(unwrapStoredValue(row)))
    .filter((project): project is any => project !== null);

  return dedupeById(projects);
}

async function readTasks() {
  const rows = await kv.getByPrefixAndLength("task:", 41, 10000);
  const tasks = rows
    .map((row) => normalizeTaskRecord(unwrapStoredValue(row)))
    .filter((task): task is any => task !== null);

  return dedupeById(tasks);
}

async function readAvSchedules() {
  const rows = await kv.getByPrefixAndLength("av-schedule:", 48, 10000);
  const entries = rows
    .map((row) => normalizeAvScheduleRecord(unwrapStoredValue(row)))
    .filter((entry): entry is any => entry !== null);

  return dedupeById(entries);
}

async function readTeams() {
  const rows = await kv.getByPrefixAndLength("team:", 41, 10000);
  const teams = rows
    .map((row) => normalizeTeamRecord(unwrapStoredValue(row)))
    .filter((team): team is any => team !== null);

  return dedupeById(teams);
}

async function readAppSettings() {
  const stored = await kv.get("settings:global");
  return normalizeAppSettingsRecord(stored);
}

async function readUserQuotaTarget(userId: string): Promise<number> {
  const target = await readUserQuotaTargetRecord(userId);
  return target.amount;
}

async function readUserQuotaTargetRecord(userId: string): Promise<{ amount: number; updatedAt: string }> {
  const key = `quota-target:${userId}`;
  const stored = await kv.get(key);
  const normalized = normalizeQuotaTargetRecord(stored);
  return {
    amount: normalized?.amount || 0,
    updatedAt: normalized?.updatedAt || "",
  };
}

async function listQuotaTargets() {
  const rows = await kv.getByPrefix("quota-target:");
  const targets = rows
    .map((row) => normalizeQuotaTargetRecord(unwrapStoredValue(row)))
    .filter((entry): entry is { userId: string; amount: number; updatedAt: string } => Boolean(entry))
    .sort((a, b) => b.amount - a.amount);
  return targets;
}

async function findProjectStorageKeys(projectId: string): Promise<string[]> {
  const rows = await kv.getByPrefix("project:");
  return rows
    .map((row) => {
      const project = normalizeProjectRecord(unwrapStoredValue(row));
      return {
        key: row?.key,
        match: project?.id === projectId,
        ts: new Date(project?.updatedAt || project?.createdAt || 0).getTime(),
      };
    })
    .filter((entry) => entry.match && typeof entry.key === "string" && entry.key.length > 0)
    .sort((a, b) => b.ts - a.ts)
    .map((entry) => entry.key as string);
}

async function findTaskStorageKeys(taskId: string): Promise<string[]> {
  const rows = await kv.getByPrefix("task:");
  return rows
    .map((row) => {
      const task = normalizeTaskRecord(unwrapStoredValue(row));
      return {
        key: row?.key,
        match: task?.id === taskId,
        ts: new Date(task?.updatedAt || task?.createdAt || 0).getTime(),
      };
    })
    .filter((entry) => entry.match && typeof entry.key === "string" && entry.key.length > 0)
    .sort((a, b) => b.ts - a.ts)
    .map((entry) => entry.key as string);
}

async function findAvScheduleStorageKeys(entryId: string): Promise<string[]> {
  const rows = await kv.getByPrefix("av-schedule:");
  return rows
    .map((row) => {
      const entry = normalizeAvScheduleRecord(unwrapStoredValue(row));
      return {
        key: row?.key,
        match: entry?.id === entryId,
        ts: new Date(entry?.updatedAt || entry?.createdAt || 0).getTime(),
      };
    })
    .filter((entry) => entry.match && typeof entry.key === "string" && entry.key.length > 0)
    .sort((a, b) => b.ts - a.ts)
    .map((entry) => entry.key as string);
}

async function findTeamStorageKeys(teamId: string): Promise<string[]> {
  const rows = await kv.getByPrefix("team:");
  return rows
    .map((row) => {
      const team = normalizeTeamRecord(unwrapStoredValue(row));
      return {
        key: row?.key,
        match: team?.id === teamId,
        ts: new Date(team?.updatedAt || team?.createdAt || 0).getTime(),
      };
    })
    .filter((entry) => entry.match && typeof entry.key === "string" && entry.key.length > 0)
    .sort((a, b) => b.ts - a.ts)
    .map((entry) => entry.key as string);
}

function serializeProject(project: any, directory: Record<string, string>) {
  const techAssignedIds = normalizeStringArray(Array.isArray(project.techAssignedIds) ? project.techAssignedIds : []);
  const techAssignedNames = techAssignedIds
    .map((id: string) => resolveUserName(id, directory))
    .filter(Boolean);
  const visibleTeams = normalizeStringArray(Array.isArray(project.visibleTeams) ? project.visibleTeams : []);

  return {
    id: project.id,
    projectName: project.projectName || "",
    client: project.client || "",
    projectType: normalizeProjectType(project.projectType || project.project_type),
    sourceProposalId: typeof project.sourceProposalId === "string"
      ? project.sourceProposalId
      : (typeof project.source_proposal_id === "string" ? project.source_proposal_id : ""),
    description: project.description || "",
    driveLink: sanitizeHttpUrl(
      typeof project.driveLink === "string"
        ? project.driveLink
        : (typeof project.drive_link === "string" ? project.drive_link : ""),
    ),
    accountManager: project.accountManager || "",
    techAssignedIds,
    techAssignedNames,
    visibleTeams,
    visibleTeamNames: visibleTeams,
    team: project.team || "",
    amount: typeof project.amount === "number" ? project.amount : 0,
    startDate: project.startDate || "",
    targetEndDate: project.targetEndDate || "",
    priority: project.priority,
    status: project.status,
    riskLevel: project.riskLevel || "Low",
    progress: typeof project.progress === "number" ? project.progress : 0,
    referenceLinks: Array.isArray(project.referenceLinks) ? project.referenceLinks : [],
    notes: (Array.isArray(project.notes) ? project.notes : []).map((entry: any) => ({
      id: typeof entry?.id === "string" ? entry.id : crypto.randomUUID(),
      body: typeof entry?.body === "string" ? entry.body : "",
      createdBy: typeof entry?.createdBy === "string" ? entry.createdBy : "",
      createdByName: typeof entry?.createdByName === "string" && entry.createdByName.trim()
        ? entry.createdByName
        : resolveUserName(entry?.createdBy || "", directory, "User"),
      createdAt: typeof entry?.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
    })),
    createdBy: project.createdBy || "",
    createdAt: project.createdAt || new Date().toISOString(),
    updatedAt: project.updatedAt || project.createdAt || new Date().toISOString(),
    lastUpdated: project.updatedAt,
  };
}

function serializeTask(task: any, projectMap: Record<string, any>, directory: Record<string, string>) {
  const derived = computeTaskDerived(task);
  return {
    ...task,
    projectName: projectMap[task.projectId]?.projectName || "",
    assignedToName: resolveUserName(task.assignedTo || "", directory, task.assignedTo || ""),
    requestedByName: resolveUserName(task.requestedBy || "", directory, task.requestedBy || ""),
    daysRemaining: derived.daysRemaining,
    isOverdue: derived.isOverdue,
  };
}

function serializeAvSchedule(entry: any, directory: Record<string, string>) {
  return {
    id: entry.id,
    userId: entry.userId,
    userName: resolveUserName(entry.userId, directory, "User"),
    date: entry.date,
    whereabouts: entry.whereabouts,
    workMode: entry.workMode === "WFH" ? "WFH" : "In Office",
    note: entry.note || "",
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || entry.createdAt || new Date().toISOString(),
  };
}

function serializeRole(value: unknown): AppRole {
  if (value === "admin" || value === "team_lead" || value === "user") return value;
  return "user";
}

async function replaceTeamInUsers(oldTeamName: string, nextTeamName: string | null) {
  const sourceTeam = normalizeTeamName(oldTeamName);
  if (!sourceTeam) return;
  const targetTeam = nextTeamName ? normalizeTeamName(nextTeamName) : "";
  const users = await listAuthUsers(true);

  for (const authUser of users) {
    const currentTeams = getUserTeams(authUser);
    if (!currentTeams.includes(sourceTeam)) continue;

    const replaced = normalizeStringArray([
      ...currentTeams.filter((team) => team !== sourceTeam),
      targetTeam,
    ]);

    const metadata = {
      ...(authUser.user_metadata || {}),
      teams: replaced,
      team: replaced[0] || "",
    };
    await supabase.auth.admin.updateUserById(authUser.id, {
      user_metadata: metadata,
    });
  }
}

async function setTeamMembers(teamName: string, memberIds: string[]) {
  const normalizedTeamName = normalizeTeamName(teamName);
  if (!normalizedTeamName) return;

  const users = await listAuthUsers(true);
  const activeUsers = users.filter((authUser) => authUser.user_metadata?.isActive !== false);
  const validUserIds = new Set(activeUsers.map((authUser) => authUser.id));
  const memberIdSet = new Set(memberIds.filter((id) => validUserIds.has(id)));

  for (const authUser of users) {
    const currentTeams = getUserTeams(authUser);
    const shouldBeMember = memberIdSet.has(authUser.id);
    const isMember = currentTeams.includes(normalizedTeamName);
    if (shouldBeMember === isMember) continue;

    const nextTeams = shouldBeMember
      ? normalizeStringArray([...currentTeams, normalizedTeamName])
      : currentTeams.filter((team) => team !== normalizedTeamName);

    const metadata = {
      ...(authUser.user_metadata || {}),
      teams: nextTeams,
      team: nextTeams[0] || "",
    };
    await supabase.auth.admin.updateUserById(authUser.id, {
      user_metadata: metadata,
    });
  }
}

async function replaceTeamInProjects(oldTeamName: string, nextTeamName: string | null) {
  const sourceTeam = normalizeTeamName(oldTeamName);
  if (!sourceTeam) return;
  const targetTeam = nextTeamName ? normalizeTeamName(nextTeamName) : "";

  const projects = await readProjects();
  for (const project of projects) {
    const currentTeam = normalizeTeamName(project.team);
    const currentVisibleTeams = normalizeStringArray(Array.isArray(project.visibleTeams) ? project.visibleTeams : []);
    const includesVisible = currentVisibleTeams.includes(sourceTeam);
    const matchesTeam = currentTeam === sourceTeam;
    if (!matchesTeam && !includesVisible) continue;

    const nextTeam = matchesTeam ? targetTeam : currentTeam;
    const nextVisibleTeams = normalizeStringArray([
      ...currentVisibleTeams.filter((team) => team !== sourceTeam),
      targetTeam,
      nextTeam,
    ]);
    const normalized = normalizeProjectForStorage(
      {
        ...project,
        team: nextTeam,
        visibleTeams: nextVisibleTeams,
      },
      project.createdBy || "",
    );
    const updated = {
      ...project,
      ...normalized,
      id: project.id,
      createdBy: project.createdBy || "",
      createdAt: project.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`project:${project.id}`, updated);
  }
}

async function serializeTeams() {
  const [storedTeams, authUsers, projects] = await Promise.all([
    readTeams(),
    listAuthUsers(false),
    readProjects(),
  ]);

  const teamByName = new Map<string, any>();
  for (const teamName of DEFAULT_TEAMS) {
    const normalizedName = normalizeTeamName(teamName);
    teamByName.set(normalizedName.toLowerCase(), {
      id: `virtual:${normalizedName.toLowerCase().replace(/\s+/g, "-")}`,
      name: normalizedName,
      description: "",
      createdBy: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  for (const team of storedTeams) {
    teamByName.set(team.name.toLowerCase(), team);
  }
  for (const authUser of authUsers) {
    for (const teamName of getUserTeams(authUser)) {
      const normalizedName = normalizeTeamName(teamName);
      const key = normalizedName.toLowerCase();
      if (!teamByName.has(key)) {
        teamByName.set(key, {
          id: `virtual:${key.replace(/\s+/g, "-")}`,
          name: normalizedName,
          description: "",
          createdBy: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }
  for (const project of projects) {
    const names = normalizeStringArray([
      project.team,
      ...(Array.isArray(project.visibleTeams) ? project.visibleTeams : []),
    ]);
    for (const teamName of names) {
      const normalizedName = normalizeTeamName(teamName);
      const key = normalizedName.toLowerCase();
      if (!teamByName.has(key)) {
        teamByName.set(key, {
          id: `virtual:${key.replace(/\s+/g, "-")}`,
          name: normalizedName,
          description: "",
          createdBy: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  const membersByTeam = new Map<string, Array<{ id: string; name: string; email: string; role: AppRole }>>();
  for (const authUser of authUsers) {
    const member = {
      id: authUser.id,
      name: authUser.user_metadata?.name || authUser.email || "User",
      email: authUser.email || "",
      role: serializeRole(authUser.user_metadata?.role),
    };
    for (const teamName of getUserTeams(authUser)) {
      const key = normalizeTeamName(teamName).toLowerCase();
      const list = membersByTeam.get(key) || [];
      list.push(member);
      membersByTeam.set(key, list);
    }
  }

  return Array.from(teamByName.values())
    .map((team) => {
      const key = normalizeTeamName(team.name).toLowerCase();
      const members = membersByTeam.get(key) || [];
      return {
        id: team.id,
        name: team.name,
        description: team.description || "",
        memberCount: members.length,
        members,
        createdBy: team.createdBy || "",
        createdAt: team.createdAt || new Date().toISOString(),
        updatedAt: team.updatedAt || team.createdAt || new Date().toISOString(),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function ensureStoredTeams(teamNames: string[], actorId: string) {
  const existing = await readTeams();
  const existingNames = new Set(existing.map((team) => team.name.toLowerCase()));
  for (const teamName of teamNames) {
    const normalizedName = normalizeTeamName(teamName);
    if (!normalizedName) continue;
    if (existingNames.has(normalizedName.toLowerCase())) continue;
    const teamId = crypto.randomUUID();
    const payload = normalizeTeamForStorage({ name: normalizedName, description: "" }, actorId);
    await kv.set(`team:${teamId}`, {
      ...payload,
      id: teamId,
      createdBy: actorId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    existingNames.add(normalizedName.toLowerCase());
  }
}

async function collectKnownTeamNames() {
  const [projects, users] = await Promise.all([
    readProjects(),
    listAuthUsers(false),
  ]);

  return normalizeStringArray([
    ...DEFAULT_TEAMS,
    ...projects.map((project) => project.team || ""),
    ...projects.flatMap((project) => (Array.isArray(project.visibleTeams) ? project.visibleTeams : [])),
    ...users.flatMap((authUser) => getUserTeams(authUser)),
  ]);
}

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/server/health", (c) => {
  return c.json({ status: "ok" });
});

// ==================== AUTH ROUTES ====================

// Sign up new user
app.post("/server/signup", async (c) => {
  try {
    const payload = await c.req.json();
    const parsed = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(1),
    }).safeParse(payload);

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const { email, password, name } = parsed.data;
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role: "user", isActive: true },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.error('Signup error:', error);
      return c.json({ error: error.message }, 400);
    }

    return c.json({ user: data.user });
  } catch (err) {
    console.error('Signup exception:', err);
    return c.json({ error: 'Signup failed' }, 500);
  }
});

// Check if demo account exists and create if needed
app.post("/server/setup-demo", async (c) => {
  try {
    const demoEmail = 'demo@taskflow.com';
    const demoPassword = 'demo123';
    const demoName = 'Demo User';

    const usersResult = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersResult.error) {
      return c.json({ error: usersResult.error.message }, 500);
    }

    const existing = usersResult.data.users.find(
      (user) => (user.email || '').toLowerCase() === demoEmail,
    );

    if (existing?.id) {
      await supabase.auth.admin.updateUserById(existing.id, {
        password: demoPassword,
        user_metadata: {
          ...(existing.user_metadata || {}),
          name: demoName,
          role: "user",
          isActive: true,
        },
      });
      return c.json({ message: 'Demo account already exists', exists: true });
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      user_metadata: { name: demoName, role: "user", isActive: true },
      email_confirm: true
    });

    if (error || !data.user) {
      return c.json({ error: error?.message || "Failed to create demo account" }, 400);
    }

    return c.json({ message: 'Demo account created', exists: false });
  } catch (err) {
    console.error('Setup demo error:', err);
    return c.json({ error: 'Failed to setup demo account' }, 500);
  }
});

app.get("/server/me", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const teams = getUserTeams(user);

    return c.json({
      user: {
        id: user.id,
        email: user.email || "",
        name: user.user_metadata?.name || "User",
        role: getRoleFromUser(user),
        isActive: isUserActive(user),
        team: teams[0] || "",
        teams,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    return c.json({ error: "Failed to fetch profile" }, 500);
  }
});

app.get("/server/users", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);

    const role = getRoleFromUser(user);
    if (!canManageTeams(role) && !canManageUsers(role)) {
      return c.json({
        users: [{
          id: user.id,
          email: user.email || "",
          name: user.user_metadata?.name || "User",
          role,
          isActive: isUserActive(user),
          teams: getUserTeams(user),
        }],
      });
    }

    const usersResult = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersResult.error) {
      return c.json({ error: usersResult.error.message }, 500);
    }

    return c.json({
      users: usersResult.data.users
        .filter((authUser) => authUser.user_metadata?.isActive !== false)
        .map((authUser) => ({
          id: authUser.id,
          email: authUser.email || "",
          name: authUser.user_metadata?.name || authUser.email || "User",
          role: authUser.user_metadata?.role === "admin"
            ? "admin"
            : authUser.user_metadata?.role === "team_lead"
            ? "team_lead"
            : "user",
          isActive: authUser.user_metadata?.isActive !== false,
          teams: getUserTeams(authUser),
        })),
    });
  } catch (error) {
    console.error("Get users error:", error);
    return c.json({ error: "Failed to fetch users" }, 500);
  }
});

app.get("/server/admin/users", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    if (!canManageUsers(getRoleFromUser(user))) return c.json({ error: "Forbidden" }, 403);

    const usersResult = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersResult.error) {
      return c.json({ error: usersResult.error.message }, 500);
    }

    return c.json({
      users: usersResult.data.users.map((authUser) => ({
        id: authUser.id,
        email: authUser.email || "",
        fullName: authUser.user_metadata?.name || authUser.email || "User",
        role: authUser.user_metadata?.role === "admin"
          ? "admin"
          : authUser.user_metadata?.role === "team_lead"
          ? "team_lead"
          : "user",
        isActive: authUser.user_metadata?.isActive !== false,
        teams: getUserTeams(authUser),
        createdAt: authUser.created_at,
        updatedAt: authUser.updated_at,
      })),
    });
  } catch (error) {
    console.error("Admin list users error:", error);
    return c.json({ error: "Failed to fetch users" }, 500);
  }
});

app.post("/server/admin/users", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    if (!canManageUsers(getRoleFromUser(user))) return c.json({ error: "Forbidden" }, 403);

    const parsed = AdminCreateUserSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const payload = parsed.data;
    const created = await supabase.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        name: payload.fullName,
        role: payload.role,
        isActive: payload.isActive,
      },
    });

    if (created.error || !created.data.user?.id) {
      return c.json({ error: created.error?.message || "Failed to create user" }, 400);
    }

    return c.json({
      user: {
        id: created.data.user.id,
        email: payload.email,
        fullName: payload.fullName,
        role: payload.role,
        isActive: payload.isActive,
      },
    });
  } catch (error) {
    console.error("Admin create user error:", error);
    return c.json({ error: "Failed to create user" }, 500);
  }
});

app.put("/server/admin/users/:id", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    if (!canManageUsers(getRoleFromUser(user))) return c.json({ error: "Forbidden" }, 403);

    const parsed = AdminUpdateUserSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const userId = c.req.param("id");
    const current = await supabase.auth.admin.getUserById(userId);
    if (current.error || !current.data.user?.id) {
      return c.json({ error: "User not found" }, 404);
    }

    const existingMetadata = current.data.user.user_metadata || {};
    const nextMetadata = {
      ...existingMetadata,
      ...(parsed.data.fullName ? { name: parsed.data.fullName } : {}),
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {}),
    };

    const updated = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: nextMetadata,
    });

    if (updated.error) {
      return c.json({ error: updated.error.message }, 400);
    }

    return c.json({
      user: {
        id: userId,
        email: updated.data.user?.email || current.data.user.email || "",
        fullName: nextMetadata.name || "User",
        role: nextMetadata.role === "admin"
          ? "admin"
          : nextMetadata.role === "team_lead"
          ? "team_lead"
          : "user",
        isActive: nextMetadata.isActive !== false,
      },
    });
  } catch (error) {
    console.error("Admin update user error:", error);
    return c.json({ error: "Failed to update user" }, 500);
  }
});

app.delete("/server/admin/users/:id", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    if (!canManageUsers(getRoleFromUser(user))) return c.json({ error: "Forbidden" }, 403);

    const userId = c.req.param("id");
    if (userId === user.id) {
      return c.json({ error: "You cannot delete your own account while signed in" }, 400);
    }

    const current = await supabase.auth.admin.getUserById(userId);
    if (current.error || !current.data.user?.id) {
      return c.json({ error: "User not found" }, 404);
    }

    const deleted = await supabase.auth.admin.deleteUser(userId);
    if (deleted.error) {
      return c.json({ error: deleted.error.message }, 400);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Admin delete user error:", error);
    return c.json({ error: "Failed to delete user" }, 500);
  }
});

// ==================== SETTINGS ROUTES ====================

app.get("/server/settings", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const role = getRoleFromUser(user);
    if (!canManageSystemSettings(role)) return c.json({ error: "Forbidden" }, 403);

    const settings = await readAppSettings();
    return c.json({ settings });
  } catch (error) {
    console.error("Get settings error:", error);
    return c.json({ error: "Failed to fetch settings" }, 500);
  }
});

app.put("/server/settings", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const role = getRoleFromUser(user);
    if (!canManageSystemSettings(role)) return c.json({ error: "Forbidden" }, 403);

    const parsed = AppSettingsPayloadSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const existing = await readAppSettings();
    const nextSettings = normalizeAppSettingsRecord({
      ...existing,
      ...parsed.data,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    });

    await kv.set("settings:global", nextSettings);
    return c.json({ settings: nextSettings });
  } catch (error) {
    console.error("Update settings error:", error);
    return c.json({ error: "Failed to update settings" }, 500);
  }
});

// ==================== TEAM ROUTES ====================

app.get("/server/teams", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);

    await ensureStoredTeams(await collectKnownTeamNames(), user.id);
    const teams = await serializeTeams();
    return c.json({ teams });
  } catch (error) {
    console.error("Get teams error:", error);
    return c.json({ error: "Failed to fetch teams" }, 500);
  }
});

app.post("/server/teams", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const role = getRoleFromUser(user);
    if (!canManageTeams(role)) return c.json({ error: "Forbidden" }, 403);

    await ensureStoredTeams(await collectKnownTeamNames(), user.id);
    const parsed = TeamPayloadSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const nextName = normalizeTeamName(parsed.data.name);
    const existing = await serializeTeams();
    if (existing.some((team) => team.name.toLowerCase() === nextName.toLowerCase())) {
      return c.json({ error: "Team name already exists" }, 400);
    }

    const teamId = crypto.randomUUID();
    const normalized = normalizeTeamForStorage(parsed.data, user.id);
    const teamData = {
      ...normalized,
      id: teamId,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`team:${teamId}`, teamData);

    const teams = await serializeTeams();
    const team = teams.find((entry) => entry.id === teamId);
    return c.json({ team });
  } catch (error) {
    console.error("Create team error:", error);
    return c.json({ error: "Failed to create team" }, 500);
  }
});

app.put("/server/teams/:id", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const role = getRoleFromUser(user);
    if (!canManageTeams(role)) return c.json({ error: "Forbidden" }, 403);

    await ensureStoredTeams(await collectKnownTeamNames(), user.id);
    const teamId = c.req.param("id");
    const parsed = TeamPayloadSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const keys = await findTeamStorageKeys(teamId);
    if (keys.length === 0) {
      return c.json({ error: "Team not found" }, 404);
    }
    const existingRaw = await kv.get(keys[0]);
    const existing = normalizeTeamRecord(unwrapStoredValue(existingRaw));
    if (!existing) {
      return c.json({ error: "Team not found" }, 404);
    }

    const nextName = normalizeTeamName(parsed.data.name);
    const teams = await serializeTeams();
    if (
      teams.some((team) => team.id !== teamId && team.name.toLowerCase() === nextName.toLowerCase())
    ) {
      return c.json({ error: "Team name already exists" }, 400);
    }

    const normalized = normalizeTeamForStorage(
      {
        ...existing,
        ...parsed.data,
      },
      existing.createdBy || user.id,
    );
    const updated = {
      ...existing,
      ...normalized,
      id: teamId,
      createdBy: existing.createdBy || user.id,
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`team:${teamId}`, updated);
    const legacyKeys = keys.filter((key) => key !== `team:${teamId}`);
    if (legacyKeys.length > 0) await kv.mdel(legacyKeys);

    if (existing.name !== updated.name) {
      await replaceTeamInUsers(existing.name, updated.name);
      await replaceTeamInProjects(existing.name, updated.name);
    }

    const refreshed = await serializeTeams();
    const team = refreshed.find((entry) => entry.id === teamId);
    return c.json({ team });
  } catch (error) {
    console.error("Update team error:", error);
    return c.json({ error: "Failed to update team" }, 500);
  }
});

app.put("/server/teams/:id/members", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const role = getRoleFromUser(user);
    if (!canManageTeams(role)) return c.json({ error: "Forbidden" }, 403);

    await ensureStoredTeams(await collectKnownTeamNames(), user.id);
    const teamId = c.req.param("id");
    const parsed = TeamMembersPayloadSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const keys = await findTeamStorageKeys(teamId);
    if (keys.length === 0) {
      return c.json({ error: "Team not found" }, 404);
    }
    const existingRaw = await kv.get(keys[0]);
    const existing = normalizeTeamRecord(unwrapStoredValue(existingRaw));
    if (!existing) {
      return c.json({ error: "Team not found" }, 404);
    }

    await setTeamMembers(existing.name, normalizeStringArray(parsed.data.memberIds));
    const teams = await serializeTeams();
    const team = teams.find((entry) => entry.id === teamId);
    return c.json({ team });
  } catch (error) {
    console.error("Update team members error:", error);
    return c.json({ error: "Failed to update team members" }, 500);
  }
});

app.delete("/server/teams/:id", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const role = getRoleFromUser(user);
    if (!canManageTeams(role)) return c.json({ error: "Forbidden" }, 403);

    await ensureStoredTeams(await collectKnownTeamNames(), user.id);
    const teamId = c.req.param("id");
    const teams = await serializeTeams();
    const team = teams.find((entry) => entry.id === teamId);
    if (!team) {
      return c.json({ error: "Team not found" }, 404);
    }
    if (isDefaultTeamName(team.name)) {
      return c.json({ error: "Default teams cannot be deleted" }, 400);
    }

    const keys = await findTeamStorageKeys(teamId);
    if (keys.length > 0) {
      await kv.mdel(keys);
    } else {
      // Virtual teams can still be removed by name from users/projects.
      const storedTeams = await readTeams();
      const targetName = normalizeTeamName(team.name).toLowerCase();
      const matchingStoredKeys = storedTeams
        .filter((entry) => normalizeTeamName(entry.name).toLowerCase() === targetName)
        .map((entry) => `team:${entry.id}`);
      if (matchingStoredKeys.length > 0) {
        await kv.mdel(matchingStoredKeys);
      }
    }
    await replaceTeamInUsers(team.name, null);
    await replaceTeamInProjects(team.name, null);

    return c.json({ success: true });
  } catch (error) {
    console.error("Delete team error:", error);
    return c.json({ error: "Failed to delete team" }, 500);
  }
});

// ==================== PROJECT ROUTES ====================

// Get all projects for a user
app.get("/server/projects", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);

    const role = getRoleFromUser(user);
    const directory = await getUserDirectoryFast();
    const projects = (await readProjects())
      .filter((project) => canViewProject(project, user, role))
      .sort((a, b) => {
        const aTs = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTs = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTs - aTs;
      })
      .map((project) => serializeProject(project, directory));

    const groupedServerSide = projects.length > 1000;
    const clientGroups = groupedServerSide ? buildClientGroups(projects) : undefined;

    return c.json({ projects, groupedServerSide, clientGroups });
  } catch (err) {
    console.error("Get projects error:", err);
    return c.json({ error: 'Failed to fetch projects' }, 500);
  }
});

// Create new project
app.post("/server/projects", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const role = getRoleFromUser(user);
    if (!canCreateProject(role)) return c.json({ error: "Forbidden" }, 403);

    const parsed = ProjectPayloadSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const projectId = crypto.randomUUID();
    const normalized = normalizeProjectForStorage(parsed.data, user.id);
    const projectData = {
      ...normalized,
      id: projectId,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`project:${projectId}`, projectData);
    const directory = await getUserDirectoryFast();
    const normalizedRecord = normalizeProjectRecord(projectData);
    if (!normalizedRecord) {
      return c.json({ error: "Failed to normalize project data" }, 500);
    }
    return c.json({ project: serializeProject(normalizedRecord, directory) });
  } catch (err) {
    console.error("Create project error:", err);
    return c.json({ error: 'Failed to create project' }, 500);
  }
});

// Update project
app.put("/server/projects/:id", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const role = getRoleFromUser(user);

    const projectId = c.req.param("id");
    const parsed = ProjectPayloadSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const existingKeys = await findProjectStorageKeys(projectId);
    if (existingKeys.length === 0) {
      return c.json({ error: "Project not found" }, 404);
    }

    const existingRaw = await kv.get(existingKeys[0]);
    const existing = normalizeProjectRecord(unwrapStoredValue(existingRaw));
    if (!existing) {
      return c.json({ error: "Project not found" }, 404);
    }
    if (!canEditProject(existing, user, role)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const normalized = normalizeProjectForStorage(parsed.data, existing.createdBy || user.id);
    const updatedProject = {
      ...existing,
      ...normalized,
      id: projectId,
      createdBy: existing.createdBy || user.id,
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const canonicalKey = `project:${projectId}`;
    await kv.set(canonicalKey, updatedProject);
    const legacyKeys = existingKeys.filter((key) => key !== canonicalKey);
    if (legacyKeys.length > 0) {
      await kv.mdel(legacyKeys);
    }

    const directory = await getUserDirectoryFast();
    const normalizedRecord = normalizeProjectRecord(updatedProject);
    if (!normalizedRecord) {
      return c.json({ error: "Failed to normalize project data" }, 500);
    }
    return c.json({ project: serializeProject(normalizedRecord, directory) });
  } catch (err) {
    console.error("Update project error:", err);
    return c.json({ error: 'Failed to update project' }, 500);
  }
});

// Add project note
app.post("/server/projects/:id/notes", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);

    const role = getRoleFromUser(user);
    const projectId = c.req.param("id");
    const parsed = ProjectNotePayloadSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const existingKeys = await findProjectStorageKeys(projectId);
    if (existingKeys.length === 0) {
      return c.json({ error: "Project not found" }, 404);
    }

    const existingRaw = await kv.get(existingKeys[0]);
    const existing = normalizeProjectRecord(unwrapStoredValue(existingRaw));
    if (!existing) {
      return c.json({ error: "Project not found" }, 404);
    }
    if (!canViewProject(existing, user, role)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const noteEntry = {
      id: crypto.randomUUID(),
      body: parsed.data.note.trim(),
      createdBy: user.id,
      createdByName: user.user_metadata?.name || user.email || "User",
      createdAt: new Date().toISOString(),
    };
    const normalized = normalizeProjectForStorage(
      {
        ...existing,
        notes: [...(Array.isArray(existing.notes) ? existing.notes : []), noteEntry],
      },
      existing.createdBy || user.id,
    );
    const updatedProject = {
      ...existing,
      ...normalized,
      id: projectId,
      createdBy: existing.createdBy || user.id,
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const canonicalKey = `project:${projectId}`;
    await kv.set(canonicalKey, updatedProject);
    const legacyKeys = existingKeys.filter((key) => key !== canonicalKey);
    if (legacyKeys.length > 0) {
      await kv.mdel(legacyKeys);
    }

    const directory = await getUserDirectoryFast();
    const normalizedRecord = normalizeProjectRecord(updatedProject);
    if (!normalizedRecord) {
      return c.json({ error: "Failed to normalize project data" }, 500);
    }
    return c.json({ project: serializeProject(normalizedRecord, directory) });
  } catch (err) {
    console.error("Add project note error:", err);
    return c.json({ error: "Failed to add note" }, 500);
  }
});

// Delete project
app.delete("/server/projects/:id", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const role = getRoleFromUser(user);

    const projectId = c.req.param("id");
    const projectKeys = await findProjectStorageKeys(projectId);
    if (projectKeys.length === 0) {
      return c.json({ error: "Project not found" }, 404);
    }

    const existingRaw = await kv.get(projectKeys[0]);
    const existing = normalizeProjectRecord(unwrapStoredValue(existingRaw));
    if (!existing) {
      return c.json({ error: "Project not found" }, 404);
    }
    if (!canDeleteProject(existing, user, role)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await kv.mdel(projectKeys);

    const tasks = await kv.getByPrefix("task:");
    const taskKeys = tasks
      .filter((row) => normalizeTaskRecord(unwrapStoredValue(row))?.projectId === projectId)
      .map((row) => row?.key)
      .filter((key): key is string => typeof key === "string" && key.length > 0);

    if (taskKeys.length > 0) {
      await kv.mdel(taskKeys);
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("Delete project error:", err);
    return c.json({ error: 'Failed to delete project' }, 500);
  }
});

// ==================== TASK ROUTES ====================

// Get all tasks for a user
app.get("/server/tasks", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);

    const role = getRoleFromUser(user);
    const directory = await getUserDirectoryFast();
    const projects = (await readProjects()).filter((project) => canViewProject(project, user, role));
    const projectMap = projects.reduce((acc, project) => {
      acc[project.id] = project;
      return acc;
    }, {} as Record<string, any>);

    const tasks = (await readTasks())
      .filter((task) => projectMap[task.projectId])
      .filter((task) => canViewTask(task, projectMap[task.projectId], user, role))
      .sort((a, b) => {
        const aTs = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTs = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTs - aTs;
      })
      .map((task) => serializeTask(task, projectMap, directory));

    return c.json({ tasks });
  } catch (err) {
    console.error("Get tasks error:", err);
    return c.json({ error: 'Failed to fetch tasks' }, 500);
  }
});

// Create new task
app.post("/server/tasks", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const role = getRoleFromUser(user);
    if (!canCreateTask(role)) return c.json({ error: "Forbidden" }, 403);

    const parsed = TaskPayloadSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const projects = await readProjects();
    const project = projects.find((entry) => entry.id === parsed.data.projectId);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }
    if (!canViewProject(project, user, role)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const taskId = crypto.randomUUID();
    const existingTasks = await readTasks();
    const normalized = normalizeTaskForStorage(parsed.data);
    normalized.taskId = normalized.taskId || generateTaskIdentifier(existingTasks, normalized.projectId);
    if (role === "user" && normalized.visibleUserIds.length === 0) {
      const sameTeamMemberIds = await resolveTeamMemberIds(project);
      normalized.visibleUserIds = normalizeStringArray([
        ...sameTeamMemberIds,
        normalized.assignedTo,
        normalized.requestedBy,
        user.id,
      ]);
    }
    const taskData = {
      ...normalized,
      id: taskId,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`task:${taskId}`, taskData);
    const directory = await getUserDirectoryFast();
    const projectMap = projects.reduce((acc, project) => {
      acc[project.id] = project;
      return acc;
    }, {} as Record<string, any>);
    return c.json({ task: serializeTask(taskData, projectMap, directory) });
  } catch (err) {
    console.error("Create task error:", err);
    return c.json({ error: 'Failed to create task' }, 500);
  }
});

// Update task
app.put("/server/tasks/:id", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const role = getRoleFromUser(user);

    const taskId = c.req.param("id");
    const parsed = TaskPayloadSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const existingKeys = await findTaskStorageKeys(taskId);
    if (existingKeys.length === 0) {
      return c.json({ error: "Task not found" }, 404);
    }

    const existingRaw = await kv.get(existingKeys[0]);
    const existing = normalizeTaskRecord(unwrapStoredValue(existingRaw));
    if (!existing) {
      return c.json({ error: "Task not found" }, 404);
    }

    const projects = await readProjects();
    const targetProject = projects.find((project) => project.id === parsed.data.projectId);
    if (!targetProject) {
      return c.json({ error: "Project not found" }, 404);
    }
    const currentProject = projects.find((project) => project.id === existing.projectId);
    if (!currentProject) {
      return c.json({ error: "Project not found" }, 404);
    }
    if (!canEditTask(existing, currentProject, user, role)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (!canViewProject(targetProject, user, role)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const normalized = normalizeTaskForStorage(parsed.data);
    normalized.taskId = normalized.taskId || existing.taskId || generateTaskIdentifier(await readTasks(), normalized.projectId);
    if (role === "user" && normalized.visibleUserIds.length === 0) {
      const sameTeamMemberIds = await resolveTeamMemberIds(targetProject);
      normalized.visibleUserIds = normalizeStringArray([
        ...sameTeamMemberIds,
        normalized.assignedTo,
        normalized.requestedBy,
        existing.createdBy || user.id,
      ]);
    }
    const updatedTask = {
      ...existing,
      ...normalized,
      id: taskId,
      createdBy: existing.createdBy || user.id,
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const canonicalKey = `task:${taskId}`;
    await kv.set(canonicalKey, updatedTask);
    const legacyKeys = existingKeys.filter((key) => key !== canonicalKey);
    if (legacyKeys.length > 0) {
      await kv.mdel(legacyKeys);
    }

    const directory = await getUserDirectoryFast();
    const projectMap = projects.reduce((acc, project) => {
      acc[project.id] = project;
      return acc;
    }, {} as Record<string, any>);
    return c.json({ task: serializeTask(updatedTask, projectMap, directory) });
  } catch (err) {
    console.error("Update task error:", err);
    return c.json({ error: 'Failed to update task' }, 500);
  }
});

// Delete task
app.delete("/server/tasks/:id", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const role = getRoleFromUser(user);

    const taskId = c.req.param("id");
    const keys = await findTaskStorageKeys(taskId);
    if (keys.length === 0) {
      return c.json({ error: "Task not found" }, 404);
    }

    const existingRaw = await kv.get(keys[0]);
    const existing = normalizeTaskRecord(unwrapStoredValue(existingRaw));
    if (!existing) {
      return c.json({ error: "Task not found" }, 404);
    }

    const projects = await readProjects();
    const project = projects.find((entry) => entry.id === existing.projectId);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }
    if (!canDeleteTask(existing, project, user, role)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await kv.mdel(keys);
    return c.json({ success: true });
  } catch (err) {
    console.error("Delete task error:", err);
    return c.json({ error: 'Failed to delete task' }, 500);
  }
});

// ==================== AV SCHEDULE ROUTES ====================

app.get("/server/av-schedule", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const role = getRoleFromUser(user);
    if (!canViewAvSchedule(user, role)) return c.json({ error: "Forbidden" }, 403);

    const directory = await getUserDirectoryFast();
    const entries = (await readAvSchedules())
      .sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        if (byDate !== 0) return byDate;
        const aTs = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTs = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTs - aTs;
      })
      .map((entry) => serializeAvSchedule(entry, directory));

    return c.json({ entries });
  } catch (err) {
    console.error("Get AV schedule error:", err);
    return c.json({ error: "Failed to fetch AV schedule" }, 500);
  }
});

app.post("/server/av-schedule", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const role = getRoleFromUser(user);
    if (!canViewAvSchedule(user, role)) return c.json({ error: "Forbidden" }, 403);

    const parsed = AvSchedulePayloadSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const payload = parsed.data;
    const existing = (await readAvSchedules()).find(
      (entry) => entry.userId === user.id && entry.date === payload.date,
    );

    const entryId = existing?.id || crypto.randomUUID();
    const nextEntry = normalizeAvScheduleRecord({
      ...(existing || {}),
      id: entryId,
      userId: user.id,
      date: payload.date,
      whereabouts: payload.whereabouts,
      workMode: payload.workMode,
      note: payload.note || "",
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (!nextEntry) {
      return c.json({ error: "Invalid schedule payload" }, 400);
    }

    await kv.set(`av-schedule:${entryId}`, nextEntry);
    const directory = await getUserDirectoryFast();
    return c.json({ entry: serializeAvSchedule(nextEntry, directory) });
  } catch (err) {
    console.error("Create AV schedule error:", err);
    return c.json({ error: "Failed to save AV schedule" }, 500);
  }
});

app.put("/server/av-schedule/:id", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const role = getRoleFromUser(user);
    if (!canViewAvSchedule(user, role)) return c.json({ error: "Forbidden" }, 403);

    const entryId = c.req.param("id");
    const parsed = AvSchedulePayloadSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const keys = await findAvScheduleStorageKeys(entryId);
    if (keys.length === 0) {
      return c.json({ error: "Schedule entry not found" }, 404);
    }

    const existingRaw = await kv.get(keys[0]);
    const existing = normalizeAvScheduleRecord(unwrapStoredValue(existingRaw));
    if (!existing) {
      return c.json({ error: "Schedule entry not found" }, 404);
    }
    if (!canManageAvScheduleEntry(existing, user, role)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const nextEntry = normalizeAvScheduleRecord({
      ...existing,
      date: parsed.data.date,
      whereabouts: parsed.data.whereabouts,
      workMode: parsed.data.workMode,
      note: parsed.data.note || "",
      updatedAt: new Date().toISOString(),
    });
    if (!nextEntry) {
      return c.json({ error: "Invalid schedule payload" }, 400);
    }

    const canonicalKey = `av-schedule:${entryId}`;
    await kv.set(canonicalKey, nextEntry);
    const legacyKeys = keys.filter((key) => key !== canonicalKey);
    if (legacyKeys.length > 0) {
      await kv.mdel(legacyKeys);
    }

    const directory = await getUserDirectoryFast();
    return c.json({ entry: serializeAvSchedule(nextEntry, directory) });
  } catch (err) {
    console.error("Update AV schedule error:", err);
    return c.json({ error: "Failed to update AV schedule" }, 500);
  }
});

app.delete("/server/av-schedule/:id", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const role = getRoleFromUser(user);
    if (!canViewAvSchedule(user, role)) return c.json({ error: "Forbidden" }, 403);

    const entryId = c.req.param("id");
    const keys = await findAvScheduleStorageKeys(entryId);
    if (keys.length === 0) {
      return c.json({ error: "Schedule entry not found" }, 404);
    }

    const existingRaw = await kv.get(keys[0]);
    const existing = normalizeAvScheduleRecord(unwrapStoredValue(existingRaw));
    if (!existing) {
      return c.json({ error: "Schedule entry not found" }, 404);
    }
    if (!canManageAvScheduleEntry(existing, user, role)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await kv.mdel(keys);
    return c.json({ success: true });
  } catch (err) {
    console.error("Delete AV schedule error:", err);
    return c.json({ error: "Failed to delete AV schedule" }, 500);
  }
});

// ==================== QUOTA ROUTES ====================

app.get("/server/quota-target", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);

    const target = await readUserQuotaTargetRecord(user.id);
    return c.json(target);
  } catch (err) {
    console.error("Get quota target error:", err);
    return c.json({ error: "Failed to fetch quota target" }, 500);
  }
});

app.get("/server/quota-targets", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);
    const role = getRoleFromUser(user);
    if (!canManageUsers(role)) return c.json({ error: "Forbidden" }, 403);

    const usersResult = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersResult.error) {
      return c.json({ error: usersResult.error.message }, 500);
    }

    const activeUsers = (usersResult.data.users || []).filter((entry) => isUserActive(entry));
    const userMap = new Map(
      activeUsers.map((entry) => [
        entry.id,
        {
          userId: entry.id,
          email: entry.email || "",
          name: entry.user_metadata?.name || entry.email || "User",
          role: serializeRole(entry.user_metadata?.role),
          teams: getUserTeams(entry),
        },
      ]),
    );

    const targets = await listQuotaTargets();
    const targetByUser = new Map(targets.map((target) => [target.userId, target]));
    const merged = activeUsers.map((entry) => {
      const record = targetByUser.get(entry.id);
      const base = userMap.get(entry.id)!;
      return {
        ...base,
        amount: record?.amount || 0,
        updatedAt: record?.updatedAt || "",
      };
    });

    return c.json({ targets: merged });
  } catch (err) {
    console.error("Get quota targets error:", err);
    return c.json({ error: "Failed to fetch quota targets" }, 500);
  }
});

app.get("/server/quota", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);

    const role = getRoleFromUser(user);
    const directory = await getUserDirectoryFast();
    const records = (await readProjects())
      .filter((project) => canViewProject(project, user, role))
      .map((project) => serializeProject(project, directory))
      .sort((a, b) => {
        const aTs = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTs = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTs - aTs;
      });

    const proposals = records.filter((project) => project.projectType === "proposal");
    const projects = records.filter((project) => project.projectType === "project");
    const userQuotaTargetRecord = await readUserQuotaTargetRecord(user.id);
    const userQuotaTarget = userQuotaTargetRecord.amount;
    const userQuotaProgressPercent = userQuotaTarget > 0
      ? Number(Math.min(100, (grandTotal / userQuotaTarget) * 100).toFixed(2))
      : 0;
    const userQuotaProgressPercentRaw = userQuotaTarget > 0
      ? Number(((grandTotal / userQuotaTarget) * 100).toFixed(2))
      : 0;
    const userQuotaRemainingAmount = userQuotaTarget > 0 ? Math.max(0, userQuotaTarget - grandTotal) : 0;
    const userQuotaExceededAmount = userQuotaTarget > 0 ? Math.max(0, grandTotal - userQuotaTarget) : 0;

    const proposalAmount = proposals.reduce((sum, project) => sum + getProjectAmount(project), 0);
    const projectAmount = projects.reduce((sum, project) => sum + getProjectAmount(project), 0);
    const grandTotal = proposalAmount + projectAmount;

    const totalProposals = proposals.length;
    const totalProjects = projects.length;
    const activeProjects = projects.filter(
      (project) => project.status !== "Completed" && project.status !== "Cancelled",
    ).length;
    const openProposals = proposals.filter(
      (project) => project.status !== "Completed" && project.status !== "Cancelled",
    ).length;
    const completedProjects = projects.filter((project) => project.status === "Completed").length;

    const convertedProjects = projects.filter(
      (project) => typeof project.sourceProposalId === "string" && project.sourceProposalId.trim().length > 0,
    ).length;
    const conversionRate = totalProposals > 0
      ? Number(((convertedProjects / totalProposals) * 100).toFixed(2))
      : 0;

    const monthlyMap = new Map<string, { month: string; proposalAmount: number; projectAmount: number }>();
    for (const project of records) {
      const month = toMonthKey(project.startDate || project.createdAt || project.updatedAt || "");
      if (!month) continue;

      const amount = getProjectAmount(project);
      const current = monthlyMap.get(month) || { month, proposalAmount: 0, projectAmount: 0 };
      if (project.projectType === "proposal") {
        current.proposalAmount += amount;
      } else {
        current.projectAmount += amount;
      }
      monthlyMap.set(month, current);
    }
    const monthlyTrend = Array.from(monthlyMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((entry) => ({
        ...entry,
        totalAmount: entry.proposalAmount + entry.projectAmount,
      }));

    return c.json({
      summary: {
        totalProposals,
        totalProjects,
        proposalAmount,
        projectAmount,
        grandTotal,
        activeProjects,
        openProposals,
        completedProjects,
        total_proposals: totalProposals,
        total_projects: totalProjects,
        proposal_amount: proposalAmount,
        project_amount: projectAmount,
        grand_total: grandTotal,
      },
      quotaMetrics: {
        proposalPipelineAmount: proposalAmount,
        activeDeliveryAmount: projectAmount,
        conversionCount: convertedProjects,
        conversionRate,
        averageProposalValue: totalProposals > 0 ? proposalAmount / totalProposals : 0,
        averageProjectValue: totalProjects > 0 ? projectAmount / totalProjects : 0,
      },
      statusBreakdown: {
        all: buildStatusCounts(records),
        proposals: buildStatusCounts(proposals),
        projects: buildStatusCounts(projects),
      },
      groupedTotals: {
        byClient: buildGroupedTotals(records, (project) => project.client || "Unassigned Client"),
        byAccountManager: buildGroupedTotals(records, (project) => project.accountManager || "Unassigned"),
        byTeam: buildGroupedTotals(records, (project) => project.team || "Unassigned"),
      },
      monthlyTrend,
      userQuotaTarget,
      userQuotaProgressPercent,
      userQuotaProgressPercentRaw,
      userQuotaRemainingAmount,
      userQuotaExceededAmount,
      userQuotaTargetUpdatedAt: userQuotaTargetRecord.updatedAt,
      proposals,
      projects,
      records,
    });
  } catch (err) {
    console.error("Get quota data error:", err);
    return c.json({ error: "Failed to fetch quota data" }, 500);
  }
});

app.put("/server/quota-target", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);

    const parsed = QuotaTargetPayloadSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const amount = Number.isFinite(parsed.data.amount) ? Math.max(0, parsed.data.amount) : 0;
    const updatedAt = new Date().toISOString();
    await kv.set(`quota-target:${user.id}`, {
      userId: user.id,
      amount,
      updatedAt,
    });

    return c.json({ userId: user.id, amount, updatedAt });
  } catch (err) {
    console.error("Update quota target error:", err);
    return c.json({ error: "Failed to update quota target" }, 500);
  }
});

// ==================== DASHBOARD ROUTES ====================

// Get dashboard statistics
app.get("/server/dashboard/stats", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user?.id) return c.json({ error: "Unauthorized" }, 401);

    const role = getRoleFromUser(user);
    const directory = await getUserDirectoryFast();
    const projects = (await readProjects()).filter((project) => canViewProject(project, user, role));
    const projectMap = projects.reduce((acc, project) => {
      acc[project.id] = project;
      return acc;
    }, {} as Record<string, any>);

    const tasks = (await readTasks())
      .filter((task) => projectMap[task.projectId])
      .filter((task) => canViewTask(task, projectMap[task.projectId], user, role));

    const serializedTasks = tasks.map((task) => serializeTask(task, projectMap, directory));
    const tasksByStatus = serializedTasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const tasksByPriority = serializedTasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const projectsByStatus = projects.reduce((acc, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const baseStats = {
      totalProjects: projects.length,
      totalTasks: serializedTasks.length,
      pendingTasks: serializedTasks.filter((task) => task.status === "Pending" || task.status === "Not Started").length,
      inProgressTasks: serializedTasks.filter((task) => task.status === "In Progress").length,
      completedTasks: serializedTasks.filter((task) => task.status === "Completed").length,
      overdueTasks: serializedTasks.filter((task) => task.isOverdue).length,
      tasksByStatus,
      tasksByPriority,
      projectsByStatus,
    };

    if (role === "admin") {
      const usersResult = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const totalUsers = usersResult.error
        ? 0
        : (usersResult.data.users || []).filter((authUser) => authUser.user_metadata?.isActive !== false).length;

      const projectsByAccountManager = projects.reduce((acc, project) => {
        const name = (project.accountManager || "").trim() || "Unassigned";
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return c.json({
        stats: {
          ...baseStats,
          totalUsers,
          projectsByAccountManager,
        },
      });
    }

    const assignedProjects = projects.filter((project) =>
      project.createdBy === user.id || (project.techAssignedIds || []).includes(user.id)
    ).length;
    const assignedTasks = serializedTasks.filter((task) => task.assignedTo === user.id).length;
    const inProgressAssignedTasks = serializedTasks.filter(
      (task) => task.assignedTo === user.id && task.status === "In Progress",
    ).length;

    return c.json({
      stats: {
        ...baseStats,
        assignedProjects,
        assignedTasks,
        inProgressAssignedTasks,
      },
    });
  } catch (err) {
    console.error("Get dashboard stats error:", err);
    return c.json({ error: 'Failed to fetch dashboard stats' }, 500);
  }
});

Deno.serve(app.fetch);


