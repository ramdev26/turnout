import React from 'react';
import { EVENT_THEMES } from '../../themes/eventThemes';
import { cn } from '../../utils/cn';

const ui = EVENT_THEMES.minimal.ui;

export const AttendeeShell: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => {
  return (
    <div
      className="flex min-h-[calc(100vh-3.5rem)] flex-col"
      style={{ background: ui.pageBg, color: ui.text }}
    >
      <div className={cn('mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8')}>
        <div>
          <h1 className="text-lg font-semibold sm:text-xl" style={{ color: ui.text }}>
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
};
