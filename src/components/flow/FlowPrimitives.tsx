import React from 'react';
import { Link } from 'react-router-dom';
import { EVENT_THEMES } from '../../themes/eventThemes';
import { cardMutedStyleFor, cardStyleFor, fieldClassFor, fieldStyleFor } from '../../themes/flowUi';
import { cn } from '../../utils/cn';

export const APP_FLOW_UI = EVENT_THEMES.minimal.ui;

export function useFlowUi() {
  return APP_FLOW_UI;
}

export function FlowPage({ children, className }: { children: React.ReactNode; className?: string }) {
  const ui = APP_FLOW_UI;
  return (
    <div className={cn('mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8', className)} style={{ color: ui.text }}>
      {children}
    </div>
  );
}

export function FlowCard({
  children,
  className,
  muted,
}: {
  children: React.ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cn('rounded-2xl border p-5 shadow-sm sm:p-6', className)}
      style={muted ? cardMutedStyleFor(APP_FLOW_UI) : cardStyleFor(APP_FLOW_UI)}
    >
      {children}
    </div>
  );
}

export function FlowStatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accent?: string;
}) {
  const ui = APP_FLOW_UI;
  return (
    <div className="rounded-2xl border p-5 shadow-sm" style={cardStyleFor(ui)}>
      <div className="flex items-center justify-between gap-2" style={{ color: ui.textMuted }}>
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl" style={{ color: accent || ui.text }}>
        {value}
      </p>
    </div>
  );
}

export function FlowAlert({
  children,
  variant = 'info',
}: {
  children: React.ReactNode;
  variant?: 'info' | 'error' | 'success';
}) {
  const ui = APP_FLOW_UI;
  if (variant === 'error') {
    return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{children}</div>;
  }
  if (variant === 'success') {
    return (
      <div
        className="rounded-xl border px-4 py-3 text-sm font-medium"
        style={{ borderColor: ui.accent, background: ui.accentSoft, color: ui.text }}
      >
        {children}
      </div>
    );
  }
  return (
    <div className="rounded-xl border px-4 py-3 text-sm font-medium" style={{ ...cardMutedStyleFor(ui), color: ui.text }}>
      {children}
    </div>
  );
}

export function FlowButton({
  children,
  className,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const ui = APP_FLOW_UI;
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50';
  if (variant === 'primary') {
    return (
      <button
        type="button"
        className={cn(base, 'text-white hover:brightness-105', className)}
        style={{ backgroundColor: ui.accent }}
        {...props}
      >
        {children}
      </button>
    );
  }
  if (variant === 'ghost') {
    return (
      <button
        type="button"
        className={cn(base, className)}
        style={{ color: ui.textMuted }}
        {...props}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={cn(base, 'border', className)}
      style={{ ...cardStyleFor(ui), color: ui.text }}
      {...props}
    >
      {children}
    </button>
  );
}

export function FlowLinkButton({
  to,
  children,
  className,
  primary,
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
  primary?: boolean;
}) {
  const ui = APP_FLOW_UI;
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
        primary ? 'text-white hover:brightness-105' : 'border',
        className
      )}
      style={primary ? { backgroundColor: ui.accent } : { ...cardStyleFor(ui), color: ui.text }}
    >
      {children}
    </Link>
  );
}

export function FlowInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const ui = APP_FLOW_UI;
  return <input className={fieldClassFor(ui)} style={{ ...fieldStyleFor(ui), color: ui.text }} {...props} />;
}

export function FlowTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ui = APP_FLOW_UI;
  return <textarea className={cn(fieldClassFor(ui), 'resize-y')} style={{ ...fieldStyleFor(ui), color: ui.text }} {...props} />;
}

export function FlowLabel({ children }: { children: React.ReactNode }) {
  const ui = APP_FLOW_UI;
  return (
    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
      {children}
    </span>
  );
}

export function FlowSectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const ui = APP_FLOW_UI;
  return (
    <div>
      <h2 className="text-lg font-semibold sm:text-xl" style={{ color: ui.text }}>
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
