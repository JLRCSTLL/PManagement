import React, { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Project, ProjectFormData, User } from '../types';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface ProjectFormProps {
  initialData?: Project;
  users: User[];
  canManageVisibility?: boolean;
  existingTeams?: string[];
  defaultTeam?: string;
  onSubmit: (data: ProjectFormData) => void;
  onCancel: () => void;
}

const DEFAULT_TEAMS = ['AV', 'Project Manager'];

function normalizeUnique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function ProjectForm({
  initialData,
  users,
  canManageVisibility = false,
  existingTeams = [],
  defaultTeam = '',
  onSubmit,
  onCancel,
}: ProjectFormProps) {
  const initialTeam = useMemo(() => (initialData?.team || '').trim(), [initialData?.team]);
  const initialVisibleTeams = useMemo(
    () => (Array.isArray(initialData?.visibleTeams) ? initialData.visibleTeams : []),
    [initialData?.visibleTeams],
  );
  const initialAmount = typeof initialData?.amount === 'number' ? initialData.amount : 0;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    getValues,
    watch,
  } = useForm<ProjectFormData>({
    defaultValues: initialData
      ? {
          ...initialData,
          client: initialData.client || '',
          projectType: initialData.projectType || 'project',
          driveLink: initialData.driveLink || '',
          accountManager: initialData.accountManager || '',
          techAssignedIds: Array.isArray(initialData.techAssignedIds) ? initialData.techAssignedIds : [],
          visibleTeams: Array.isArray(initialData.visibleTeams) ? initialData.visibleTeams : [],
          team: initialData.team || DEFAULT_TEAMS[0],
          amount: typeof initialData.amount === 'number' ? initialData.amount : 0,
          referenceLinks: Array.isArray(initialData.referenceLinks) ? initialData.referenceLinks : [],
        }
      : {
          projectName: '',
          client: '',
          projectType: '',
          description: '',
          driveLink: '',
          accountManager: '',
          techAssignedIds: [],
          visibleTeams: [],
          team: (defaultTeam || DEFAULT_TEAMS[0]).trim(),
          amount: 0,
          startDate: '',
          targetEndDate: '',
          priority: 'Medium',
          status: 'Not Started',
          riskLevel: 'Low',
          progress: 0,
          referenceLinks: [],
        },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'referenceLinks',
  });

  const managerSuggestions = useMemo(
    () =>
      normalizeUnique(
        users.map((user) => (user.name || user.fullName || user.email || '').trim()).filter(Boolean),
      ),
    [users],
  );
  const baseTeamOptions = useMemo(
    () =>
      normalizeUnique([
        ...DEFAULT_TEAMS,
        ...existingTeams,
        defaultTeam,
        initialTeam,
        ...initialVisibleTeams,
      ]),
    [existingTeams, defaultTeam, initialTeam, initialVisibleTeams],
  );
  const [teamOptions, setTeamOptions] = useState<string[]>(baseTeamOptions);
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [newTeam, setNewTeam] = useState('');

  const priority = watch('priority');
  const status = watch('status');
  const riskLevel = watch('riskLevel');
  const projectType = watch('projectType');
  const team = watch('team') || '';
  const techAssignedIds = watch('techAssignedIds') || [];
  const visibleTeams = watch('visibleTeams') || [];

  useEffect(() => {
    setTeamOptions(baseTeamOptions);
  }, [baseTeamOptions]);

  useEffect(() => {
    if (initialData) return;
    const nextDefault = (defaultTeam || '').trim();
    if (!nextDefault) return;
    const current = (getValues('team') || '').trim();
    if (!current) {
      setValue('team', nextDefault, { shouldDirty: false });
    }
  }, [defaultTeam, initialData, getValues, setValue]);

  function toggleMultiValue(field: 'techAssignedIds', userId: string) {
    const current = watch(field) || [];
    const next = current.includes(userId)
      ? current.filter((value) => value !== userId)
      : [...current, userId];
    setValue(field, normalizeUnique(next), { shouldDirty: true });
  }

  function toggleTeamVisibility(teamName: string) {
    const current = watch('visibleTeams') || [];
    const next = current.includes(teamName)
      ? current.filter((value) => value !== teamName)
      : [...current, teamName];
    setValue('visibleTeams', normalizeUnique(next), { shouldDirty: true });
  }

  function addTeamOption() {
    const trimmed = newTeam.trim();
    if (!trimmed) return;

    const nextOptions = normalizeUnique([...teamOptions, trimmed]);
    setTeamOptions(nextOptions);
    setValue('team', trimmed, { shouldDirty: true });
    const nextVisibleTeams = normalizeUnique([...(watch('visibleTeams') || []), trimmed]);
    setValue('visibleTeams', nextVisibleTeams, { shouldDirty: true });
    setNewTeam('');
    setIsAddingTeam(false);
  }

  function submitForm(data: ProjectFormData) {
    const normalizedProjectType =
      data.projectType === 'proposal' || data.projectType === 'project'
        ? data.projectType
        : '';
    const normalizedTechIds = normalizeUnique(data.techAssignedIds || []);
    const normalizedTeam = (data.team || '').trim();
    const normalizedVisibleTeams = normalizeUnique([
      ...(data.visibleTeams || []),
      normalizedTeam,
    ]);
    const normalizedLinks = (data.referenceLinks || [])
      .map((link, index) => ({
        ...link,
        label: (link.label || '').trim(),
        url: (link.url || '').trim(),
        note: (link.note || '').trim(),
        sortOrder: index,
      }))
      .filter((link) => link.label && link.url);
    const normalizedDriveLink = (data.driveLink || '').trim();

    onSubmit({
      ...data,
      projectType: normalizedProjectType,
      client: (data.client || '').trim(),
      driveLink: normalizedDriveLink,
      accountManager: (data.accountManager || '').trim(),
      team: normalizedTeam,
      amount: Number.isFinite(data.amount) ? Math.max(0, data.amount) : initialAmount,
      techAssignedIds: normalizedTechIds,
      visibleTeams: normalizedVisibleTeams,
      referenceLinks: normalizedLinks,
    });
  }

  return (
    <form onSubmit={handleSubmit(submitForm)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="projectName">Project Name *</Label>
          <Input
            id="projectName"
            {...register('projectName', { required: 'Project name is required' })}
          />
          {errors.projectName && (
            <p className="text-sm text-red-600">{errors.projectName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="client">Client *</Label>
          <Input
            id="client"
            {...register('client', { required: 'Client is required' })}
            placeholder="ABC Corporation"
          />
          {errors.client && (
            <p className="text-sm text-red-600">{errors.client.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="projectType">Project Type *</Label>
        <input
          type="hidden"
          {...register('projectType', { required: 'Project Type is required' })}
        />
        <Select
          value={projectType || undefined}
          onValueChange={(value) =>
            setValue('projectType', value as 'proposal' | 'project', {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger id="projectType">
            <SelectValue placeholder="Select Project Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="proposal">Proposal</SelectItem>
            <SelectItem value="project">Project</SelectItem>
          </SelectContent>
        </Select>
        {errors.projectType && (
          <p className="text-sm text-red-600">{errors.projectType.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" {...register('description')} rows={3} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="driveLink">Project Drive Link</Label>
        <Input
          id="driveLink"
          placeholder="https://drive.google.com/..."
          {...register('driveLink', {
            validate: (value) => {
              const trimmed = (value || '').trim();
              if (!trimmed) return true;
              try {
                const parsed = new URL(trimmed);
                if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                  return true;
                }
              } catch {
                // no-op
              }
              return 'Enter a valid http/https URL';
            },
          })}
        />
        {errors.driveLink && (
          <p className="text-sm text-red-600">{errors.driveLink.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="accountManager">Account Manager *</Label>
          <Input
            id="accountManager"
            list="account-manager-suggestions"
            {...register('accountManager', { required: 'Account Manager is required' })}
            placeholder="Type account manager name"
          />
          <datalist id="account-manager-suggestions">
            {managerSuggestions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          {errors.accountManager && (
            <p className="text-sm text-red-600">{errors.accountManager.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="team">Team/Department</Label>
          <Select
            value={team || '__none__'}
            onValueChange={(value) => {
              if (value === '__add_team__') {
                setIsAddingTeam(true);
                return;
              }
              setValue('team', value === '__none__' ? '' : value, { shouldDirty: true });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select team/department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Not specified</SelectItem>
              {teamOptions.map((teamOption) => (
                <SelectItem key={teamOption} value={teamOption}>
                  {teamOption}
                </SelectItem>
              ))}
              <SelectItem value="__add_team__">+ Add Team</SelectItem>
            </SelectContent>
          </Select>
          {isAddingTeam && (
            <div className="flex gap-2">
              <Input
                value={newTeam}
                onChange={(event) => setNewTeam(event.target.value)}
                placeholder="Enter new team"
              />
              <Button type="button" variant="outline" onClick={addTeamOption}>
                Add
              </Button>
              <Button type="button" variant="ghost" onClick={() => setIsAddingTeam(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Amount *</Label>
        <Input
          id="amount"
          type="number"
          min="0"
          step="0.01"
          {...register('amount', {
            valueAsNumber: true,
            validate: (value) => {
              if (!Number.isFinite(value)) return 'Amount is required';
              if (value < 0) return 'Amount cannot be negative';
              return true;
            },
          })}
          placeholder="0.00"
        />
        {errors.amount && (
          <p className="text-sm text-red-600">{errors.amount.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Tech Assigned</Label>
        <div className="max-h-32 overflow-y-auto rounded-md border p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          {users.map((user) => {
            const checked = techAssignedIds.includes(user.id);
            return (
              <label key={user.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleMultiValue('techAssignedIds', user.id)}
                />
                <span>{user.name || user.fullName || user.email}</span>
              </label>
            );
          })}
        </div>
      </div>

      {canManageVisibility && (
        <div className="space-y-2">
          <Label>Visible To Teams</Label>
          <p className="text-xs text-gray-500">
            Only selected teams can view this project and inherited tasks.
          </p>
          <div className="max-h-32 overflow-y-auto rounded-md border p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {teamOptions.map((teamOption) => {
              const checked = visibleTeams.includes(teamOption);
              return (
                <label key={teamOption} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleTeamVisibility(teamOption)}
                  />
                  <span>{teamOption}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" type="date" {...register('startDate')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetEndDate">Target End Date</Label>
          <Input id="targetEndDate" type="date" {...register('targetEndDate')} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Priority *</Label>
          <Select value={priority} onValueChange={(value) => setValue('priority', value as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Status *</Label>
          <Select value={status} onValueChange={(value) => setValue('status', value as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Not Started">Not Started</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="On Hold">On Hold</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Risk Level *</Label>
          <Select value={riskLevel} onValueChange={(value) => setValue('riskLevel', value as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="progress">Progress (%)</Label>
        <Input
          id="progress"
          type="number"
          min="0"
          max="100"
          {...register('progress', { valueAsNumber: true })}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Project Reference Links</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => append({ label: '', url: '', note: '', sortOrder: fields.length })}
          >
            <Plus className="w-4 h-4" />
            Add Link
          </Button>
        </div>

        {fields.length === 0 && (
          <p className="text-sm text-gray-500">No links added yet.</p>
        )}

        {fields.map((field, index) => (
          <div key={field.id} className="border rounded-md p-3 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium">Link {index + 1}</p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Label *</Label>
                <Input
                  {...register(`referenceLinks.${index}.label` as const, {
                    required: 'Label is required',
                  })}
                  placeholder="Design Spec"
                />
              </div>
              <div className="space-y-1">
                <Label>URL *</Label>
                <Input
                  {...register(`referenceLinks.${index}.url` as const, {
                    required: 'URL is required',
                  })}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Note</Label>
              <Textarea
                rows={2}
                {...register(`referenceLinks.${index}.note` as const)}
                placeholder="Optional context for this link"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1">
          {initialData ? 'Update Project' : 'Create Project'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </div>
    </form>
  );
}
