import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, TicketSettings } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

const DEFAULT_SETTINGS: TicketSettings = {
  categories: [],
  slaRules: {
    Critical: { firstResponseMinutes: 15, resolutionMinutes: 240, businessDays: false },
    High: { firstResponseMinutes: 60, resolutionMinutes: 480, businessDays: false },
    Medium: { firstResponseMinutes: 240, resolutionMinutes: 2880, businessDays: true },
    Low: { firstResponseMinutes: 480, resolutionMinutes: 7200, businessDays: true },
  },
};

export function TicketAdminSettingsPage() {
  const [settings, setSettings] = React.useState<TicketSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setIsLoading(true);
    try {
      const response = await apiClient.getTicketSettings();
      setSettings(response);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load ticket settings');
    } finally {
      setIsLoading(false);
    }
  }

  function addCategory() {
    setSettings((prev) => ({
      ...prev,
      categories: [
        ...prev.categories,
        { id: `cat-${crypto.randomUUID().slice(0, 8)}`, name: '', subcategories: [], isActive: true },
      ],
    }));
  }

  function updateCategory(index: number, updates: Partial<TicketSettings['categories'][number]>) {
    setSettings((prev) => ({
      ...prev,
      categories: prev.categories.map((entry, idx) => (idx === index ? { ...entry, ...updates } : entry)),
    }));
  }

  function removeCategory(index: number) {
    setSettings((prev) => ({
      ...prev,
      categories: prev.categories.filter((_, idx) => idx !== index),
    }));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const payload: TicketSettings = {
        ...settings,
        categories: settings.categories
          .map((entry) => ({
            ...entry,
            name: entry.name.trim(),
            subcategories: entry.subcategories.map((value) => value.trim()).filter(Boolean),
          }))
          .filter((entry) => entry.name),
      };
      const response = await apiClient.updateTicketSettings(payload);
      setSettings(response);
      toast.success('Ticket settings saved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save ticket settings');
    } finally {
      setIsSaving(false);
    }
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
        <h1 className="text-3xl font-bold text-gray-900">Ticket Admin Settings</h1>
        <p className="text-gray-500 mt-1">Manage categories and SLA rules.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Categories</h2>
          <Button size="sm" variant="outline" className="gap-2" onClick={addCategory}>
            <Plus className="w-4 h-4" />
            Add Category
          </Button>
        </div>

        <div className="space-y-3">
          {settings.categories.map((entry, index) => (
            <div key={entry.id || index} className="border rounded-md p-3 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category Name</Label>
                  <Input
                    value={entry.name}
                    onChange={(event) => updateCategory(index, { name: event.target.value })}
                  />
                </div>
                <div className="flex items-end justify-end">
                  <Button size="sm" variant="destructive" onClick={() => removeCategory(index)} className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Subcategories (one per line)</Label>
                <Textarea
                  rows={3}
                  value={entry.subcategories.join('\n')}
                  onChange={(event) => updateCategory(index, { subcategories: event.target.value.split('\n') })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-5 space-y-4">
        <h2 className="text-lg font-semibold">SLA Rules (minutes)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['Critical', 'High', 'Medium', 'Low'] as const).map((priority) => (
            <div key={priority} className="border rounded-md p-3 space-y-2">
              <p className="font-medium text-gray-900">{priority}</p>
              <div className="space-y-1.5">
                <Label>First Response Minutes</Label>
                <Input
                  type="number"
                  min={1}
                  value={settings.slaRules[priority].firstResponseMinutes}
                  onChange={(event) => {
                    const value = Math.max(1, Number(event.target.value) || 1);
                    setSettings((prev) => ({
                      ...prev,
                      slaRules: {
                        ...prev.slaRules,
                        [priority]: {
                          ...prev.slaRules[priority],
                          firstResponseMinutes: value,
                        },
                      },
                    }));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Resolution Minutes</Label>
                <Input
                  type="number"
                  min={1}
                  value={settings.slaRules[priority].resolutionMinutes}
                  onChange={(event) => {
                    const value = Math.max(1, Number(event.target.value) || 1);
                    setSettings((prev) => ({
                      ...prev,
                      slaRules: {
                        ...prev.slaRules,
                        [priority]: {
                          ...prev.slaRules[priority],
                          resolutionMinutes: value,
                        },
                      },
                    }));
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Ticket Settings'}</Button>
      </div>
    </div>
  );
}
