import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { LogOut, User, Calendar, Plus, LayoutDashboard, Wallet, Shield } from 'lucide-react';
import { api } from '../api/client';
import { cn } from '../utils/cn';
import { Button } from './ui/Button';
import { Skeleton } from './ui/Feedback';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, setUser, loading, setLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const isPublicLanding =
    /^\/e\/[^/]+$/.test(location.pathname) || /^\/events\/[^/]+$/.test(location.pathname);

  const isStaffCheckin = /^\/staff\/checkin\/[^/]+$/.test(location.pathname);

  const isFullscreenFlow =
    isPublicLanding ||
    isStaffCheckin ||
    location.pathname === '/events/new' ||
    /^\/dashboard\/events\/[^/]+\/settings$/.test(location.pathname);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await api.post('/api/auth/logout');
    } catch {
      // ignore
    } finally {
      setUser(null);
      setLoading(false);
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen text-neutral-900">
      {!isPublicLanding && !isStaffCheckin && (
      <nav className="sticky top-0 z-50 border-b border-neutral-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-neutral-900">
              <span className="grid h-8 w-8 place-items-center rounded-xl border border-[#00E676]/25 bg-[#ecfdf3] text-[#009f55]">
                T
              </span>
              Turnout
            </Link>
            <div className="hidden items-center gap-1.5 md:flex">
              {user && (
                <>
                  {user.role === 'organizer' ? (
                    <>
                      <NavLink to="/dashboard" active={location.pathname.startsWith('/dashboard')}>
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                      </NavLink>
                      <NavLink to="/dashboard/earnings" active={location.pathname === '/dashboard/earnings'}>
                        <Wallet className="h-4 w-4" />
                        Earnings
                      </NavLink>
                      <NavLink to="/events/themes" active={location.pathname.startsWith('/events/')}>
                        <Plus className="h-4 w-4" />
                        Create
                      </NavLink>
                    </>
                  ) : null}
                  {user.role === 'super_admin' ? (
                    <NavLink to="/admin/dashboard" active={location.pathname.startsWith('/admin')}>
                      <Shield className="h-4 w-4" />
                      Admin
                    </NavLink>
                  ) : null}
                  {user.role === 'attendee' ? (
                    <NavLink to="/attendee/dashboard" active={location.pathname.startsWith('/attendee')}>
                      <Calendar className="h-4 w-4" />
                      Events
                    </NavLink>
                  ) : null}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loading ? (
              <Skeleton className="h-9 w-24 rounded-full" />
            ) : user ? (
              <>
                <Link
                  to={user.role === 'attendee' ? '/attendee/account' : '/dashboard'}
                  title={user.role === 'attendee' ? 'Open my account' : 'Open dashboard'}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-2 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#ecfdf3] text-[#00a95d]">
                    <User className="h-4 w-4" />
                  </span>
                  <span className="hidden pr-1 sm:block">{user.displayName}</span>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="rounded-full px-3">
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
        </div>
      </nav>
      )}

      <main
        className={cn(
          'mx-auto w-full',
          isFullscreenFlow ? 'max-w-none px-0 py-0' : 'max-w-7xl px-4 py-8 sm:px-6 lg:px-8'
        )}
      >
        {children}
      </main>

      {!isFullscreenFlow && (
      <footer className="mt-14 border-t border-neutral-200 bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-neutral-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p className="font-medium text-neutral-700">Turnout</p>
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
}) => (
  <Link
    to={to}
    className={cn(
      'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition',
      active ? 'bg-[#ecfdf3] text-[#00a95d]' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
    )}
  >
    {children}
  </Link>
);
