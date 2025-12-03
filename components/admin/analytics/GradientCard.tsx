'use client';

import { ReactNode } from 'react';

interface GradientCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  gradient?: string;
  icon?: ReactNode;
  className?: string;
}

export function GradientCard({
  title,
  value,
  subtitle,
  gradient = 'from-blue-500 via-purple-500 to-pink-500',
  icon,
  className = '',
}: GradientCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-6 sm:p-8 shadow-xl shadow-purple-500/25 ${className}`}
    >
      {icon && <div className="absolute top-6 right-6 opacity-20">{icon}</div>}
      <div className="relative">
        <p className="text-xs sm:text-sm font-semibold text-white/90 uppercase tracking-wider mb-2">
          {title}
        </p>
        <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-1 break-words">
          {typeof value === 'number' ? value.toLocaleString('en-PH') : value}
        </p>
        {subtitle && (
          <p className="text-xs sm:text-sm text-white/80 mt-2">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

