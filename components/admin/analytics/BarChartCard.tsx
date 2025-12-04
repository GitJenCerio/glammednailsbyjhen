'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface BarChartCardProps {
  title: string;
  data: Array<{ service: string; count: number }>;
  className?: string;
}

export function BarChartCard({ title, data, className = '' }: BarChartCardProps) {
  const chartData = data.map((item) => ({
    name: item.service.length > 15 ? item.service.substring(0, 15) + '...' : item.service,
    fullName: item.service,
    count: item.count,
  }));

  return (
    <div className={`rounded-2xl border-2 border-slate-300 bg-white p-3 sm:p-4 md:p-3 shadow-lg ${className}`}>
      <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-600 mb-3 sm:mb-4">
        {title}
      </h3>
      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-48 sm:h-64 text-slate-400 text-sm">
          No data available
        </div>
      ) : (
        <div className="h-[200px] sm:h-[250px] md:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" stroke="#64748b" style={{ fontSize: '12px' }} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#64748b"
              style={{ fontSize: '11px' }}
              tickLine={false}
              width={80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
              formatter={(value: number, name: string, props: any) => [
                `${value} bookings`,
                props.payload.fullName,
              ]}
            />
            <Bar dataKey="count" fill="#ec4899" radius={[0, 8, 8, 0]} />
          </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

