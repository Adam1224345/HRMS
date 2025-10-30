import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Users,
  Shield,
  Settings,
  LogOut,
  Building2,
  UserCheck,
  Calendar,
  FileText,
  BarChart3,
  Menu,
  X,
  ClipboardList,
  CalendarCheck
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '../../contexts/AuthContext';
import UserManagement from './UserManagement';
import RoleManagement from './RoleManagement';
import ProfileSettings from './ProfileSettings';
import TaskManagement from './TaskManagement';
import AdminDashboard from './AdminDashboard';
import EmployeeDashboard from './EmployeeDashboard';
import LeaveManagement from './LeaveManagement';

// Simple Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex justify-center items-center h-full">
          <p className="text-red-500">Error: {this.state.error?.message || 'Something went wrong'}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const Dashboard = () => {
  const { user, logout, hasPermission, hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const navigationItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: BarChart3,
      show: true
    },
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      show: hasPermission('user_read')
    },
    {
      id: 'roles',
      label: 'Role Management',
      icon: Shield,
      show: hasPermission('role_read')
    },
    {
      id: 'tasks',
      label: 'Task Management',
      icon: ClipboardList,
      show: hasPermission('task_read')
    },
    {
      id: 'leaves',
      label: 'Leave Management',
      icon: CalendarCheck,
      show: hasPermission('leave_read')
    },
    {
      id: 'profile',
      label: 'Profile Settings',
      icon: Settings,
      show: true
    }
  ];

  const visibleNavItems = navigationItems.filter(item => item.show);

  const renderContent = () => {
    if (!user) {
      return (
        <div className="flex justify-center items-center h-full">
          <p>Loading user data...</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'users':
        return (
          <ErrorBoundary>
            <UserManagement />
          </ErrorBoundary>
        );
      case 'roles':
        return (
          <ErrorBoundary>
            <RoleManagement />
          </ErrorBoundary>
        );
      case 'tasks':
        return (
          <ErrorBoundary>
            <TaskManagement />
          </ErrorBoundary>
        );
      case 'leaves':
        return (
          <ErrorBoundary>
            <LeaveManagement />
          </ErrorBoundary>
        );
      case 'profile':
        return (
          <ErrorBoundary>
            <ProfileSettings />
          </ErrorBoundary>
        );
      default:
        const isAdminOrHR = hasRole('Admin') || hasRole('HR');
        const isEmployee = hasRole('Employee') && !isAdminOrHR;

        if (isAdminOrHR) {
          return (
            <ErrorBoundary>
              <AdminDashboard />
            </ErrorBoundary>
          );
        } else if (isEmployee) {
          return (
            <ErrorBoundary>
              <EmployeeDashboard />
            </ErrorBoundary>
          );
        } else {
          return (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-gray-900">
                Welcome back, {user?.first_name || 'User'}!
              </h2>
              <p className="text-gray-600 mt-2">
                Your role does not grant access to a specific dashboard view.
              </p>

              {/* User Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Your Role</CardTitle>
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {user?.roles?.length ? (
                        user.roles.map((role) => (
                          <Badge key={role.id} variant="secondary">
                            {role.name}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-gray-600">No roles assigned</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <

Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Permissions</CardTitle>
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{user?.permissions?.length || 0}</div>
                    <p className="text-xs text-muted-foreground">Active permissions</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Account Status</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {user?.is_active ? 'Active' : 'Inactive'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Member since{' '}
                      {user?.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Role-based Quick Actions */}
              {hasRole('Admin') && (
                <Card>
                  <CardHeader>
                    <CardTitle>System Administration</CardTitle>
                    <CardDescription>
                      As an administrator, you have full access to all system features.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button
                        onClick={() => setActiveTab('users')}
                        className="justify-start"
                        variant="outline"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Manage Users
                      </Button>
                      <Button
                        onClick={() => setActiveTab('roles')}
                        className="justify-start"
                        variant="outline"
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Manage Roles
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {hasRole('HR') && !hasRole('Admin') && (
                <Card>
                  <CardHeader>
                    <CardTitle>HR Management</CardTitle>
                    <CardDescription>
                      Manage employee information and organizational structure.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => setActiveTab('users')}
                      className="justify-start"
                      variant="outline"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Manage Employees
                    </Button>
                  </CardContent>
                </Card>
              )}

              {hasRole('Employee') && !hasRole('HR') && !hasRole('Admin') && (
                <Card>
                  <CardHeader>
                    <CardTitle>Employee Portal</CardTitle>
                    <CardDescription>
                      Access your personal information, leave requests, and company resources.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Action</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Access</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>Update Profile</TableCell>
                          <TableCell>Modify your personal information</TableCell>
                          <TableCell>
                            <Button
                              onClick={() => setActiveTab('profile')}
                              variant="outline"
                              size="sm"
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Go to Profile
                            </Button>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Request Leave</TableCell>
                          <TableCell>Submit and manage leave requests</TableCell>
                          <TableCell>
                            <Button
                              onClick={() => setActiveTab('leaves')}
                              variant="outline"
                              size="sm"
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Go to Leave Requests
                            </Button>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          );
        }
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 z-50 w-64 h-full bg-white shadow-lg transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:w-64 lg:min-w-[16rem] lg:flex-shrink-0`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b">
          <div className="flex items-center">
            <Building2 className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-xl font-semibold text-gray-900">HRMS</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="mt-6 flex-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center px-6 py-3 text-left hover:bg-gray-50 transition-colors ${
                  activeTab === item.id
                    ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                    : 'text-gray-700'
                }`}
              >
                <Icon className="h-5 w-5 mr-3" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-6 border-t">
          <div className="flex items-center mb-4">
            <Avatar className="h-10 w-10">
              <AvatarFallback>
                {getInitials(user?.first_name, user?.last_name)}
              </AvatarFallback>
            </Avatar>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">
                {user?.first_name || 'User'} {user?.last_name || ''}
              </p>
              <p className="text-xs text-gray-500">{user?.email || 'N/A'}</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline" className="w-full">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="bg-white shadow-sm border-b h-16 flex items-center justify-between px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;