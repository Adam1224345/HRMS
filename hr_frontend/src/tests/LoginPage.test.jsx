import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAuth } from "./utils";

import Login from "@/components/auth/LoginPage.jsx";

test("renders login form", () => {
  renderWithAuth(<Login />);
  expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
});

test("user can type credentials", async () => {
  renderWithAuth(<Login />);
  const user = userEvent.setup();

  await user.type(screen.getByPlaceholderText(/username/i), "admin");
  await user.type(screen.getByPlaceholderText(/password/i), "admin123");

  expect(screen.getByPlaceholderText(/username/i)).toHaveValue("admin");
  expect(screen.getByPlaceholderText(/password/i)).toHaveValue("admin123");
});
