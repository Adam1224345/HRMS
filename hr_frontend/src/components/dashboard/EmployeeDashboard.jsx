import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ClipboardList, CheckCircle, Clock, FileText } from 'lucide-react';
import ChartContainer from './ChartContainer';

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const API_BASE = 'http://localhost:5000/api';

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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please log in first.');
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/dashboard/employee`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  if (!data) return <div className="p-8 text-center">No data</div>;

  const myTaskStats = data.my_task_stats || {};
  const myLeaveStats = data.my_leave_stats || {};

  const toChartData = (obj) => {
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).map(([name, value]) => ({
      name, value: Number(value) || 0
    }));
  };

  const taskStatusData = toChartData(myTaskStats.tasks_by_status);
  const taskPriorityData = toChartData(myTaskStats.tasks_by_priority);
  const leaveTrend = Array.isArray(myLeaveStats.monthly_trend) ? myLeaveStats.monthly_trend : [];

  const completionRate = [{
    name: 'Rate',
    value: myTaskStats.completion_rate ?? 0,
    fill: myTaskStats.completion_rate >= 70 ? '#10B981' : myTaskStats.completion_rate >= 40 ? '#F59E0B' : '#EF4444'
  }];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">My Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Tasks" value={myTaskStats.total_tasks ?? 0} icon={ClipboardList} desc="Assigned" color="text-blue-500" />
        <StatCard title="Completed" value={myTaskStats.completed_tasks ?? 0} icon={CheckCircle} desc={`${myTaskStats.completion_rate ?? 0}%`} color="text-green-500" />
        <StatCard title="Pending Leaves" value={myLeaveStats.pending_requests ?? 0} icon={Clock} desc="Awaiting" color="text-yellow-500" />
        <StatCard title="Total Leaves" value={myLeaveStats.total_requests ?? 0} icon={FileText} desc="Submitted" color="text-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Task Status" data={taskStatusData}>
          <PieChart>
            <Pie data={taskStatusData.length > 0 ? taskStatusData : [{ name: 'No Data', value: 1 }]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
              {taskStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
        <ChartContainer title="Tasks by Priority" data={taskPriorityData}>
          <BarChart data={taskPriorityData.length > 0 ? taskPriorityData : [{ name: 'No Data', value: 0 }]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#8B5CF6" />
          </BarChart>
        </ChartContainer>

        <ChartContainer title="Leave Trend (6 Months)" data={leaveTrend}>
          <BarChart data={leaveTrend.length > 0 ? leaveTrend : [{ month: 'No Data', count: 0 }]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#10B981" />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
};

export default EmployeeDashboard;