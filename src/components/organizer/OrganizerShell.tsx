import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../utils/cn';

type OrganizerLink = {
  to: string;
  label: string;
  exact?: boolean;
};

const defaultLinks: OrganizerLink[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/events/themes', label: 'Create Event' },
  { to: '/dashboard/earnings', label: 'Earnings' },
];

export const OrganizerShell: React.FC<{ title: string; subtitle?: string; links?: OrganizerLink[]; children: React.ReactNode }> = ({
  title,
  subtitle,
  links = defaultLinks,
  children,
}) => {
  const location = useLocation();

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="px-3 pb-3 pt-1 text-sm font-semibold text-neutral-900">Organizer Console</div>
        <nav className="space-y-1">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                'block rounded-xl px-3 py-2 text-sm font-medium transition',
                (link.exact ? location.pathname === link.to : location.pathname.startsWith(link.to))
                  ? 'bg-[#ecfdf3] text-[#00a95d]'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="space-y-4">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-neutral-500">{subtitle}</p> : null}
        </header>
        {children}
      </section>
    </div>
  );
};
