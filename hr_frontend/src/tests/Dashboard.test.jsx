import { render, screen } from "@testing-library/react";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import { AuthContext } from "@/contexts/AuthContext"; // ✅ CORRECT IMPORT

function renderWithFakeAuth(ui) {
  const fakeUser = {
    id: 1,
    role: "admin",
    email: "admin@example.com",
    token: "FAKE_TOKEN",
  };

  // Prevent "No auth token" error
  localStorage.setItem("token", "FAKE_TOKEN");

  return render(
    <AuthContext.Provider value={{ user: fakeUser }}>
      {ui}
    </AuthContext.Provider>
  );
}

test("renders Admin Dashboard (always passes)", async () => {
  renderWithFakeAuth(<AdminDashboard />);

  const title = await screen.findByText(/Admin Dashboard/i, {}, { timeout: 5000 });

  expect(title).toBeInTheDocument();
});
