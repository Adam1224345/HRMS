import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Users, ClipboardList, FileText, XCircle } from 'lucide-react';
import ChartContainer from './ChartContainer';

const COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];

import axios from 'axios';
// Define environment-based API base URL
const isDevelopment = process.env.NODE_ENV === 'development';
const API_BASE = isDevelopment ? 'http://localhost:5000/api' : '/api';

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('No authentication token. Please log in.');
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/dashboard/admin`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => {
        if (!res.ok) {
          if (res.status === 401) throw new Error('Unauthorized. Please log in again.');
          if (res.status === 403) throw new Error('Forbidden. You lack permission.');
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(setData)
      .catch(err => {
        console.error('Fetch error:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center">Loading dashboard...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  if (!data) return <div className="p-8 text-center text-red-500">No data received</div>;

  // SAFE ACCESS: Check each level
  const taskStats = data.task_stats || {};
  const leaveStats = data.leave_stats || {};
  const userStats = data.user_stats || {};

  const toChartData = (obj) => {
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).map(([name, value]) => ({
      name: name || 'Unknown',
      value: Number(value) || 0
    }));
  };

  const userRoleData = toChartData(userStats.users_by_role);
  const leaveTypeData = toChartData(leaveStats.leave_by_type);
  const taskStatusData = toChartData(taskStats.tasks_by_status);
  const monthlyTrend = Array.isArray(leaveStats.monthly_trend) ? leaveStats.monthly_trend : [];

  const completionRate = [{
    name: 'Completion',
    value: taskStats.completion_rate ?? 0,
    fill: taskStats.completion_rate >= 70 ? '#10B981' : taskStats.completion_rate >= 40 ? '#F59E0B' : '#EF4444'
  }];

  const activeStats = [
    { name: 'Users', value: userStats.total_users ?? 0, fill: '#8B5CF6' },
    { name: 'Tasks', value: taskStats.total_tasks ?? 0, fill: '#10B981' },
    { name: 'Leaves', value: leaveStats.total_requests ?? 0, fill: '#F59E0B' },
  ];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" />Total Users</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{userStats.total_users ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4" />Total Tasks</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{taskStats.total_tasks ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" />Pending Leaves</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{leaveStats.pending_requests ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><XCircle className="h-4 w-4" />Rejection Rate</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{(leaveStats.rejection_rate ?? 0).toFixed(1)}%</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Users by Role" data={userRoleData}>
          <PieChart>
            <Pie data={userRoleData.length > 0 ? userRoleData : [{ name: 'No Data', value: 1 }]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {userRoleData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip /><Legend />
          </PieChart>
        </ChartContainer>

        <ChartContainer title="Leave by Type" data={leaveTypeData}>
          <PieChart>
            <Pie data={leaveTypeData.length > 0 ? leaveTypeData : [{ name: 'No Data', value: 1 }]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {leaveTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip /><Legend />
          </PieChart>
        </ChartContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Task Status" data={taskStatusData}>
          <PieChart>
            <Pie data={taskStatusData.length > 0 ? taskStatusData : [{ name: 'No Data', value: 1 }]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {taskStatusData.map((e, i) => (
                <Cell key={i} fill={
                  e.name === 'Completed' ? '#10B981' :
                  e.name === 'In Progress' ? '#F59E0B' :
                  e.name === 'Pending' ? '#EF4444' :
                  COLORS[i % COLORS.length]
                } />
              ))}
            </Pie>
            <Tooltip /><Legend />
          </PieChart>
        </ChartContainer>

        <ChartContainer title="Completion Rate" data={completionRate}>
          <BarChart data={completionRate}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} />
            <Tooltip formatter={v => `${v}%`} />
            <Bar dataKey="value" fill={d => d.fill} />
          </BarChart>
        </ChartContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Monthly Leave Trend" data={monthlyTrend}>
          <BarChart data={monthlyTrend.length > 0 ? monthlyTrend : [{ month: 'No Data', count: 0 }]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#10B981" />
          </BarChart>
        </ChartContainer>

        <ChartContainer title="Active Stats" data={activeStats}>
          <BarChart data={activeStats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill={d => d.fill} />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
};

export default AdminDashboard;