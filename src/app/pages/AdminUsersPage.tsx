import React, { useEffect, useState } from 'react';
import { apiClient } from '../lib/api';
import { UserRole } from '../types';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { seedSampleData } from '../utils/seedData';

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
}

const defaultCreateForm = {
  email: '',
  password: '',
  fullName: '',
  role: 'user' as UserRole,
  isActive: true,
};

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ fullName: string; role: UserRole; isActive: boolean }>({
    fullName: '',
    role: 'user',
    isActive: true,
  });

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const { users } = await apiClient.getAdminUsers();
      setUsers(users);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiClient.createAdminUser(createForm);
      toast.success('User created');
      setCreateForm(defaultCreateForm);
      await loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create user');
    }
  }

  function startEdit(user: AdminUser) {
    setEditingUserId(user.id);
    setEditForm({
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
    });
  }

  async function saveEdit(userId: string) {
    try {
      await apiClient.updateAdminUser(userId, editForm);
      toast.success('User updated');
      setEditingUserId(null);
      await loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user');
    }
  }

  async function handleDeleteUser(userId: string, email: string) {
    if (currentUser?.id === userId) {
      toast.error('You cannot delete the account currently signed in');
      return;
    }

    const confirmed = window.confirm(`Delete user ${email}? This action cannot be undone.`);
    if (!confirmed) return;

    setDeletingUserId(userId);
    try {
      await apiClient.deleteAdminUser(userId);
      toast.success('User deleted');
      if (editingUserId === userId) {
        setEditingUserId(null);
      }
      await loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  }

  async function handleSeed() {
    setIsSeeding(true);
    try {
      const result = await seedSampleData();
      if (!result.success) {
        throw new Error(String(result.error || 'Failed to seed sample data'));
      }
      toast.success('Sample project and task seeded');
    } catch (error: any) {
      toast.error(error.message || 'Failed to seed sample data');
    } finally {
      setIsSeeding(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin: Users</h1>
        <p className="text-gray-500 mt-1">Create, update role, and activate/deactivate user access</p>
        <div className="mt-3">
          <Button variant="outline" onClick={handleSeed} disabled={isSeeding}>
            {isSeeding ? 'Seeding sample data...' : 'Seed Sample Project/Task'}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4">Create User</h2>
        <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Password</Label>
            <Input
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Full Name</Label>
            <Input
              value={createForm.fullName}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, fullName: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select
              value={createForm.role}
              onValueChange={(value: UserRole) => setCreateForm((prev) => ({ ...prev, role: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="team_lead">Team Lead</SelectItem>
                <SelectItem value="user">Standard User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full">Create</Button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  {editingUserId === user.id ? (
                    <Input
                      value={editForm.fullName}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, fullName: e.target.value }))}
                    />
                  ) : (
                    user.fullName
                  )}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  {editingUserId === user.id ? (
                    <Select
                      value={editForm.role}
                      onValueChange={(value: UserRole) => setEditForm((prev) => ({ ...prev, role: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="team_lead">Team Lead</SelectItem>
                        <SelectItem value="user">Standard User</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    user.role
                  )}
                </TableCell>
                <TableCell>
                  {editingUserId === user.id ? (
                    <Select
                      value={editForm.isActive ? 'active' : 'inactive'}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({ ...prev, isActive: value === 'active' }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    user.isActive ? 'Active' : 'Inactive'
                  )}
                </TableCell>
                <TableCell className="space-x-2">
                  {editingUserId === user.id ? (
                    <>
                      <Button size="sm" onClick={() => saveEdit(user.id)}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingUserId(null)}>Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => startEdit(user)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        disabled={deletingUserId === user.id || currentUser?.id === user.id}
                      >
                        {currentUser?.id === user.id
                          ? 'Current Account'
                          : deletingUserId === user.id
                          ? 'Deleting...'
                          : 'Delete'}
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
