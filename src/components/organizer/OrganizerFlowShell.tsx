import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { EVENT_THEMES } from '../../themes/eventThemes';
import { cn } from '../../utils/cn';
import type { FlowNavLink } from '../../utils/organizerNav';

const ui = EVENT_THEMES.minimal.ui;

export type OrganizerFlowShellProps = {
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  /** @deprecated Navigation lives in the left sidebar — kept for API compatibility */
  navLinks?: FlowNavLink[];
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'default' | 'wide' | 'full';
};

export const OrganizerFlowShell: React.FC<OrganizerFlowShellProps> = ({
  title,
  subtitle,
  backTo = '/dashboard',
  backLabel = 'Back',
  children,
  footer,
  maxWidth = 'default',
}) => {
  const maxClass =
    maxWidth === 'full' ? 'max-w-none' : maxWidth === 'wide' ? 'max-w-[1600px]' : 'max-w-[1440px]';

  return (
    <div
      className="flex min-h-[calc(100vh-3.5rem)] flex-col transition-[background] duration-500"
      style={{ background: ui.pageBg, color: ui.text }}
    >
      <div className={cn('mx-auto w-full px-4 py-5 sm:px-6 lg:px-8', maxClass)}>
        <div className="mb-6 flex min-w-0 items-start gap-3 sm:items-center">
          <Link
            to={backTo}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition hover:opacity-80"
            style={{ color: ui.textMuted }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{backLabel}</span>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold sm:text-xl" style={{ color: ui.text }}>
              {title}
            </h1>
            {subtitle ? (
              <p className="truncate text-sm" style={{ color: ui.textMuted }}>
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

      {footer ? (
        <footer
          className="shrink-0 border-t px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8"
          style={{ background: ui.footerBg, borderColor: ui.borderColor }}
        >
          <div className={cn('mx-auto', maxClass)}>{footer}</div>
        </footer>
      ) : null}
    </div>
  );
};
