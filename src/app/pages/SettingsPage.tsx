import React from 'react';

export function SettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">System-wide settings are available to Admin only.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-sm text-gray-700">
          This area is reserved for global settings. Team and department management is in
          <span className="font-medium"> Team/Department Settings</span>.
        </p>
      </div>
    </div>
  );
}

