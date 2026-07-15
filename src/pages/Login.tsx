import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '../api/client';
import { parseAuthPayload } from '../api/authResponse';
import { useAuthStore } from '../store/useAuthStore';
import { AuthFlowLayout } from '../components/auth/AuthFlowLayout';
import { persistAuthTokenFromResponse, getAuthToken, clearAuthToken } from '../api/authToken';
import { FlowAlert, FlowButton, FlowInput, FlowLabel } from '../components/flow/FlowPrimitives';
import { APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { cn } from '../utils/cn';
import { accentSegmentStyleFor } from '../themes/flowUi';
import { BASADMIN_BASE } from '../utils/adminNav';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

function basadminDestination(nextParam: string | null) {
  if (nextParam && nextParam.startsWith(BASADMIN_BASE)) return nextParam;
  return `${BASADMIN_BASE}/dashboard`;
}

export const Login: React.FC<{ basadmin?: boolean }> = ({ basadmin = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setUser } = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [loginAs, setLoginAs] = useState<'organizer' | 'attendee'>('organizer');
  const ui = APP_FLOW_UI;

  const nextParam = searchParams.get('next');
  const from =
    nextParam && nextParam.startsWith('/')
      ? nextParam
      : (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setUnverifiedEmail(null);
    try {
      const raw = await api.post<unknown>('/api/auth/login', values);
      const res = parseAuthPayload(raw);
      if (basadmin) {
        if (res.user.role !== 'super_admin') {
          setServerError('Super admin access only. Use a super admin account.');
          return;
        }
      } else if (loginAs === 'organizer' && !['organizer', 'super_admin'].includes(res.user.role)) {
        setServerError('This account is attendee type. Switch to "Attendee" and try again.');
        return;
      } else if (loginAs === 'attendee' && res.user.role !== 'attendee') {
        setServerError('This account is organizer type. Switch to "Organizer" and try again.');
        return;
      }
      persistAuthTokenFromResponse(res);
      if (!getAuthToken()) {
        setServerError('Sign-in succeeded but the session could not be saved. Check browser storage settings.');
        return;
      }
      setUser(res.user);
      try {
        const me = await api.get<unknown>('/api/auth/me');
        setUser(parseAuthPayload(me).user);
      } catch (e: unknown) {
        clearAuthToken();
        setUser(null);
        const err = e as { message?: string; error?: string };
        setServerError(err?.message || err?.error || 'Could not verify your session. Try again.');
        return;
      }
      const destination =
        res.user.role === 'super_admin'
          ? basadminDestination(nextParam)
          : res.user.role === 'attendee'
            ? '/attendee/dashboard'
            : from;
      navigate(destination, { replace: true });
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string; email?: string };
      if (err?.error === 'email_not_verified') {
        const email = (err.email || values.email || '').trim().toLowerCase();
        setUnverifiedEmail(email || null);
        setServerError(err?.message || 'Please verify your email before signing in.');
        return;
      }
      setServerError(err?.message || err?.error || 'Login failed');
    }
  };

  return (
    <AuthFlowLayout
      title={basadmin ? 'BasAdmin sign in' : 'Sign in'}
      subtitle={basadmin ? 'Super admin access to the platform console.' : 'Choose account type, then continue.'}
    >
      {!basadmin && (
        <div className="grid grid-cols-2 gap-2 rounded-xl border p-1" style={{ borderColor: ui.borderColor, background: ui.fieldBg }}>
          {(['organizer', 'attendee'] as const).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setLoginAs(role)}
              className={cn('rounded-lg px-3 py-2.5 text-sm font-semibold transition')}
              style={loginAs === role ? accentSegmentStyleFor(ui, true) : { color: ui.textMuted }}
            >
              {role === 'organizer' ? 'Event Organizer' : 'Attendee'}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <FlowLabel>Email</FlowLabel>
          <FlowInput {...register('email')} type="email" placeholder="you@example.com" />
          {errors.email?.message && <span className="text-xs text-red-600">{errors.email.message}</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <FlowLabel>Password</FlowLabel>
            <Link to="/forgot-password" className="text-xs font-semibold" style={{ color: ui.accent }}>
              Forgot password?
            </Link>
          </div>
          <FlowInput {...register('password')} type="password" autoComplete="current-password" />
          {errors.password?.message && <span className="text-xs text-red-600">{errors.password.message}</span>}
        </label>

        {serverError && <FlowAlert variant="error">{serverError}</FlowAlert>}
        {unverifiedEmail && (
          <p className="text-sm" style={{ color: ui.textMuted }}>
            <Link
              to={`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
              className="font-semibold"
              style={{ color: ui.accent }}
            >
              Resend verification email
            </Link>
          </p>
        )}
        <FlowButton type="submit" disabled={isSubmitting} className="mt-2 h-11 w-full">
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </FlowButton>
      </form>

      {!basadmin && (
        <p className="mt-6 text-center text-sm sm:text-left" style={{ color: ui.textMuted }}>
          Don&apos;t have an account?{' '}
          <Link
            to={loginAs === 'attendee' ? '/attendee/signup' : '/signup'}
            className="font-semibold"
            style={{ color: ui.accent }}
          >
            {loginAs === 'attendee' ? 'Create attendee account' : 'Create organizer account'}
          </Link>
        </p>
      )}
    </AuthFlowLayout>
  );
};
