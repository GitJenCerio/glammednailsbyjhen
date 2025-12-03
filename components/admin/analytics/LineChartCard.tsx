'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, parse, isValid } from 'date-fns';

interface LineChartCardProps {
  title: string;
  data: Array<{ date: string; revenue: number }>;
  className?: string;
}

export function LineChartCard({ title, data, className = '' }: LineChartCardProps) {
  const chartData = data.map((item) => {
    // Parse date string (format: yyyy-MM-dd)
    const parsedDate = parse(item.date, 'yyyy-MM-dd', new Date());
    const formattedDate = isValid(parsedDate) ? format(parsedDate, 'MMM d') : item.date;
    
    return {
      date: formattedDate,
      fullDate: item.date,
      revenue: item.revenue,
    };
  });

  return (
    <div className={`rounded-2xl border-2 border-slate-300 bg-white p-4 sm:p-6 shadow-lg ${className}`}>
      <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-600 mb-4">
        {title}
      </h3>
      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
          No data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              style={{ fontSize: '12px' }}
              tickLine={false}
            />
            <YAxis
              stroke="#64748b"
              style={{ fontSize: '12px' }}
              tickLine={false}
              tickFormatter={(value) => `₱${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [`₱${value.toLocaleString('en-PH')}`, 'Revenue']}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#8b5cf6"
              strokeWidth={3}
              dot={{ fill: '#8b5cf6', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

