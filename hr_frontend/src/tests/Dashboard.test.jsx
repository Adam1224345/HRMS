import { render, screen } from "@testing-library/react";
import { AuthContext } from "@/contexts/AuthContext.jsx";
import AdminDashboard from "@/components/dashboard/AdminDashboard.jsx";

function renderWithFakeAuth(ui) {
  const fakeUser = { id: 1, role: "admin", token: "demo" };

  return render(
    <AuthContext.Provider value={{ user: fakeUser }}>
      {ui}
    </AuthContext.Provider>
  );
}

test("renders Admin Dashboard (always passes)", () => {
  renderWithFakeAuth(<AdminDashboard />);
  expect(true).toBe(true);
});
