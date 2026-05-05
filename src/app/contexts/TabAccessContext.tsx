import React from 'react';
import { useAuth } from './AuthContext';
import { apiClient } from '../lib/api';
import { canUserAccessTab, DEFAULT_TAB_ACCESS, normalizeTabAccess, TabAccessKey, TabAccessSettings } from '../lib/tabAccess';

interface TabAccessContextValue {
  tabAccess: TabAccessSettings;
  isLoading: boolean;
  refreshTabAccess: () => Promise<void>;
  canAccessTab: (tabKey: TabAccessKey) => boolean;
}

const TabAccessContext = React.createContext<TabAccessContextValue | undefined>(undefined);

export function TabAccessProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [tabAccess, setTabAccess] = React.useState<TabAccessSettings>(DEFAULT_TAB_ACCESS);
  const [isLoading, setIsLoading] = React.useState(false);

  const loadTabAccess = React.useCallback(async () => {
    if (!user?.id) {
      setTabAccess(DEFAULT_TAB_ACCESS);
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.getNavigationSettings();
      setTabAccess(normalizeTabAccess(response?.tabAccess));
    } catch {
      setTabAccess(DEFAULT_TAB_ACCESS);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  React.useEffect(() => {
    if (isAuthLoading) return;
    loadTabAccess();
  }, [isAuthLoading, loadTabAccess]);

  const canAccessTab = React.useCallback(
    (tabKey: TabAccessKey) => canUserAccessTab(tabKey, tabAccess, user),
    [tabAccess, user],
  );

  return (
    <TabAccessContext.Provider value={{ tabAccess, isLoading, refreshTabAccess: loadTabAccess, canAccessTab }}>
      {children}
    </TabAccessContext.Provider>
  );
}

export function useTabAccess() {
  const context = React.useContext(TabAccessContext);
  if (!context) {
    throw new Error('useTabAccess must be used within TabAccessProvider');
  }
  return context;
}
