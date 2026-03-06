import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    if (!key || process.env[key]) continue;

    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function hydrateFromSupabaseInfo() {
  const infoPath = resolve(process.cwd(), 'utils', 'supabase', 'info.tsx');
  if (!existsSync(infoPath)) return;

  const content = readFileSync(infoPath, 'utf8');
  const projectIdMatch = content.match(/projectId\s*=\s*"([^"]+)"/);
  const anonKeyMatch = content.match(/publicAnonKey\s*=\s*"([^"]+)"/);

  if (!process.env.SUPABASE_URL && projectIdMatch?.[1]) {
    process.env.SUPABASE_URL = `https://${projectIdMatch[1]}.supabase.co`;
  }
  if (!process.env.SUPABASE_ANON_KEY && anonKeyMatch?.[1]) {
    process.env.SUPABASE_ANON_KEY = anonKeyMatch[1];
  }
}

loadDotEnv();
hydrateFromSupabaseInfo();

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

function looksLikeJwt(value) {
  return typeof value === 'string' && value.split('.').length === 3;
}

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (
  serviceRoleKey === 'your_service_role_key' ||
  serviceRoleKey.toLowerCase().includes('your_') ||
  !looksLikeJwt(serviceRoleKey)
) {
  console.error('Invalid SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Use the real Service Role key from Supabase Dashboard -> Settings -> API -> service_role.');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
const EDGE_BASE_URL = process.env.EDGE_FUNCTION_URL || `${SUPABASE_URL}/functions/v1/server`;

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const usersToEnsure = [
  {
    email: 'admin@taskflow.com',
    password: 'admin123',
    name: 'System Admin',
    role: 'admin',
    isActive: true,
    teams: ['Project Manager', 'AV'],
  },
  {
    email: 'alice@taskflow.com',
    password: 'user1234',
    name: 'Alice Manager',
    role: 'team_lead',
    isActive: true,
    teams: ['Project Manager'],
  },
  {
    email: 'bob@taskflow.com',
    password: 'user1234',
    name: 'Bob Engineer',
    role: 'user',
    isActive: true,
    teams: ['AV'],
  },
  {
    email: 'cara@taskflow.com',
    password: 'user1234',
    name: 'Cara Analyst',
    role: 'user',
    isActive: true,
    teams: ['AV'],
  },
  {
    email: 'dan@taskflow.com',
    password: 'user1234',
    name: 'Dan Inactive',
    role: 'user',
    isActive: false,
    teams: ['AV'],
  },
];

async function listUsers() {
  const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users || [];
}

async function ensureUser(definition, currentUsers) {
  const existing = currentUsers.find((user) => (user.email || '').toLowerCase() === definition.email);
  const userMetadata = {
    name: definition.name,
    role: definition.role,
    isActive: definition.isActive,
    team: Array.isArray(definition.teams) && definition.teams[0] ? definition.teams[0] : '',
    teams: Array.isArray(definition.teams) ? definition.teams : [],
  };

  if (!existing) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: definition.email,
      password: definition.password,
      email_confirm: true,
      user_metadata: userMetadata,
    });
    if (error || !data.user) {
      throw new Error(error?.message || `Failed to create ${definition.email}`);
    }
    return data.user;
  }

  const { data, error } = await adminClient.auth.admin.updateUserById(existing.id, {
    password: definition.password,
    user_metadata: {
      ...(existing.user_metadata || {}),
      ...userMetadata,
    },
  });
  if (error || !data.user) {
    throw new Error(error?.message || `Failed to update ${definition.email}`);
  }
  return data.user;
}

async function edgeRequest(path, token, method = 'GET', body = undefined) {
  const response = await fetch(`${EDGE_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Edge request failed: ${response.status}`);
  }
  return payload;
}

async function main() {
  console.log('Ensuring users...');
  const users = await listUsers();
  const ensured = {};
  for (const definition of usersToEnsure) {
    const user = await ensureUser(definition, users);
    ensured[definition.email] = user.id;
    console.log(`  - ${definition.email} (${definition.role}, active=${definition.isActive})`);
  }

  console.log('Signing in as admin...');
  const signInResult = await anonClient.auth.signInWithPassword({
    email: 'admin@taskflow.com',
    password: 'admin123',
  });
  if (signInResult.error || !signInResult.data.session?.access_token) {
    throw new Error(signInResult.error?.message || 'Unable to sign in as admin');
  }
  const adminToken = signInResult.data.session.access_token;

  console.log('Removing old seed projects...');
  const existingProjects = await edgeRequest('/projects', adminToken);
  for (const project of existingProjects.projects || []) {
    if (
      (typeof project.client === 'string' && project.client.startsWith('SEED-CLIENT-')) ||
      (typeof project.projectId === 'string' && project.projectId.startsWith('SEED-'))
    ) {
      await edgeRequest(`/projects/${project.id}`, adminToken, 'DELETE');
    }
  }

  console.log('Creating sample projects...');
  const projectDefinitions = [
    {
      projectName: 'Platform Security Hardening',
      client: 'SEED-CLIENT-001',
      description: 'Harden role-based access and review endpoint visibility.',
      accountManager: 'Alice Manager',
      techAssignedIds: [ensured['bob@taskflow.com']],
      visibleTeams: ['AV', 'Project Manager'],
      team: 'AV',
      amount: 250000,
      startDate: '2026-03-01',
      targetEndDate: '2026-04-10',
      priority: 'High',
      status: 'In Progress',
      riskLevel: 'Medium',
      progress: 40,
      referenceLinks: [
        {
          label: 'Architecture Note',
          url: 'https://example.com/security-architecture',
          note: 'Primary design note',
          sortOrder: 0,
        },
        {
          label: 'Threat Model',
          url: 'https://example.com/threat-model',
          note: 'Access model notes',
          sortOrder: 1,
        },
      ],
    },
    {
      projectName: 'Data Operations Automation',
      client: 'SEED-CLIENT-002',
      description: 'Automate recurring data integrity and validation work.',
      accountManager: 'Cara Analyst',
      techAssignedIds: [ensured['bob@taskflow.com']],
      visibleTeams: ['AV'],
      team: 'Project Manager',
      amount: 175000,
      startDate: '2026-03-05',
      targetEndDate: '2026-05-01',
      priority: 'Medium',
      status: 'Not Started',
      riskLevel: 'Low',
      progress: 0,
      referenceLinks: [
        {
          label: 'Operations Spec',
          url: 'https://example.com/dataops-spec',
          note: '',
          sortOrder: 0,
        },
      ],
    },
  ];

  const createdProjects = [];
  for (const definition of projectDefinitions) {
    const response = await edgeRequest('/projects', adminToken, 'POST', definition);
    createdProjects.push(response.project);
    console.log(`  - ${definition.client}`);
  }

  console.log('Creating sample tasks...');
  const tasks = [
    {
      projectId: createdProjects[0].id,
      title: 'Audit endpoint authorization',
      taskId: 'SEED-TASK-001',
      description: 'Review hidden project/task access across API routes.',
      assignedTo: ensured['bob@taskflow.com'],
      requestedBy: ensured['alice@taskflow.com'],
      priority: 'High',
      status: 'In Progress',
      startDate: '2026-03-02',
      dueDate: '2026-03-14',
      progress: 50,
      dependencies: '',
      notes: 'Focus on project and task list endpoints first.',
      referenceLink: 'https://example.com/api-audit',
      visibleUserIds: [ensured['alice@taskflow.com'], ensured['bob@taskflow.com']],
    },
    {
      projectId: createdProjects[0].id,
      title: 'Refactor project reference link UI',
      taskId: 'SEED-TASK-002',
      description: 'Add reorder and note support in project form.',
      assignedTo: ensured['cara@taskflow.com'],
      requestedBy: ensured['alice@taskflow.com'],
      priority: 'Medium',
      status: 'Pending',
      startDate: '2026-03-08',
      dueDate: '2026-03-20',
      progress: 15,
      dependencies: 'SEED-TASK-001',
      notes: '',
      referenceLink: 'https://example.com/ui-reference',
      visibleUserIds: [],
    },
    {
      projectId: createdProjects[1].id,
      title: 'Build automated validation job',
      taskId: 'SEED-TASK-003',
      description: 'Implement recurring validation with daily report output.',
      assignedTo: ensured['bob@taskflow.com'],
      requestedBy: ensured['cara@taskflow.com'],
      priority: 'Critical',
      status: 'Not Started',
      startDate: '2026-03-10',
      dueDate: '2026-03-28',
      progress: 0,
      dependencies: '',
      notes: 'Initial scaffold only.',
      referenceLink: '',
      visibleUserIds: [ensured['cara@taskflow.com'], ensured['bob@taskflow.com']],
    },
  ];

  for (const task of tasks) {
    await edgeRequest('/tasks', adminToken, 'POST', task);
    console.log(`  - ${task.taskId}`);
  }

  console.log('Seed completed.');
  console.log('Admin login: admin@taskflow.com / admin123');
  console.log('Sample users: alice@taskflow.com, bob@taskflow.com, cara@taskflow.com');
}

main().catch((error) => {
  console.error('Seed failed:', error.message || error);
  process.exit(1);
});
