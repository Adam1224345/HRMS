const API_BASE = 'http://localhost:5000/api';
const token = () => localStorage.getItem('token');

export const fetchAdminDashboard = () =>
  fetch(`${API_BASE}/dashboard/admin`, { headers: { Authorization: `Bearer ${token()}` } })
    .then(r => r.ok ? r.json() : Promise.reject(r.status));

export const fetchEmployeeDashboard = () =>
  fetch(`${API_BASE}/dashboard/employee`, { headers: { Authorization: `Bearer ${token()}` } })
    .then(r => r.ok ? r.json() : Promise.reject(r.status));