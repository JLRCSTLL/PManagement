# AV CISC RBAC Dashboard

AV CISC is a React + Supabase project/task dashboard with role-based visibility, admin user controls, and project/task assignment workflows.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, React Hook Form, Zod
- Backend: Supabase Edge Function (`supabase/functions/server/index.ts`) with Hono
- Auth: Supabase Auth
- Database:
  - Runtime persistence currently uses Supabase-backed KV (`kv_store.ts`)
  - Relational RBAC schema is provided in `supabase/migrations/20260306112000_rbac_visibility.sql`
  - Prisma schema mirror is provided in `prisma/schema.prisma`

## Implemented RBAC Features

- Roles: `admin`, `user`
- Admin-only operations:
  - create/edit/deactivate users
  - create/edit/delete projects and tasks
  - assign project visibility (`visibleUserIds`)
  - assign task-level visibility overrides (`visibleUserIds`) with project inheritance default
- Standard users:
  - can only read projects/tasks they are allowed to view
  - cannot mutate projects/tasks
- Visibility enforcement is applied in backend query filtering (`/projects`, `/tasks`, `/dashboard/stats`)

## Project Model Updates

- `Owner` renamed to `Account Manager`:
  - `accountManagerId`
  - resolved display: `accountManagerName`
- `Tech Assigned`:
  - `techAssignedIds`
  - resolved display: `techAssignedNames`
- Multi-link references:
  - `referenceLinks[]` with `label`, `url`, `note`, `sortOrder`
- Project-level visibility:
  - `visibleUserIds`
  - resolved display: `visibleUserNames`

## Task Model Updates

- Tasks stay linked to project (`projectId`)
- Added task visibility override (`visibleUserIds`) with inheritance:
  - if empty: inherits project visibility
  - if set: restricted to listed users (plus assignment/requestor safeguards)
- API computes:
  - `daysRemaining`
  - `isOverdue`

## Admin UI

- Route: `/admin/users`
- Supports:
  - list users
  - create user
  - edit user role
  - activate/deactivate user
  - optional sample seed from UI button (admin only)

## Frontend Updates

- Projects page:
  - Account Manager + Tech Assigned fields
  - visibility selector for users
  - multi-link project references add/edit/reorder/delete
  - read-only mode for non-admin
- Tasks page:
  - assignment/requested-by user selection
  - task visibility override selector
  - read-only mode for non-admin
- Dashboard:
  - admin cards and charts include total users and projects by account manager
  - standard user cards include assigned project/task metrics

## Environment

Copy `.env.example` and fill values.

```bash
cp .env.example .env
```

Minimum for scripts:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

## Run

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Supabase Commands

Apply migrations:

```bash
npx supabase db push --linked
```

Deploy edge function:

```bash
npx supabase functions deploy server --project-ref ezsfzliblqsslqcnwdya --no-verify-jwt --use-api
```

## Seed Script

Script: `scripts/seed-rbac.mjs`

Creates:

- 1 admin user
- multiple standard users (including one inactive)
- sample projects with different visibility settings
- sample tasks with task-level visibility overrides
- sample multi-link references

Run:

```bash
npm run seed:rbac
```

Default seeded credentials:

- Admin: `admin@taskflow.com` / `admin123`

## Authorization Model Notes

- Route protection:
  - frontend `ProtectedRoute` guards admin pages by role
- Backend protection:
  - every protected API route validates bearer token and active status
  - backend enforces role checks for mutation/admin routes
  - project/task lists are filtered server-side by allowed visibility
- Security principle:
  - UI hiding is not trusted; API returns only authorized records

## Key Files

- `supabase/functions/server/index.ts`: auth, RBAC, project/task visibility, admin APIs
- `src/app/components/ProjectForm.tsx`: Account Manager + Tech Assigned + visibility + multi-links
- `src/app/pages/ProjectsPage.tsx`: role-aware project management and filters
- `src/app/pages/TasksPage.tsx`: role-aware task management and visibility
- `src/app/pages/AdminUsersPage.tsx`: admin user management
- `src/app/pages/DashboardPage.tsx`: admin/user scoped stats
- `supabase/migrations/20260306112000_rbac_visibility.sql`: relational schema update
- `prisma/schema.prisma`: Prisma schema mirror
- `scripts/seed-rbac.mjs`: seed workflow
