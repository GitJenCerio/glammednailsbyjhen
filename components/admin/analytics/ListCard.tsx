'use client';

import { ReactNode } from 'react';

interface ListCardProps {
  title: string;
  items: Array<{
    id: string;
    title: string;
    subtitle?: string;
    metadata?: ReactNode;
  }>;
  emptyMessage?: string;
  className?: string;
}

export function ListCard({ title, items, emptyMessage = 'No items', className = '' }: ListCardProps) {
  return (
    <div className={`rounded-2xl border-2 border-slate-300 bg-white p-4 sm:p-6 shadow-lg ${className}`}>
      <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-600 mb-2">
        {title}
      </h3>
      {items.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">{emptyMessage}</div>
      ) : (
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 p-1.5 rounded border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <p className="text-xs font-medium text-slate-900 truncate flex-1 min-w-0 leading-tight">{item.title}</p>
              {item.metadata && <div className="flex-shrink-0 text-[10px]">{item.metadata}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

