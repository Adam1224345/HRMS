import { screen } from "@testing-library/react";
import { renderWithAuth } from "./utils/renderWithAuth";
import AdminDashboard from "@/components/dashboard/AdminDashboard";

test("renders AdminDashboard with error message when not logged in", async () => {
  renderWithAuth(<AdminDashboard />);
  const errorMessage = await screen.findByText(/error_please_log_in/i, {}, { timeout: 5000 });
  expect(errorMessage).toBeInTheDocument();
});