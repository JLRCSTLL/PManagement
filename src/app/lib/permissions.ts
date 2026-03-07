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
  if (!role) return false;
  if (role === 'admin' || role === 'team_lead' || role === 'user') return true;
  return false;
}

export function canDeleteProject(role: UserRole | undefined, project: Project, userId: string | undefined): boolean {
  return canEditProject(role, project, userId);
}

export function canCreateTask(role: UserRole | undefined): boolean {
  return role === 'admin' || role === 'team_lead' || role === 'user';
}

export function canEditTask(role: UserRole | undefined, task: Task, userId: string | undefined): boolean {
  if (!role) return false;
  if (role === 'admin' || role === 'team_lead' || role === 'user') return true;
  return false;
}

export function canDeleteTask(role: UserRole | undefined, task: Task, userId: string | undefined): boolean {
  return canEditTask(role, task, userId);
}
