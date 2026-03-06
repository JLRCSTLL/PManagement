# TaskFlow Setup Guide

## 1. Install Dependencies

```bash
npm install
```

## 2. Configure Environment

Copy the example env file and fill values:

```bash
cp .env.example .env
```

Required values:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

Optional:

- `EDGE_FUNCTION_URL` (defaults to `${SUPABASE_URL}/functions/v1/server`)
- `DATABASE_URL` (for Prisma CLI/schema tooling)

## 3. Apply Database Migration

This repo includes relational RBAC schema in:

- `supabase/migrations/20260306112000_rbac_visibility.sql`

Apply migrations:

```bash
npx supabase db push --linked
```

## 4. Deploy Backend Function

```bash
npx supabase functions deploy server --project-ref ezsfzliblqsslqcnwdya --no-verify-jwt --use-api
```

## 5. Start Frontend

```bash
npm run dev
```

## 6. Seed Data (Optional but Recommended)

Run seed script:

```bash
npm run seed:rbac
```

Seed script creates:

- 1 admin user
- several standard users
- inactive sample user
- sample projects with different visibility rules
- sample tasks with inherited and overridden visibility
- multi-link project references

Default admin credential:

- `admin@taskflow.com` / `admin123`

## 7. Verify Core Flows

1. Sign in as admin and open `/admin/users`.
2. Confirm users and roles are visible.
3. Open `/projects` and create/edit a project:
   - set account manager
   - set tech assigned
   - set visible users
   - add/reorder reference links
4. Open `/tasks` and create/edit tasks with/without task visibility overrides.
5. Sign in as standard user and verify hidden projects/tasks are not returned.
6. Confirm dashboard cards/charts differ for admin vs standard user.

## Notes

- Frontend route guards are enforced, but backend authorization is the source of truth.
- Project/task reads are filtered server-side by current user access.
- Non-admin users are read-only for project/task management in this implementation.
