import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { AuthFlowLayout } from '../components/auth/AuthFlowLayout';
import { FlowAlert, FlowButton, FlowInput, FlowLabel } from '../components/flow/FlowPrimitives';
import { APP_FLOW_UI } from '../components/flow/FlowPrimitives';

type VerifyState = 'idle' | 'verifying' | 'verified' | 'error' | 'awaiting';

export const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = (searchParams.get('token') || '').trim();
  const emailParam = (searchParams.get('email') || '').trim();

  const [email, setEmail] = useState(emailParam);
  const [state, setState] = useState<VerifyState>(token ? 'verifying' : 'awaiting');
  const [message, setMessage] = useState<string | null>(
    token ? null : 'We sent a verification link to your email. Click it to activate your account.'
  );
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const ui = APP_FLOW_UI;

  const title = useMemo(() => {
    if (state === 'verified') return 'Email verified';
    if (state === 'verifying') return 'Verifying email';
    return 'Verify your email';
  }, [state]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setState('verifying');
      setError(null);
      try {
        const res = await api.post<{ ok?: boolean; email?: string; message?: string }>('/api/auth/verify-email', {
          token,
        });
        if (cancelled) return;
        if (res.email) setEmail(res.email);
        setMessage(res.message || 'Your email is verified. You can sign in now.');
        setState('verified');
      } catch (e: unknown) {
        if (cancelled) return;
        const err = e as { message?: string; error?: string };
        setError(err?.message || err?.error || 'Verification failed. Request a new link below.');
        setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const resend = async () => {
    const target = email.trim().toLowerCase();
    if (!target) {
      setError('Enter the email you used to sign up.');
      return;
    }
    setResending(true);
    setError(null);
    try {
      const res = await api.post<{ ok?: boolean; message?: string }>('/api/auth/resend-verification', {
        email: target,
      });
      setMessage(res.message || 'If an unverified account exists, we sent a new link.');
      setState('awaiting');
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      setError(err?.message || err?.error || 'Could not resend verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthFlowLayout
      title={title}
      subtitle={
        state === 'verified'
          ? 'Your account is ready. Sign in to continue.'
          : 'Confirm your email address to finish creating your account.'
      }
    >
      <div className="flex flex-col gap-4">
        {message && !error && <FlowAlert variant="success">{message}</FlowAlert>}
        {error && <FlowAlert variant="error">{error}</FlowAlert>}

        {state === 'verified' ? (
          <FlowButton type="button" className="mt-2 h-11 w-full" onClick={() => navigate('/login', { replace: true })}>
            Continue to sign in
          </FlowButton>
        ) : (
          <>
            <label className="flex flex-col gap-1.5">
              <FlowLabel>Email</FlowLabel>
              <FlowInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={state === 'verifying'}
              />
            </label>
            <FlowButton type="button" className="mt-2 h-11 w-full" disabled={resending || state === 'verifying'} onClick={resend}>
              {resending ? 'Sending...' : state === 'verifying' ? 'Verifying...' : 'Resend verification email'}
            </FlowButton>
          </>
        )}
      </div>

      <p className="mt-6 text-center text-sm sm:text-left" style={{ color: ui.textMuted }}>
        Already verified?{' '}
        <Link to="/login" className="font-semibold" style={{ color: ui.accent }}>
          Sign in
        </Link>
      </p>
    </AuthFlowLayout>
  );
};
