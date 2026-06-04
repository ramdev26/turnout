import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import { Signup } from './pages/Signup';
import { api } from './api/client';
import { clearAuthToken } from './api/authToken';
import { EventSettings } from './pages/EventSettings';
import { AgendaManager } from './pages/AgendaManager';
import { CheckInManager } from './pages/CheckInManager';
import { StaffCheckInScanner } from './pages/StaffCheckInScanner';
import { RunbookManager } from './pages/RunbookManager';
import { AttendeeLogin } from './pages/AttendeeLogin';
import { AttendeeSignup } from './pages/AttendeeSignup';
import { AttendeeDashboard } from './pages/AttendeeDashboard';
import { AttendeeAccount } from './pages/AttendeeAccount';
import { PayHereReturn } from './pages/PayHereReturn';
import { PayHereCancel } from './pages/PayHereCancel';
import { AdminDashboard } from './pages/AdminDashboard';
import { OrganizerEarnings } from './pages/OrganizerEarnings';
import { AdminUsers } from './pages/AdminUsers';
import { AdminEvents } from './pages/AdminEvents';
import { AdminTransactions } from './pages/AdminTransactions';
import { AdminPayouts } from './pages/AdminPayouts';
import { AdminSettings } from './pages/AdminSettings';
import { AdminLogs } from './pages/AdminLogs';

function FullPageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-neutral-300 border-t-[#00a95d]" />
    </div>
  );
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

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'super_admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { setUser, setLoading, user } = useAuthStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ user: any }>('/api/auth/me');
        if (!cancelled) setUser(res.user);
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
          <Route path="/" element={<MarketingLanding />} />
          <Route path="/discover" element={<Home />} />
          <Route
            path="/login"
            element={
              user ? <Navigate to={user.role === 'super_admin' ? '/admin' : user.role === 'attendee' ? '/attendee/dashboard' : '/dashboard'} replace /> : <Login />
            }
          />
          <Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <Signup />} />
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
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<RequireSuperAdmin><AdminDashboard /></RequireSuperAdmin>} />
          <Route path="/admin/users" element={<RequireSuperAdmin><AdminUsers /></RequireSuperAdmin>} />
          <Route path="/admin/events" element={<RequireSuperAdmin><AdminEvents /></RequireSuperAdmin>} />
          <Route path="/admin/transactions" element={<RequireSuperAdmin><AdminTransactions /></RequireSuperAdmin>} />
          <Route path="/admin/payouts" element={<RequireSuperAdmin><AdminPayouts /></RequireSuperAdmin>} />
          <Route path="/admin/settings" element={<RequireSuperAdmin><AdminSettings /></RequireSuperAdmin>} />
          <Route path="/admin/logs" element={<RequireSuperAdmin><AdminLogs /></RequireSuperAdmin>} />
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
          <Route
            path="/dashboard/events/:eventId/agenda"
            element={
              <RequireOrganizer>
                <AgendaManager />
              </RequireOrganizer>
            }
          />
          <Route
            path="/dashboard/events/:eventId/checkin"
            element={
              <RequireOrganizer>
                <CheckInManager />
              </RequireOrganizer>
            }
          />
          <Route
            path="/dashboard/events/:eventId/runbook"
            element={
              <RequireOrganizer>
                <RunbookManager />
              </RequireOrganizer>
            }
          />
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
