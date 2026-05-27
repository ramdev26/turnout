import React from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  navLinks,
  children,
  footer,
  maxWidth = 'default',
}) => {
  const location = useLocation();
  const cardStyle = { backgroundColor: ui.cardBg, borderColor: ui.borderColor };

  const maxClass =
    maxWidth === 'full' ? 'max-w-none' : maxWidth === 'wide' ? 'max-w-[1600px]' : 'max-w-[1440px]';

  return (
    <div
      className="flex min-h-[calc(100vh-4rem)] flex-col transition-[background] duration-500 sm:min-h-[calc(100vh-4rem)]"
      style={{ background: ui.pageBg, color: ui.text }}
    >
      <header
        className="sticky top-0 z-30 shrink-0 border-b backdrop-blur-md"
        style={{ background: ui.headerBg, borderColor: ui.borderColor }}
      >
        <div className={cn('mx-auto flex flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8', maxClass)}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3 sm:items-center">
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

          {navLinks && navLinks.length > 0 && (
            <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
              {navLinks.map((link) => {
                const active = link.exact ? location.pathname === link.to : location.pathname.startsWith(link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:text-sm"
                    style={
                      active
                        ? { background: ui.accentSoft, borderColor: ui.accent, color: ui.accent }
                        : { ...cardStyle, color: ui.textMuted }
                    }
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </header>

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
