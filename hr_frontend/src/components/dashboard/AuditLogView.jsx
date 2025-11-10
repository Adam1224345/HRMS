// src/components/AuditLogView.jsx
import React, { useState, useEffect, useCallback } from 'react';
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const AuditLogView = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [perPage] = useState(20);

  // Filters
  const [userIdFilter, setUserIdFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page,
        per_page: perPage,
      });

      if (userIdFilter) params.append('user_id', userIdFilter);
      if (actionFilter) params.append('action', actionFilter);
      if (startDateFilter) params.append('start_date', startDateFilter);
      if (endDateFilter) params.append('end_date', endDateFilter);

      const response = await fetch(`${API_BASE_URL}/audit-logs?${params.toString()}`);

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setTotalLogs(data.total ?? 0);
      setTotalPages(data.pages ?? 1);
    } catch (err) {
      console.error('Audit log fetch error:', err);
      setError(err.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, userIdFilter, actionFilter, startDateFilter, endDateFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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

  const formatTimestamp = (ts) => new Date(ts).toLocaleString();
  const formatDetails = (details) => {
    if (!details) return <span className="text-xs text-gray-500">—</span>;
    try {
      const obj = JSON.parse(details);
      return (
        <ul className="text-xs space-y-1">
          {Object.entries(obj).map(([k, v]) => (
            <li key={k}>
              <strong>{k}:</strong>{' '}
              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
            </li>
          ))}
        </ul>
      );
    } catch {
      return <span className="text-xs">{details}</span>;
    }
  };

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs ({totalLogs} total)</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="text-sm font-medium">User ID</label>
              <Input
                type="number"
                placeholder="e.g. 5"
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="text-sm font-medium">Action</label>
              <Input
                placeholder="e.g. LOGIN"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
              />
            </div>
            <Button onClick={handleFilter} size="sm">
              <Search className="h-4 w-4 mr-1" />
              Filter
            </Button>
            <Button onClick={handleReset} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </div>

          {/* Loading / Error */}
          {loading && <p className="text-center text-muted-foreground">Loading...</p>}
          {error && <p className="text-red-500 text-center">Error: {error}</p>}

          {/* Table */}
          {!loading && !error && logs.length > 0 && (
            <>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">ID</TableHead>
                      <TableHead className="w-[80px]">User ID</TableHead>
                      <TableHead className="w-[140px]">Action</TableHead>
                      <TableHead className="w-[100px]">Resource</TableHead>
                      <TableHead className="w-[100px]">Res ID</TableHead>
                      <TableHead className="w-[160px]">Timestamp</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.id}</TableCell>
                        <TableCell>{log.user_id}</TableCell>
                        <TableCell>{log.action}</TableCell>
                        <TableCell>{log.resource_type || '—'}</TableCell>
                        <TableCell>{log.resource_id || '—'}</TableCell>
                        <TableCell>{formatTimestamp(log.timestamp)}</TableCell>
                        <TableCell className="max-w-xs">
                          {formatDetails(log.details)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <Pagination className="mt-6">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <PaginationItem key={p}>
                        <PaginationLink onClick={() => setPage(p)} isActive={p === page}>
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  {totalPages > 7 && (
                    <PaginationItem>
                      <span className="px-2">...</span>
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

          {/* Empty State */}
          {!loading && !error && logs.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No logs found. Try adjusting filters.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogView;