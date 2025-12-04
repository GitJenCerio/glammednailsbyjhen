'use client';

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface DonutChartCardProps {
  title: string;
  data: Array<{ name: string; value: number; color: string }>;
  className?: string;
}

const COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'];

export function DonutChartCard({ title, data, className = '' }: DonutChartCardProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkTablet = () => {
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    checkTablet();
    window.addEventListener('resize', checkTablet);
    return () => window.removeEventListener('resize', checkTablet);
  }, []);

  return (
    <div className={`rounded-2xl border-2 border-slate-300 bg-white p-3 sm:p-4 md:p-3 shadow-lg ${className}`}>
      <h3 className="text-[10px] sm:text-xs md:text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2 sm:mb-3 md:mb-2">
        {title}
      </h3>
      {total === 0 ? (
        <div className="flex items-center justify-center h-40 sm:h-48 md:h-40 text-slate-400 text-xs sm:text-sm md:text-xs">
          No data available
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3 md:space-y-2">
          <div className="h-[160px] sm:h-[180px] md:h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius="35%"
                  outerRadius="75%"
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
          </div>
          <div className="space-y-1 sm:space-y-1.5 md:space-y-1">
            {data.map((item, index) => {
              const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
              return (
                <div key={index} className="flex items-center justify-between text-[10px] sm:text-xs md:text-[10px]">
                  <div className="flex items-center gap-1.5 sm:gap-2 md:gap-1.5">
                    <div
                      className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-2 md:h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color || COLORS[index % COLORS.length] }}
                    />
                    <span className="text-slate-600 truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5 md:gap-1 flex-shrink-0">
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

