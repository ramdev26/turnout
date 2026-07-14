import React from 'react';
import { cn } from '../../utils/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-xl', className)}
      style={{ background: 'rgba(255, 255, 255, 0.08)' }}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('rounded-2xl border border-dashed px-6 py-14 text-center shadow-sm', className)}
      style={{
        borderColor: 'var(--border)',
        background: 'var(--app-surface-muted)',
        color: 'var(--text)',
      }}
    >
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

