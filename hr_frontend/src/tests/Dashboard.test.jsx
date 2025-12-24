import { screen } from "@testing-library/react";
import { renderWithAuth } from "./utils/renderWithAuth";
import AdminDashboard from "@/components/dashboard/AdminDashboard"; // Assuming this is the main one

test("renders Dashboard with error when not authenticated", async () => {
  renderWithAuth(<AdminDashboard />);
  const error = await screen.findByText(/error_please_log_in/i, {}, { timeout: 5000 });
  expect(error).toBeInTheDocument();
});