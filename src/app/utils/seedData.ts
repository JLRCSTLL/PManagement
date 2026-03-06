import { apiClient } from '../lib/api';

export async function seedSampleData() {
  try {
    const { user } = await apiClient.getMe();
    if (user.role !== 'admin') {
      return { success: false, error: 'Only admins can seed sample data.' };
    }

    const { users } = await apiClient.getUsers();
    if (!users || users.length < 2) {
      return { success: false, error: 'At least two active users are required to seed sample data.' };
    }

    const accountManager = users[0];
    const techAssigned = users[1];
    const accountManagerName = accountManager.name || accountManager.fullName || accountManager.email;

    const { project } = await apiClient.createProject({
      projectName: 'RBAC Sample Project',
      client: 'Sample Client Corporation',
      description: 'Sample project seeded for role-based visibility testing',
      accountManager: accountManagerName,
      techAssignedIds: [techAssigned.id],
      visibleTeams: ['AV', 'Project Manager'],
      team: 'AV',
      amount: 150000,
      startDate: '2026-03-01',
      targetEndDate: '2026-04-15',
      priority: 'High',
      status: 'In Progress',
      riskLevel: 'Medium',
      progress: 35,
      referenceLinks: [
        {
          label: 'Specification',
          url: 'https://example.com/spec',
          note: 'Functional requirements',
          sortOrder: 0,
        },
        {
          label: 'Design',
          url: 'https://example.com/design',
          note: 'UI and UX references',
          sortOrder: 1,
        },
      ],
    });

    await apiClient.createTask({
      projectId: project.id,
      title: 'Initial architecture review',
      taskId: `SEED-TASK-${Math.floor(Math.random() * 1000)}`,
      description: 'Review architecture with account manager and technical assignee',
      assignedTo: techAssigned.id,
      requestedBy: accountManager.id,
      priority: 'High',
      status: 'In Progress',
      startDate: '2026-03-02',
      dueDate: '2026-03-15',
      progress: 45,
      dependencies: '',
      notes: 'Seeded task',
      referenceLink: 'https://example.com/task',
      visibleUserIds: [],
    });

    return { success: true };
  } catch (error) {
    console.error('Error seeding sample data:', error);
    return { success: false, error };
  }
}
