import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithAuth } from "./utils/renderWithAuth";
import LoginPage from "@/components/auth/LoginPage.jsx";

describe("LoginPage", () => {
  test("renders login form", () => {
    renderWithAuth(<LoginPage />);
    expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/username or email/i)).toBeInTheDocument();
  });

  test("user can type credentials", async () => {
    const user = userEvent.setup();
    renderWithAuth(<LoginPage />);

    const usernameInput = screen.getByPlaceholderText(/username or email/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);

    await user.type(usernameInput, "admin");
    await user.type(passwordInput, "admin123");

    expect(usernameInput).toHaveValue("admin");
    expect(passwordInput).toHaveValue("admin123");
  });
});