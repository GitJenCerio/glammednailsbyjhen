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
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-4 sm:p-6 md:p-4 shadow-xl shadow-purple-500/25 ${className}`}
    >
      {icon && <div className="absolute top-4 right-4 sm:top-6 sm:right-6 md:top-4 md:right-4 opacity-20 md:opacity-15">
        <div className="w-8 h-8 sm:w-12 sm:h-12 md:w-8 md:h-8">{icon}</div>
      </div>}
      <div className="relative">
        <p className="text-[10px] sm:text-xs md:text-[10px] font-semibold text-white/90 uppercase tracking-wider mb-1 sm:mb-2 md:mb-1">
          {title}
        </p>
        <p className="text-xl sm:text-2xl md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-white mb-0.5 sm:mb-1 md:mb-0.5 break-words">
          {typeof value === 'number' ? value.toLocaleString('en-PH') : value}
        </p>
        {subtitle && (
          <p className="text-[10px] sm:text-xs md:text-[10px] text-white/80 mt-1 sm:mt-2 md:mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

