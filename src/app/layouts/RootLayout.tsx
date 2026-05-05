import React from 'react';
import { Outlet } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from 'next-themes';
import { apiClient } from '../lib/api';
import { applyThemePreset } from '../lib/userTheme';

export function RootLayout() {
  const { user } = useAuth();
  const { setTheme } = useTheme();

  React.useEffect(() => {
    let isCancelled = false;

    async function applyUserTheme() {
      if (!user?.id) {
        applyThemePreset('default');
        return;
      }
      try {
        const { settings } = await apiClient.getUserSettings();
        if (isCancelled) return;
        applyThemePreset(settings?.themePreset || 'default');
        const preferredTheme = settings?.preferredTheme;
        if (preferredTheme === 'light' || preferredTheme === 'dark') {
          setTheme(preferredTheme);
          return;
        }
        setTheme('system');
      } catch {
        // Keep the currently active theme if user settings are unavailable.
      }
    }

    applyUserTheme();

    return () => {
      isCancelled = true;
    };
  }, [setTheme, user?.id]);

  if (!user) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
