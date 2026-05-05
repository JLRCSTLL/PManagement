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
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

loadDotEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const EDGE_BASE_URL = `${SUPABASE_URL}/functions/v1/server`;
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

async function main() {
  const email = process.env.TICKET_SETTINGS_ADMIN_EMAIL || 'admin@taskflow.com';
  const password = process.env.TICKET_SETTINGS_ADMIN_PASSWORD || 'admin123';

  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session?.access_token) {
    throw new Error(signIn.error?.message || 'Unable to sign in as admin for ticket settings seed');
  }

  const token = signIn.data.session.access_token;
  const payload = {
    categories: [
      { id: 'cat-software', name: 'Software', subcategories: ['Installation', 'Bug', 'Account Access', 'License'], isActive: true },
      { id: 'cat-hardware', name: 'Hardware', subcategories: ['Laptop', 'Desktop', 'Printer', 'Peripheral'], isActive: true },
      { id: 'cat-network', name: 'Network', subcategories: ['VPN', 'Wi-Fi', 'LAN', 'Firewall'], isActive: true },
      { id: 'cat-service-request', name: 'Service Request', subcategories: ['New User', 'Access Request', 'Change Request'], isActive: true },
    ],
    slaRules: {
      Critical: { firstResponseMinutes: 15, resolutionMinutes: 240, businessDays: false },
      High: { firstResponseMinutes: 60, resolutionMinutes: 480, businessDays: false },
      Medium: { firstResponseMinutes: 240, resolutionMinutes: 2880, businessDays: true },
      Low: { firstResponseMinutes: 480, resolutionMinutes: 7200, businessDays: true },
    },
  };

  await edgeRequest('/tickets/settings', token, 'PUT', payload);
  console.log('Ticket settings seeded successfully.');
}

main().catch((error) => {
  console.error('Seed ticket settings failed:', error.message || error);
  process.exit(1);
});
