import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';

export const renderWithAuth = (ui, options = {}) => render(
  <MemoryRouter initialEntries={['/']}>
    <AuthProvider>{ui}</AuthProvider>
  </MemoryRouter>,
  options
);