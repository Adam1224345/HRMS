// src/tests/utils.jsx

import { render } from "@testing-library/react";
import { MemoryRouter } from 'react-router-dom'; // NEW: Import MemoryRouter
import { AuthProvider } from "@/contexts/AuthContext.jsx";

export function renderWithAuth(ui, options = {}) {
  return render(
    <MemoryRouter> // NEW: Wrap with MemoryRouter for router context
      <AuthProvider>
        {ui}
      </AuthProvider>
    </MemoryRouter>,
    options
  );
}