import React from 'react';
import { useForm } from 'react-hook-form';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Project, Task, TaskFormData, User } from '../types';

interface TaskFormProps {
  initialData?: Task;
  projects: Project[];
  users: User[];
  canManageVisibility?: boolean;
  onSubmit: (data: TaskFormData) => void;
  onCancel: () => void;
}

function normalizeUnique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function TaskForm({
  initialData,
  projects,
  users,
  canManageVisibility = false,
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<TaskFormData>({
    defaultValues: initialData || {
      projectId: '',
      title: '',
      taskId: '',
      description: '',
      assignedTo: '',
      requestedBy: '',
      priority: 'Medium',
      status: 'Not Started',
      startDate: '',
      dueDate: '',
      progress: 0,
      dependencies: '',
      notes: '',
      referenceLink: '',
      visibleUserIds: [],
    },
  });

  const projectId = watch('projectId');
  const priority = watch('priority');
  const status = watch('status');
  const assignedTo = watch('assignedTo') || '';
  const requestedBy = watch('requestedBy') || '';
  const visibleUserIds = watch('visibleUserIds') || [];

  function toggleVisibleUser(userId: string) {
    const next = visibleUserIds.includes(userId)
      ? visibleUserIds.filter((value) => value !== userId)
      : [...visibleUserIds, userId];
    setValue('visibleUserIds', normalizeUnique(next), { shouldDirty: true });
  }

  function submitForm(data: TaskFormData) {
    onSubmit({
      ...data,
      assignedTo: (data.assignedTo || '').trim(),
      requestedBy: (data.requestedBy || '').trim(),
      visibleUserIds: normalizeUnique(data.visibleUserIds || []),
      referenceLink: (data.referenceLink || '').trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit(submitForm)} className="space-y-4">
      <div className="space-y-2">
        <Label>Project *</Label>
        <Select value={projectId || '__none__'} onValueChange={(value) => setValue('projectId', value === '__none__' ? '' : value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Select project</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.projectName} ({project.client || 'No client'})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!projectId && (
          <p className="text-sm text-red-600">Project is required</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Task Title *</Label>
          <Input
            id="title"
            {...register('title', { required: 'Task title is required' })}
          />
          {errors.title && (
            <p className="text-sm text-red-600">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="taskId">Task ID *</Label>
          <Input
            id="taskId"
            {...register('taskId', { required: 'Task ID is required' })}
            placeholder="TASK-001"
          />
          {errors.taskId && (
            <p className="text-sm text-red-600">{errors.taskId.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" {...register('description')} rows={3} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Assigned To</Label>
          <Select
            value={assignedTo || '__none__'}
            onValueChange={(value) => setValue('assignedTo', value === '__none__' ? '' : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Unassigned</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name || user.fullName || user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Requested By</Label>
          <Select
            value={requestedBy || '__none__'}
            onValueChange={(value) => setValue('requestedBy', value === '__none__' ? '' : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select requester" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Not specified</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name || user.fullName || user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" type="date" {...register('startDate')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dueDate">Due Date</Label>
          <Input id="dueDate" type="date" {...register('dueDate')} />
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

      <div className="space-y-2">
        <Label htmlFor="dependencies">Dependencies</Label>
        <Input id="dependencies" {...register('dependencies')} placeholder="TASK-002, TASK-003" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" {...register('notes')} rows={3} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="referenceLink">Reference Link</Label>
        <Input id="referenceLink" type="url" placeholder="https://..." {...register('referenceLink')} />
      </div>

      {canManageVisibility && (
        <div className="space-y-2">
          <Label>Task Visibility Override</Label>
          <p className="text-xs text-gray-500">
            Leave empty to inherit project visibility. Select users only if this task should be restricted further.
          </p>
          <div className="max-h-32 overflow-y-auto rounded-md border p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {users.map((user) => (
              <label key={user.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={visibleUserIds.includes(user.id)}
                  onCheckedChange={() => toggleVisibleUser(user.id)}
                />
                <span>{user.name || user.fullName || user.email}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1" disabled={!projectId}>
          {initialData ? 'Update Task' : 'Create Task'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </div>
    </form>
  );
}
