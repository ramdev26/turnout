import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { MarketingLanding } from './pages/MarketingLanding';
import { Dashboard } from './pages/Dashboard';
import { CreateEvent } from './pages/CreateEvent';
import { EventThemes } from './pages/EventThemes';
import { EventLanding } from './pages/EventLanding';
import { EventCheckout } from './pages/EventCheckout';
import { Success } from './pages/Success';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Signup } from './pages/Signup';
import { VerifyEmail } from './pages/VerifyEmail';
import { api } from './api/client';
import { parseAuthPayload } from './api/authResponse';
import { clearAuthToken, getAuthToken } from './api/authToken';
import { EventSettings } from './pages/EventSettings';
import { CheckInManager } from './pages/CheckInManager';
import { EventCoupons } from './pages/EventCoupons';
import { EventPurchaseLimits } from './pages/EventPurchaseLimits';
import { StaffCheckInScanner } from './pages/StaffCheckInScanner';
import { AttendeeLogin } from './pages/AttendeeLogin';
import { AttendeeSignup } from './pages/AttendeeSignup';
import { AttendeeDashboard } from './pages/AttendeeDashboard';
import { AttendeeAccount } from './pages/AttendeeAccount';
import { PayHereReturn } from './pages/PayHereReturn';
import { PayHereCancel } from './pages/PayHereCancel';
import { AdminDashboard } from './pages/AdminDashboard';
import { OrganizerEarnings } from './pages/OrganizerEarnings';
import { OrganizerOrders } from './pages/OrganizerOrders';
import { OrganizerOrderDetail } from './pages/OrganizerOrderDetail';
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
import { isCustomEventHostname, isPlatformHostname, normalizeHostname } from './lib/platformHost';

function FullPageLoader({ dark }: { dark?: boolean }) {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center"
      style={dark ? { background: '#000', minHeight: '100vh' } : undefined}
    >
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-white/70"
        aria-label="Loading"
      />
    </div>
  );
}

function HostAwareRoot({
  user,
}: {
  user: ReturnType<typeof useAuthStore>['user'];
}) {
  const customHost = isCustomEventHostname();
  const [resolving, setResolving] = useState(customHost);
  const [hostSlug, setHostSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const host = normalizeHostname(window.location.hostname);
        if (isPlatformHostname(host)) {
          // Still consult API so PLATFORM_HOSTS env can expand the list.
          try {
            const cfg = await api.get<{ platformHosts?: string[] }>('/api/domain/config');
            const platformHosts = (cfg.platformHosts || []).map((h) => normalizeHostname(h));
            if (platformHosts.includes(host)) return;
          } catch {
            return;
          }
        }

        const mapped = await api.get<{ slug?: string; path?: string }>(
          `/api/events/by-host/${encodeURIComponent(host)}`
        );
        const slug =
          (mapped.slug || '').trim() ||
          (mapped.path || '').replace(/^\/e\//, '').split('/')[0].trim();
        if (!cancelled && slug) {
          setHostSlug(slug);
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

  // Custom domains stay on `/` — never Navigate to `/e/:slug` (that rewrites the address bar).
  if (hostSlug) {
    return <EventLanding forcedSlug={hostSlug} />;
  }
  if (resolving) {
    return <FullPageLoader dark={customHost} />;
  }
  if (customHost) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-center text-white">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Event unavailable</h1>
          <p className="mt-2 text-sm text-white/60">This domain is not connected to a live event yet.</p>
        </div>
      </div>
    );
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

/** On a custom domain, `/e/:slug` collapses to `/` (and checkout to `/checkout`). */
function CustomDomainSlugRedirect({
  children,
  to = '/',
}: {
  children: React.ReactNode;
  to?: string;
}) {
  const { slug } = useParams<{ slug: string }>();
  const [mappedSlug, setMappedSlug] = useState<string | null>(null);
  const [checked, setChecked] = useState(() => !isCustomEventHostname());

  useEffect(() => {
    if (!isCustomEventHostname()) {
      setChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const host = normalizeHostname(window.location.hostname);
        const mapped = await api.get<{ slug?: string }>(`/api/events/by-host/${encodeURIComponent(host)}`);
        if (!cancelled) setMappedSlug((mapped.slug || '').trim() || null);
      } catch {
        if (!cancelled) setMappedSlug(null);
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!checked) return <FullPageLoader dark />;
  if (mappedSlug && (!slug || slug === mappedSlug)) {
    return <Navigate to={to} replace />;
  }
  return <>{children}</>;
}

function CustomDomainCheckout() {
  const [slug, setSlug] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const host = normalizeHostname(window.location.hostname);
        const mapped = await api.get<{ slug?: string }>(`/api/events/by-host/${encodeURIComponent(host)}`);
        const next = (mapped.slug || '').trim();
        if (!cancelled) {
          if (next) setSlug(next);
          else setFailed(true);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return <Navigate to="/" replace />;
  if (!slug) return <FullPageLoader dark />;
  return <EventCheckout forcedSlug={slug} />;
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
  const { user, loading, setUser } = useAuthStore();
  const location = useLocation();
  const [hydrating, setHydrating] = useState(false);

  useEffect(() => {
    if (loading || user || !getAuthToken()) return;

    let cancelled = false;
    setHydrating(true);
    (async () => {
      try {
        const raw = await api.get<unknown>('/api/auth/me');
        if (!cancelled) setUser(parseAuthPayload(raw).user);
      } catch {
        if (!cancelled) clearAuthToken();
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user, setUser]);

  if (loading || hydrating) return <FullPageLoader />;
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
  const { user, loading, setUser } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [hydrating, setHydrating] = useState(false);
  const next = searchParams.get('next');
  const destination =
    next && next.startsWith(BASADMIN_BASE) ? next : `${BASADMIN_BASE}/dashboard`;

  useEffect(() => {
    if (loading || user || !getAuthToken()) return;

    let cancelled = false;
    setHydrating(true);
    (async () => {
      try {
        const raw = await api.get<unknown>('/api/auth/me');
        if (!cancelled) setUser(parseAuthPayload(raw).user);
      } catch {
        if (!cancelled) clearAuthToken();
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user, setUser]);

  if (loading || hydrating) return <FullPageLoader />;

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
        if (!cancelled && !useAuthStore.getState().user) {
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
          <Route path="/verify-email" element={<VerifyEmail />} />
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
            path="/dashboard/orders"
            element={
              <RequireOrganizer>
                <OrganizerOrders />
              </RequireOrganizer>
            }
          />
          <Route
            path="/dashboard/orders/:orderId"
            element={
              <RequireOrganizer>
                <OrganizerOrderDetail />
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
          <Route
            path="/dashboard/events/:eventId/coupons"
            element={
              <RequireOrganizer>
                <EventCoupons />
              </RequireOrganizer>
            }
          />
          <Route
            path="/dashboard/events/:eventId/limits"
            element={
              <RequireOrganizer>
                <EventPurchaseLimits />
              </RequireOrganizer>
            }
          />
          <Route path="/dashboard/events/:eventId/runbook" element={<Navigate to="/dashboard" replace />} />
          <Route path="/staff/checkin/:eventId" element={<StaffCheckInScanner />} />
          <Route path="/checkout" element={<CustomDomainCheckout />} />
          <Route path="/events/:eventId/checkout" element={<EventCheckout />} />
          <Route
            path="/e/:slug/checkout"
            element={
              <CustomDomainSlugRedirect to="/checkout">
                <EventCheckout />
              </CustomDomainSlugRedirect>
            }
          />
          <Route path="/events/:eventId" element={<EventLanding />} />
          <Route
            path="/e/:slug"
            element={
              <CustomDomainSlugRedirect to="/">
                <EventLanding />
              </CustomDomainSlugRedirect>
            }
          />
          <Route path="/orders/:orderId/success" element={<Success />} />
          <Route path="/payhere/return" element={<PayHereReturn />} />
          <Route path="/payhere/cancel" element={<PayHereCancel />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}
