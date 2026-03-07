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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    checkSession();
  }, []);

  async function resolveUserProfile(sessionUser: any): Promise<User> {
    const fallback: User = {
      id: sessionUser.id,
      email: sessionUser.email || '',
      name: sessionUser.user_metadata?.name || 'User',
      role: 'user',
      isActive: true,
    };

    try {
      const { apiClient } = await import('../lib/api');
      const { user } = await apiClient.getMe();
      return {
        id: user.id || fallback.id,
        email: user.email || fallback.email,
        name: user.name || fallback.name,
        role: normalizeRole(user.role),
        isActive: user.isActive ?? true,
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

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, signIn, signUp, signOut }}>
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
