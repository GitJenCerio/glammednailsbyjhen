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
      <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-600 mb-4">
        {title}
      </h3>
      {items.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">{emptyMessage}</div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{item.title}</p>
                {item.subtitle && (
                  <p className="text-xs text-slate-500 mt-1 truncate">{item.subtitle}</p>
                )}
              </div>
              {item.metadata && <div className="flex-shrink-0">{item.metadata}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

