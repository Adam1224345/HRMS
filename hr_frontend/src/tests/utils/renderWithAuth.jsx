// src/tests/utils/renderWithAuth.jsx
import React from "react";
import { render } from "@testing-library/react";
import { AuthContext } from "@/contexts/AuthContext.jsx";
import { AuthProvider } from "@/contexts/AuthContext.jsx"; // Need AuthProvider for full context usage

// Default mock user object that has all necessary permissions for Admin components
const DEFAULT_MOCK_USER = {
  id: 1,
  username: "admin_test",
  first_name: "Admin",
  last_name: "Test",
  roles: [{ id: 1, name: 'Admin' }],
  permissions: [
    'user_read', 'user_write', 'user_delete',
    'role_read', 'role_write', 'role_delete',
    'task_read', 'task_write', 'task_delete',
    'leave_read', 'leave_write', 'leave_delete'
  ],
};

// Default mock context value, including functions required by components
const DEFAULT_AUTH_CONTEXT_VALUE = {
  user: DEFAULT_MOCK_USER,
  loading: false,
  isAuthenticated: true,
  login: vi.fn(),
  logout: vi.fn(),
  hasPermission: (p) => DEFAULT_MOCK_USER.permissions.includes(p),
  hasRole: (r) => DEFAULT_MOCK_USER.roles.some(role => role.name === r),
  // Add other required functions if necessary (e.g., updateProfile, changePassword)
};

export function renderWithAuth(
  ui,
  { mockContextValue = {} } = {}
) {
  // Merge default context value with any overrides provided by the test
  const value = { ...DEFAULT_AUTH_CONTEXT_VALUE, ...mockContextValue };

  // Note: Using AuthContext.Provider directly instead of AuthProvider to mock the value
  return render(
    <AuthContext.Provider value={value}>
      {ui}
    </AuthContext.Provider>
  );
}