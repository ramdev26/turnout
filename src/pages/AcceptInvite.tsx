import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { FlowAlert, FlowButton, FlowCard } from '../components/flow/FlowPrimitives';
import { APP_FLOW_UI } from '../components/flow/FlowPrimitives';

export const AcceptInvite: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const ui = APP_FLOW_UI;

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{
    email: string;
    role: string;
    organizationName: string;
    ownerName: string;
    status: string;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setError('This invite link is missing a token.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await api.get<{
          invite: {
            email: string;
            role: string;
            organizationName: string;
            ownerName: string;
            status: string;
          };
        }>(`/api/organizer/invites/preview?token=${encodeURIComponent(token)}`);
        setInvite(res.invite);
        if (res.invite.status !== 'pending') {
          setError('This invitation is no longer active.');
        }
      } catch (e: unknown) {
        const err = e as { message?: string; error?: string };
        setError(err?.message || err?.error || 'Invite not found or expired.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const accept = async () => {
    if (!token) return;
    setAccepting(true);
    setError(null);
    try {
      await api.post('/api/organizer/invites/accept', { token });
      navigate('/dashboard', { replace: true });
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      setError(err?.message || err?.error || 'Could not accept invitation.');
    } finally {
      setAccepting(false);
    }
  };

  const loginHref = `/login?next=${encodeURIComponent(`/invite/accept?token=${token}`)}`;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12" style={{ background: ui.pageBg, color: ui.text }}>
      <div className="w-full max-w-md">
        <FlowCard>
          <h1 className="text-xl font-semibold">Team invitation</h1>
          {loading ? (
            <p className="mt-3 text-sm" style={{ color: ui.textMuted }}>
              Loading invitation…
            </p>
          ) : invite ? (
            <>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: ui.textMuted }}>
                You have been invited to join{' '}
                <strong style={{ color: ui.text }}>{invite.organizationName || invite.ownerName}</strong> on Turnout as{' '}
                <strong style={{ color: ui.text }}>{invite.role}</strong>.
              </p>
              <p className="mt-2 text-sm" style={{ color: ui.textMuted }}>
                Sign in as <strong style={{ color: ui.text }}>{invite.email}</strong> to accept.
              </p>
            </>
          ) : null}

          {error ? <div className="mt-4"><FlowAlert variant="error">{error}</FlowAlert></div> : null}

          {!loading && invite && invite.status === 'pending' ? (
            <div className="mt-6 flex flex-col gap-2">
              {user?.role === 'organizer' ? (
                <FlowButton onClick={accept} disabled={accepting}>
                  {accepting ? 'Joining…' : 'Accept invitation'}
                </FlowButton>
              ) : (
                <Link to={loginHref}>
                  <FlowButton className="w-full">Sign in to accept</FlowButton>
                </Link>
              )}
              {!user ? (
                <p className="text-center text-xs" style={{ color: ui.textMuted }}>
                  New to Turnout?{' '}
                  <Link to="/signup" className="font-semibold underline-offset-2 hover:underline" style={{ color: ui.accent }}>
                    Create an organizer account
                  </Link>{' '}
                  using {invite.email}, then return here.
                </p>
              ) : null}
            </div>
          ) : null}
        </FlowCard>
      </div>
    </div>
  );
};
