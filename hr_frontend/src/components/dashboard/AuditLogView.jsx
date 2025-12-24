import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next'; 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Search, RotateCcw } from 'lucide-react';
import axios from 'axios';

// ---------------------------------------------------------------
// SAFE AXIOS BASE URL – works on localhost **and** Vercel
// ---------------------------------------------------------------
if (!axios.defaults.baseURL) {
  const isDev = process.env.NODE_ENV === 'development';
  axios.defaults.baseURL = isDev ? 'http://localhost:5000/api' : '/api';
}

const AuditLogView = () => {
  const { t } = useTranslation();

  // -----------------------------------------------------------------
  // State
  // -----------------------------------------------------------------
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const perPage = 20;

  // Filters
  const [userIdFilter, setUserIdFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // -----------------------------------------------------------------
  // Fetch logs 
  // -----------------------------------------------------------------
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    if (!token) {
      setError(t('alert_please_log_in'));
      setLoading(false);
      return;
    }

    try {
      const params = {
        page: page.toString(),
        per_page: perPage.toString(),
        ...(userIdFilter && { user_id: userIdFilter }),
        ...(actionFilter && { action: actionFilter }),
        ...(startDateFilter && { start_date: startDateFilter }),
        ...(endDateFilter && { end_date: endDateFilter }),
      };

      const response = await axios.get('/audit-logs', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      const data = response.data;
      setLogs(data.logs || []);
      setTotalLogs(data.total ?? 0);
      setTotalPages(data.pages ?? 1);
    } catch (err) {
      console.error('Audit log fetch error:', err);
      const msg =
        err.response?.data?.error ||
        err.message ||
        t('error_failed_to_load_logs');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, userIdFilter, actionFilter, startDateFilter, endDateFilter]);

  // -----------------------------------------------------------------
  // Effects
  // -----------------------------------------------------------------
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // -----------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------
  const handleFilter = () => {
    setPage(1);
    fetchLogs();
  };

  const handleReset = () => {
    setUserIdFilter('');
    setActionFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setPage(1);
    fetchLogs();
  };

  // -----------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------
  const formatTimestamp = (ts) => {
    try {
      return new Date(ts).toLocaleString(t('locale') || 'en-GB', { 
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return t('invalid_date');
    }
  };

  // -----------------------------------------------------------------
  // 🔥 FIXED VERSION — Handles object OR string safely
  // -----------------------------------------------------------------
  const formatDetails = (details) => {
    if (!details) return <span className="text-xs text-gray-500">—</span>;

    // If backend sends already parsed object
    if (typeof details === 'object') {
      return (
        <ul className="text-xs space-y-1">
          {Object.entries(details).map(([k, v]) => (
            <li key={k}>
              <strong>{k}:</strong>{' '}
              <span className="font-mono">
                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
              </span>
            </li>
          ))}
        </ul>
      );
    }

    // If backend sends JSON string
    try {
      const obj = JSON.parse(details);
      return (
        <ul className="text-xs space-y-1">
          {Object.entries(obj).map(([k, v]) => (
            <li key={k}>
              <strong>{k}:</strong>{' '}
              <span className="font-mono">
                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
              </span>
            </li>
          ))}
        </ul>
      );
    } catch {
      return <span className="text-xs font-mono">{details}</span>;
    }
  };

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {t('audit_logs_title')} ({totalLogs} {t('total')})
          </CardTitle>
        </CardHeader>

        <CardContent>
          {/* ---------- Filters ---------- */}
          <div className="flex flex-wrap gap-3 mb-6 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="text-sm font-medium block mb-1">{t('user_id')}</label>
              <Input
                type="number"
                placeholder={t('user_id_placeholder')}
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
              />
            </div>

            <div className="flex-1 min-w-[180px]">
              <label className="text-sm font-medium block mb-1">{t('action')}</label>
              <Input
                placeholder={t('action_placeholder')}
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              />
            </div>

            <div className="flex-1 min-w-[160px]">
              <label className="text-sm font-medium block mb-1">{t('start_date')}</label>
              <Input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
              />
            </div>

            <div className="flex-1 min-w-[160px]">
              <label className="text-sm font-medium block mb-1">{t('end_date')}</label>
              <Input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
              />
            </div>

            <Button onClick={handleFilter} size="sm">
              <Search className="h-4 w-4 mr-1" />
              {t('filter')}
            </Button>

            <Button onClick={handleReset} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-1" />
              {t('reset')}
            </Button>
          </div>

          {/* ---------- Loading / Error ---------- */}
          {loading && (
            <p className="text-center text-muted-foreground py-4">
              {t('loading_logs')}
            </p>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              <strong>{t('error_colon')}</strong> {error}
            </div>
          )}

          {/* ---------- Table ---------- */}
          {!loading && !error && logs.length > 0 && (
            <>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">{t('table_id')}</TableHead>
                      <TableHead className="w-[80px]">{t('table_user_id')}</TableHead>
                      <TableHead className="w-[160px]">{t('table_action')}</TableHead>
                      <TableHead className="w-[110px]">{t('table_resource')}</TableHead>
                      <TableHead className="w-[100px]">{t('table_res_id')}</TableHead>
                      <TableHead className="w-[170px]">{t('table_timestamp')}</TableHead>
                      <TableHead className="min-w-[200px]">{t('table_details')}</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{log.id}</TableCell>
                        <TableCell>{log.user_id}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">
                            {log.action}
                          </code>
                        </TableCell>
                        <TableCell>{log.resource_type || '—'}</TableCell>
                        <TableCell>{log.resource_id || '—'}</TableCell>
                        <TableCell className="text-xs">
                          {formatTimestamp(log.timestamp)}
                        </TableCell>

                        {/* 🔥 SAFE DETAILS FIX */}
                        <TableCell className="max-w-xs">
                          {formatDetails(log.details)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* ---------- Pagination ---------- */}
              <Pagination className="mt-6">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    />
                  </PaginationItem>

                  {Array.from(
                    { length: Math.min(totalPages, 7) },
                    (_, i) => {
                      const p = i + 1;
                      return (
                        <PaginationItem key={p}>
                          <PaginationLink
                            onClick={() => setPage(p)}
                            isActive={p === page}
                            className="cursor-pointer"
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    }
                  )}

                  {totalPages > 7 && (
                    <PaginationItem>
                      <span className="px-2 text-muted-foreground">...</span>
                    </PaginationItem>
                  )}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </>
          )}

          {/* ---------- Empty State ---------- */}
          {!loading && !error && logs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg mb-2">{t('no_audit_logs_found')}</p>
              <p className="text-sm">
                {t('adjust_filters_or_create_activity')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogView;
