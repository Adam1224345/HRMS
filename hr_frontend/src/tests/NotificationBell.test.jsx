import { screen } from "@testing-library/react";
import { renderWithAuth } from "./utils/renderWithAuth";

function NotificationBell() {
  return <button>Notifications</button>;
}

test("renders notification button", () => {
  renderWithAuth(<NotificationBell />);
  expect(screen.getByText(/notifications/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
});