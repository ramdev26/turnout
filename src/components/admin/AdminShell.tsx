import React from 'react';
import { Shield } from 'lucide-react';
import { EVENT_THEMES } from '../../themes/eventThemes';

const ui = EVENT_THEMES.minimal.ui;

export const AdminShell: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({
  title,
  subtitle,
  actions,
  children,
}) => {
  return (
    <div
      className="flex min-h-[calc(100vh-3.5rem)] flex-col"
      style={{ background: ui.pageBg, color: ui.text }}
    >
      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest" style={{ borderColor: ui.borderColor, color: ui.textMuted }}>
              <Shield className="h-3.5 w-3.5" style={{ color: ui.accent }} />
              BasAdmin
            </div>
            <h1 className="text-xl font-semibold sm:text-2xl" style={{ color: ui.text }}>
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: ui.textMuted }}>
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
};
