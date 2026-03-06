import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Search, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';
import { AvScheduleEntry, AvScheduleFormData } from '../types';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

const initialForm: AvScheduleFormData = {
  date: '',
  whereabouts: '',
  workMode: 'In Office',
  note: '',
};

const TIME_RANGE_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;

function unwrapValue(input: any): any {
  let current = input;
  let depth = 0;
  while (current && typeof current === 'object' && 'value' in current && depth < 5) {
    current = current.value;
    depth += 1;
  }
  return current;
}

function normalizeEntry(raw: any): AvScheduleEntry | null {
  const source = unwrapValue(raw);
  if (!source || typeof source !== 'object') return null;
  if (typeof source.id !== 'string' || typeof source.userId !== 'string') return null;
  if (typeof source.date !== 'string') return null;

  return {
    id: source.id,
    userId: source.userId,
    userName: source.userName || source.user_name || 'User',
    date: source.date,
    whereabouts: typeof source.whereabouts === 'string' ? source.whereabouts.trim() : '',
    workMode: source.workMode === 'WFH' ? 'WFH' : 'In Office',
    note: source.note || '',
    createdAt: source.createdAt || source.created_at || new Date().toISOString(),
    updatedAt: source.updatedAt || source.updated_at || source.createdAt || new Date().toISOString(),
  };
}

function formatDate(value: string) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function toDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string): Date | undefined {
  if (!value) return undefined;
  const parts = value.split('-');
  if (parts.length !== 3) return undefined;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;
  return new Date(year, month - 1, day);
}

function getCurrentTimeKey() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function toMinutes(timeValue: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(timeValue)) return null;
  const [hoursText, minutesText] = timeValue.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return (hours * 60) + minutes;
}

function parseTimeRange(value: string): { start: string; end: string; startMinutes: number; endMinutes: number } | null {
  const trimmed = (value || '').trim().replace(/\s+/g, '');
  if (!trimmed) return null;
  const match = trimmed.match(TIME_RANGE_PATTERN);
  if (!match) return null;
  const start = `${match[1]}:${match[2]}`;
  const end = `${match[3]}:${match[4]}`;
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === null || endMinutes === null) return null;
  return { start, end, startMinutes, endMinutes };
}

function isWithinRange(currentMinutes: number, range: { startMinutes: number; endMinutes: number }) {
  if (range.startMinutes === range.endMinutes) return true;
  if (range.startMinutes < range.endMinutes) {
    return currentMinutes >= range.startMinutes && currentMinutes < range.endMinutes;
  }
  return currentMinutes >= range.startMinutes || currentMinutes < range.endMinutes;
}

export function AVSchedulePage() {
  const { user } = useAuth();
  const role = user?.role;

  const [entries, setEntries] = useState<AvScheduleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateKey(new Date()));
  const [selectedTime, setSelectedTime] = useState<string>(() => getCurrentTimeKey());
  const [searchTerm, setSearchTerm] = useState('');
  const [scheduleStartTime, setScheduleStartTime] = useState('');
  const [scheduleEndTime, setScheduleEndTime] = useState('');
  const [form, setForm] = useState<AvScheduleFormData>(initialForm);

  useEffect(() => {
    loadEntries();
  }, []);

  const filteredEntries = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const source = [...entries].sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    if (!query) return source;
    return source.filter((entry) =>
      entry.userName.toLowerCase().includes(query) ||
      entry.whereabouts.toLowerCase().includes(query) ||
      entry.workMode.toLowerCase().includes(query) ||
      entry.date.toLowerCase().includes(query),
    );
  }, [entries, searchTerm]);

  const entryDateSet = useMemo(
    () => new Set(entries.map((entry) => entry.date)),
    [entries],
  );

  const selectedDateEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.date === selectedDate)
        .sort((a, b) => a.userName.localeCompare(b.userName)),
    [entries, selectedDate],
  );

  const selectedTimeMinutes = useMemo(() => toMinutes(selectedTime), [selectedTime]);

  const availabilityForSelectedTime = useMemo(() => {
    const available: AvScheduleEntry[] = [];
    const unavailable: Array<{ entry: AvScheduleEntry; reason: string }> = [];

    for (const entry of selectedDateEntries) {
      if (entry.workMode !== 'In Office') {
        unavailable.push({ entry, reason: 'WFH' });
        continue;
      }

      const range = parseTimeRange(entry.whereabouts || '');
      if (!range) {
        available.push(entry);
        continue;
      }

      if (selectedTimeMinutes === null) {
        unavailable.push({ entry, reason: `Scheduled ${range.start}-${range.end}` });
        continue;
      }

      if (isWithinRange(selectedTimeMinutes, range)) {
        unavailable.push({ entry, reason: `Scheduled ${range.start}-${range.end}` });
      } else {
        available.push(entry);
      }
    }

    return { available, unavailable };
  }, [selectedDateEntries, selectedTimeMinutes]);

  function canManageEntry(entry: AvScheduleEntry) {
    if (!user?.id) return false;
    if (role === 'admin' || role === 'team_lead') return true;
    return entry.userId === user.id;
  }

  async function loadEntries() {
    setIsLoading(true);
    try {
      const { entries } = await apiClient.getAvSchedule();
      const normalized = (entries || [])
        .map(normalizeEntry)
        .filter((entry): entry is AvScheduleEntry => entry !== null);
      setEntries(normalized);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load AV schedule');
      console.error('Load AV schedule error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date) {
      toast.error('Date is required');
      return;
    }

    if ((scheduleStartTime && !scheduleEndTime) || (!scheduleStartTime && scheduleEndTime)) {
      toast.error('Set both start and end time for schedule');
      return;
    }

    setIsSaving(true);
    try {
      const scheduleRange = scheduleStartTime && scheduleEndTime
        ? `${scheduleStartTime}-${scheduleEndTime}`
        : '';

      const payload = {
        date: form.date,
        workMode: form.workMode,
        whereabouts: form.workMode === 'WFH' ? '' : scheduleRange,
        note: form.note?.trim() || '',
      };

      if (editingId) {
        await apiClient.updateAvScheduleEntry(editingId, payload);
        toast.success('Schedule updated');
      } else {
        await apiClient.createAvScheduleEntry(payload);
        toast.success('Schedule saved');
      }

      setEditingId(null);
      setForm(initialForm);
      setScheduleStartTime('');
      setScheduleEndTime('');
      await loadEntries();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save schedule');
      console.error('Save AV schedule error:', error);
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(entry: AvScheduleEntry) {
    if (!canManageEntry(entry)) return;
    const range = parseTimeRange(entry.whereabouts || '');
    setEditingId(entry.id);
    setForm({
      date: entry.date,
      workMode: entry.workMode,
      whereabouts: entry.whereabouts,
      note: entry.note || '',
    });
    setScheduleStartTime(range?.start || '');
    setScheduleEndTime(range?.end || '');
  }

  async function handleDelete(entry: AvScheduleEntry) {
    if (!canManageEntry(entry)) return;
    const confirmed = window.confirm(`Delete schedule for ${entry.userName} on ${formatDate(entry.date)}?`);
    if (!confirmed) return;

    try {
      await apiClient.deleteAvScheduleEntry(entry.id);
      setEntries((prev) => prev.filter((item) => item.id !== entry.id));
      if (editingId === entry.id) {
        setEditingId(null);
        setForm(initialForm);
      }
      toast.success('Schedule deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete schedule');
      console.error('Delete AV schedule error:', error);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(initialForm);
    setScheduleStartTime('');
    setScheduleEndTime('');
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
        <h1 className="text-3xl font-bold text-gray-900">AV Schedule</h1>
        <p className="text-gray-500 mt-1">Track team whereabouts and whether each member is in office or WFH.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4">{editingId ? 'Update Schedule Entry' : 'Add Schedule Entry'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Work Setup *</Label>
              <Select
                value={form.workMode}
                onValueChange={(value: 'In Office' | 'WFH') => {
                  setForm((prev) => ({ ...prev, workMode: value }));
                  if (value === 'WFH') {
                    setScheduleStartTime('');
                    setScheduleEndTime('');
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select setup" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="In Office">In Office</SelectItem>
                  <SelectItem value="WFH">WFH</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Whereabouts Schedule (Time)</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="time"
                value={scheduleStartTime}
                onChange={(event) => setScheduleStartTime(event.target.value)}
                disabled={form.workMode === 'WFH'}
              />
              <Input
                type="time"
                value={scheduleEndTime}
                onChange={(event) => setScheduleEndTime(event.target.value)}
                disabled={form.workMode === 'WFH'}
              />
            </div>
            <p className="text-xs text-gray-500">
              Leave time blank when in office for full availability. Time range means unavailable during that period.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              rows={2}
              value={form.note || ''}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="Optional details"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : editingId ? 'Update Entry' : 'Save Entry'}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={viewMode === 'calendar' ? 'default' : 'outline'}
            size="sm"
            className="gap-2"
            onClick={() => setViewMode('calendar')}
          >
            <CalendarDays className="w-4 h-4" />
            Calendar View
          </Button>
          <Button
            type="button"
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            className="gap-2"
            onClick={() => setViewMode('table')}
          >
            <Table2 className="w-4 h-4" />
            Table View
          </Button>
        </div>

        {viewMode === 'calendar' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-md border">
              <Calendar
                mode="single"
                selected={parseDateKey(selectedDate)}
                onSelect={(value) => {
                  if (!value) return;
                  setSelectedDate(toDateKey(value));
                }}
                modifiers={{
                  hasEntry: (day) => entryDateSet.has(toDateKey(day)),
                }}
                modifiersClassNames={{
                  hasEntry: 'bg-blue-100 text-blue-900 font-semibold',
                }}
                className="w-full"
              />
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Entries for {formatDate(selectedDate)}
                </h3>
                <p className="text-sm text-gray-500">
                  Check who is available based on work setup and schedule time.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="selected-time">Time</Label>
                <Input
                  id="selected-time"
                  type="time"
                  value={selectedTime}
                  onChange={(event) => setSelectedTime(event.target.value)}
                />
              </div>

              <div className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-medium text-gray-900">
                  Available Tech at {selectedTime || '--:--'}
                </p>
                {availabilityForSelectedTime.available.length === 0 ? (
                  <p className="text-sm text-gray-500">No available tech at this time.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availabilityForSelectedTime.available.map((entry) => (
                      <span
                        key={`available-${entry.id}`}
                        className="text-xs rounded-full bg-green-100 text-green-800 px-2 py-1"
                      >
                        {entry.userName || 'User'}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {selectedDateEntries.length === 0 ? (
                <div className="rounded-md border p-4 text-sm text-gray-500">
                  No schedule entries for this date.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateEntries.map((entry) => (
                    <div key={entry.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-gray-900">{entry.userName || 'User'}</p>
                        <span className="text-xs rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                          {entry.workMode}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">
                        {entry.whereabouts ? `Scheduled: ${entry.whereabouts}` : 'No schedule time (Available)'}
                      </p>
                      {entry.note ? (
                        <p className="text-xs text-gray-500">Note: {entry.note}</p>
                      ) : null}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(entry)}
                          disabled={!canManageEntry(entry)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(entry)}
                          disabled={!canManageEntry(entry)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                className="pl-10"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by date, member, work setup, or schedule time..."
              />
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Team Member</TableHead>
                  <TableHead>Schedule Time</TableHead>
                  <TableHead>Work Setup</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      No schedule entries yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.date)}</TableCell>
                      <TableCell>{entry.userName || 'User'}</TableCell>
                      <TableCell>{entry.whereabouts || 'Available All Day'}</TableCell>
                      <TableCell>{entry.workMode}</TableCell>
                      <TableCell>{entry.note || '-'}</TableCell>
                      <TableCell>{formatDate(entry.updatedAt)}</TableCell>
                      <TableCell className="space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(entry)}
                          disabled={!canManageEntry(entry)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(entry)}
                          disabled={!canManageEntry(entry)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </>
        )}
      </div>
    </div>
  );
}
