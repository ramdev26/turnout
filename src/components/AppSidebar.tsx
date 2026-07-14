import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { EVENT_THEMES } from '../themes/eventThemes';
import { TurnoutLogo } from './branding/TurnoutLogo';
import { cn } from '../utils/cn';
import type { AppNavLink } from '../utils/appNav';
import { isNavLinkActive } from '../utils/appNav';

const ui = EVENT_THEMES.minimal.ui;

type Props = {
  logoHref: string;
  primaryLinks: AppNavLink[];
  secondaryTitle?: string;
  secondaryLinks?: AppNavLink[];
  mobileOpen: boolean;
  onMobileClose: () => void;
};

function SidebarNavSection({
  links,
  pathname,
  onNavigate,
}: {
  links: AppNavLink[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-0.5">
      {links.map((link) => {
        const active = isNavLinkActive(pathname, link);
        const Icon = link.icon;
        return (
          <li key={link.to}>
            <Link
              to={link.to}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                active ? 'font-semibold' : 'hover:opacity-90'
              )}
              style={
                active
                  ? { background: ui.accentSoft, color: ui.accentOn, border: `1px solid ${ui.borderColor}` }
                  : { color: ui.textMuted }
              }
            >
              {Icon ? <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.25 : 2} /> : null}
              <span className="truncate">{link.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export const AppSidebar: React.FC<Props> = ({
  logoHref,
  primaryLinks,
  secondaryTitle,
  secondaryLinks,
  mobileOpen,
  onMobileClose,
}) => {
  const { pathname } = useLocation();

  useEffect(() => {
    onMobileClose();
  }, [pathname, onMobileClose]);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4" style={{ borderColor: ui.borderColor }}>
        <Link to={logoHref} className="flex min-w-0 items-center gap-2" onClick={onMobileClose}>
          <TurnoutLogo className="h-6 w-auto" />
        </Link>
        <button
          type="button"
          className="rounded-lg p-2 lg:hidden"
          onClick={onMobileClose}
          aria-label="Close menu"
          style={{ color: ui.textMuted }}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        <SidebarNavSection links={primaryLinks} pathname={pathname} onNavigate={onMobileClose} />

        {secondaryLinks && secondaryLinks.length > 0 ? (
          <div className="mt-6 border-t pt-4" style={{ borderColor: ui.borderColor }}>
            {secondaryTitle ? (
              <p
                className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider"
                style={{ color: ui.textSubtle }}
              >
                {secondaryTitle}
              </p>
            ) : null}
            <SidebarNavSection links={secondaryLinks} pathname={pathname} onNavigate={onMobileClose} />
          </div>
        ) : null}
      </nav>
    </div>
  );

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onMobileClose}
          aria-label="Close menu overlay"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[240px] border-r transition-transform duration-200 ease-out lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ background: ui.cardBg, borderColor: ui.borderColor }}
        aria-label="Application sidebar"
      >
        {sidebarContent}
      </aside>
    </>
  );
};
