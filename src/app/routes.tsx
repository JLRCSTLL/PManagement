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
import { CreateTicketPage } from "./pages/CreateTicketPage";
import { EditTicketPage } from "./pages/EditTicketPage";
import { MyTicketsPage } from "./pages/MyTicketsPage";
import { TicketAdminSettingsPage } from "./pages/TicketAdminSettingsPage";
import { TicketDashboardPage } from "./pages/TicketDashboardPage";
import { TicketDetailPage } from "./pages/TicketDetailPage";
import { TicketQueuePage } from "./pages/TicketQueuePage";
import { TicketSlaQueuePage } from "./pages/TicketSlaQueuePage";

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
        path: "tickets/dashboard",
        element: (
          <ProtectedRoute>
            <TicketDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "tickets/my",
        element: (
          <ProtectedRoute>
            <MyTicketsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "tickets/queue",
        element: (
          <ProtectedRoute requiredRoles={["admin", "team_lead"]}>
            <TicketQueuePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "tickets/sla",
        element: (
          <ProtectedRoute requiredRoles={["admin", "team_lead"]}>
            <TicketSlaQueuePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "tickets/create",
        element: (
          <ProtectedRoute>
            <CreateTicketPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "tickets/:id",
        element: (
          <ProtectedRoute>
            <TicketDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "tickets/:id/edit",
        element: (
          <ProtectedRoute>
            <EditTicketPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "settings/tickets",
        element: (
          <ProtectedRoute requiredRole="admin">
            <TicketAdminSettingsPage />
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
