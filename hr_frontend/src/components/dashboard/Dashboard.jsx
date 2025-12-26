import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import EmployeeSelfService from './EmployeeSelfService';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Users,
  Bell,
  Shield,
  Settings,
  LogOut,
  Building2,
  Calendar,
  FileText,
  BarChart3,
  ClipboardList,
  CalendarCheck,
  ScrollText,
  Check
} from 'lucide-react';
import LanguageToggle from '../ui/LanguageToggle';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarSeparator
} from '@/components/ui/sidebar';
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
import DOMPurify from 'dompurify';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_BASE = `${API_BASE_URL}/api`;
const SOCKET_BASE = API_BASE_URL;

// --- FIXED REAL-TIME NOTIFICATION BELL (Instant, No Refresh Needed) ---
const NotificationBell = ({ userId, userRoles }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('soundEnabled') !== 'false');

  const isAdminOrHR = userRoles?.some(r => r.name === 'Admin' || r.name === 'HR') || false;

  useEffect(() => {
    localStorage.setItem('soundEnabled', soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (!userId) return;

    const token = localStorage.getItem('token');

    // Fetch notifications function
    const fetchNotifications = async () => {
      try {
        const res = await axios.get(`${API_BASE}/notifications`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Fetch-All': isAdminOrHR ? 'true' : 'false'
          }
        });
        const notifs = res.data || [];
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.is_read).length);
        console.log('Notifications refreshed:', notifs.length);
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };

    // Initial fetch
    fetchNotifications();

    // Socket.IO - Stable, with fallback and aggressive reconnect
    const socket = io(SOCKET_BASE, {
      withCredentials: true,
      transports: ['websocket', 'polling'], // Fallback to polling if WebSocket fails
      reconnection: true,
      reconnectionAttempts: Infinity, // Keep trying forever
      reconnectionDelay: 500,         // Fast retry
      reconnectionDelayMax: 2000,
      randomizationFactor: 0.5,
      timeout: 15000,
      autoConnect: true,
      forceNew: true
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected successfully! Joining room...');
      socket.emit('join', { user_id: userId, is_admin_or_hr: isAdminOrHR });
      fetchNotifications(); // Refresh on every connect/reconnect
    });

    socket.on('new_notification', (notif) => {
      console.log('🔔 New live notification:', notif);
      if (notif.user_id === userId || isAdminOrHR) {
        setNotifications(prev => [notif, ...prev]);
        setUnreadCount(prev => prev + 1);
        if (soundEnabled) {
          new Audio('/sounds/notification.mp3').play().catch(() => {});
        }
      }
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    // Ping every 5 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping');
      }
    }, 5000);

    // Extra: Refresh when tab becomes visible again
    const visibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    };
    document.addEventListener('visibilitychange', visibilityChange);

    return () => {
      clearInterval(pingInterval);
      document.removeEventListener('visibilitychange', visibilityChange);
      socket.disconnect();
    };
  }, [userId, isAdminOrHR, soundEnabled]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE}/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
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
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        className="relative rounded-full h-10 w-10 hover:bg-blue-50 transition-colors"
        aria-label={t('notifications_aria', { count: unreadCount })}
      >
        <Bell className="h-5 w-5 text-blue-600 hover:text-blue-700" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white animate-pulse" />
        )}
      </Button>

      {open && (
        <div
          className="absolute right-0 sm:right-0 mt-2 z-50 origin-top-right rounded-xl border border-blue-100 bg-card text-card-foreground shadow-xl outline-none animate-in fade-in zoom-in-95 duration-200"
          style={{
            width: 'calc(100vw - 2rem)',
            maxWidth: '384px',
            marginRight: '0px'
          }}
        >
          <div className="flex items-center justify-between p-4 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-white rounded-t-xl">
            <div>
              <h3 className="font-semibold leading-none tracking-tight text-blue-900">{t('notifications_header')}</h3>
              <p className="text-xs text-blue-600/80 mt-1">
                {unreadCount} {t('unread')}
              </p>
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="h-8 px-2 text-xs font-medium text-blue-600 hover:bg-blue-100"
                >
                  {t('mark_all_read')}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllNotifications}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                {t('clear_all')}
              </Button>
            </div>
          </div>

          <div className="max-h-[60vh] sm:max-h-[500px] overflow-y-auto scroll-area">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Bell className="h-10 w-10 mb-3 opacity-20 text-blue-400" />
                <p className="text-sm">{t('no_notifications')}</p>
              </div>
            ) : (
              <div className="grid gap-0">
                {notifications.map((not, i) => (
                  <div
                    key={not.id || i}
                    className={`
                      relative flex gap-4 p-4 transition-colors hover:bg-blue-50/50 border-b border-border/50 last:border-0
                      ${!not.is_read ? 'bg-blue-50/80' : ''}
                    `}
                  >
                    <div className="flex-1 space-y-1">
                      <p
                        className={`text-sm leading-snug ${!not.is_read ? 'font-medium text-blue-900' : 'text-muted-foreground'}`}
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(not.message) }}
                      />
                      <p className="text-xs text-blue-400">
                        {dayjs(not.timestamp).fromNow()}
                      </p>
                    </div>
                    {!not.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-blue-600 opacity-70 hover:opacity-100 hover:bg-blue-100"
                        onClick={(e) => { e.stopPropagation(); markAsRead(not.id); }}
                        title={t('mark_as_read')}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

NotificationBell.propTypes = { userId: PropTypes.number, userRoles: PropTypes.array };

// Error Boundary
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <div className="p-4 text-destructive border rounded-md bg-destructive/10">Error: {this.state.error?.message}</div>;
    return this.props.children;
  }
}

// --- MAIN DASHBOARD (Unchanged) ---
const Dashboard = () => {
  const { t } = useTranslation();
  const { user, logout, hasPermission, hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  const handleLogout = async () => await logout();

  const getInitials = (f, l) => `${f?.charAt(0) || ''}${l?.charAt(0) || ''}`.toUpperCase();

  const navigationItems = [
    { id: 'overview', label: t('overview'), icon: BarChart3, show: true },
    { id: 'users', label: t('user_management'), icon: Users, show: hasPermission('user_read') },
    { id: 'roles', label: t('role_management'), icon: Shield, show: hasPermission('role_read') },
    { id: 'tasks', label: t('task_management'), icon: ClipboardList, show: hasPermission('task_read') },
    { id: 'leaves', label: t('leave_management'), icon: CalendarCheck, show: hasPermission('leave_read') },
    { id: 'calendar', label: t('calendar_view'), icon: Calendar, show: hasPermission('leave_read') || hasPermission('task_read') },
    { id: 'employee-self-service', label: t('employee_self_service'), icon: FileText, show: hasRole('Employee') },
    { id: 'audit-logs', label: t('audit_logs'), icon: ScrollText, show: hasRole('Admin') || hasRole('HR') },
    { id: 'profile', label: t('profile_settings'), icon: Settings, show: true }
  ];

  const visibleNavItems = navigationItems.filter(item => item.show);

  const renderContent = () => {
    if (!user) return <div className="flex h-full items-center justify-center text-muted-foreground animate-pulse">{t('loading_user_data')}</div>;

    switch (activeTab) {
      case 'users': return <ErrorBoundary><UserManagement /></ErrorBoundary>;
      case 'roles': return <ErrorBoundary><RoleManagement /></ErrorBoundary>;
      case 'tasks': return <ErrorBoundary><TaskManagement /></ErrorBoundary>;
      case 'leaves': return <ErrorBoundary><LeaveManagement /></ErrorBoundary>;
      case 'calendar': return <ErrorBoundary><CalendarView /></ErrorBoundary>;
      case 'employee-self-service': return <ErrorBoundary><EmployeeSelfService /></ErrorBoundary>;
      case 'audit-logs': return <ErrorBoundary><AuditLogView /></ErrorBoundary>;
      case 'profile': return <ErrorBoundary><ProfileSettings /></ErrorBoundary>;
      default:
        const isAdminOrHR = hasRole('Admin') || hasRole('HR');
        const isEmployee = hasRole('Employee') && !isAdminOrHR;
        if (isAdminOrHR) return <ErrorBoundary><AdminDashboard /></ErrorBoundary>;
        if (isEmployee) return <ErrorBoundary><EmployeeDashboard /></ErrorBoundary>;
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            <Card className="hover:shadow-lg transition-shadow border-t-4 border-t-blue-500">
              <CardHeader>
                <CardTitle className="text-blue-900">{t('welcome_back')}</CardTitle>
                <CardDescription>{t('quick_actions')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button variant="outline" className="w-full justify-start h-12 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all" onClick={() => setActiveTab('tasks')}>
                    <ClipboardList className="mr-3 h-5 w-5 text-blue-600" /> {t('go_to_tasks')}
                  </Button>
                  <Button variant="outline" className="w-full justify-start h-12 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all" onClick={() => setActiveTab('leaves')}>
                    <FileText className="mr-3 h-5 w-5 text-blue-600" /> {t('go_to_leave_requests')}
                  </Button>
                  <Button variant="outline" className="w-full justify-start h-12 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all" onClick={() => setActiveTab('profile')}>
                    <Settings className="mr-3 h-5 w-5 text-blue-600" /> {t('go_to_profile')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r border-border bg-sidebar text-sidebar-foreground">
        <SidebarHeader className="border-b border-sidebar-border/50">
          <div className="flex items-center gap-2 p-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <Building2 className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-bold text-blue-900 text-base">HRMS</span>
              <span className="truncate text-xs text-blue-600/80 font-medium">Portal</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="gap-0">
          <SidebarMenu>
            {visibleNavItems.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  onClick={() => setActiveTab(item.id)}
                  isActive={activeTab === item.id}
                  tooltip={item.label}
                  className="h-10 my-1 hover:bg-blue-50 hover:text-blue-700 data-[active=true]:bg-blue-100 data-[active=true]:text-blue-800 transition-colors"
                >
                  <item.icon className="size-5" />
                  <span className="font-medium">{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border/50">
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 transition-colors">
                <Avatar className="h-9 w-9 rounded-lg border border-blue-100">
                  <AvatarFallback className="rounded-lg bg-blue-100 font-medium text-blue-700">
                    {getInitials(user?.first_name, user?.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold text-blue-900">{user?.first_name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </div>
            </SidebarMenuItem>
            <SidebarSeparator className="bg-sidebar-border/50" />
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleLogout}
                tooltip={t('sign_out')}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors h-10"
              >
                <LogOut className="size-5" />
                <span className="font-medium">{t('sign_out')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-background flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-blue-100 bg-background/95 backdrop-blur-md px-4 shadow-sm transition-[width,height] ease-linear">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1 h-9 w-9 text-blue-600 hover:bg-blue-50 hover:text-blue-700" />
            <div className="hidden md:block h-6 w-px bg-blue-200 mx-2" />
            <h1 className="text-sm font-semibold md:text-lg text-blue-900 tracking-tight">
              {navigationItems.find(i => i.id === activeTab)?.label}
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-3 md:gap-4">
            <span className="hidden text-xs text-blue-900/60 sm:inline-block font-medium">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
            <LanguageToggle />
            <NotificationBell userId={user?.id} userRoles={user?.roles} />
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-4 md:p-6 lg:p-8 bg-blue-50/10">
          <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            {renderContent()}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Dashboard;
