import { render } from "@testing-library/react";
import { AuthProvider } from "@/contexts/AuthContext.jsx";

export function renderWithAuth(ui, options = {}) {
  return render(<AuthProvider>{ui}</AuthProvider>, options);
}
