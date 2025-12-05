// src/tests/UserManagement.test.jsx
import { screen, render } from "@testing-library/react";
// Since renderWithAuth is broken, we will render directly and mock useAuth.
import UserManagement from "@/components/dashboard/UserManagement";
import { useAuth } from "@/contexts/AuthContext";

// Mock the useAuth hook globally for this test file
vi.mock('@/contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useAuth: () => ({
      user: {
        id: 1,
        username: 'admin_test',
        // Must provide the required permissions for UserManagement
        permissions: ['user_read', 'user_write'], 
      },
      loading: false,
      isAuthenticated: true,
      hasPermission: (p) => ['user_read', 'user_write'].includes(p),
      hasRole: vi.fn(), // Not strictly needed by this component for rendering the content
    }),
  };
});

test(
  "renders UserManagement (real backend)",
  async () => {
    // Render directly, relying on the mocked useAuth
    render(<UserManagement />);

    // The component renders "Create User" which matches /add user/i
    const btn = await screen.findByText(/Create User/i, {}, { timeout: 5000 });

    expect(btn).toBeInTheDocument();
  },
  10000
);