import { screen, render } from "@testing-library/react";
import AdminDashboard from "@/components/dashboard/AdminDashboard.jsx"; 
import { useAuth } from "@/contexts/AuthContext"; 
import { vi } from 'vitest'; 
const mockAdminDashboardData = {
    task_stats: { total_tasks: 10, tasks_by_status: { Completed: 5, Pending: 5 }, completion_rate: 50 },
    leave_stats: { total_requests: 5, pending_requests: 2, rejection_rate: 10, leave_by_type: { Sick: 3, Vacation: 2 }, monthly_trend: [] },
    user_stats: { total_users: 20, users_by_role: { Admin: 1, HR: 4, Employee: 15 } },
};

vi.mock('@/contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useAuth: () => ({
      user: {
        id: 1,

        username: 'admin_test',
        roles: [{ name: 'Admin' }],
        permissions: ['user_read', 'role_read', 'task_read', 'leave_read'],
      },
      loading: false,
      isAuthenticated: true,
      hasPermission: vi.fn(() => true),
      hasRole: vi.fn((r) => r === 'Admin' || r === 'HR'),
    }),
  };
});

vi.spyOn(global, 'fetch').mockImplementation(() =>
    Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockAdminDashboardData,
    })
);

test(
    "renders overview section (real backend)",
    async () => {
        render(<AdminDashboard />); 
      const title = await screen.findByText(/Admin Dashboard/i, {}, { timeout: 5000 });
        expect(title).toBeInTheDocument();
        
        const totalUsersValue = screen.getByText('20');
        expect(totalUsersValue).toBeInTheDocument();

    },
    7000 
);