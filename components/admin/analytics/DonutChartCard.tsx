'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface DonutChartCardProps {
  title: string;
  data: Array<{ name: string; value: number; color: string }>;
  className?: string;
}

const COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'];

export function DonutChartCard({ title, data, className = '' }: DonutChartCardProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  return (
    <div className={`rounded-2xl border-2 border-slate-300 bg-white p-4 sm:p-6 shadow-lg ${className}`}>
      <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-600 mb-4">
        {title}
      </h3>
      {total === 0 ? (
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
          No data available
        </div>
      ) : (
        <div className="space-y-4">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2">
            {data.map((item, index) => {
              const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
              return (
                <div key={index} className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color || COLORS[index % COLORS.length] }}
                    />
                    <span className="text-slate-600">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{item.value}</span>
                    <span className="text-slate-400">({percentage}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

