import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router';
import { UserRole } from '../types';

export function ProtectedRoute({
  children,
  requiredRole,
  requiredRoles,
  requiredTeam,
}: {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requiredRoles?: UserRole[];
  requiredTeam?: string;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  if (requiredRoles && !requiredRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  if (requiredTeam) {
    const teamKey = requiredTeam.trim().toLowerCase();
    const assignedTeams = new Set(
      [
        ...(Array.isArray(user.teams) ? user.teams : []),
        typeof user.team === 'string' ? user.team : '',
      ]
        .map((team) => team.trim().toLowerCase())
        .filter(Boolean),
    );
    if (!assignedTeams.has(teamKey)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
