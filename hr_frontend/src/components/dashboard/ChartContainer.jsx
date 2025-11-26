import React from 'react';
import { ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const ChartContainer = ({ title, data, children, className }) => {
  const hasData = data && 
    ((Array.isArray(data) && data.length > 0) || 
     (typeof data === 'object' && Object.values(data).some(v => v > 0)));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <ResponsiveContainer width="100%" height={300}>
          {children}
        </ResponsiveContainer>
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm bg-white bg-opacity-80 rounded-lg">
            No Data Available
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ChartContainer;