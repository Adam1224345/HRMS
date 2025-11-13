import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Users,
  Bell,
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
  CalendarCheck,
  ScrollText
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
import CalendarView from './CalendarView';
import AuditLogView from './AuditLogView';
import io from 'socket.io-client';
import axios from 'axios';

// Define environment-based API base URL
const isDevelopment = process.env.NODE_ENV === 'development';
const API_BASE = isDevelopment ? 'http://localhost:5000/api' : '/api';
const SOCKET_BASE = isDevelopment ? 'http://localhost:5000' : '';
const NotificationBell = ({ userId }) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState('right');

  // Detect if user is Admin
  const { user } = useAuth();
  const isAdmin = user?.roles?.some(r => r.name === 'Admin') || false;

  useEffect(() => {
    if (!userId) return;

    const token = localStorage.getItem('token');
    const endpoint = isAdmin ? `${API_BASE}/notifications/all` : `${API_BASE}/notifications`;

    // Load notifications
    axios.get(endpoint, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      const notifs = res.data || [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.is_read && (isAdmin || n.user_id === userId)).length);
    })
    .catch(err => console.error('Failed to load notifications:', err));

    // Socket.IO real-time
    const socket = io(SOCKET_BASE, {
      withCredentials: true,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('Notification socket connected');
      socket.emit('join', { user_id: userId });
    });

    socket.on('new_notification', (notif) => {
      setNotifications(prev => [notif, ...prev]);
      if (!notif.is_read && (isAdmin || notif.user_id === userId)) {
        setUnreadCount(prev => prev + 1);
      }
      new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-alert-2579.mp3')
        .play().catch(() => {});
    });

    socket.on('disconnect', () => {
      console.log('Notification socket disconnected');
    });

    return () => socket.disconnect();
  }, [userId, isAdmin]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!open) {
      const bellElement = dropdownRef.current?.querySelector('button');
      if (bellElement) {
        const rect = bellElement.getBoundingClientRect();
        const spaceOnRight = window.innerWidth - rect.right;
        const spaceOnLeft = rect.left;
        const dropdownWidth = 320;
        if (spaceOnRight < dropdownWidth && spaceOnLeft >= spaceOnRight) {
          setDropdownPosition('left');
        } else {
          setDropdownPosition('right');
        }
      }
    }
    setOpen(!open);
  };

  const markAsRead = async (id) => {
    const notif = notifications.find(n => n.id === id);
    if (!notif || (!isAdmin && notif.user_id !== userId)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE}/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const ownUnread = notifications.filter(n => !n.is_read && (isAdmin || n.user_id === userId));
    if (ownUnread.length === 0) return;

    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => 
        (isAdmin || n.user_id === userId) ? { ...n, is_read: true } : n
      ));
      setUnreadCount(prev => prev - ownUnread.length);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const clearAllNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-full hover:bg-gray-200 transition-all duration-200"
        aria-label={`Notifications ${unreadCount > 0 ? `${unreadCount} unread` : ''}`}
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse shadow-lg">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div 
          className={`absolute ${
            dropdownPosition === 'right' ? 'right-0' : 'left-0'
          } mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden`}
          style={{
            maxWidth: 'calc(100vw - 3rem)',
            maxHeight: '80vh'
          }}
        >
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-lg">Notifications {isAdmin ? '(All Users)' : ''}</h3>
              <span className="text-sm bg-white/20 px-2 py-1 rounded-full">
                {unreadCount} unread
              </span>
            </div>
            
            {unreadCount > 0 && (
              <div className="flex justify-between items-center mt-2">
                <button 
                  onClick={markAllAsRead}
                  className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-all duration-200 font-medium"
                >
                  Mark all as read
                </button>
                <button 
                  onClick={clearAllNotifications}
                  className="text-sm text-white/80 hover:text-white text-xs"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">No notifications yet</p>
                <p className="text-gray-400 text-xs mt-1">We'll notify you when something arrives</p>
              </div>
            ) : (
              notifications.map((not, index) => (
                <div
                  key={not.id || index}
                  className={`p-3 border-b border-gray-100 hover:bg-gray-50 transition-all duration-200 ${
                    !not.is_read ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-2">
                      <p className="text-sm font-medium text-gray-900 break-words">
                        {not.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(not.timestamp).toLocaleString()}
                      </p>
                      {isAdmin && not.user_id !== userId && (
                        <p className="text-xs text-indigo-600 mt-1">
                          To: User #{not.user_id}
                        </p>
                      )}
                    </div>
                    {!not.is_read && (isAdmin || not.user_id === userId) && (
                      <button
                        onClick={() => markAsRead(not.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-2 flex-shrink-0 transition-colors px-2 py-1 rounded hover:bg-blue-100"
                        title="Mark as read"
                        aria-label="Mark as read"
                      >
                        Check
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 bg-gray-50 text-center border-t">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">
                  {notifications.length} total
                </span>
                <button 
                  className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  onClick={clearAllNotifications}
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
// Error Boundary
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
      id: 'calendar',
      label: 'Calendar View',
      icon: Calendar,
      show: hasPermission('leave_read') || hasPermission('task_read')
    },
    {
      id: 'audit-logs',
      label: 'Audit Logs',
      icon: ScrollText,
      show: hasRole('Admin') || hasRole('HR')
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
      case 'calendar':
        return (
          <ErrorBoundary>
            <CalendarView />
          </ErrorBoundary>
        );
      case 'audit-logs':
        return (
          <ErrorBoundary>
            <AuditLogView />
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Welcome back!</CardTitle>
                  <CardDescription>Quick actions to get started</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell>View Tasks</TableCell>
                        <TableCell>Check your assigned tasks</TableCell>
                        <TableCell>
                          <Button
                            onClick={() => setActiveTab('tasks')}
                            variant="outline"
                            size="sm"
                          >
                            <ClipboardList className="h-4 w-4 mr-2" />
                            Go to Tasks
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
                      <TableRow>
                        <TableCell>Profile Settings</TableCell>
                        <TableCell>Update your personal information</TableCell>
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
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
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
            <NotificationBell userId={user?.id} />
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