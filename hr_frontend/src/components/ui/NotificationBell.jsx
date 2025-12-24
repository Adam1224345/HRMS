import React from 'react';
import { Bell, Check, X } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './dropdown-menu';
import { Button } from './button';
import { ScrollArea } from './scroll-area';
import { Badge } from './badge';

const NotificationBell = () => {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

    const handleMarkAsRead = (id) => {
        markAsRead(id);
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge variant="destructive" className="absolute top-0 right-0 h-4 w-4 p-0 flex items-center justify-center rounded-full">
                            {unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80" align="end">
                <DropdownMenuLabel className="flex justify-between items-center">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                        <Button variant="link" size="sm" onClick={markAllAsRead} className="h-6 p-0">
                            Mark all as read
                        </Button>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <ScrollArea className="h-[300px]">
                    {notifications.length === 0 ? (
                        <p className="text-center text-sm text-gray-500 py-4">No notifications yet.</p>
                    ) : (
                        notifications.map((notification) => (
                            <DropdownMenuItem
                                key={notification.id}
                                className={`flex flex-col items-start space-y-1 p-2 cursor-pointer ${!notification.is_read ? 'bg-blue-50/50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}
                                onSelect={(e) => {
                                    // Prevent closing the dropdown when clicking an item
                                    e.preventDefault();
                                    if (!notification.is_read) {
                                        handleMarkAsRead(notification.id);
                                    }
                                    // TODO: Add navigation logic based on notification.type and notification.related_id
                                }}
                            >
                                <div className="flex justify-between w-full">
                                    <p className={`text-sm font-medium ${!notification.is_read ? 'text-blue-700' : 'text-gray-700'}`}>
                                        {notification.message}
                                    </p>
                                    {!notification.is_read && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 ml-2 flex-shrink-0"
                                            onClick={(e) => {
                                                e.stopPropagation(); // Prevent onSelect from firing
                                                handleMarkAsRead(notification.id);
                                            }}
                                        >
                                            <Check className="h-4 w-4 text-green-500" />
                                        </Button>
                                    )}
                                </div>
                                <span className="text-xs text-gray-500">
                                    {formatTime(notification.timestamp)}
                                </span>
                            </DropdownMenuItem>
                        ))
                    )}
                </ScrollArea>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default NotificationBell;
