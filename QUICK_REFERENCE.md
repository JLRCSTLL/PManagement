# Quick Reference

## Commands

```bash
npm run dev
npm run build
npm run seed:rbac
npx supabase db push --linked
npx supabase functions deploy server --project-ref ezsfzliblqsslqcnwdya --no-verify-jwt --use-api
```

## Roles

- `admin`
  - manage users (`/admin/users`)
  - create/edit/delete projects and tasks
  - assign project/task visibility
- `user`
  - read-only view of authorized projects/tasks

## Project Fields

- Project ID
- Project Name
- Description
- Account Manager
- Tech Assigned
- Team / Department
- Start Date
- Target End Date
- Priority
- Status
- Risk Level
- Progress %
- Reference Links (multi-link)
- Visible Users

## Task Fields

- Task ID
- Project
- Task Title
- Description
- Assigned To
- Requested By
- Priority
- Status
- Start Date
- Due Date
- Progress %
- Dependencies
- Notes
- Reference Link
- Visibility Override (optional)

## Security

- `ProtectedRoute` enforces role-only routes in frontend.
- Backend enforces auth + role + visibility filtering.
- Hidden projects/tasks are not returned by list endpoints.
- Non-admin write attempts are blocked by backend.

## Important Files

- `supabase/functions/server/index.ts`
- `src/app/pages/ProjectsPage.tsx`
- `src/app/pages/TasksPage.tsx`
- `src/app/pages/AdminUsersPage.tsx`
- `src/app/components/ProjectForm.tsx`
- `src/app/components/TaskForm.tsx`
- `supabase/migrations/20260306112000_rbac_visibility.sql`
- `prisma/schema.prisma`
- `scripts/seed-rbac.mjs`
