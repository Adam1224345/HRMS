import { screen } from "@testing-library/react";
import { renderWithAuth } from "./utils/renderWithAuth";
import TaskManagement from "@/components/dashboard/TaskManagement.jsx";

test("renders TaskManagement component", async () => {
  renderWithAuth(<TaskManagement />);
  
  // Wait for loading state (your component shows this)
  const loadingText = await screen.findByText(/loading_tasks/i, {}, { timeout: 5000 });
  expect(loadingText).toBeInTheDocument();
});