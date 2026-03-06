import React from 'react';
import { differenceInDays, format } from 'date-fns';
import { AlertTriangle, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { Project, Task } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface TasksTableProps {
  tasks: Task[];
  projects: Project[];
  canEditTask: (task: Task) => boolean;
  canDeleteTask: (task: Task) => boolean;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

const priorityColors = {
  Low: 'bg-blue-100 text-blue-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  High: 'bg-orange-100 text-orange-800',
  Critical: 'bg-red-100 text-red-800',
};

const statusColors = {
  'Not Started': 'bg-gray-100 text-gray-800',
  'In Progress': 'bg-blue-100 text-blue-800',
  'Pending': 'bg-yellow-100 text-yellow-800',
  'Completed': 'bg-green-100 text-green-800',
  'Blocked': 'bg-red-100 text-red-800',
};

function resolveDaysRemaining(task: Task): number | null {
  if (typeof task.daysRemaining === 'number') return task.daysRemaining;
  if (!task.dueDate || task.status === 'Completed') return null;
  return differenceInDays(new Date(task.dueDate), new Date());
}

export function TasksTable({ tasks, projects, canEditTask, canDeleteTask, onEdit, onDelete }: TasksTableProps) {
  const getProjectName = (projectId: string) => {
    const project = projects.find((entry) => entry.id === projectId);
    return project ? project.projectName : 'Unknown';
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No tasks found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Requested By</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const daysRemaining = resolveDaysRemaining(task);
            const isOverdue = task.isOverdue ?? (daysRemaining !== null && daysRemaining < 0);

            return (
              <TableRow key={task.id} className={isOverdue ? 'bg-red-50' : ''}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {isOverdue && <AlertTriangle className="w-4 h-4 text-red-600" />}
                    <div>
                      <div className="font-medium text-gray-900">{task.title}</div>
                      <div className="text-sm text-gray-500">{task.taskId}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{task.projectName || getProjectName(task.projectId)}</TableCell>
                <TableCell>{task.assignedToName || task.assignedTo || '-'}</TableCell>
                <TableCell>{task.requestedByName || task.requestedBy || '-'}</TableCell>
                <TableCell>
                  <Badge className={priorityColors[task.priority]} variant="secondary">
                    {task.priority}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[task.status]} variant="secondary">
                    {task.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={task.progress} className="w-16" />
                    <span className="text-sm text-gray-600">{task.progress}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  {task.dueDate ? (
                    <div>
                      <div className="text-sm">{format(new Date(task.dueDate), 'MMM dd, yyyy')}</div>
                      {daysRemaining !== null && (
                        <div
                          className={`text-xs ${
                            isOverdue
                              ? 'text-red-600 font-medium'
                              : daysRemaining <= 3
                              ? 'text-orange-600'
                              : 'text-gray-500'
                          }`}
                        >
                          {isOverdue
                            ? `${Math.abs(daysRemaining)} days overdue`
                            : `${daysRemaining} days left`}
                        </div>
                      )}
                    </div>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {task.referenceLink && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(task.referenceLink, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    {canEditTask(task) && (
                      <Button variant="ghost" size="sm" onClick={() => onEdit(task)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    {canDeleteTask(task) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(task.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
