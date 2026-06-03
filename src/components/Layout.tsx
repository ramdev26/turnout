import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { LogOut, User, Calendar, Plus, LayoutDashboard, Wallet, Shield, Menu } from 'lucide-react';
import { api } from '../api/client';
import { cn } from '../utils/cn';
import { Button } from './ui/Button';
import { Skeleton } from './ui/Feedback';
import { EVENT_THEMES } from '../themes/eventThemes';
import { cardStyleFor } from '../themes/flowUi';
import { clearAuthToken } from '../api/authToken';
import { TurnoutLogo } from './branding/TurnoutLogo';
import { TURNOUT_BRAND } from '../themes/brandColors';

const ui = EVENT_THEMES.minimal.ui;

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, setUser, loading, setLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const isPublicLanding = /^\/e\/[^/]+$/.test(path) || /^\/events\/[^/]+$/.test(path);
  const isStaffCheckin = /^\/staff\/checkin\/[^/]+$/.test(path);
  const isOrganizerConsole = /^\/dashboard/.test(path) || path === '/events/themes';
  const isAttendeeConsole = /^\/attendee/.test(path) && path !== '/attendee/signup';
  const isAdminConsole = /^\/admin/.test(path);
  const isAuthPage =
    path === '/login' ||
    path === '/signup' ||
    path === '/attendee/signup' ||
    path === '/forgot-password' ||
    path === '/reset-password';

  const isMarketingHome = path === '/';

  const isOrderConfirmation = /^\/orders\/\d+\/success$/.test(path);

  const isFullscreenFlow =
    isPublicLanding ||
    isStaffCheckin ||
    isMarketingHome ||
    isOrderConfirmation ||
    path === '/events/new' ||
    /^\/dashboard\/events\/[^/]+\/settings$/.test(path);

  const isAppFlow = isOrganizerConsole || isAttendeeConsole || isAdminConsole || isAuthPage;
  const hideChrome = isFullscreenFlow || isPublicLanding || isStaffCheckin || isMarketingHome;
  const useThemedBar = isAppFlow && !hideChrome;
  const chromeThemed = !hideChrome;

  const logoHref = !user
    ? '/'
    : user.role === 'super_admin'
      ? '/admin/dashboard'
      : user.role === 'attendee'
        ? '/attendee/dashboard'
        : '/dashboard';

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

  return (
    <div
      className="min-h-screen"
      style={chromeThemed || isAuthPage ? { background: ui.pageBg, color: ui.text } : undefined}
    >
      {!hideChrome && (
        <nav
          className="sticky top-0 z-50 border-b backdrop-blur-xl"
          style={{ background: ui.headerBg, borderColor: ui.borderColor }}
        >
          <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3 sm:gap-6">
              <Link
                to={logoHref}
                className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight sm:text-base"
                style={{ color: ui.text }}
              >
                <TurnoutLogo className="h-6 w-auto" />
              </Link>
              {user && (
                <div className="hidden items-center gap-1 md:flex">
                  {user.role === 'organizer' ? (
                    <>
                      <NavLink to="/dashboard" active={path.startsWith('/dashboard') && path !== '/dashboard/earnings'}>
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                      </NavLink>
                      <NavLink to="/dashboard/earnings" active={path === '/dashboard/earnings'}>
                        <Wallet className="h-4 w-4" />
                        Earnings
                      </NavLink>
                      <NavLink to="/events/new" active={path.startsWith('/events/')}>
                        <Plus className="h-4 w-4" />
                        Create
                      </NavLink>
                    </>
                  ) : null}
                  {user.role === 'super_admin' ? (
                    <NavLink to="/admin/dashboard" active={path.startsWith('/admin')}>
                      <Shield className="h-4 w-4" />
                      Admin
                    </NavLink>
                  ) : null}
                  {user.role === 'attendee' ? (
                    <NavLink to="/attendee/dashboard" active={path.startsWith('/attendee')}>
                      <Calendar className="h-4 w-4" />
                      Events
                    </NavLink>
                  ) : null}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {loading ? (
                <Skeleton className="h-9 w-24 rounded-full" />
              ) : user ? (
                <>
                  <Link
                    to={user.role === 'attendee' ? '/attendee/account' : '/dashboard'}
                    title={user.role === 'attendee' ? 'Open my account' : 'Open dashboard'}
                    className="inline-flex items-center gap-2 rounded-full border px-2 py-1.5 text-sm font-medium transition"
                    style={{ ...cardStyleFor(ui), color: ui.text }}
                  >
                    <span
                      className="grid h-7 w-7 place-items-center rounded-full"
                      style={{ backgroundColor: ui.accent, color: TURNOUT_BRAND.ink }}
                    >
                      <User className="h-4 w-4" />
                    </span>
                    <span className="hidden max-w-[120px] truncate pr-1 sm:block">{user.displayName}</span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="rounded-full px-3"
                    style={{ color: ui.textMuted }}
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
              {user && chromeThemed ? (
                <details className="relative md:hidden">
                  <summary className="list-none cursor-pointer rounded-full border p-2" style={cardStyleFor(ui)}>
                    <Menu className="h-4 w-4" style={{ color: ui.text }} />
                  </summary>
                  <div
                    className="absolute right-0 mt-2 min-w-[180px] rounded-xl border p-2 shadow-lg"
                    style={{ ...cardStyleFor(ui), backgroundColor: ui.cardBg }}
                  >
                    {user.role === 'organizer' && (
                      <>
                        <MobileNavLink to="/dashboard" label="Dashboard" />
                        <MobileNavLink to="/dashboard/earnings" label="Earnings" />
                        <MobileNavLink to="/events/new" label="Create" />
                      </>
                    )}
                    {user.role === 'attendee' && <MobileNavLink to="/attendee/dashboard" label="Events" />}
                    {user.role === 'super_admin' && <MobileNavLink to="/admin/dashboard" label="Admin" />}
                  </div>
                </details>
              ) : null}
            </div>
          </div>
        </nav>
      )}

      <main
        className={cn(
          'mx-auto w-full',
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
  );
};

const NavLink = ({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: React.ReactNode;
}) => {
  const ui = EVENT_THEMES.minimal.ui;
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition hover:opacity-90"
      style={
        active
          ? { background: ui.accentSoft, color: ui.accent }
          : { color: ui.textMuted }
      }
    >
      {children}
    </Link>
  );
};

const MobileNavLink = ({ to, label }: { to: string; label: string }) => (
  <Link
    to={to}
    className="block rounded-lg px-3 py-2 text-sm font-medium"
    style={{ color: EVENT_THEMES.minimal.ui.text }}
  >
    {label}
  </Link>
);
