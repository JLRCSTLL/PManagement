import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';
import { canCreateProject, canDeleteProject, canEditProject, canManageTeamSettings } from '../lib/permissions';
import { ClientProjectGroup, ClientProjectGroupMeta, Project, ProjectFormData, User } from '../types';
import { ProjectForm } from '../components/ProjectForm';
import { ProjectsTable } from '../components/ProjectsTable';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
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

const DEFAULT_TEAMS = ['AV', 'Project Manager'];

const amountFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function normalizeUnique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

const priorityOrder: Record<Project['priority'], number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

function getHighestPriority(values: Project['priority'][]): Project['priority'] {
  let highest: Project['priority'] = 'Low';
  for (const value of values) {
    if (priorityOrder[value] > priorityOrder[highest]) {
      highest = value;
    }
  }
  return highest;
}

function getClientName(project: Project): string {
  const client = (project.client || '').trim();
  return client || 'Unassigned Client';
}

function buildClientGroups(projects: Project[]): ClientProjectGroup[] {
  const groupMap = new Map<string, Project[]>();
  for (const project of projects) {
    const client = getClientName(project);
    const list = groupMap.get(client) || [];
    list.push(project);
    groupMap.set(client, list);
  }

  return Array.from(groupMap.entries())
    .map(([client, groupedProjects]) => {
      const totalProjects = groupedProjects.length;
      const totalAmount = groupedProjects.reduce((sum, project) => sum + (project.amount || 0), 0);
      const priorities = groupedProjects.map((project) => project.priority);
      const totalProgress = groupedProjects.reduce((sum, project) => sum + (project.progress || 0), 0);
      return {
        client,
        totalProjects,
        totalAmount,
        highestPriority: getHighestPriority(priorities),
        overallProgress: totalProjects > 0 ? Math.round(totalProgress / totalProjects) : 0,
        projects: groupedProjects,
      };
    })
    .sort((a, b) => a.client.localeCompare(b.client));
}

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

  const links = Array.isArray(source.referenceLinks)
    ? source.referenceLinks
    : Array.isArray(source.reference_links)
    ? source.reference_links
    : source.referenceLink
    ? [{ id: crypto.randomUUID(), label: 'Reference', url: source.referenceLink, note: '', sortOrder: 0 }]
    : [];
  const notes = Array.isArray(source.notes)
    ? source.notes
        .map((entry: any) => ({
          id: typeof entry?.id === 'string' ? entry.id : crypto.randomUUID(),
          body: typeof entry?.body === 'string' ? entry.body : '',
          createdBy: typeof entry?.createdBy === 'string' ? entry.createdBy : '',
          createdByName: typeof entry?.createdByName === 'string' ? entry.createdByName : '',
          createdAt: typeof entry?.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
        }))
        .filter((entry: any) => entry.body.trim().length > 0)
    : [];

  return {
    id: source.id,
    projectName,
    client: source.client || source.projectId || '',
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
    referenceLinks: links,
    notes,
    createdBy: source.createdBy || source.created_by || source.userId || '',
    createdAt: source.createdAt || source.created_at || new Date().toISOString(),
    updatedAt: source.updatedAt || source.updated_at || source.createdAt || source.created_at || new Date().toISOString(),
    lastUpdated: source.lastUpdated || source.updatedAt || source.updated_at || source.createdAt || source.created_at || new Date().toISOString(),
  };
}

function normalizeClientGroupMeta(raw: any): ClientProjectGroupMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.client !== 'string' || !Array.isArray(raw.projectIds)) return null;
  const highestPriority = raw.highestPriority;
  if (highestPriority !== 'Low' && highestPriority !== 'Medium' && highestPriority !== 'High' && highestPriority !== 'Critical') {
    return null;
  }

  const projectIds = raw.projectIds.filter((value: any) => typeof value === 'string');
  return {
    client: raw.client.trim() || 'Unassigned Client',
    projectIds,
    totalProjects: typeof raw.totalProjects === 'number' ? raw.totalProjects : projectIds.length,
    totalAmount: typeof raw.totalAmount === 'number' ? raw.totalAmount : 0,
    highestPriority,
    overallProgress: typeof raw.overallProgress === 'number' ? raw.overallProgress : 0,
  };
}

function normalizeUser(raw: any): User | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;
  const name = raw.name || raw.fullName || raw.email || 'User';
  const teams = Array.isArray(raw.teams)
    ? raw.teams.filter((team: any) => typeof team === 'string' && team.trim()).map((team: string) => team.trim())
    : [];
  return {
    id: raw.id,
    email: raw.email || '',
    name,
    fullName: raw.fullName || name,
    role: raw.role === 'admin' || raw.role === 'team_lead' ? raw.role : 'user',
    isActive: raw.isActive !== false,
    team: typeof raw.team === 'string' ? raw.team.trim() : (teams[0] || ''),
    teams,
  };
}

export function ProjectsPage() {
  const { user } = useAuth();
  const role = user?.role;
  const canCreate = canCreateProject(role);
  const canManageVisibility = canManageTeamSettings(role);

  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [clientGroupMeta, setClientGroupMeta] = useState<ClientProjectGroupMeta[]>([]);
  const [isGroupedServerSide, setIsGroupedServerSide] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const filteredProjects = useMemo(() => {
    let filtered = [...projects];

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter((project) =>
        project.projectName.toLowerCase().includes(query) ||
        project.client.toLowerCase().includes(query) ||
        (project.accountManager || '').toLowerCase().includes(query) ||
        (project.techAssignedNames || []).join(' ').toLowerCase().includes(query),
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((project) => project.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter((project) => project.priority === priorityFilter);
    }

    return filtered;
  }, [projects, searchTerm, statusFilter, priorityFilter]);
  const hasActiveProjectFilters = useMemo(
    () => searchTerm.trim().length > 0 || statusFilter !== 'all' || priorityFilter !== 'all',
    [searchTerm, statusFilter, priorityFilter],
  );
  const filteredProjectsById = useMemo(
    () => new Map(filteredProjects.map((project) => [project.id, project])),
    [filteredProjects],
  );
  const groupedProjects = useMemo<ClientProjectGroup[]>(() => {
    if (!hasActiveProjectFilters && isGroupedServerSide && clientGroupMeta.length > 0) {
      return clientGroupMeta
        .map((meta) => {
          const clientProjects = meta.projectIds
            .map((id) => filteredProjectsById.get(id))
            .filter((project): project is Project => Boolean(project));

          if (clientProjects.length === 0) return null;
          return {
            client: meta.client,
            totalProjects: meta.totalProjects,
            totalAmount: meta.totalAmount,
            highestPriority: meta.highestPriority,
            overallProgress: meta.overallProgress,
            projects: clientProjects,
          };
        })
        .filter((group): group is ClientProjectGroup => group !== null);
    }

    return buildClientGroups(filteredProjects);
  }, [hasActiveProjectFilters, isGroupedServerSide, clientGroupMeta, filteredProjectsById, filteredProjects]);
  const availableTeams = useMemo(
    () =>
      normalizeUnique([
        ...DEFAULT_TEAMS,
        ...projects.map((project) => project.team || ''),
        ...projects.flatMap((project) => project.visibleTeams || []),
      ]),
    [projects],
  );
  const currentUserDefaultTeam = useMemo(() => {
    if (!user?.id) return '';
    const current = users.find((entry) => entry.id === user.id);
    if (!current) return '';
    if (typeof current.team === 'string' && current.team.trim()) return current.team.trim();
    if (Array.isArray(current.teams) && current.teams[0]) return current.teams[0];
    return '';
  }, [users, user?.id]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [projectsResponse, usersResponse] = await Promise.all([
        apiClient.getProjects(),
        apiClient.getUsers(),
      ]);

      const normalizedProjects = (projectsResponse.projects || [])
        .map(normalizeProject)
        .filter((project): project is Project => project !== null);
      const normalizedClientGroups = (projectsResponse.clientGroups || [])
        .map(normalizeClientGroupMeta)
        .filter((group): group is ClientProjectGroupMeta => group !== null);
      const normalizedUsers = (usersResponse.users || [])
        .map(normalizeUser)
        .filter((entry): entry is User => entry !== null && entry.isActive);

      setProjects(normalizedProjects);
      setUsers(normalizedUsers);
      setClientGroupMeta(normalizedClientGroups);
      setIsGroupedServerSide(projectsResponse.groupedServerSide === true && normalizedClientGroups.length > 0);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load projects');
      console.error('Load projects error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(data: ProjectFormData) {
    if (!canCreate) {
      toast.error('You do not have permission to create projects');
      return;
    }

    try {
      if (editingProject) {
        if (!canEditProject(role, editingProject, user?.id)) {
          toast.error('You do not have permission to edit this project');
          return;
        }
        const { project } = await apiClient.updateProject(editingProject.id, data);
        const normalized = normalizeProject(project);
        if (normalized) {
          setProjects((prev) => prev.map((entry) => (entry.id === normalized.id ? normalized : entry)));
        }
        toast.success('Project updated successfully');
      } else {
        const { project } = await apiClient.createProject(data);
        const normalized = normalizeProject(project);
        if (normalized) {
          setProjects((prev) => [normalized, ...prev]);
        }
        toast.success('Project created successfully');
      }

      setIsDialogOpen(false);
      setEditingProject(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save project');
      console.error('Save project error:', error);
    }
  }

  async function handleDelete(id: string) {
    if (!canDeleteProject(role)) {
      toast.error('You do not have permission to delete projects');
      return;
    }

    try {
      await apiClient.deleteProject(id);
      setProjects((prev) => prev.filter((project) => project.id !== id));
      if (selectedProject?.id === id) {
        setSelectedProject(null);
        setIsDetailsOpen(false);
      }
      setDeleteConfirmId(null);
      toast.success('Project deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete project');
      console.error('Delete project error:', error);
    }
  }

  function handleEdit(project: Project) {
    if (!canEditProject(role, project, user?.id)) return;
    setEditingProject(project);
    setIsDialogOpen(true);
  }

  function handleView(project: Project) {
    setSelectedProject(project);
    setIsDetailsOpen(true);
  }

  async function handleAddNote() {
    if (!selectedProject?.id || !noteInput.trim()) return;

    setIsSavingNote(true);
    try {
      const { project } = await apiClient.addProjectNote(selectedProject.id, noteInput.trim());
      const normalized = normalizeProject(project);
      if (normalized) {
        setProjects((prev) => prev.map((entry) => (entry.id === normalized.id ? normalized : entry)));
        setSelectedProject(normalized);
      }
      setNoteInput('');
      toast.success('Note added');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add note');
    } finally {
      setIsSavingNote(false);
    }
  }

  function handleCloseDialog() {
    setIsDialogOpen(false);
    setEditingProject(null);
  }

  function formatDate(value: string) {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString();
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
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 mt-1">Manage project ownership, visibility, and references</p>
        </div>

        {canCreate ? (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingProject(null)} className="gap-2">
                <Plus className="w-4 h-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProject ? 'Edit Project' : 'Create New Project'}</DialogTitle>
              </DialogHeader>
              <ProjectForm
                initialData={editingProject || undefined}
                users={users}
                canManageVisibility={canManageVisibility}
                existingTeams={availableTeams}
                defaultTeam={editingProject ? editingProject.team : currentUserDefaultTeam}
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by project, client, account manager, or tech assigned..."
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
              <SelectItem value="On Hold">On Hold</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
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
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <ProjectsTable
          clientGroups={groupedProjects}
          canShowVisibility={canManageVisibility}
          canEditProject={(project) => canEditProject(role, project, user?.id)}
          canDeleteProject={(_project) => canDeleteProject(role)}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={(id) => setDeleteConfirmId(id)}
        />
      </div>

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project and all associated tasks.
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

      <Dialog
        open={isDetailsOpen}
        onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) {
            setSelectedProject(null);
            setNoteInput('');
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Project Details</DialogTitle>
          </DialogHeader>

          {selectedProject ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Project Name</p>
                  <p className="text-sm font-medium text-gray-900">{selectedProject.projectName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Client</p>
                  <p className="text-sm text-gray-900">{selectedProject.client || '-'}</p>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Description</p>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedProject.description || '-'}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Account Manager</p>
                  <p className="text-sm text-gray-900">{selectedProject.accountManager || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Team / Department</p>
                  <p className="text-sm text-gray-900">{selectedProject.team || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Amount</p>
                  <p className="text-sm text-gray-900">{amountFormatter.format(selectedProject.amount || 0)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Start Date</p>
                  <p className="text-sm text-gray-900">{formatDate(selectedProject.startDate)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Target End Date</p>
                  <p className="text-sm text-gray-900">{formatDate(selectedProject.targetEndDate)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">Notes</p>
                <div className="space-y-2 rounded-md border p-3 max-h-40 overflow-y-auto">
                  {selectedProject.notes.length === 0 ? (
                    <p className="text-sm text-gray-500">No notes yet.</p>
                  ) : (
                    selectedProject.notes.map((note) => (
                      <div key={note.id} className="rounded bg-gray-50 p-2">
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{note.body}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {note.createdByName || 'Unknown'} • {formatDate(note.createdAt)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <Textarea
                  value={noteInput}
                  onChange={(event) => setNoteInput(event.target.value)}
                  rows={3}
                  placeholder="Add a project note..."
                />
                <div className="flex justify-end">
                  <Button onClick={handleAddNote} disabled={isSavingNote || !noteInput.trim()}>
                    {isSavingNote ? 'Saving...' : 'Add Note'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No project selected.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
