import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';
import { canCreateTask, canDeleteTask, canEditTask, canManageTeamSettings } from '../lib/permissions';
import { Project, Task, TaskFormData, User } from '../types';
import { TaskForm } from '../components/TaskForm';
import { TasksTable } from '../components/TasksTable';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

function unwrapValue(input: any): any {
  let current = input;
  let depth = 0;
  while (current && typeof current === 'object' && 'value' in current && depth < 5) {
    current = current.value;
    depth += 1;
  }
  return current;
}

function normalizeProject(raw: any): Project | null {
  const source = unwrapValue(raw);
  if (!source || typeof source !== 'object') return null;
  const projectName = typeof source.projectName === 'string'
    ? source.projectName
    : typeof source.project_name === 'string'
    ? source.project_name
    : '';
  if (typeof source.id !== 'string' || !projectName) {
    return null;
  }
  const rawProjectType = typeof source.projectType === 'string'
    ? source.projectType.trim().toLowerCase()
    : typeof source.project_type === 'string'
    ? source.project_type.trim().toLowerCase()
    : '';
  const projectType: Project['projectType'] = rawProjectType === 'proposal' ? 'proposal' : 'project';

  return {
    id: source.id,
    projectName,
    client: source.client || source.projectId || '',
    projectType,
    description: source.description || '',
    accountManager: source.accountManager || source.account_manager || source.accountManagerName || source.owner || '',
    techAssignedIds: Array.isArray(source.techAssignedIds) ? source.techAssignedIds : [],
    techAssignedNames: Array.isArray(source.techAssignedNames) ? source.techAssignedNames : [],
    visibleTeams: Array.isArray(source.visibleTeams)
      ? source.visibleTeams
      : Array.isArray(source.visible_teams)
      ? source.visible_teams
      : [],
    visibleTeamNames: Array.isArray(source.visibleTeamNames)
      ? source.visibleTeamNames
      : Array.isArray(source.visible_teams)
      ? source.visible_teams
      : [],
    team: source.team || '',
    amount: typeof source.amount === 'number' ? source.amount : Number(source.amount) || 0,
    startDate: source.startDate || source.start_date || '',
    targetEndDate: source.targetEndDate || source.target_end_date || '',
    priority: source.priority || 'Medium',
    status: source.status || 'Not Started',
    riskLevel: source.riskLevel || 'Low',
    progress: typeof source.progress === 'number' ? source.progress : 0,
    referenceLinks: Array.isArray(source.referenceLinks)
      ? source.referenceLinks
      : Array.isArray(source.reference_links)
      ? source.reference_links
      : [],
    notes: Array.isArray(source.notes) ? source.notes : [],
    createdBy: source.createdBy || source.created_by || source.userId || '',
    createdAt: source.createdAt || source.created_at || new Date().toISOString(),
    updatedAt: source.updatedAt || source.updated_at || source.createdAt || source.created_at || new Date().toISOString(),
    lastUpdated: source.lastUpdated || source.updatedAt || source.updated_at || source.createdAt || source.created_at || new Date().toISOString(),
  };
}

function normalizeTask(raw: any): Task | null {
  const source = unwrapValue(raw);
  if (!source || typeof source !== 'object') return null;
  if (typeof source.id !== 'string' || typeof source.taskId !== 'string' || typeof source.title !== 'string' || typeof source.projectId !== 'string') {
    return null;
  }

  return {
    id: source.id,
    projectId: source.projectId,
    projectName: source.projectName || '',
    title: source.title,
    taskId: source.taskId,
    description: source.description || '',
    assignedTo: source.assignedTo || '',
    assignedToName: source.assignedToName || '',
    requestedBy: source.requestedBy || '',
    requestedByName: source.requestedByName || '',
    priority: source.priority || 'Medium',
    status: source.status || 'Not Started',
    startDate: source.startDate || '',
    dueDate: source.dueDate || '',
    progress: typeof source.progress === 'number' ? source.progress : 0,
    dependencies: source.dependencies || '',
    notes: source.notes || '',
    referenceLink: source.referenceLink || '',
    visibleUserIds: Array.isArray(source.visibleUserIds) ? source.visibleUserIds : [],
    daysRemaining: typeof source.daysRemaining === 'number' ? source.daysRemaining : null,
    isOverdue:
      source.isOverdue === true ||
      (!!source.dueDate && source.status !== 'Completed' && new Date(source.dueDate) < new Date()),
    createdBy: source.createdBy || source.userId || '',
    createdAt: source.createdAt || new Date().toISOString(),
    updatedAt: source.updatedAt || source.createdAt || new Date().toISOString(),
  };
}

function normalizeUser(raw: any): User | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;
  const name = raw.name || raw.fullName || raw.email || 'User';
  return {
    id: raw.id,
    email: raw.email || '',
    name,
    fullName: raw.fullName || name,
    role: raw.role === 'admin' || raw.role === 'team_lead' ? raw.role : 'user',
    isActive: raw.isActive !== false,
  };
}

export function TasksPage() {
  const { user } = useAuth();
  const role = user?.role;
  const canCreate = canCreateTask(role);
  const canManageVisibility = canManageTeamSettings(role);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [overdueFilter, setOverdueFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter((task) =>
        task.title.toLowerCase().includes(query) ||
        task.taskId.toLowerCase().includes(query) ||
        (task.assignedToName || task.assignedTo || '').toLowerCase().includes(query) ||
        (task.requestedByName || task.requestedBy || '').toLowerCase().includes(query),
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((task) => task.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter((task) => task.priority === priorityFilter);
    }

    if (projectFilter !== 'all') {
      filtered = filtered.filter((task) => task.projectId === projectFilter);
    }

    if (overdueFilter === 'overdue') {
      filtered = filtered.filter((task) => task.isOverdue);
    }

    return filtered;
  }, [tasks, searchTerm, statusFilter, priorityFilter, projectFilter, overdueFilter]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [tasksResponse, projectsResponse, usersResponse] = await Promise.all([
        apiClient.getTasks(),
        apiClient.getProjects(),
        apiClient.getUsers(),
      ]);

      const normalizedTasks = (tasksResponse.tasks || [])
        .map(normalizeTask)
        .filter((task): task is Task => task !== null);
      const normalizedProjects = (projectsResponse.projects || [])
        .map(normalizeProject)
        .filter((project): project is Project => project !== null);
      const normalizedUsers = (usersResponse.users || [])
        .map(normalizeUser)
        .filter((entry): entry is User => entry !== null && entry.isActive);

      setTasks(normalizedTasks);
      setProjects(normalizedProjects);
      setUsers(normalizedUsers);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load data');
      console.error('Load data error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(data: TaskFormData) {
    if (!canCreate) {
      toast.error('You do not have permission to create tasks');
      return;
    }

    try {
      if (editingTask) {
        if (!canEditTask(role, editingTask, user?.id)) {
          toast.error('You do not have permission to edit this task');
          return;
        }
        const { task } = await apiClient.updateTask(editingTask.id, data);
        const normalized = normalizeTask(task);
        if (normalized) {
          setTasks((prev) => prev.map((entry) => (entry.id === normalized.id ? normalized : entry)));
        }
        toast.success('Task updated successfully');
      } else {
        const { task } = await apiClient.createTask(data);
        const normalized = normalizeTask(task);
        if (normalized) {
          setTasks((prev) => [normalized, ...prev]);
        }
        toast.success('Task created successfully');
      }
      setIsDialogOpen(false);
      setEditingTask(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save task');
      console.error('Save task error:', error);
    }
  }

  async function handleDelete(id: string) {
    if (!canDeleteTask(role)) {
      toast.error('You do not have permission to delete tasks');
      return;
    }

    try {
      await apiClient.deleteTask(id);
      setTasks((prev) => prev.filter((task) => task.id !== id));
      setDeleteConfirmId(null);
      toast.success('Task deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete task');
      console.error('Delete task error:', error);
    }
  }

  function handleEdit(task: Task) {
    if (!canEditTask(role, task, user?.id)) return;
    setEditingTask(task);
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    setIsDialogOpen(false);
    setEditingTask(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-500 mt-1">Tasks follow project visibility by default</p>
        </div>

        {canCreate ? (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingTask(null)} className="gap-2">
                <Plus className="w-4 h-4" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
              </DialogHeader>
              <TaskForm
                initialData={editingTask || undefined}
                projects={projects}
                users={users}
                canManageVisibility={canManageVisibility}
                onSubmit={handleSubmit}
                onCancel={handleCloseDialog}
              />
            </DialogContent>
          </Dialog>
        ) : (
          <div className="text-sm text-gray-500">Read-only access</div>
        )}
      </div>

      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by title, ID, assignee, requester..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Not Started">Not Started</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={overdueFilter} onValueChange={setOverdueFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Overdue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="overdue">Overdue Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <TasksTable
          tasks={filteredTasks}
          projects={projects}
          canEditTask={(task) => canEditTask(role, task, user?.id)}
          canDeleteTask={(_task) => canDeleteTask(role)}
          onEdit={handleEdit}
          onDelete={(id) => setDeleteConfirmId(id)}
        />
      </div>

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
