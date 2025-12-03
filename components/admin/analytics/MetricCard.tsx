'use client';

import { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  color?: 'slate' | 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'pink';
  className?: string;
}

const colorClasses = {
  slate: 'border-slate-300 bg-slate-50 text-slate-900',
  blue: 'border-blue-300 bg-blue-50 text-blue-900',
  green: 'border-green-300 bg-green-50 text-green-900',
  orange: 'border-orange-300 bg-orange-50 text-orange-900',
  red: 'border-red-300 bg-red-50 text-red-900',
  purple: 'border-purple-300 bg-purple-50 text-purple-900',
  pink: 'border-pink-300 bg-pink-50 text-pink-900',
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  color = 'slate',
  className = '',
}: MetricCardProps) {
  return (
    <div
      className={`rounded-2xl border-2 ${colorClasses[color]} p-4 sm:p-5 shadow-lg hover:shadow-xl transition-shadow ${className}`}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider opacity-70">
          {title}
        </p>
        {icon && <div className="opacity-60">{icon}</div>}
      </div>
      <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-1">
        {typeof value === 'number' ? value.toLocaleString('en-PH') : value}
      </p>
      {subtitle && (
        <p className="text-xs sm:text-sm opacity-70 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

