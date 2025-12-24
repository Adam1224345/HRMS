import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, FileText, Loader2, Plane, Star } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import './CalendarView.css';

// --- CONSTANTS FOR CONSISTENT COLORING ---
const LEAVE_COLOR = {
  bg: '#10b981', // emerald-500
  border: '#059669', // emerald-600
};

const TASK_COLOR = {
  bg: '#3b82f6', // blue-500
  border: '#2563eb', // blue-600
};

const HOLIDAY_COLOR = {
  bg: '#f97316', // orange-500
  border: '#ea580c', // orange-600
};

// Safe axios baseURL setup
if (!axios.defaults.baseURL) {
  const isDev = process.env.NODE_ENV === 'development';
  axios.defaults.baseURL = isDev ? 'http://localhost:5000/api' : '/api';
}

const CalendarView = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchCalendarEvents();
  }, []);

  const fetchCalendarEvents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/calendar/events', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const transformedEvents = response.data.map((event) => {
        let colorConfig = TASK_COLOR;

        if (event.type === 'leave') {
          colorConfig = LEAVE_COLOR;
        } else if (event.type === 'holiday') {
          colorConfig = HOLIDAY_COLOR;
        }

        return {
          id: event.id,
          title: event.title,
          start: event.start,
          end: event.end,
          backgroundColor: colorConfig.bg,
          borderColor: colorConfig.border,
          extendedProps: {
            type: event.type,
            status: event.status,
            description: event.description,
            user: event.user,
            priority: event.priority,
          },
        };
      });

      setEvents(transformedEvents);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (clickInfo) => {
    setSelectedEvent({
      title: clickInfo.event.title,
      start: clickInfo.event.start,
      end: clickInfo.event.end,
      ...clickInfo.event.extendedProps,
    });
    setDialogOpen(true);
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      Pending: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      Approved: 'bg-green-100 text-green-800 border border-green-200',
      Rejected: 'bg-red-100 text-red-800 border border-red-200',
      'In Progress': 'bg-blue-100 text-blue-800 border border-blue-200',
      Completed: 'bg-gray-100 text-gray-800 border border-gray-200',
    };

    return (
      <Badge className={statusColors[status] || 'bg-gray-100 text-gray-800 border border-gray-200'}>
        {t(`status_${status.toLowerCase().replace(' ', '_')}`)}
      </Badge>
    );
  };

  const getPriorityBadge = (priority) => {
    const priorityColors = {
      Low: 'bg-blue-100 text-blue-800 border border-blue-200',
      Medium: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      High: 'bg-red-100 text-red-800 border border-red-200',
    };

    return (
      <Badge className={priorityColors[priority] || 'bg-gray-100 text-gray-800 border border-gray-200'}>
        {t(`priority_${priority.toLowerCase()}`)}
      </Badge>
    );
  };

  // Format date without time for holidays/tasks, with time only for leaves
  const formatDate = (date, type) => {
    if (!date) return 'N/A';

    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    // Show time only for leave requests
    if (type === 'leave') {
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.hour12 = true;
    }

    return new Date(date).toLocaleString(t('locale') || 'en-US', options);
  };

  const { title, start, end, type, status, description, user: eventUser, priority } = selectedEvent || {};
  const isLeave = type === 'leave';
  const isHoliday = type === 'holiday';
  const isTask = type === 'task';

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">{t('calendar_view_title')}</h2>
          <p className="text-gray-600 mt-2">{t('calendar_view_desc')}</p>
        </div>
        <Button onClick={fetchCalendarEvents} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Calendar className="h-4 w-4 mr-2" />
          )}
          {loading ? t('refreshing') : t('refresh')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('monthly_calendar')}</CardTitle>
          <CardDescription>
            <div className="flex flex-wrap gap-4 mt-2 font-medium">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <div className="w-3 h-3 rounded-full border border-emerald-300" style={{ backgroundColor: LEAVE_COLOR.bg }}></div>
                <span>{t('legend_leave_requests')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <div className="w-3 h-3 rounded-full border border-blue-300" style={{ backgroundColor: TASK_COLOR.bg }}></div>
                <span>{t('legend_task_deadlines')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <div className="w-3 h-3 rounded-full border border-orange-300" style={{ backgroundColor: HOLIDAY_COLOR.bg }}></div>
                <span>{t('legend_holidays')}</span>
              </div>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-96">
              <Loader2 className="h-8 w-8 text-gray-500 animate-spin" />
              <p className="text-gray-600 ml-3">{t('loading_calendar_events')}</p>
            </div>
          ) : (
            <div className="calendar-container">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay',
                }}
                events={events}
                eventClick={handleEventClick}
                height="auto"
                editable={false}
                selectable={true}
                selectMirror={true}
                dayMaxEvents={true}
                weekends={true}
                eventDisplay="auto"
                eventTimeFormat={{
                  hour: '2-digit',
                  minute: '2-digit',
                  meridiem: false,
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
              {isHoliday ? (
                <Star className="h-5 w-5 text-orange-600" />
              ) : isLeave ? (
                <Plane className="h-5 w-5 text-emerald-600" />
              ) : (
                <FileText className="h-5 w-5 text-blue-600" />
              )}
              {title || 'Event'}
            </DialogTitle>
            <DialogDescription>
              {isHoliday ? t('holiday_event_details') : isLeave ? t('leave_request_details') : t('task_project_details')}
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-5 py-2">
              {/* Type and Status */}
              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block uppercase tracking-wider">
                    {t('type')}
                  </label>
                  <p className="text-base font-medium text-gray-900 capitalize mt-1">
                    {t(`event_type_${type}`)}
                  </p>
                </div>

                {!isHoliday && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 block uppercase tracking-wider">
                      {t('status')}
                    </label>
                    <div className="mt-1">{getStatusBadge(status)}</div>
                  </div>
                )}
              </div>

              {/* Dates - Conditional: Show both only for leaves */}
              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {t('start_date')}
                  </label>
                  <p className="text-sm text-gray-900 mt-1 font-mono bg-gray-50 p-2 rounded">
                    {formatDate(start, type)}
                  </p>
                </div>

                {isLeave && end && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 block uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {t('end_date')}
                    </label>
                    <p className="text-sm text-gray-900 mt-1 font-mono bg-gray-50 p-2 rounded">
                      {formatDate(end, type)}
                    </p>
                  </div>
                )}
              </div>

              {/* User and Priority (skip for holidays) */}
              {((eventUser && !isHoliday) || priority) && (
                <div className="grid grid-cols-2 gap-4 border-b pb-4">
                  {eventUser && !isHoliday && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 block uppercase tracking-wider flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {isLeave ? t('employee') : t('assigned_to')}
                      </label>
                      <p className="text-sm text-gray-900 mt-1 font-medium">
                        {eventUser.first_name} {eventUser.last_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        ({eventUser.email})
                      </p>
                    </div>
                  )}

                  {priority && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 block uppercase tracking-wider">
                        {t('priority')}
                      </label>
                      <div className="mt-1">{getPriorityBadge(priority)}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {description && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block uppercase tracking-wider">
                    {t('description_reason')}
                  </label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{description}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarView;