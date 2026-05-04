import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiClient, AppSettings, AppSettingsPayload } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';

const DEFAULT_SETTINGS: AppSettingsPayload = {
  organizationName: 'Project Management',
  dashboardSubtitle: 'Project and Schedule Management',
  timezone: 'Asia/Manila',
  defaultCurrency: 'PHP',
  dateFormat: 'YYYY-MM-DD',
  weekStartsOn: 'monday',
  defaultProjectVisibility: 'team_only',
  enableTaskDueReminders: true,
  reminderLeadDays: 3,
  enableDailySummary: false,
  dailySummaryTime: '09:00',
};

function toPayload(raw: Partial<AppSettings> | null | undefined): AppSettingsPayload {
  if (!raw) return { ...DEFAULT_SETTINGS };
  const normalizedReminderLeadDays = typeof raw.reminderLeadDays === 'number'
    ? Math.max(1, Math.min(30, Math.round(raw.reminderLeadDays)))
    : DEFAULT_SETTINGS.reminderLeadDays;
  const normalizedSummaryTime = typeof raw.dailySummaryTime === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(raw.dailySummaryTime.trim())
    ? raw.dailySummaryTime.trim()
    : DEFAULT_SETTINGS.dailySummaryTime;
  return {
    organizationName: typeof raw.organizationName === 'string' && raw.organizationName.trim()
      ? raw.organizationName.trim()
      : DEFAULT_SETTINGS.organizationName,
    dashboardSubtitle: typeof raw.dashboardSubtitle === 'string' && raw.dashboardSubtitle.trim()
      ? raw.dashboardSubtitle.trim()
      : DEFAULT_SETTINGS.dashboardSubtitle,
    timezone: typeof raw.timezone === 'string' && raw.timezone.trim()
      ? raw.timezone.trim()
      : DEFAULT_SETTINGS.timezone,
    defaultCurrency: raw.defaultCurrency === 'USD' || raw.defaultCurrency === 'EUR' ? raw.defaultCurrency : 'PHP',
    dateFormat: raw.dateFormat === 'MMM dd, yyyy' || raw.dateFormat === 'dd/MM/yyyy' ? raw.dateFormat : 'YYYY-MM-DD',
    weekStartsOn: raw.weekStartsOn === 'sunday' ? 'sunday' : 'monday',
    defaultProjectVisibility: raw.defaultProjectVisibility === 'all_teams' ? 'all_teams' : 'team_only',
    enableTaskDueReminders: raw.enableTaskDueReminders !== false,
    reminderLeadDays: normalizedReminderLeadDays,
    enableDailySummary: raw.enableDailySummary === true,
    dailySummaryTime: normalizedSummaryTime,
  };
}

export function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSettings, setSavedSettings] = useState<AppSettingsPayload>({ ...DEFAULT_SETTINGS });
  const [draftSettings, setDraftSettings] = useState<AppSettingsPayload>({ ...DEFAULT_SETTINGS });
  const [lastUpdatedAt, setLastUpdatedAt] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(savedSettings) !== JSON.stringify(draftSettings),
    [savedSettings, draftSettings],
  );

  const canSave = useMemo(() => {
    if (!draftSettings.organizationName.trim()) return false;
    if (!draftSettings.dashboardSubtitle.trim()) return false;
    if (!draftSettings.timezone.trim()) return false;
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(draftSettings.dailySummaryTime)) return false;
    if (draftSettings.reminderLeadDays < 1 || draftSettings.reminderLeadDays > 30) return false;
    return isDirty && !isSaving;
  }, [draftSettings, isDirty, isSaving]);

  async function loadSettings() {
    setIsLoading(true);
    try {
      const { settings } = await apiClient.getSettings();
      const normalized = toPayload(settings);
      setSavedSettings(normalized);
      setDraftSettings(normalized);
      setLastUpdatedAt(typeof settings?.updatedAt === 'string' ? settings.updatedAt : '');
    } catch (error: any) {
      toast.error(error.message || 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const { settings } = await apiClient.updateSettings(draftSettings);
      const normalized = toPayload(settings);
      setSavedSettings(normalized);
      setDraftSettings(normalized);
      setLastUpdatedAt(typeof settings?.updatedAt === 'string' ? settings.updatedAt : new Date().toISOString());
      toast.success('Settings saved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }

  function handleReset() {
    setDraftSettings(savedSettings);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Global app settings for your workspace.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-5 space-y-5">
        <h2 className="text-lg font-semibold">Organization</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="organizationName">Organization Name</Label>
            <Input
              id="organizationName"
              value={draftSettings.organizationName}
              onChange={(event) => setDraftSettings((prev) => ({ ...prev, organizationName: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dashboardSubtitle">Dashboard Subtitle</Label>
            <Input
              id="dashboardSubtitle"
              value={draftSettings.dashboardSubtitle}
              onChange={(event) => setDraftSettings((prev) => ({ ...prev, dashboardSubtitle: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="timezone">Default Timezone</Label>
            <Input
              id="timezone"
              value={draftSettings.timezone}
              onChange={(event) => setDraftSettings((prev) => ({ ...prev, timezone: event.target.value }))}
              placeholder="e.g. Asia/Manila"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-5 space-y-5">
        <h2 className="text-lg font-semibold">Regional Defaults</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Default Currency</Label>
            <Select
              value={draftSettings.defaultCurrency}
              onValueChange={(value) => setDraftSettings((prev) => ({ ...prev, defaultCurrency: value as AppSettingsPayload['defaultCurrency'] }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PHP">PHP</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Date Format</Label>
            <Select
              value={draftSettings.dateFormat}
              onValueChange={(value) => setDraftSettings((prev) => ({ ...prev, dateFormat: value as AppSettingsPayload['dateFormat'] }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                <SelectItem value="MMM dd, yyyy">MMM dd, yyyy</SelectItem>
                <SelectItem value="dd/MM/yyyy">dd/MM/yyyy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Week Starts On</Label>
            <Select
              value={draftSettings.weekStartsOn}
              onValueChange={(value) => setDraftSettings((prev) => ({ ...prev, weekStartsOn: value as AppSettingsPayload['weekStartsOn'] }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monday">Monday</SelectItem>
                <SelectItem value="sunday">Sunday</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Default Project Visibility</Label>
            <Select
              value={draftSettings.defaultProjectVisibility}
              onValueChange={(value) => setDraftSettings((prev) => ({ ...prev, defaultProjectVisibility: value as AppSettingsPayload['defaultProjectVisibility'] }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="team_only">Team only</SelectItem>
                <SelectItem value="all_teams">All teams</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-5 space-y-5">
        <h2 className="text-lg font-semibold">Task Alerts</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Enable Due Date Reminders</p>
              <p className="text-sm text-gray-500">Show reminders before task deadlines.</p>
            </div>
            <Switch
              checked={draftSettings.enableTaskDueReminders}
              onCheckedChange={(checked) => setDraftSettings((prev) => ({ ...prev, enableTaskDueReminders: checked }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reminderLeadDays">Reminder Lead Time (days)</Label>
            <Input
              id="reminderLeadDays"
              type="number"
              min={1}
              max={30}
              disabled={!draftSettings.enableTaskDueReminders}
              value={draftSettings.reminderLeadDays}
              onChange={(event) => {
                const value = Number(event.target.value);
                const next = Number.isFinite(value) ? Math.max(1, Math.min(30, Math.round(value))) : 1;
                setDraftSettings((prev) => ({ ...prev, reminderLeadDays: next }));
              }}
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="font-medium text-gray-900">Enable Daily Summary</p>
              <p className="text-sm text-gray-500">Reserve a daily project summary schedule.</p>
            </div>
            <Switch
              checked={draftSettings.enableDailySummary}
              onCheckedChange={(checked) => setDraftSettings((prev) => ({ ...prev, enableDailySummary: checked }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dailySummaryTime">Daily Summary Time (HH:mm)</Label>
            <Input
              id="dailySummaryTime"
              placeholder="09:00"
              disabled={!draftSettings.enableDailySummary}
              value={draftSettings.dailySummaryTime}
              onChange={(event) => setDraftSettings((prev) => ({ ...prev, dailySummaryTime: event.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {lastUpdatedAt ? `Last updated: ${new Date(lastUpdatedAt).toLocaleString()}` : 'Settings have not been updated yet.'}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={!isDirty || isSaving}>
            Reset
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
