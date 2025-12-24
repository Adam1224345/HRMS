// src/components/dashboard/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid 
} from 'recharts';
import { 
  Users, 
  ClipboardList, 
  FileText, 
  XCircle, 
  Clock
} from 'lucide-react';
import ChartContainer from './ChartContainer';

// VITE-SAFE API BASE
const API_BASE = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

const COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];

const AdminDashboard = () => {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError(t('error_please_log_in'));
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/dashboard/admin`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
      .then(res => {
        if (res.status === 401) throw new Error(t('error_unauthorized'));
        if (res.status === 403) throw new Error(t('error_forbidden'));
        if (!res.ok) throw new Error(t('error_http_status', { status: res.status }));
        return res.json();
      })
      .then(data => setData(data || {}))
      .catch(err => {
        console.error('Admin Dashboard Error:', err);
        setError(err.message || t('error_fetching_data'));
      })
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <div className="p-8 text-center text-lg">{t('loading')}...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{t('error')}: {error}</div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">{t('no_data_available')}</div>;

  const taskStats = data.task_stats || {};
  const leaveStats = data.leave_stats || {};
  const userStats = data.user_stats || {};

  const toChartData = (obj, map = {}) => {
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).map(([key, value]) => ({
      name: t(map[key] || key, { defaultValue: key }),
      original_name: key,
      value: Number(value) || 0,
    }));
  };

  const userRoleData = toChartData(userStats.users_by_role);
  const leaveTypeData = toChartData(leaveStats.leave_by_type);
  const taskStatusData = toChartData(taskStats.tasks_by_status, {
    'Completed': 'task_status_completed',
    'In Progress': 'task_status_in_progress',
    'Pending': 'task_status_pending',
  });

  const monthlyTrend = Array.isArray(leaveStats.monthly_trend) ? leaveStats.monthly_trend : [];

  const completionRate = [{
    name: t('completion_rate_label'),
    value: taskStats.completion_rate ?? 0,
    fill: taskStats.completion_rate >= 70 ? '#10B981' :
          taskStats.completion_rate >= 40 ? '#F59E0B' :
          '#EF4444',
  }];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-sm">
          <p className="font-semibold">{label}</p>
          <p>{t('count')}: <strong>{payload[0].value}</strong></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900">{t('admin_dashboard_title')}</h1>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('total_users_card')}
            </CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.total_users ?? 0}</div>
            <p className="text-xs text-muted-foreground">{t('active_users')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('total_tasks_card')}
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taskStats.total_tasks ?? 0}</div>
            <p className="text-xs text-muted-foreground">{t('all_time')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('pending_leaves_card')}
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {leaveStats.pending_requests ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">{t('awaiting_approval')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('rejection_rate_card')}
            </CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {(leaveStats.rejection_rate ?? 0).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">{t('this_year')}</p>
          </CardContent>
        </Card>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* USERS BY ROLE */}
        <ChartContainer title={t('chart_users_by_role')} data={userRoleData}>
          <PieChart>
            <Pie
              data={userRoleData.length ? userRoleData : [{ name: t('no_data'), value: 1 }]}
              dataKey="value"
              nameKey="name"
              cx="50%" cy="50%" outerRadius={100} label
            >
              {userRoleData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ChartContainer>

        {/* TASK STATUS */}
        <ChartContainer title={t('chart_task_status')} data={taskStatusData}>
          <PieChart>
            <Pie
              data={taskStatusData.length ? taskStatusData : [{ name: t('no_data'), value: 1 }]}
              dataKey="value"
              nameKey="name"
              cx="50%" cy="50%" outerRadius={100} label
            >
              {taskStatusData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry.original_name === 'Completed' ? '#10B981' :
                    entry.original_name === 'In Progress' ? '#F59E0B' :
                    entry.original_name === 'Pending' ? '#EF4444' :
                    COLORS[i % COLORS.length]
                  }
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ChartContainer>

        {/* COMPLETION RATE */}
        <ChartContainer title={t('chart_completion_rate')} data={completionRate}>
          <BarChart data={completionRate}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
            <Tooltip formatter={(v) => `${v}%`} />
            <Bar 
              dataKey="value" 
              fill={completionRate[0].fill} 
              radius={[8, 8, 0, 0]} 
            />
          </BarChart>
        </ChartContainer>

        {/* MONTHLY TREND */}
        <ChartContainer title={t('chart_monthly_leave_trend')} data={monthlyTrend}>
          <BarChart data={monthlyTrend.length ? monthlyTrend : [{ month: t('no_data'), count: 0 }]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#10B981" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ChartContainer>

      </div>
    </div>
  );
};

export default AdminDashboard;
