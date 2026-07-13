import React from 'react';
import { Shield } from 'lucide-react';
import { EVENT_THEMES } from '../../themes/eventThemes';
import { BASADMIN_BASE } from '../../utils/adminNav';

const ui = EVENT_THEMES.minimal.ui;

export const AdminShell: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => {
  return (
    <div
      className="flex min-h-[calc(100vh-3.5rem)] flex-col"
      style={{ background: ui.pageBg, color: ui.text }}
    >
      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest" style={{ borderColor: ui.borderColor, color: ui.accent }}>
              <Shield className="h-3.5 w-3.5" />
              BasAdmin
            </div>
            <h1 className="text-lg font-semibold sm:text-xl" style={{ color: ui.text }}>
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                {subtitle}
              </p>
            ) : null}
            <p className="mt-1 font-mono text-[11px]" style={{ color: ui.textSubtle }}>
              {BASADMIN_BASE}
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
};
