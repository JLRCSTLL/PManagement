import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ExternalLink, Search } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../lib/api';
import { Project, QuotaResponse } from '../types';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

type QuotaTab = 'all' | 'proposals' | 'projects';
type SortField = 'amount' | 'targetEndDate' | 'startDate' | 'progress' | 'priority' | 'status' | 'client';
type SortDirection = 'asc' | 'desc';

const amountFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const priorityOrder: Record<Project['priority'], number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

const statusOrder: Record<Project['status'], number> = {
  'Not Started': 1,
  'In Progress': 2,
  'On Hold': 3,
  Completed: 4,
  Cancelled: 5,
};

const statusColors: Record<Project['status'], string> = {
  'Not Started': 'bg-gray-100 text-gray-800',
  'In Progress': 'bg-blue-100 text-blue-800',
  'On Hold': 'bg-yellow-100 text-yellow-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
};

const priorityColors: Record<Project['priority'], string> = {
  Low: 'bg-blue-100 text-blue-800',
  Medium: 'bg-amber-100 text-amber-800',
  High: 'bg-orange-100 text-orange-800',
  Critical: 'bg-red-100 text-red-800',
};

const riskColors: Record<Project['riskLevel'], string> = {
  Low: 'bg-green-100 text-green-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  High: 'bg-red-100 text-red-800',
};

const typeColors: Record<Project['projectType'], string> = {
  proposal: 'bg-blue-100 text-blue-800',
  project: 'bg-green-100 text-green-800',
};

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

  const rawProjectType = typeof source.projectType === 'string'
    ? source.projectType.trim().toLowerCase()
    : typeof source.project_type === 'string'
    ? source.project_type.trim().toLowerCase()
    : '';
  const projectType: Project['projectType'] = rawProjectType === 'proposal' ? 'proposal' : 'project';

  const links = Array.isArray(source.referenceLinks)
    ? source.referenceLinks
    : Array.isArray(source.reference_links)
    ? source.reference_links
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
    client: source.client || '',
    projectType,
    description: source.description || '',
    driveLink: typeof source.driveLink === 'string'
      ? source.driveLink
      : typeof source.drive_link === 'string'
      ? source.drive_link
      : '',
    accountManager: source.accountManager || source.account_manager || '',
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
    riskLevel: source.riskLevel || source.risk_level || 'Low',
    progress: typeof source.progress === 'number' ? source.progress : 0,
    referenceLinks: links,
    notes,
    createdBy: source.createdBy || source.created_by || '',
    createdAt: source.createdAt || source.created_at || new Date().toISOString(),
    updatedAt: source.updatedAt || source.updated_at || source.createdAt || new Date().toISOString(),
    lastUpdated: source.lastUpdated || source.updatedAt || source.updated_at || source.createdAt || new Date().toISOString(),
  };
}

function normalizeQuotaResponse(payload: any): QuotaResponse {
  const records = (Array.isArray(payload?.records) ? payload.records : [])
    .map(normalizeProject)
    .filter((project: Project | null): project is Project => project !== null);
  const proposals = (Array.isArray(payload?.proposals) ? payload.proposals : [])
    .map(normalizeProject)
    .filter((project: Project | null): project is Project => project !== null);
  const projects = (Array.isArray(payload?.projects) ? payload.projects : [])
    .map(normalizeProject)
    .filter((project: Project | null): project is Project => project !== null);

  return {
    summary: {
      totalProposals: toNumber(payload?.summary?.totalProposals ?? payload?.summary?.total_proposals, proposals.length),
      totalProjects: toNumber(payload?.summary?.totalProjects ?? payload?.summary?.total_projects, projects.length),
      proposalAmount: toNumber(payload?.summary?.proposalAmount ?? payload?.summary?.proposal_amount),
      projectAmount: toNumber(payload?.summary?.projectAmount ?? payload?.summary?.project_amount),
      grandTotal: toNumber(payload?.summary?.grandTotal ?? payload?.summary?.grand_total),
      activeProjects: toNumber(payload?.summary?.activeProjects),
      openProposals: toNumber(payload?.summary?.openProposals),
      completedProjects: toNumber(payload?.summary?.completedProjects),
    },
    quotaMetrics: {
      proposalPipelineAmount: toNumber(payload?.quotaMetrics?.proposalPipelineAmount),
      activeDeliveryAmount: toNumber(payload?.quotaMetrics?.activeDeliveryAmount),
      conversionCount: toNumber(payload?.quotaMetrics?.conversionCount),
      conversionRate: toNumber(payload?.quotaMetrics?.conversionRate),
      averageProposalValue: toNumber(payload?.quotaMetrics?.averageProposalValue),
      averageProjectValue: toNumber(payload?.quotaMetrics?.averageProjectValue),
    },
    userQuotaTarget: toNumber(payload?.userQuotaTarget),
    userQuotaProgressPercent: toNumber(payload?.userQuotaProgressPercent),
    userQuotaProgressPercentRaw: toNumber(payload?.userQuotaProgressPercentRaw),
    userQuotaRemainingAmount: toNumber(payload?.userQuotaRemainingAmount),
    userQuotaExceededAmount: toNumber(payload?.userQuotaExceededAmount),
    userQuotaTargetUpdatedAt: typeof payload?.userQuotaTargetUpdatedAt === 'string' ? payload.userQuotaTargetUpdatedAt : '',
    statusBreakdown: {
      all: payload?.statusBreakdown?.all || {},
      proposals: payload?.statusBreakdown?.proposals || {},
      projects: payload?.statusBreakdown?.projects || {},
    },
    groupedTotals: {
      byClient: Array.isArray(payload?.groupedTotals?.byClient) ? payload.groupedTotals.byClient : [],
      byAccountManager: Array.isArray(payload?.groupedTotals?.byAccountManager) ? payload.groupedTotals.byAccountManager : [],
      byTeam: Array.isArray(payload?.groupedTotals?.byTeam) ? payload.groupedTotals.byTeam : [],
    },
    monthlyTrend: Array.isArray(payload?.monthlyTrend) ? payload.monthlyTrend : [],
    records,
    proposals,
    projects,
  };
}

function formatDate(value: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function formatMonth(value: string): string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return value;
  const [yearText, monthText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return value;
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function dateValue(value: string): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function matchesDateRange(project: Project, fromDate: string, toDate: string): boolean {
  if (!fromDate && !toDate) return true;
  const startCandidate = project.startDate || project.createdAt || '';
  const endCandidate = project.targetEndDate || project.startDate || project.updatedAt || '';

  if (fromDate && startCandidate && startCandidate < fromDate) return false;
  if (toDate && endCandidate && endCandidate > toDate) return false;
  return true;
}

export function QuotaPage() {
  const [data, setData] = useState<QuotaResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingQuotaTarget, setIsSavingQuotaTarget] = useState(false);
  const [quotaTargetInput, setQuotaTargetInput] = useState('');
  const [activeTab, setActiveTab] = useState<QuotaTab>('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'proposal' | 'project'>('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [accountManagerFilter, setAccountManagerFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [techFilter, setTechFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('targetEndDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    loadQuotaData();
  }, []);

  useEffect(() => {
    if (!data) return;
    setQuotaTargetInput(data.userQuotaTarget > 0 ? data.userQuotaTarget.toFixed(2) : '');
  }, [data?.userQuotaTarget]);

  async function loadQuotaData() {
    setIsLoading(true);
    try {
      const payload = await apiClient.getQuotaData();
      setData(normalizeQuotaResponse(payload));
    } catch (error: any) {
      toast.error(error.message || 'Failed to load quota data');
      console.error('Load quota data error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveQuotaTarget() {
    if (!data) return;
    const parsed = Number(quotaTargetInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error('Enter a valid quota amount');
      return;
    }

    const normalizedAmount = Math.round(parsed * 100) / 100;
    setIsSavingQuotaTarget(true);
    try {
      const { amount } = await apiClient.updateQuotaTarget(normalizedAmount);
      setData((prev) => {
        if (!prev) return prev;
        const quotaTarget = Number.isFinite(amount) ? Math.max(0, amount) : normalizedAmount;
        const progressPercent = quotaTarget > 0
          ? Number(Math.min(100, (prev.summary.grandTotal / quotaTarget) * 100).toFixed(2))
          : 0;
        return {
          ...prev,
          userQuotaTarget: quotaTarget,
          userQuotaProgressPercent: progressPercent,
        };
      });
      setQuotaTargetInput((Number.isFinite(amount) ? amount : normalizedAmount).toFixed(2));
      toast.success('Quota target saved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save quota target');
    } finally {
      setIsSavingQuotaTarget(false);
    }
  }

  const allRecords = useMemo(() => data?.records || [], [data]);

  const clientOptions = useMemo(
    () => Array.from(new Set(allRecords.map((project) => (project.client || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [allRecords],
  );
  const accountManagerOptions = useMemo(
    () => Array.from(new Set(allRecords.map((project) => (project.accountManager || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [allRecords],
  );
  const teamOptions = useMemo(
    () => Array.from(new Set(allRecords.map((project) => (project.team || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [allRecords],
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(allRecords.map((project) => project.status))).sort((a, b) => a.localeCompare(b)),
    [allRecords],
  );
  const techOptions = useMemo(
    () =>
      Array.from(
        new Set(
          allRecords.flatMap((project) => Array.isArray(project.techAssignedNames) ? project.techAssignedNames : []),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [allRecords],
  );

  const recordsByTab = useMemo(() => {
    if (!data) return [];
    if (activeTab === 'proposals') return data.proposals;
    if (activeTab === 'projects') return data.projects;
    return data.records;
  }, [data, activeTab]);

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    let records = [...recordsByTab];

    records = records.filter((project) => {
      if (typeFilter !== 'all' && project.projectType !== typeFilter) return false;
      if (clientFilter !== 'all' && project.client !== clientFilter) return false;
      if (accountManagerFilter !== 'all' && project.accountManager !== accountManagerFilter) return false;
      if (teamFilter !== 'all' && project.team !== teamFilter) return false;
      if (statusFilter !== 'all' && project.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && project.priority !== priorityFilter) return false;
      if (riskFilter !== 'all' && project.riskLevel !== riskFilter) return false;
      if (techFilter !== 'all' && !(project.techAssignedNames || []).includes(techFilter)) return false;
      if (!matchesDateRange(project, dateFrom, dateTo)) return false;

      if (!query) return true;
      const haystack = [
        project.projectName,
        project.client,
        project.accountManager,
        (project.techAssignedNames || []).join(' '),
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });

    records.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'amount') {
        comparison = a.amount - b.amount;
      } else if (sortField === 'progress') {
        comparison = a.progress - b.progress;
      } else if (sortField === 'priority') {
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
      } else if (sortField === 'status') {
        comparison = statusOrder[a.status] - statusOrder[b.status];
      } else if (sortField === 'client') {
        comparison = a.client.localeCompare(b.client);
      } else if (sortField === 'startDate') {
        comparison = dateValue(a.startDate) - dateValue(b.startDate);
      } else if (sortField === 'targetEndDate') {
        comparison = dateValue(a.targetEndDate) - dateValue(b.targetEndDate);
      }

      return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    return records;
  }, [
    recordsByTab,
    searchTerm,
    typeFilter,
    clientFilter,
    accountManagerFilter,
    teamFilter,
    statusFilter,
    priorityFilter,
    riskFilter,
    techFilter,
    dateFrom,
    dateTo,
    sortField,
    sortDirection,
  ]);

  const activeSectionStats = useMemo(() => {
    const totalRecords = filteredRecords.length;
    const totalAmount = filteredRecords.reduce((sum, project) => sum + project.amount, 0);
    const averageProgress = totalRecords > 0
      ? Math.round(filteredRecords.reduce((sum, project) => sum + project.progress, 0) / totalRecords)
      : 0;
    const countByStatus = filteredRecords.reduce((acc, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRecords,
      totalAmount,
      averageProgress,
      countByStatus,
    };
  }, [filteredRecords]);

  const pieData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Proposals', value: data.summary.totalProposals },
      { name: 'Projects', value: data.summary.totalProjects },
    ];
  }, [data]);

  const amountComparisonData = useMemo(() => {
    if (!data) return [];
    return [
      { type: 'Proposals', amount: data.summary.proposalAmount },
      { type: 'Projects', amount: data.summary.projectAmount },
    ];
  }, [data]);

  const statusChartData = useMemo(() => {
    const source = data?.statusBreakdown?.all || {};
    return Object.entries(source).map(([status, count]) => ({ status, count }));
  }, [data]);

  const monthlyTrendData = useMemo(
    () => (data?.monthlyTrend || []).map((entry) => ({ ...entry, label: formatMonth(entry.month) })),
    [data],
  );

  function resetFilters() {
    setSearchTerm('');
    setTypeFilter('all');
    setClientFilter('all');
    setAccountManagerFilter('all');
    setTeamFilter('all');
    setStatusFilter('all');
    setPriorityFilter('all');
    setRiskFilter('all');
    setTechFilter('all');
    setDateFrom('');
    setDateTo('');
    setSortField('targetEndDate');
    setSortDirection('desc');
  }

  function openDetails(project: Project) {
    setSelectedProject(project);
    setIsDetailsOpen(true);
  }

  const hasFilters = useMemo(
    () =>
      searchTerm.trim().length > 0 ||
      typeFilter !== 'all' ||
      clientFilter !== 'all' ||
      accountManagerFilter !== 'all' ||
      teamFilter !== 'all' ||
      statusFilter !== 'all' ||
      priorityFilter !== 'all' ||
      riskFilter !== 'all' ||
      techFilter !== 'all' ||
      dateFrom !== '' ||
      dateTo !== '',
    [
      searchTerm,
      typeFilter,
      clientFilter,
      accountManagerFilter,
      teamFilter,
      statusFilter,
      priorityFilter,
      riskFilter,
      techFilter,
      dateFrom,
      dateTo,
    ],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load quota data</p>
      </div>
    );
  }

  const summaryCards = [
    { label: 'Total Proposals', value: data.summary.totalProposals.toLocaleString() },
    { label: 'Total Projects', value: data.summary.totalProjects.toLocaleString() },
    { label: 'Total Proposal Amount', value: amountFormatter.format(data.summary.proposalAmount) },
    { label: 'Total Project Amount', value: amountFormatter.format(data.summary.projectAmount) },
    { label: 'Grand Total Amount', value: amountFormatter.format(data.summary.grandTotal) },
    { label: 'Active Projects', value: data.summary.activeProjects.toLocaleString() },
    { label: 'Open Proposals', value: data.summary.openProposals.toLocaleString() },
    { label: 'Completed Projects', value: data.summary.completedProjects.toLocaleString() },
  ];

  const sectionTitle = activeTab === 'proposals'
    ? 'Proposals Summary'
    : activeTab === 'projects'
    ? 'Projects Summary'
    : 'All Records Summary';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Quota</h1>
        <p className="text-gray-500 mt-1">
          Pipeline and delivery summary for proposals and active projects.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Quota Target</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="quotaTargetAmount">Quota Amount</Label>
              <Input
                id="quotaTargetAmount"
                type="number"
                min={0}
                step="0.01"
                placeholder="Enter target amount"
                value={quotaTargetInput}
                onChange={(event) => setQuotaTargetInput(event.target.value)}
              />
            </div>
            <Button onClick={handleSaveQuotaTarget} disabled={isSavingQuotaTarget}>
              {isSavingQuotaTarget ? 'Saving...' : 'Save Target'}
            </Button>
          </div>

          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Current Target</span>
              <span className="font-semibold text-gray-900">
                {amountFormatter.format(data.userQuotaTarget || 0)}
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Attainment</span>
                <span>{data.userQuotaProgressPercent.toFixed(2)}%</span>
              </div>
              <Progress value={Math.max(0, Math.min(100, data.userQuotaProgressPercent || 0))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-gray-500 tracking-wide">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Quota Analytics</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase text-gray-500">Proposal Pipeline Amount</p>
              <p className="text-xl font-semibold mt-1">{amountFormatter.format(data.quotaMetrics.proposalPipelineAmount)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase text-gray-500">Active Delivery Amount</p>
              <p className="text-xl font-semibold mt-1">{amountFormatter.format(data.quotaMetrics.activeDeliveryAmount)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase text-gray-500">Conversion Count</p>
              <p className="text-xl font-semibold mt-1">{data.quotaMetrics.conversionCount.toLocaleString()}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase text-gray-500">Conversion Rate</p>
              <p className="text-xl font-semibold mt-1">{data.quotaMetrics.conversionRate.toFixed(2)}%</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase text-gray-500">Average Proposal Value</p>
              <p className="text-xl font-semibold mt-1">{amountFormatter.format(data.quotaMetrics.averageProposalValue)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase text-gray-500">Average Project Value</p>
              <p className="text-xl font-semibold mt-1">{amountFormatter.format(data.quotaMetrics.averageProjectValue)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Breakdown by Type</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={85} label>
                  {pieData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.name === 'Proposals' ? '#3b82f6' : '#16a34a'}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Amount Comparison</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={amountComparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip formatter={(value: any) => amountFormatter.format(Number(value) || 0)} />
                <Bar dataKey="amount" fill="#0f766e" name="Amount" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {statusChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">
                No status data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" name="Records" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Amount Trend</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          {monthlyTrendData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              Not enough date data to show trends yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value: any) => amountFormatter.format(Number(value) || 0)} />
                <Bar dataKey="proposalAmount" stackId="a" fill="#3b82f6" name="Proposal Amount" />
                <Bar dataKey="projectAmount" stackId="a" fill="#16a34a" name="Project Amount" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as QuotaTab)}>
            <TabsList className="w-full md:w-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="proposals">Proposals</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search name, client, account manager, tech..."
                className="pl-10"
              />
            </div>
            <div className="md:col-span-2">
              <Select value={typeFilter} onValueChange={(value: 'all' | 'proposal' | 'project') => setTypeFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clientOptions.map((client) => (
                    <SelectItem key={client} value={client}>{client}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={accountManagerFilter} onValueChange={setAccountManagerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Account Manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Managers</SelectItem>
                  {accountManagerOptions.map((manager) => (
                    <SelectItem key={manager} value={manager}>{manager}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teamOptions.map((team) => (
                    <SelectItem key={team} value={team}>{team}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
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
            <div className="md:col-span-2">
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Risk Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={techFilter} onValueChange={setTechFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tech Assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tech</SelectItem>
                  {techOptions.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-gray-500">Date From</Label>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-gray-500">Date To</Label>
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Select value={sortField} onValueChange={(value: SortField) => setSortField(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount">Amount</SelectItem>
                  <SelectItem value="targetEndDate">Target End Date</SelectItem>
                  <SelectItem value="startDate">Start Date</SelectItem>
                  <SelectItem value="progress">Progress</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={sortDirection} onValueChange={(value: SortDirection) => setSortDirection(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasFilters && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Clear Filters
              </Button>
            </div>
          )}

          <div className="rounded-md border p-3 bg-gray-50">
            <p className="text-sm font-semibold text-gray-900">{sectionTitle}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-700">
              <span>{activeSectionStats.totalRecords} records</span>
              <span>{amountFormatter.format(activeSectionStats.totalAmount)} total</span>
              <span>{activeSectionStats.averageProgress}% avg progress</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(activeSectionStats.countByStatus).length === 0 ? (
                <span className="text-xs text-gray-500">No status counts.</span>
              ) : (
                Object.entries(activeSectionStats.countByStatus).map(([status, count]) => (
                  <Badge key={status} variant="secondary">
                    {status}: {count}
                  </Badge>
                ))
              )}
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center space-y-4">
              <p className="text-gray-700 font-medium">
                {allRecords.length === 0 ? 'No proposals or projects available yet.' : 'No records match your current filters.'}
              </p>
              <p className="text-sm text-gray-500">
                {allRecords.length === 0
                  ? 'Create your first proposal or project to start tracking quota.'
                  : 'Adjust your filters or search terms.'}
              </p>
              {allRecords.length === 0 ? (
                <div className="flex gap-2 justify-center">
                  <Button asChild>
                    <Link to="/projects">Create New Project</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/projects">Create New Proposal</Link>
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={resetFilters}>Reset Filters</Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project / Proposal Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Account Manager</TableHead>
                  <TableHead>Team/Department</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Target End Date</TableHead>
                  <TableHead>Tech Assigned</TableHead>
                  <TableHead>References</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium max-w-[240px] truncate">{project.projectName}</TableCell>
                    <TableCell>
                      <Badge className={typeColors[project.projectType]} variant="secondary">
                        {project.projectType === 'proposal' ? 'Proposal' : 'Project'}
                      </Badge>
                    </TableCell>
                    <TableCell>{project.client || '-'}</TableCell>
                    <TableCell>{project.accountManager || '-'}</TableCell>
                    <TableCell>{project.team || '-'}</TableCell>
                    <TableCell>{amountFormatter.format(project.amount || 0)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[project.status]} variant="secondary">{project.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={priorityColors[project.priority]} variant="secondary">{project.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={riskColors[project.riskLevel]} variant="secondary">{project.riskLevel}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={project.progress} className="w-16" />
                        <span className="text-xs text-gray-600">{project.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(project.startDate)}</TableCell>
                    <TableCell>{formatDate(project.targetEndDate)}</TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      {project.techAssignedNames.length > 0 ? project.techAssignedNames.join(', ') : '-'}
                    </TableCell>
                    <TableCell>{project.referenceLinks.length}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openDetails(project)}>
                          View Details
                        </Button>
                        <Button size="sm" asChild>
                          <Link to="/projects">Edit</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isDetailsOpen}
        onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) setSelectedProject(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Details</DialogTitle>
          </DialogHeader>

          {selectedProject ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Project / Proposal Name</p>
                  <p className="text-sm font-medium text-gray-900">{selectedProject.projectName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Type</p>
                  <Badge className={typeColors[selectedProject.projectType]} variant="secondary">
                    {selectedProject.projectType === 'proposal' ? 'Proposal' : 'Project'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Client</p>
                  <p className="text-sm text-gray-900">{selectedProject.client || '-'}</p>
                </div>
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
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Created</p>
                  <p className="text-sm text-gray-900">{formatDate(selectedProject.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Updated</p>
                  <p className="text-sm text-gray-900">{formatDate(selectedProject.updatedAt)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Description</p>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedProject.description || '-'}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Tech Assigned</p>
                  <p className="text-sm text-gray-900">
                    {selectedProject.techAssignedNames.length > 0 ? selectedProject.techAssignedNames.join(', ') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Visible Teams</p>
                  <p className="text-sm text-gray-900">
                    {selectedProject.visibleTeamNames.length > 0 ? selectedProject.visibleTeamNames.join(', ') : '-'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">References</p>
                {selectedProject.referenceLinks.length === 0 ? (
                  <p className="text-sm text-gray-500">No references.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedProject.referenceLinks.map((link) => (
                      <button
                        key={link.id || `${selectedProject.id}-${link.label}`}
                        type="button"
                        className="w-full rounded-md border p-2 text-left hover:bg-gray-50"
                        onClick={() => window.open(link.url, '_blank')}
                      >
                        <p className="text-sm font-medium text-blue-700 flex items-center gap-2">
                          {link.label}
                          <ExternalLink className="w-3 h-3" />
                        </p>
                        <p className="text-xs text-gray-500 truncate">{link.url}</p>
                        {link.note ? <p className="text-xs text-gray-600 mt-1">{link.note}</p> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Notes</p>
                {selectedProject.notes.length === 0 ? (
                  <p className="text-sm text-gray-500">No notes.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedProject.notes.map((note) => (
                      <div key={note.id} className="rounded-md border p-2">
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{note.body}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {note.createdByName || 'User'} • {formatDate(note.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No record selected.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
