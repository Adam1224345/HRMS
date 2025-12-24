import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // <--- ADDED
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ClipboardList, CheckCircle, Clock, FileText } from 'lucide-react';
import ChartContainer from './ChartContainer';
import axios from 'axios';
// Define environment-based API base URL
const isDevelopment = process.env.NODE_ENV === 'development';
const API_BASE = isDevelopment ? 'http://localhost:5000/api' : '/api';

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

// Status/Data Map for Chart Translation
const CHART_STATUS_MAP = {
    'Completed': 'task_status_completed',
    'Pending': 'task_status_pending',
    'In Progress': 'task_status_in_progress',
    'Low': 'priority_low',
    'Medium': 'priority_medium',
    'High': 'priority_high',
    'Rate': 'completion_rate_label',
};


const StatCard = ({ title, value, icon: Icon, desc, color }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className={`h-4 w-4 ${color}`} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </CardContent>
  </Card>
);

const EmployeeDashboard = () => {
  const { t } = useTranslation(); // <--- ADDED
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError(t('error_please_log_in')); // <-- Translated
      setLoading(false);
      return;
    }

    // Use API_BASE defined above
    fetch(`${API_BASE}/dashboard/employee`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => {
        if (!res.status === 401) throw new Error(t('error_unauthorized')); // <-- Translated
        if (!res.ok) {
          return res.json().then(err => {
            throw new Error(err.message || t('error_http_status', { status: res.status })); // <-- Translated
          }).catch(() => {
            throw new Error(t('error_http_status', { status: res.status })); // <-- Translated
          });
        }
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message || t('error_failed_to_load_dashboard'))) // <-- Translated
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <div className="p-8 text-center">{t('loading')}...</div>; // <-- Translated
  if (error) return <div className="p-8 text-center text-red-500">{t('error')}: {error}</div>; // <-- Translated
  if (!data) return <div className="p-8 text-center">{t('no_data_available')}</div>; // <-- Translated

  const myTaskStats = data.my_task_stats || {};
  const myLeaveStats = data.my_leave_stats || {};

  const toChartData = (obj) => {
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).map(([name, value]) => ({
      // Translate the name key based on the map
      name: t(CHART_STATUS_MAP[name] || name, { defaultValue: name }),
      original_name: name,
      value: Number(value) || 0
    }));
  };

  const taskStatusData = toChartData(myTaskStats.tasks_by_status);
  const taskPriorityData = toChartData(myTaskStats.tasks_by_priority);
  const leaveTrend = Array.isArray(myLeaveStats.monthly_trend) ? myLeaveStats.monthly_trend : [];

  const completionRate = [{
    name: t('completion_rate_label'), // <-- Translated
    value: myTaskStats.completion_rate ?? 0,
    fill: myTaskStats.completion_rate >= 70 ? '#10B981' : myTaskStats.completion_rate >= 40 ? '#F59E0B' : '#EF4444'
  }];

  // --- Custom Tooltip Component for better UX ---
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const value = payload[0].value;
            return (
                <div className="bg-white p-2 border shadow-lg text-sm rounded">
                    <p className="font-bold">{label}</p>
                    <p>{t('count')}: {value}</p>
                </div>
            );
        }
        return null;
    };


  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">{t('my_dashboard_title')}</h1> {/* <-- Translated */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={t('total_tasks_stat_card')} // <-- Translated
          value={myTaskStats.total_tasks ?? 0}
          icon={ClipboardList}
          desc={t('assigned')} // <-- Translated
          color="text-blue-500"
        />
        <StatCard
          title={t('completed_stat_card')} // <-- Translated
          value={myTaskStats.completed_tasks ?? 0}
          icon={CheckCircle}
          desc={`${myTaskStats.completion_rate ?? 0}%`}
          color="text-green-500"
        />
        <StatCard
          title={t('pending_leaves_stat_card')} // <-- Translated
          value={myLeaveStats.pending_requests ?? 0}
          icon={Clock}
          desc={t('awaiting')} // <-- Translated
          color="text-yellow-500"
        />
        <StatCard
          title={t('total_leaves_stat_card')} // <-- Translated
          value={myLeaveStats.total_requests ?? 0}
          icon={FileText}
          desc={t('submitted')} // <-- Translated
          color="text-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title={t('chart_task_status')} data={taskStatusData}> {/* <-- Translated */}
          <PieChart>
            <Pie
              data={taskStatusData.length > 0 ? taskStatusData : [{ name: t('no_data'), value: 1 }]} // <-- Translated
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {taskStatusData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ChartContainer>

        <ChartContainer title={t('chart_completion_rate')} data={completionRate}> {/* <-- Translated */}
          <BarChart data={completionRate}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} label={{ value: t('percentage_label'), angle: -90, position: 'insideLeft' }} /> {/* <-- Translated */}
            <Tooltip formatter={(v) => `${v}%`} />
            <Bar dataKey="value" fill={(d) => d.fill} />
          </BarChart>
        </ChartContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title={t('chart_tasks_by_priority')} data={taskPriorityData}> {/* <-- Translated */}
          <BarChart data={taskPriorityData.length > 0 ? taskPriorityData : [{ name: t('no_data'), value: 0 }]}> {/* <-- Translated */}
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis label={{ value: t('count_label'), angle: -90, position: 'insideLeft' }} /> {/* <-- Translated */}
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" fill="#8B5CF6" />
          </BarChart>
        </ChartContainer>

        <ChartContainer title={t('chart_leave_trend_6_months')} data={leaveTrend}> {/* <-- Translated */}
          <BarChart data={leaveTrend.length > 0 ? leaveTrend : [{ month: t('no_data_label'), count: 0 }]}> {/* <-- Translated */}
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" label={{ value: t('month_label'), position: 'bottom' }} /> {/* <-- Translated */}
            <YAxis label={{ value: t('count_label'), angle: -90, position: 'insideLeft' }} /> {/* <-- Translated */}
            <Tooltip />
            <Bar dataKey="count" fill="#10B981" />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
};
export default EmployeeDashboard;