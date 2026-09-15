import React, { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { LogOut, Menu, User } from 'lucide-react';
import { api } from '../api/client';
import { cn } from '../utils/cn';
import { Button } from './ui/Button';
import { Skeleton } from './ui/Feedback';
import { EVENT_THEMES } from '../themes/eventThemes';
import { cardStyleFor } from '../themes/flowUi';
import { clearAuthToken } from '../api/authToken';
import { TurnoutLogo } from './branding/TurnoutLogo';
import { TURNOUT_BRAND } from '../themes/brandColors';
import { AppSidebar } from './AppSidebar';
import { adminMainNav, BASADMIN_BASE } from '../utils/adminNav';
import { attendeeMainNav } from '../utils/attendeeNav';
import { eventWorkspaceNav, organizationSettingsSubNav, organizerMainNav } from '../utils/organizerNav';
import type { AppNavLink } from '../utils/appNav';

const ui = EVENT_THEMES.minimal.ui;

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, setUser, loading, setLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isPublicLanding =
    /^\/e\/[^/]+$/.test(path) ||
    /^\/e\/[^/]+\/checkout$/.test(path) ||
    (/^\/events\/[^/]+$/.test(path) && !/^\/events\/(new|themes)$/.test(path)) ||
    (/^\/events\/[^/]+\/checkout$/.test(path) && !/^\/events\/(new|themes)\//.test(path));
  const isStaffCheckin = /^\/staff\/checkin\/[^/]+$/.test(path);
  const isOrganizerConsole =
    /^\/dashboard/.test(path) || /^\/events\/(new|themes)/.test(path);
  const isAttendeeConsole = /^\/attendee/.test(path) && path !== '/attendee/signup';
  const isAdminConsole = /^\/basadmin/.test(path) || /^\/admin/.test(path);
  const isAuthPage =
    path === '/' ||
    path === '/login' ||
    path === `${BASADMIN_BASE}/login` ||
    path === '/signup' ||
    path === '/attendee/signup' ||
    path === '/forgot-password' ||
    path === '/reset-password';

  const isMarketingHome = path === '/landing';
  const isOrderConfirmation = /^\/orders\/\d+\/success$/.test(path);
  const isPaymentReturn = /^\/payhere\/(return|cancel)$/.test(path);

  const hideChrome = isPublicLanding || isStaffCheckin || isMarketingHome || isOrderConfirmation || isPaymentReturn;
  const isAppFlow = isOrganizerConsole || isAttendeeConsole || isAdminConsole || isAuthPage;
  const chromeThemed = !hideChrome;

  const showAppSidebar = !!user && !hideChrome && (isOrganizerConsole || isAttendeeConsole || isAdminConsole);

  const logoHref = !user
    ? '/'
    : user.role === 'super_admin'
      ? `${BASADMIN_BASE}/dashboard`
      : user.role === 'attendee'
        ? '/attendee/dashboard'
        : '/dashboard';

  const eventIdMatch = path.match(/^\/dashboard\/events\/([^/]+)/);
  const eventId = eventIdMatch?.[1];

  const { primaryLinks, secondaryTitle, secondaryLinks } = useMemo((): {
    primaryLinks: AppNavLink[];
    secondaryTitle?: string;
    secondaryLinks?: AppNavLink[];
  } => {
    if (!user) return { primaryLinks: [] };

    if (user.role === 'super_admin') {
      return { primaryLinks: adminMainNav };
    }

    if (user.role === 'attendee') {
      return { primaryLinks: attendeeMainNav };
    }

    const inOrganizationSettings = path.startsWith('/dashboard/organization');
    const eventWorkspaceSecondary =
      eventId && !['new', 'themes'].includes(eventId) ? eventWorkspaceNav(eventId) : undefined;
    const secondary = inOrganizationSettings ? organizationSettingsSubNav() : eventWorkspaceSecondary;

    return {
      primaryLinks: organizerMainNav,
      secondaryTitle: secondary ? (inOrganizationSettings ? 'Organization' : 'Event workspace') : undefined,
      secondaryLinks: secondary,
    };
  }, [user, eventId, path]);

  const accountHref =
    user?.role === 'attendee'
      ? '/attendee/account'
      : user?.role === 'organizer'
        ? '/dashboard/organization'
        : `${BASADMIN_BASE}/dashboard`;

  const handleLogout = async () => {
    setLoading(true);
    try {
      await api.post('/api/auth/logout');
    } catch {
      // ignore
    } finally {
      clearAuthToken();
      setUser(null);
      setLoading(false);
      navigate('/');
    }
  };

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div
      className="min-h-screen"
      style={chromeThemed || isAuthPage ? { background: ui.pageBg, color: ui.text } : undefined}
    >
      {showAppSidebar ? (
        <AppSidebar
          logoHref={logoHref}
          primaryLinks={primaryLinks}
          secondaryTitle={secondaryTitle}
          secondaryLinks={secondaryLinks}
          mobileOpen={sidebarOpen}
          onMobileClose={closeSidebar}
        />
      ) : null}

      <div className={cn('flex min-h-screen flex-col', showAppSidebar && 'lg:pl-[240px]')}>
        {!hideChrome && (
          <header
            className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 backdrop-blur-xl sm:px-6"
            style={{ background: ui.headerBg, borderColor: ui.borderColor }}
          >
            <div className="flex min-w-0 items-center gap-2">
              {showAppSidebar ? (
                <button
                  type="button"
                  className="rounded-lg border p-2 lg:hidden"
                  style={cardStyleFor(ui)}
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open menu"
                >
                  <Menu className="h-4 w-4" style={{ color: ui.text }} />
                </button>
              ) : (
                <Link
                  to={logoHref}
                  className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight"
                  style={{ color: ui.text }}
                >
                  <TurnoutLogo className="h-6 w-auto" />
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2">
              {loading ? (
                <Skeleton className="h-9 w-24 rounded-full" />
              ) : user ? (
                <>
                  <Link
                    to={accountHref}
                    title={
                      user.role === 'attendee'
                        ? 'Open my account'
                        : user.role === 'organizer'
                          ? 'Organization settings'
                          : 'Open dashboard'
                    }
                    className="inline-flex items-center gap-2 rounded-full border px-2 py-1.5 text-sm font-medium transition"
                    style={{ ...cardStyleFor(ui), color: ui.text }}
                  >
                    <span
                      className="grid h-7 w-7 place-items-center rounded-full"
                      style={{ backgroundColor: ui.accent, color: TURNOUT_BRAND.ink }}
                    >
                      <User className="h-4 w-4" />
                    </span>
                    <span className="hidden max-w-[140px] truncate pr-1 sm:block">{user.displayName}</span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="rounded-full px-3"
                    style={{ color: ui.textMuted }}
                    aria-label="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Link to="/login">
                  <Button size="sm" className="rounded-full px-5">
                    Sign in
                  </Button>
                </Link>
              )}
            </div>
          </header>
        )}

        <main
          className={cn(
            'mx-auto w-full flex-1',
            hideChrome || isAppFlow ? 'max-w-none px-0 py-0' : 'max-w-7xl px-4 py-8 sm:px-6 lg:px-8'
          )}
        >
          {children}
        </main>

        {!hideChrome && !isAppFlow && (
          <footer className="mt-14 border-t" style={{ borderColor: ui.borderColor, background: ui.footerBg }}>
            <div
              className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8"
              style={{ color: ui.textMuted }}
            >
              <TurnoutLogo className="h-4 w-auto" />
              <div className="flex flex-wrap items-center gap-4">
                <span>Events</span>
                <span>Create</span>
                <span>Dashboard</span>
                <span>Support</span>
              </div>
              <p>© {new Date().getFullYear()} Turnout</p>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};
