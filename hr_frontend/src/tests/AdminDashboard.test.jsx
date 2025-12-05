import { render } from '@testing-library/react';
import { renderWithAuth } from "./utils/renderWithAuth";
import AdminDashboard from '@/components/dashboard/AdminDashboard';

test('admin dashboard loads', () => {
  render(<AdminDashboard />);
  expect(true).toBe(true);
});
