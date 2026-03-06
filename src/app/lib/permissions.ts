import { Project, Task, UserRole } from '../types';

export function hasAnyRole(role: UserRole | undefined, allowedRoles: UserRole[]): boolean {
  if (!role) return false;
  return allowedRoles.includes(role);
}

export function canManageUsers(role: UserRole | undefined): boolean {
  return role === 'admin';
}

export function canManageAllSettings(role: UserRole | undefined): boolean {
  return role === 'admin';
}

export function canManageTeamSettings(role: UserRole | undefined): boolean {
  return role === 'admin' || role === 'team_lead';
}

export function canCreateProject(role: UserRole | undefined): boolean {
  return role === 'admin' || role === 'team_lead' || role === 'user';
}

export function canEditProject(role: UserRole | undefined, project: Project, userId: string | undefined): boolean {
  if (!role || !userId) return false;
  if (role === 'admin' || role === 'team_lead') return true;
  return project.createdBy === userId || project.techAssignedIds.includes(userId);
}

export function canDeleteProject(role: UserRole | undefined): boolean {
  return role === 'admin';
}

export function canCreateTask(role: UserRole | undefined): boolean {
  return role === 'admin' || role === 'team_lead' || role === 'user';
}

export function canEditTask(role: UserRole | undefined, task: Task, userId: string | undefined): boolean {
  if (!role || !userId) return false;
  if (role === 'admin' || role === 'team_lead') return true;
  return task.createdBy === userId || task.assignedTo === userId;
}

export function canDeleteTask(role: UserRole | undefined): boolean {
  return role === 'admin';
}

