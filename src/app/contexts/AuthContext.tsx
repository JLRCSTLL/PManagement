import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

function normalizeRole(value: unknown): User['role'] {
  if (value === 'admin' || value === 'team_lead' || value === 'user') return value;
  return 'user';
}

function normalizeTeams(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveTeamInfo(source: any): { team: string; teams: string[] } {
  const teams = normalizeTeams(source?.teams);
  const team = typeof source?.team === 'string' ? source.team.trim() : '';
  if (team && !teams.includes(team)) {
    teams.unshift(team);
  }
  return {
    team: team || teams[0] || '',
    teams,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    checkSession();
  }, []);

  async function resolveUserProfile(sessionUser: any): Promise<User> {
    const sessionTeamInfo = resolveTeamInfo(sessionUser?.user_metadata);
    const fallback: User = {
      id: sessionUser.id,
      email: sessionUser.email || '',
      name: sessionUser.user_metadata?.name || 'User',
      role: 'user',
      isActive: true,
      team: sessionTeamInfo.team,
      teams: sessionTeamInfo.teams,
    };

    try {
      const { apiClient } = await import('../lib/api');
      const { user } = await apiClient.getMe();
      let apiTeamInfo = resolveTeamInfo(user);

      // Some backend versions of /me do not include team fields.
      // Fallback to /users and read the current user's teams there.
      if (!apiTeamInfo.team && apiTeamInfo.teams.length === 0) {
        try {
          const { users } = await apiClient.getUsers();
          const currentId = user.id || fallback.id;
          const currentEmail = user.email || fallback.email;
          const currentUser = Array.isArray(users)
            ? users.find((entry: any) => entry?.id === currentId || entry?.email === currentEmail)
            : null;
          if (currentUser) {
            apiTeamInfo = resolveTeamInfo(currentUser);
          }
        } catch {
          // Keep existing fallback values when users endpoint is unavailable.
        }
      }

      return {
        id: user.id || fallback.id,
        email: user.email || fallback.email,
        name: user.name || fallback.name,
        role: normalizeRole(user.role),
        isActive: user.isActive ?? true,
        team: apiTeamInfo.team || fallback.team,
        teams: apiTeamInfo.teams.length > 0 ? apiTeamInfo.teams : fallback.teams,
      };
    } catch {
      return fallback;
    }
  }

  async function checkSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session check error:', error);
        setIsLoading(false);
        return;
      }

      if (session?.access_token) {
        localStorage.setItem('access_token', session.access_token);
        const userData = await resolveUserProfile(session.user);
        if (!userData.isActive) {
          await supabase.auth.signOut();
          localStorage.removeItem('access_token');
          setUser(null);
          setAccessToken(null);
          setIsLoading(false);
          return;
        }
        setUser(userData);
        setAccessToken(session.access_token);
      }
    } catch (err) {
      console.error('Session check exception:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data.session) {
      localStorage.setItem('access_token', data.session.access_token);
      const userData = await resolveUserProfile(data.user);
      if (!userData.isActive) {
        await supabase.auth.signOut();
        localStorage.removeItem('access_token');
        throw new Error('Your account is inactive. Contact an admin.');
      }
      setUser(userData);
      setAccessToken(data.session.access_token);
    }
  }

  async function signUp(email: string, password: string, name: string) {
    const { apiClient } = await import('../lib/api');
    await apiClient.signup(email, password, name);
    
    // After signup, sign in
    await signIn(email, password);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('access_token');
  }

  async function refreshUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const userData = await resolveUserProfile(session.user);
    setUser(userData);
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
