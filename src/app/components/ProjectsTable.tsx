import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { ClientProjectGroup, Project } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface ProjectsTableProps {
  clientGroups: ClientProjectGroup[];
  canShowVisibility: boolean;
  canEditProject: (project: Project) => boolean;
  canDeleteProject: (project: Project) => boolean;
  onView: (project: Project) => void;
  onEdit: (project: Project) => void;
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
  'On Hold': 'bg-yellow-100 text-yellow-800',
  'Completed': 'bg-green-100 text-green-800',
  'Cancelled': 'bg-red-100 text-red-800',
};

const riskColors = {
  Low: 'bg-green-100 text-green-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  High: 'bg-red-100 text-red-800',
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function ProjectsTable({
  clientGroups,
  canShowVisibility,
  canEditProject,
  canDeleteProject,
  onView,
  onEdit,
  onDelete,
}: ProjectsTableProps) {
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const clientKeys = useMemo(
    () => clientGroups.map((group) => group.client),
    [clientGroups],
  );

  useEffect(() => {
    const validKeys = new Set(clientKeys);
    setExpandedClients((previous) => {
      const next = new Set(Array.from(previous).filter((key) => validKeys.has(key)));
      return next;
    });
  }, [clientKeys]);

  function toggleClient(client: string) {
    setExpandedClients((previous) => {
      const next = new Set(previous);
      if (next.has(client)) {
        next.delete(client);
      } else {
        next.add(client);
      }
      return next;
    });
  }

  if (clientGroups.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No projects found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client / Project</TableHead>
            <TableHead>Account Manager</TableHead>
            <TableHead>Tech Assigned</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Risk</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>End Date</TableHead>
            <TableHead>References</TableHead>
            {canShowVisibility && <TableHead>Visible Teams</TableHead>}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientGroups.map((group) => {
            const isExpanded = expandedClients.has(group.client);
            return (
              <React.Fragment key={group.client}>
                <TableRow
                  className="bg-slate-50 hover:bg-slate-100 cursor-pointer"
                  onClick={() => toggleClient(group.client)}
                >
                  <TableCell>
                    <button
                      type="button"
                      className="flex items-center gap-2 font-semibold text-gray-900"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleClient(group.client);
                      }}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <span>{group.client} ({group.totalProjects} {group.totalProjects === 1 ? 'Project' : 'Projects'})</span>
                    </button>
                  </TableCell>
                  <TableCell className="text-sm text-gray-700">{group.totalProjects} Projects</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>{currencyFormatter.format(group.totalAmount || 0)}</TableCell>
                  <TableCell>
                    <Badge className={priorityColors[group.highestPriority]} variant="secondary">
                      {group.highestPriority}
                    </Badge>
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={group.overallProgress} className="w-16" />
                      <span className="text-sm text-gray-600">{group.overallProgress}%</span>
                    </div>
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                  {canShowVisibility && <TableCell>-</TableCell>}
                  <TableCell className="text-right text-xs text-gray-500">
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </TableCell>
                </TableRow>

                {isExpanded && group.projects.map((project) => (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer"
                    onClick={() => onView(project)}
                  >
                    <TableCell>
                      <div className="pl-6">
                        <div className="font-medium text-gray-900">{project.projectName}</div>
                      </div>
                    </TableCell>
                    <TableCell>{project.accountManager || '-'}</TableCell>
                    <TableCell>
                      {project.techAssignedNames?.length ? project.techAssignedNames.join(', ') : '-'}
                    </TableCell>
                    <TableCell>{project.team || '-'}</TableCell>
                    <TableCell>{currencyFormatter.format(project.amount || 0)}</TableCell>
                    <TableCell>
                      <Badge className={priorityColors[project.priority]} variant="secondary">
                        {project.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[project.status]} variant="secondary">
                        {project.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={riskColors[project.riskLevel]} variant="secondary">
                        {project.riskLevel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={project.progress} className="w-16" />
                        <span className="text-sm text-gray-600">{project.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {project.targetEndDate
                        ? format(new Date(project.targetEndDate), 'MMM dd, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {project.referenceLinks.length === 0 ? (
                        <span className="text-sm text-gray-500">-</span>
                      ) : (
                        <div className="space-y-1">
                          {project.referenceLinks.slice(0, 2).map((link) => (
                            <button
                              key={link.id || `${project.id}-${link.label}`}
                              type="button"
                              className="text-xs text-blue-700 hover:underline block text-left"
                              onClick={(event) => {
                                event.stopPropagation();
                                window.open(link.url, '_blank');
                              }}
                            >
                              {link.label}
                            </button>
                          ))}
                          {project.referenceLinks.length > 2 && (
                            <span className="text-xs text-gray-500">
                              +{project.referenceLinks.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    {canShowVisibility && (
                      <TableCell className="max-w-[180px]">
                        {project.visibleTeamNames?.length ? (
                          <span className="text-sm text-gray-700">
                            {project.visibleTeamNames.slice(0, 2).join(', ')}
                            {project.visibleTeamNames.length > 2 ? ` +${project.visibleTeamNames.length - 2}` : ''}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {project.referenceLinks[0]?.url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              window.open(project.referenceLinks[0].url, '_blank');
                            }}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                        {canEditProject(project) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              onEdit(project);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canDeleteProject(project) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDelete(project.id);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
