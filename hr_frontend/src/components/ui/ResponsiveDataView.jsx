import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight } from 'lucide-react';

/**
 * ResponsiveDataView
 * Automatically switches between a Table (Desktop) and Cards (Mobile).
 * * @param {Array} columns - [{ header: 'Name', accessorKey: 'name', cell: (row) => ... }]
 * @param {Array} data - Array of data objects
 * @param {Boolean} isLoading - Show loading state
 * @param {String} mobileTitleKey - The key to use as the bold title on mobile cards
 * @param {String} mobileSubtitleKey - (Optional) The key to use as subtitle on mobile
 * @param {Function} onRowClick - (Optional) Row click handler
 */
export function ResponsiveDataView({ 
  columns, 
  data, 
  isLoading, 
  mobileTitleKey, 
  mobileSubtitleKey,
  onRowClick 
}) {
  
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-lg bg-gray-50/50">
        <p className="text-muted-foreground font-medium">No records found</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* --- DESKTOP VIEW (> lg) --- */}
      <div className="hidden lg:block rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50/80">
            <TableRow>
              {columns.map((col, idx) => (
                <TableHead key={idx} className="font-semibold text-gray-700 h-12">
                  {col.header}
                </TableHead>
              ))}
              {onRowClick && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, rowIdx) => (
              <TableRow 
                key={rowIdx} 
                className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-blue-50/50' : 'hover:bg-gray-50'}`}
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map((col, colIdx) => (
                  <TableCell key={colIdx} className="py-3">
                    {col.cell ? col.cell(row) : row[col.accessorKey]}
                  </TableCell>
                ))}
                {onRowClick && (
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* --- MOBILE VIEW (< lg) --- */}
      <div className="lg:hidden space-y-3">
        {data.map((row, rowIdx) => (
          <Card 
            key={rowIdx} 
            onClick={() => onRowClick && onRowClick(row)}
            className={`shadow-sm border-gray-200 transition-all ${onRowClick ? 'active:scale-[0.98] active:bg-gray-50' : ''}`}
          >
            <CardHeader className="pb-2 bg-gray-50/30 border-b p-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base font-semibold text-gray-900">
                    {row[mobileTitleKey] || `Record #${rowIdx + 1}`}
                  </CardTitle>
                  {mobileSubtitleKey && (
                     <p className="text-sm text-muted-foreground mt-1">{row[mobileSubtitleKey]}</p>
                  )}
                </div>
                {/* Find a 'status' column to display in the header */}
                {columns.find(c => c.accessorKey?.toLowerCase().includes('status'))?.cell?.(row)}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-3 grid gap-2">
              {columns.map((col, colIdx) => {
                // Skip title, subtitle, status, and actions in the main body
                if (col.accessorKey === mobileTitleKey || 
                    col.accessorKey === mobileSubtitleKey || 
                    col.accessorKey?.toLowerCase().includes('status') ||
                    col.header === 'Actions') return null;
                
                return (
                  <div key={colIdx} className="flex justify-between items-center text-sm py-1 border-b border-gray-100 last:border-0">
                    <span className="text-gray-500 font-medium">{col.header}</span>
                    <span className="text-gray-900 font-medium text-right ml-4">
                       {col.cell ? col.cell(row) : row[col.accessorKey]}
                    </span>
                  </div>
                );
              })}
              
              {/* Show Actions at bottom */}
              {columns.find(c => c.header === 'Actions') && (
                <div className="pt-3 mt-1 flex justify-end gap-2 border-t">
                  {columns.find(c => c.header === 'Actions').cell(row)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 w-full">
      <div className="hidden lg:block space-y-2 border rounded-md p-4 bg-white">
        <div className="flex gap-4 mb-4">
           {[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-1/4" />)}
        </div>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
      <div className="lg:hidden space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
      </div>
    </div>
  );
}