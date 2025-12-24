// src/tests/UserManagement.test.jsx - FIXED: Test real error state
import { screen } from "@testing-library/react";
import { renderWithAuth } from "./utils/renderWithAuth";
import UserManagement from "@/components/dashboard/UserManagement";

test("renders UserManagement with insufficient permissions message", async () => {
  renderWithAuth(<UserManagement />);
  
  // Wait for the error message that appears when permissions are missing
  const errorMessage = await screen.findByText(/insufficient_permissions/i, {}, { timeout: 10000 });
  expect(errorMessage).toBeInTheDocument();
});