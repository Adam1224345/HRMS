import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import axios from 'axios';
import { toast } from 'sonner';

const NotificationContext = createContext();

const isDevelopment = import.meta.env.MODE === 'development';

const API_URL = isDevelopment 
  ? (import.meta.env.VITE_API_URL || 'http://localhost:5000/api') 
  : (import.meta.env.VITE_API_URL || '/api');

  const SOCKET_URL = isDevelopment 
? (import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000') 
  : (import.meta.env.VITE_API_URL?.replace('/api', '') || '/');

export const NotificationProvider = ({ children }) => {
    const { user, isAuthenticated, token } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [socket, setSocket] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        if (!isAuthenticated || !token) return;

        try {
            const response = await axios.get(`${API_URL}/notifications`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            setNotifications(response.data);
            setUnreadCount(response.data.filter(n => !n.is_read).length);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }, [isAuthenticated, token]);

    useEffect(() => {
        if (isAuthenticated && user) {
            fetchNotifications();
    const newSocket = io(SOCKET_URL, {
                transports: ['websocket', 'polling'],
            });

            newSocket.on('connect', () => {
                console.log('Socket connected');
                newSocket.emit('join', { user_id: user.id });
            });

            newSocket.on('new_notification', (newNotification) => {
                console.log('New notification received:', newNotification);
                setNotifications(prev => [newNotification, ...prev]);
                setUnreadCount(prev => prev + 1);
                toast.info(newNotification.message, {
                    description: 'New HRMS Notification',
                    duration: 5000,
                });
            });

            newSocket.on('disconnect', () => {
                console.log('Socket disconnected');
            });

            setSocket(newSocket);

            return () => {
                newSocket.close();
            };
        } else if (!isAuthenticated) {
            setNotifications([]);
            setUnreadCount(0);
            if (socket) {
                socket.close();
                setSocket(null);
            }
        }
    }, [isAuthenticated, user, fetchNotifications]); // Removed 'socket' from deps to prevent loops

    const markAsRead = async (notificationId) => {
        try {
            await axios.put(`${API_URL}/notifications/${notificationId}/read`, {}, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            setNotifications(prev =>
                prev.map(n =>
                    n.id === notificationId ? { ...n, is_read: true } : n
                )
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        // Optimistic Update
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        
        setNotifications(prev =>
            prev.map(n => ({ ...n, is_read: true }))
        );
        setUnreadCount(0);
        
        unreadIds.forEach(id => markAsRead(id));
    };

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                unreadCount,
                fetchNotifications,
                markAsRead,
                markAllAsRead,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => useContext(NotificationContext);