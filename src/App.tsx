import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { MarketingLanding } from './pages/MarketingLanding';
import { Dashboard } from './pages/Dashboard';
import { CreateEvent } from './pages/CreateEvent';
import { EventThemes } from './pages/EventThemes';
import { EventLanding } from './pages/EventLanding';
import { Success } from './pages/Success';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Signup } from './pages/Signup';
import { api } from './api/client';
import { parseAuthPayload } from './api/authResponse';
import { clearAuthToken } from './api/authToken';
import { EventSettings } from './pages/EventSettings';
import { CheckInManager } from './pages/CheckInManager';
import { StaffCheckInScanner } from './pages/StaffCheckInScanner';
import { AttendeeLogin } from './pages/AttendeeLogin';
import { AttendeeSignup } from './pages/AttendeeSignup';
import { AttendeeDashboard } from './pages/AttendeeDashboard';
import { AttendeeAccount } from './pages/AttendeeAccount';
import { PayHereReturn } from './pages/PayHereReturn';
import { PayHereCancel } from './pages/PayHereCancel';
import { AdminDashboard } from './pages/AdminDashboard';
import { OrganizerEarnings } from './pages/OrganizerEarnings';
import { OrganizerAccount } from './pages/OrganizerAccount';
import { OrganizerBillingCancel, OrganizerBillingReturn } from './pages/OrganizerBillingReturn';
import { AcceptInvite } from './pages/AcceptInvite';
import { AdminUsers } from './pages/AdminUsers';
import { AdminEvents } from './pages/AdminEvents';
import { AdminTransactions } from './pages/AdminTransactions';
import { AdminPayouts } from './pages/AdminPayouts';
import { AdminSettings } from './pages/AdminSettings';
import { AdminLogs } from './pages/AdminLogs';
import { AdminOrganizers } from './pages/AdminOrganizers';
import { BASADMIN_BASE } from './utils/adminNav';

function FullPageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-[var(--primary)]" />
    </div>
  );
}

function HostAwareRoot({
  user,
}: {
  user: ReturnType<typeof useAuthStore>['user'];
}) {
  const [resolving, setResolving] = useState(true);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const host = window.location.hostname.toLowerCase();
        const cfg = await api.get<{ platformHosts?: string[] }>('/api/domain/config');
        const platformHosts = (cfg.platformHosts || []).map((h) => h.toLowerCase());
        const isPlatformHost =
          platformHosts.includes(host) ||
          host.endsWith('.vercel.app') ||
          host === 'localhost' ||
          host === '127.0.0.1';

        if (!isPlatformHost) {
          const mapped = await api.get<{ path: string }>(`/api/events/by-host/${encodeURIComponent(host)}`);
          if (!cancelled && mapped.path) {
            setRedirectPath(mapped.path);
            return;
          }
        }
      } catch {
        // Not a mapped event host; fall through to standard root behavior.
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }
  if (resolving) {
    return <FullPageLoader />;
  }

  if (user) {
    return (
      <Navigate
        to={
          user.role === 'super_admin'
            ? BASADMIN_BASE
            : user.role === 'attendee'
              ? '/attendee/dashboard'
              : '/dashboard'
        }
        replace
      />
    );
  }
  return <Signup />;
}

function RequireOrganizer({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'organizer') return <Navigate to="/attendee/dashboard" replace />;
  return <>{children}</>;
}

function RequireAttendee({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/attendee/login" replace />;
  if (user.role !== 'attendee') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function basadminLoginPath(returnTo: string) {
  return `${BASADMIN_BASE}/login?next=${encodeURIComponent(returnTo)}`;
}

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={basadminLoginPath(returnTo)} replace />;
  }
  if (user.role !== 'super_admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function loginRedirectForUser(
  user: NonNullable<ReturnType<typeof useAuthStore>['user']>,
  next: string | null,
) {
  if (user.role === 'super_admin') {
    return next && next.startsWith(BASADMIN_BASE) ? next : `${BASADMIN_BASE}/dashboard`;
  }
  if (user.role === 'attendee') return '/attendee/dashboard';
  return next && next.startsWith('/') && !next.startsWith(BASADMIN_BASE) ? next : '/dashboard';
}

function LoginRoute() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  if (user) {
    return <Navigate to={loginRedirectForUser(user, searchParams.get('next'))} replace />;
  }
  return <Login />;
}

function BasAdminLoginRoute() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  const destination =
    next && next.startsWith(BASADMIN_BASE) ? next : `${BASADMIN_BASE}/dashboard`;

  if (user?.role === 'super_admin') {
    return <Navigate to={destination} replace />;
  }
  if (user) {
    return <Navigate to="/" replace />;
  }
  return <Login basadmin />;
}

export default function App() {
  const { setUser, setLoading, user } = useAuthStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await api.get<unknown>('/api/auth/me');
        if (!cancelled) setUser(parseAuthPayload(raw).user);
      } catch {
        if (!cancelled) {
          clearAuthToken();
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser, setLoading]);

  return (
    <Router>
      <Layout>
        <Routes>
          <Route
            path="/"
            element={<HostAwareRoot user={user} />}
          />
          <Route path="/landing" element={<MarketingLanding />} />
          <Route path="/discover" element={<Home />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route
            path="/signup"
            element={
              user ? (
                <Navigate
                  to={
                    user.role === 'super_admin'
                      ? BASADMIN_BASE
                      : user.role === 'attendee'
                        ? '/attendee/dashboard'
                        : '/dashboard'
                  }
                  replace
                />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/forgot-password"
            element={
              user ? (
                <Navigate
                  to={
                    user.role === 'super_admin'
                      ? `${BASADMIN_BASE}/dashboard`
                      : user.role === 'attendee'
                        ? '/attendee/dashboard'
                        : '/dashboard'
                  }
                  replace
                />
              ) : (
                <ForgotPassword />
              )
            }
          />
          <Route
            path="/reset-password"
            element={
              user ? (
                <Navigate
                  to={
                    user.role === 'super_admin'
                      ? `${BASADMIN_BASE}/dashboard`
                      : user.role === 'attendee'
                        ? '/attendee/dashboard'
                        : '/dashboard'
                  }
                  replace
                />
              ) : (
                <ResetPassword />
              )
            }
          />
          <Route
            path="/attendee/login"
            element={user?.role === 'attendee' ? <Navigate to="/attendee/dashboard" replace /> : <AttendeeLogin />}
          />
          <Route
            path="/attendee/signup"
            element={user?.role === 'attendee' ? <Navigate to="/attendee/dashboard" replace /> : <AttendeeSignup />}
          />
          <Route
            path="/attendee/dashboard"
            element={
              <RequireAttendee>
                <AttendeeDashboard />
              </RequireAttendee>
            }
          />
          <Route
            path="/attendee/account"
            element={
              <RequireAttendee>
                <AttendeeAccount />
              </RequireAttendee>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireOrganizer>
                <Dashboard />
              </RequireOrganizer>
            }
          />
          <Route
            path="/dashboard/earnings"
            element={
              <RequireOrganizer>
                <OrganizerEarnings />
              </RequireOrganizer>
            }
          />
          <Route
            path="/dashboard/organization"
            element={
              <RequireOrganizer>
                <OrganizerAccount />
              </RequireOrganizer>
            }
          />
          <Route
            path="/organizer/billing/return"
            element={
              <RequireOrganizer>
                <OrganizerBillingReturn />
              </RequireOrganizer>
            }
          />
          <Route
            path="/organizer/billing/cancel"
            element={
              <RequireOrganizer>
                <OrganizerBillingCancel />
              </RequireOrganizer>
            }
          />
          <Route path="/invite/accept" element={<AcceptInvite />} />
          <Route path="/admin" element={<Navigate to={`${BASADMIN_BASE}/dashboard`} replace />} />
          <Route path="/admin/dashboard" element={<Navigate to={`${BASADMIN_BASE}/dashboard`} replace />} />
          <Route path="/admin/users" element={<Navigate to={`${BASADMIN_BASE}/users`} replace />} />
          <Route path="/admin/events" element={<Navigate to={`${BASADMIN_BASE}/events`} replace />} />
          <Route path="/admin/transactions" element={<Navigate to={`${BASADMIN_BASE}/transactions`} replace />} />
          <Route path="/admin/payouts" element={<Navigate to={`${BASADMIN_BASE}/payouts`} replace />} />
          <Route path="/admin/settings" element={<Navigate to={`${BASADMIN_BASE}/settings`} replace />} />
          <Route path="/admin/logs" element={<Navigate to={`${BASADMIN_BASE}/logs`} replace />} />
          <Route path="/basadmin" element={<Navigate to={`${BASADMIN_BASE}/dashboard`} replace />} />
          <Route path={`${BASADMIN_BASE}/login`} element={<BasAdminLoginRoute />} />
          <Route path={`${BASADMIN_BASE}/dashboard`} element={<RequireSuperAdmin><AdminDashboard /></RequireSuperAdmin>} />
          <Route path={`${BASADMIN_BASE}/organizers`} element={<RequireSuperAdmin><AdminOrganizers /></RequireSuperAdmin>} />
          <Route path={`${BASADMIN_BASE}/users`} element={<RequireSuperAdmin><AdminUsers /></RequireSuperAdmin>} />
          <Route path={`${BASADMIN_BASE}/events`} element={<RequireSuperAdmin><AdminEvents /></RequireSuperAdmin>} />
          <Route path={`${BASADMIN_BASE}/transactions`} element={<RequireSuperAdmin><AdminTransactions /></RequireSuperAdmin>} />
          <Route path={`${BASADMIN_BASE}/payouts`} element={<RequireSuperAdmin><AdminPayouts /></RequireSuperAdmin>} />
          <Route path={`${BASADMIN_BASE}/settings`} element={<RequireSuperAdmin><AdminSettings /></RequireSuperAdmin>} />
          <Route path={`${BASADMIN_BASE}/logs`} element={<RequireSuperAdmin><AdminLogs /></RequireSuperAdmin>} />
          <Route
            path="/events/themes"
            element={
              <RequireOrganizer>
                <EventThemes />
              </RequireOrganizer>
            }
          />
          <Route
            path="/events/new"
            element={
              <RequireOrganizer>
                <CreateEvent />
              </RequireOrganizer>
            }
          />
          <Route
            path="/dashboard/events/:eventId/settings"
            element={
              <RequireOrganizer>
                <EventSettings />
              </RequireOrganizer>
            }
          />
          <Route path="/dashboard/events/:eventId/agenda" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard/events/:eventId/checkin"
            element={
              <RequireOrganizer>
                <CheckInManager />
              </RequireOrganizer>
            }
          />
          <Route path="/dashboard/events/:eventId/runbook" element={<Navigate to="/dashboard" replace />} />
          <Route path="/staff/checkin/:eventId" element={<StaffCheckInScanner />} />
          <Route path="/events/:eventId" element={<EventLanding />} />
          <Route path="/e/:slug" element={<EventLanding />} />
          <Route path="/orders/:orderId/success" element={<Success />} />
          <Route path="/payhere/return" element={<PayHereReturn />} />
          <Route path="/payhere/cancel" element={<PayHereCancel />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}
