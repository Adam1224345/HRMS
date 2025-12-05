import { screen } from "@testing-library/react";
import { renderWithAuth } from "./utils";
import TaskManagement from "@/components/dashboard/TaskManagement.jsx";

test("renders TaskManagement", () => {
  renderWithAuth(<TaskManagement />);
  expect(screen.getByText(/tasks/i)).toBeInTheDocument();
});
