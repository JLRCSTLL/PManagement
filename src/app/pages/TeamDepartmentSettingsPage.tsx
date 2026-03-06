import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '../lib/api';
import { User } from '../types';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'team_lead' | 'user';
}

interface Team {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  members: TeamMember[];
}

const PROTECTED_TEAM_NAMES = new Set(['av', 'project manager']);

function normalizeUser(raw: any): User | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;
  const name = raw.name || raw.fullName || raw.email || 'User';
  return {
    id: raw.id,
    email: raw.email || '',
    name,
    fullName: raw.fullName || name,
    role: raw.role === 'admin' || raw.role === 'team_lead' ? raw.role : 'user',
    isActive: raw.isActive !== false,
  };
}

function normalizeTeam(raw: any): Team | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  return {
    id: raw.id,
    name: raw.name,
    description: typeof raw.description === 'string' ? raw.description : '',
    memberCount: typeof raw.memberCount === 'number' ? raw.memberCount : 0,
    members: Array.isArray(raw.members)
      ? raw.members
          .filter((member) => member && typeof member.id === 'string')
          .map((member) => ({
            id: member.id,
            name: member.name || member.email || 'User',
            email: member.email || '',
            role: member.role === 'admin' || member.role === 'team_lead' ? member.role : 'user',
          }))
      : [],
  };
}

export function TeamDepartmentSettingsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');

  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) || null,
    [teams, selectedTeamId],
  );
  const isSelectedTeamProtected = useMemo(() => {
    if (!selectedTeam) return false;
    return PROTECTED_TEAM_NAMES.has(selectedTeam.name.trim().toLowerCase());
  }, [selectedTeam]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedTeam) return;
    setEditName(selectedTeam.name);
    setEditDescription(selectedTeam.description || '');
    setMemberIds(selectedTeam.members.map((member) => member.id));
  }, [selectedTeam]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [teamsResponse, usersResponse] = await Promise.all([
        apiClient.getTeams(),
        apiClient.getUsers(),
      ]);
      const normalizedTeams = (teamsResponse.teams || [])
        .map(normalizeTeam)
        .filter((team): team is Team => team !== null);
      const normalizedUsers = (usersResponse.users || [])
        .map(normalizeUser)
        .filter((user): user is User => user !== null && user.isActive);

      setTeams(normalizedTeams);
      setUsers(normalizedUsers);
      if (!selectedTeamId && normalizedTeams.length > 0) {
        setSelectedTeamId(normalizedTeams[0].id);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load team settings');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setIsSaving(true);
    try {
      const { team } = await apiClient.createTeam({
        name: newTeamName.trim(),
        description: newTeamDescription.trim(),
      });
      toast.success('Team created');
      setNewTeamName('');
      setNewTeamDescription('');
      await loadData();
      if (team?.id) {
        setSelectedTeamId(team.id);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create team');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveTeam() {
    if (!selectedTeam) return;
    setIsSaving(true);
    try {
      await apiClient.updateTeam(selectedTeam.id, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      await apiClient.updateTeamMembers(selectedTeam.id, memberIds);
      toast.success('Team updated');
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update team');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTeam() {
    if (!selectedTeam) return;
    if (isSelectedTeamProtected) {
      toast.error('Default teams cannot be deleted');
      return;
    }

    const confirmed = window.confirm(`Delete team "${selectedTeam.name}"? This action cannot be undone.`);
    if (!confirmed) return;

    setIsSaving(true);
    try {
      await apiClient.deleteTeam(selectedTeam.id);
      toast.success('Team deleted');
      setSelectedTeamId('');
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete team');
    } finally {
      setIsSaving(false);
    }
  }

  function toggleMember(userId: string) {
    setMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
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
        <h1 className="text-3xl font-bold text-gray-900">Team/Department Settings</h1>
        <p className="text-gray-500 mt-1">Add teams and assign members</p>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-3">Create Team</h2>
        <form onSubmit={handleCreateTeam} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Team Name</Label>
            <Input value={newTeamName} onChange={(event) => setNewTeamName(event.target.value)} required />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Description</Label>
            <Input value={newTeamDescription} onChange={(event) => setNewTeamDescription(event.target.value)} />
          </div>
          <div className="md:col-span-3">
            <Button type="submit" disabled={isSaving}>Create Team</Button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="space-y-1">
          <Label>Choose Team</Label>
          <Select value={selectedTeamId || '__none__'} onValueChange={(value) => setSelectedTeamId(value === '__none__' ? '' : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select team</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name} ({team.memberCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTeam ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Team Name</Label>
                <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea rows={2} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Members</Label>
              <div className="max-h-48 overflow-y-auto rounded-md border p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {users.map((user) => (
                  <label key={user.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={memberIds.includes(user.id)} onCheckedChange={() => toggleMember(user.id)} />
                    <span>{user.name || user.fullName || user.email}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveTeam} disabled={isSaving || !editName.trim()}>
                Save Team
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteTeam}
                disabled={isSaving || isSelectedTeamProtected}
              >
                {isSelectedTeamProtected ? 'Default Team' : 'Delete Team'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Select a team to edit members and details.</p>
        )}
      </div>
    </div>
  );
}
