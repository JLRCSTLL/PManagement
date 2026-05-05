import React from 'react';
import { RouterProvider } from 'react-router';
import { AuthProvider } from './contexts/AuthContext';
import { TabAccessProvider } from './contexts/TabAccessContext';
import { Toaster } from './components/ui/sonner';
import { ThemeProvider } from './components/theme-provider';
import { router } from './routes';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TabAccessProvider>
          <RouterProvider router={router} />
          <Toaster position="top-right" />
        </TabAccessProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
