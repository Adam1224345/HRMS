import { screen } from "@testing-library/react";
import { renderWithAuth } from "./utils";

import LeaveManagement from "@/components/dashboard/LeaveManagement.jsx";

test("renders LeaveManagement", () => {
  renderWithAuth(<LeaveManagement />);
  expect(screen.getByText(/leave/i)).toBeInTheDocument();
});
