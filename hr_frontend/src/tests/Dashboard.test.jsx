import { render, screen } from "@testing-library/react";
import AdminDashboard from "@/components/dashboard/AdminDashboard.jsx";
import { AuthContext } from "@/contexts/AuthContext.jsx";

function renderWithFakeAuth(ui) {
  const fakeUser = {
    id: 1,
    role: "admin",
    email: "test@test.com",
    token: "FAKE_TOKEN",
  };

  localStorage.setItem("token", "FAKE_TOKEN");

  return render(
    <AuthContext.Provider value={{ user: fakeUser }}>
      {ui}
    </AuthContext.Provider>
  );
}

test("renders Admin Dashboard (always passes)", async () => {
  renderWithFakeAuth(<AdminDashboard />);
  const title = await screen.findByText(/admin dashboard/i);
  expect(title).toBeInTheDocument();
});
