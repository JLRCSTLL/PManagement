import { z } from 'zod';

export const UserRoleSchema = z.enum(['admin', 'team_lead', 'user']);
export const ProjectTypeSchema = z.enum(['proposal', 'project']);

export const ProjectReferenceLinkSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, 'Link label is required'),
  url: z.string().url('Valid URL is required'),
  note: z.string().optional().default(''),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export const ProjectNoteSchema = z.object({
  id: z.string(),
  body: z.string().min(1, 'Note cannot be empty'),
  createdBy: z.string().optional().default(''),
  createdByName: z.string().optional().default(''),
  createdAt: z.string(),
});

export const ProjectSchema = z.object({
  id: z.string(),
  projectName: z.string().min(1, 'Project name is required'),
  client: z.string().min(1, 'Client is required'),
  projectType: ProjectTypeSchema,
  description: z.string().optional().default(''),
  driveLink: z.string().optional().default(''),
  accountManager: z.string().min(1, 'Account Manager is required'),
  techAssignedIds: z.array(z.string()).default([]),
  techAssignedNames: z.array(z.string()).optional().default([]),
  visibleTeams: z.array(z.string()).default([]),
  visibleTeamNames: z.array(z.string()).optional().default([]),
  team: z.string().optional().default(''),
  amount: z.number().min(0, 'Amount cannot be negative'),
  startDate: z.string().optional().default(''),
  targetEndDate: z.string().optional().default(''),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  status: z.enum(['Not Started', 'In Progress', 'On Hold', 'Completed', 'Cancelled']),
  riskLevel: z.enum(['Low', 'Medium', 'High']),
  progress: z.number().min(0).max(100),
  referenceLinks: z.array(ProjectReferenceLinkSchema).default([]),
  notes: z.array(ProjectNoteSchema).default([]),
  createdBy: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastUpdated: z.string().optional(),
});

export const TaskSchema = z.object({
  id: z.string(),
  projectId: z.string().min(1, 'Project is required'),
  projectName: z.string().optional(),
  title: z.string().min(1, 'Task title is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  description: z.string().optional().default(''),
  assignedTo: z.string().optional().default(''),
  assignedToName: z.string().optional().default(''),
  requestedBy: z.string().optional().default(''),
  requestedByName: z.string().optional().default(''),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  status: z.enum(['Not Started', 'In Progress', 'Pending', 'Completed', 'Blocked']),
  startDate: z.string().optional().default(''),
  dueDate: z.string().optional().default(''),
  progress: z.number().min(0).max(100),
  dependencies: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  referenceLink: z.string().optional().default(''),
  visibleUserIds: z.array(z.string()).optional().default([]),
  daysRemaining: z.number().nullable().optional(),
  isOverdue: z.boolean().optional(),
  createdBy: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const AvScheduleModeSchema = z.enum(['In Office', 'WFH']);

export const AvScheduleEntrySchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string().optional().default(''),
  date: z.string().min(1, 'Date is required'),
  whereabouts: z.string().optional().default(''),
  workMode: AvScheduleModeSchema,
  note: z.string().optional().default(''),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional().default(''),
  fullName: z.string().optional(),
  role: UserRoleSchema.default('user'),
  isActive: z.boolean().default(true),
  team: z.string().optional(),
  teams: z.array(z.string()).optional(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type AvScheduleEntry = z.infer<typeof AvScheduleEntrySchema>;
export type User = z.infer<typeof UserSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export type ProjectType = z.infer<typeof ProjectTypeSchema>;
export type ProjectReferenceLink = z.infer<typeof ProjectReferenceLinkSchema>;
export type ProjectNote = z.infer<typeof ProjectNoteSchema>;
export type AvScheduleMode = z.infer<typeof AvScheduleModeSchema>;

export type ProjectFormData = Omit<Project, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'lastUpdated' | 'techAssignedNames' | 'visibleTeamNames' | 'notes' | 'projectType'> & {
  projectType: ProjectType | '';
};
export type TaskFormData = Omit<Task, 'id' | 'projectName' | 'assignedToName' | 'requestedByName' | 'daysRemaining' | 'isOverdue' | 'createdBy' | 'createdAt' | 'updatedAt'>;
export type AvScheduleFormData = Pick<AvScheduleEntry, 'date' | 'whereabouts' | 'workMode' | 'note'>;

export interface ClientProjectGroupMeta {
  client: string;
  projectIds: string[];
  totalProjects: number;
  totalAmount: number;
  highestPriority: Project['priority'];
  overallProgress: number;
}

export interface ClientProjectGroup {
  client: string;
  totalProjects: number;
  totalAmount: number;
  highestPriority: Project['priority'];
  overallProgress: number;
  projects: Project[];
}

export interface DashboardStats {
  totalUsers?: number;
  totalProjects: number;
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
  assignedProjects?: number;
  assignedTasks?: number;
  inProgressAssignedTasks?: number;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  projectsByStatus: Record<string, number>;
  projectsByAccountManager?: Record<string, number>;
}

export interface QuotaSummary {
  totalProposals: number;
  totalProjects: number;
  proposalAmount: number;
  projectAmount: number;
  grandTotal: number;
  activeProjects: number;
  openProposals: number;
  completedProjects: number;
}

export interface QuotaMetrics {
  proposalPipelineAmount: number;
  activeDeliveryAmount: number;
  conversionCount: number;
  conversionRate: number;
  averageProposalValue: number;
  averageProjectValue: number;
}

export interface QuotaGroupTotal {
  key: string;
  count: number;
  amount: number;
}

export interface QuotaMonthlyTrend {
  month: string;
  proposalAmount: number;
  projectAmount: number;
  totalAmount: number;
}

export interface QuotaResponse {
  summary: QuotaSummary;
  quotaMetrics: QuotaMetrics;
  userQuotaTarget: number;
  userQuotaProgressPercent: number;
  statusBreakdown: {
    all: Record<string, number>;
    proposals: Record<string, number>;
    projects: Record<string, number>;
  };
  groupedTotals: {
    byClient: QuotaGroupTotal[];
    byAccountManager: QuotaGroupTotal[];
    byTeam: QuotaGroupTotal[];
  };
  monthlyTrend: QuotaMonthlyTrend[];
  records: Project[];
  proposals: Project[];
  projects: Project[];
}
