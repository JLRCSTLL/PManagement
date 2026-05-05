import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { apiClient, UserSettings, UserSettingsPayload } from '../lib/api';
import { applyThemePreset, normalizeThemePreset, THEME_PRESET_OPTIONS } from '../lib/userTheme';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';

const DEFAULT_USER_SETTINGS: UserSettingsPayload = {
  preferredTheme: 'system',
  themePreset: 'default',
  timezone: 'Asia/Manila',
  dateFormat: 'YYYY-MM-DD',
  emailNotificationsEnabled: true,
  taskReminderEmailEnabled: true,
  dailySummaryEmailEnabled: false,
};

function toPayload(raw: Partial<UserSettings> | null | undefined): UserSettingsPayload {
  if (!raw) return { ...DEFAULT_USER_SETTINGS };
  return {
    preferredTheme: raw.preferredTheme === 'dark' || raw.preferredTheme === 'light' ? raw.preferredTheme : 'system',
    themePreset: normalizeThemePreset(raw.themePreset),
    timezone: typeof raw.timezone === 'string' && raw.timezone.trim() ? raw.timezone.trim() : DEFAULT_USER_SETTINGS.timezone,
    dateFormat: raw.dateFormat === 'MMM dd, yyyy' || raw.dateFormat === 'dd/MM/yyyy' ? raw.dateFormat : 'YYYY-MM-DD',
    emailNotificationsEnabled: raw.emailNotificationsEnabled !== false,
    taskReminderEmailEnabled: raw.taskReminderEmailEnabled !== false,
    dailySummaryEmailEnabled: raw.dailySummaryEmailEnabled === true,
  };
}

export function UserSettingsPage() {
  const { user, refreshUser } = useAuth();
  const { setTheme } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSettings, setSavedSettings] = useState<UserSettingsPayload>({ ...DEFAULT_USER_SETTINGS });
  const [draftSettings, setDraftSettings] = useState<UserSettingsPayload>({ ...DEFAULT_USER_SETTINGS });
  const [savedName, setSavedName] = useState(user?.name || '');
  const [draftName, setDraftName] = useState(user?.name || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState('');

  useEffect(() => {
    setSavedName(user?.name || '');
    setDraftName(user?.name || '');
  }, [user?.id]);

  useEffect(() => {
    loadSettings();
  }, []);

  const isSettingsDirty = useMemo(
    () => JSON.stringify(savedSettings) !== JSON.stringify(draftSettings),
    [savedSettings, draftSettings],
  );

  const isNameDirty = useMemo(
    () => draftName.trim() !== (savedName || '').trim(),
    [draftName, savedName],
  );

  const hasPasswordDraft = newPassword.length > 0 || confirmPassword.length > 0;

  const passwordError = useMemo(() => {
    if (!hasPasswordDraft) return '';
    if (newPassword.length < 6) return 'Password must be at least 6 characters.';
    if (newPassword !== confirmPassword) return 'Passwords do not match.';
    return '';
  }, [hasPasswordDraft, newPassword, confirmPassword]);

  const canSave = useMemo(() => {
    if (!draftName.trim()) return false;
    if (!draftSettings.timezone.trim()) return false;
    if (Boolean(passwordError)) return false;
    if (isSaving) return false;
    return isSettingsDirty || isNameDirty || hasPasswordDraft;
  }, [draftName, draftSettings.timezone, passwordError, isSaving, isSettingsDirty, isNameDirty, hasPasswordDraft]);

  async function loadSettings() {
    setIsLoading(true);
    try {
      const { settings } = await apiClient.getUserSettings();
      const normalized = toPayload(settings);
      setSavedSettings(normalized);
      setDraftSettings(normalized);
      setTheme(normalized.preferredTheme);
      applyThemePreset(normalized.themePreset);
      setLastUpdatedAt(typeof settings?.updatedAt === 'string' ? settings.updatedAt : '');
    } catch (error: any) {
      toast.error(error.message || 'Failed to load user settings');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!canSave) return;

    setIsSaving(true);
    try {
      if (isSettingsDirty) {
        const { settings } = await apiClient.updateUserSettings(draftSettings);
        const normalized = toPayload(settings);
        setSavedSettings(normalized);
        setDraftSettings(normalized);
        setTheme(normalized.preferredTheme);
        applyThemePreset(normalized.themePreset);
        setLastUpdatedAt(typeof settings?.updatedAt === 'string' ? settings.updatedAt : new Date().toISOString());
      }

      if (isNameDirty || newPassword.length > 0) {
        await apiClient.updateMe({
          ...(isNameDirty ? { name: draftName.trim() } : {}),
          ...(newPassword.length > 0 ? { password: newPassword } : {}),
        });
        await refreshUser();
        setSavedName(draftName.trim());
      }

      setNewPassword('');
      setConfirmPassword('');
      toast.success('Your settings have been saved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save user settings');
    } finally {
      setIsSaving(false);
    }
  }

  function handleReset() {
    setDraftSettings(savedSettings);
    setDraftName(savedName);
    setNewPassword('');
    setConfirmPassword('');
    setTheme(savedSettings.preferredTheme);
    applyThemePreset(savedSettings.themePreset);
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
        <h1 className="text-3xl font-bold text-gray-900">My Settings</h1>
        <p className="text-gray-500 mt-1">Personal settings that only apply to your account.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-5 space-y-5">
        <h2 className="text-lg font-semibold">Account</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="accountName">Display Name</Label>
            <Input
              id="accountName"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="accountEmail">Email</Label>
            <Input id="accountEmail" value={user?.email || ''} readOnly className="bg-gray-50" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Leave blank to keep current password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter new password"
            />
          </div>
        </div>
        {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
      </div>

      <div className="bg-white rounded-lg shadow p-5 space-y-5">
        <h2 className="text-lg font-semibold">Preferences</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label>Theme</Label>
            <Select
              value={draftSettings.preferredTheme}
              onValueChange={(value) => {
                const nextTheme = value as UserSettingsPayload['preferredTheme'];
                setDraftSettings((prev) => ({ ...prev, preferredTheme: nextTheme }));
                setTheme(nextTheme);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Color Theme</Label>
            <Select
              value={draftSettings.themePreset}
              onValueChange={(value) => {
                const nextPreset = normalizeThemePreset(value);
                setDraftSettings((prev) => ({ ...prev, themePreset: nextPreset }));
                applyThemePreset(nextPreset);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {THEME_PRESET_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              value={draftSettings.timezone}
              onChange={(event) => setDraftSettings((prev) => ({ ...prev, timezone: event.target.value }))}
              placeholder="e.g. Asia/Manila"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Date Format</Label>
            <Select
              value={draftSettings.dateFormat}
              onValueChange={(value) => setDraftSettings((prev) => ({ ...prev, dateFormat: value as UserSettingsPayload['dateFormat'] }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                <SelectItem value="MMM dd, yyyy">MMM dd, yyyy</SelectItem>
                <SelectItem value="dd/MM/yyyy">dd/MM/yyyy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-5 space-y-5">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Email Notifications</p>
              <p className="text-sm text-gray-500">Master switch for account email alerts.</p>
            </div>
            <Switch
              checked={draftSettings.emailNotificationsEnabled}
              onCheckedChange={(checked) => setDraftSettings((prev) => ({ ...prev, emailNotificationsEnabled: checked }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Task Reminder Emails</p>
              <p className="text-sm text-gray-500">Receive reminder emails for upcoming due dates.</p>
            </div>
            <Switch
              checked={draftSettings.taskReminderEmailEnabled}
              disabled={!draftSettings.emailNotificationsEnabled}
              onCheckedChange={(checked) => setDraftSettings((prev) => ({ ...prev, taskReminderEmailEnabled: checked }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Daily Summary Emails</p>
              <p className="text-sm text-gray-500">Receive one daily account summary email.</p>
            </div>
            <Switch
              checked={draftSettings.dailySummaryEmailEnabled}
              disabled={!draftSettings.emailNotificationsEnabled}
              onCheckedChange={(checked) => setDraftSettings((prev) => ({ ...prev, dailySummaryEmailEnabled: checked }))}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {lastUpdatedAt ? `Last updated: ${new Date(lastUpdatedAt).toLocaleString()}` : 'Your settings have not been updated yet.'}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={isSaving || (!isSettingsDirty && !isNameDirty && !hasPasswordDraft)}>
            Reset
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isSaving ? 'Saving...' : 'Save My Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
