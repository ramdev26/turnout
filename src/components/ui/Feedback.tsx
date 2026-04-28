import React from 'react';
import { cn } from '../../utils/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-neutral-200', className)} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center shadow-sm">
      <p className="text-lg font-semibold text-neutral-900">{title}</p>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

