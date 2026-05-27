import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { EVENT_THEMES } from '../../themes/eventThemes';
import { cardStyleFor } from '../../themes/flowUi';
import { cn } from '../../utils/cn';

const ui = EVENT_THEMES.minimal.ui;

const links = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/events', label: 'Events' },
  { to: '/admin/transactions', label: 'Transactions' },
  { to: '/admin/payouts', label: 'Payouts' },
  { to: '/admin/settings', label: 'Settings' },
  { to: '/admin/logs', label: 'Logs' },
];

export const AdminShell: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => {
  const location = useLocation();

  return (
    <div
      className="flex min-h-[calc(100vh-3.5rem)] flex-col sm:min-h-[calc(100vh-4rem)]"
      style={{ background: ui.pageBg, color: ui.text }}
    >
      <header
        className="sticky top-0 z-20 shrink-0 border-b backdrop-blur-md"
        style={{ background: ui.headerBg, borderColor: ui.borderColor }}
      >
        <div className="mx-auto max-w-[1600px] space-y-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-lg font-semibold sm:text-xl" style={{ color: ui.text }}>
              {title}
            </h1>
            {subtitle ? (
              <p className="text-sm" style={{ color: ui.textMuted }}>
                {subtitle}
              </p>
            ) : null}
          </div>
          <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
            {links.map((link) => {
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:text-sm')}
                  style={
                    active
                      ? { background: ui.accentSoft, borderColor: ui.accent, color: ui.accent }
                      : { ...cardStyleFor(ui), color: ui.textMuted }
                  }
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
};
