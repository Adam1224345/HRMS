import { screen } from "@testing-library/react";
import { renderWithAuth } from "./utils/renderWithAuth";
import LeaveManagement from "@/components/dashboard/LeaveManagement.jsx";

test("renders LeaveManagement component", async () => {
  renderWithAuth(<LeaveManagement />);
  
  // Wait for loading to finish or check loading state
  const loadingText = await screen.findByText(/loading_leave_requests/i, {}, { timeout: 5000 });
  expect(loadingText).toBeInTheDocument();
});