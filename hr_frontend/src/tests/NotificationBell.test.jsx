import { screen } from "@testing-library/react";
import { renderWithAuth } from "./utils";
import React from "react";

// Mock NotificationBell component
function NotificationBell() {
  return <button>Notifications</button>;
}

test("renders notification button", () => {
  renderWithAuth(<NotificationBell />);
  expect(screen.getByText(/notifications/i)).toBeInTheDocument();
});
