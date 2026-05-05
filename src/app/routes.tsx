import { createBrowserRouter } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { TasksPage } from "./pages/TasksPage";
import { AuthPage } from "./pages/AuthPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TeamDepartmentSettingsPage } from "./pages/TeamDepartmentSettingsPage";
import { AVSchedulePage } from "./pages/AVSchedulePage";
import { QuotaPage } from "./pages/QuotaPage";
import { UserSettingsPage } from "./pages/UserSettingsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute requiredTab="dashboard">
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "projects",
        element: (
          <ProtectedRoute requiredTab="projects">
            <ProjectsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "tasks",
        element: (
          <ProtectedRoute requiredTab="tasks">
            <TasksPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "quota",
        element: (
          <ProtectedRoute requiredTab="quota">
            <QuotaPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "av-schedule",
        element: (
          <ProtectedRoute requiredTab="av_schedule">
            <AVSchedulePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "users",
        element: (
          <ProtectedRoute requiredRole="admin" requiredTab="users">
            <AdminUsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/users",
        element: (
          <ProtectedRoute requiredRole="admin" requiredTab="users">
            <AdminUsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "settings",
        element: (
          <ProtectedRoute requiredRole="admin" requiredTab="workspace_settings">
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "my-settings",
        element: (
          <ProtectedRoute>
            <UserSettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "settings/team-department",
        element: (
          <ProtectedRoute requiredRoles={["admin", "team_lead"]} requiredTab="team_settings">
            <TeamDepartmentSettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "auth",
        element: <AuthPage />,
      },
    ],
  },
]);
