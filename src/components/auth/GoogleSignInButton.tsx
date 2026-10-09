import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { parseAuthPayload } from '../../api/authResponse';
import { persistAuthTokenFromResponse, getAuthToken, clearAuthToken } from '../../api/authToken';
import { useAuthStore } from '../../store/useAuthStore';
import { formatApiError } from '../../utils/apiError';
import {
  createGoogleTokenClient,
  loadGoogleOAuthConfig,
  type GoogleAuthRole,
} from '../../lib/googleAuth';
import { FlowAlert } from '../flow/FlowPrimitives';
import { APP_FLOW_UI } from '../flow/FlowPrimitives';
import { cn } from '../../utils/cn';
import { cardStyleFor } from '../../themes/flowUi';

type Props = {
  role: GoogleAuthRole;
  /** Called after a successful Google auth session is established. */
  onSuccess: (userRole: string) => void;
  /** Optional label above the button divider context. */
  label?: string;
  disabled?: boolean;
};

type TokenClient = {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
};

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7 12.9 19.6C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.3 0 10.1-2 13.8-5.3l-6.4-5.4C29.3 34.9 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.5 5.4-6.5 6.7.1 0 .1.1.2.1l6.4 5.4C37.4 41.4 44 36 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}

export const GoogleSignInButton: React.FC<Props> = ({
  role,
  onSuccess,
  label = 'Or continue with Google',
  disabled = false,
}) => {
  const ui = APP_FLOW_UI;
  const { setUser } = useAuthStore();
  const tokenClientRef = useRef<TokenClient | null>(null);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roleRef = useRef(role);
  roleRef.current = role;

  const finishWithAccessToken = async (accessToken: string) => {
    if (!accessToken || disabled) return;
    setBusy(true);
    setError(null);
    try {
      const raw = await api.post<unknown>('/api/auth/google', {
        accessToken,
        role: roleRef.current,
      });
      const res = parseAuthPayload(raw);
      persistAuthTokenFromResponse(res);
      if (!getAuthToken()) {
        setError('Sign-in succeeded but the session could not be saved. Check browser storage settings.');
        return;
      }
      setUser(res.user);
      try {
        const me = await api.get<unknown>('/api/auth/me');
        setUser(parseAuthPayload(me).user);
      } catch (e: unknown) {
        clearAuthToken();
        setUser(null);
        setError(formatApiError(e, 'Could not verify your session. Try again.'));
        return;
      }
      onSuccess(res.user.role);
    } catch (e: unknown) {
      setError(formatApiError(e, 'Google sign-in failed'));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const mount = async () => {
      setLoading(true);
      setError(null);
      try {
        const cfg = await loadGoogleOAuthConfig();
        if (cancelled) return;
        if (!cfg.configured || !cfg.clientId) {
          setAvailable(false);
          return;
        }

        const client = await createGoogleTokenClient(
          cfg.clientId,
          (accessToken) => {
            void finishWithAccessToken(accessToken);
          },
          (message) => {
            setBusy(false);
            setError(message);
          }
        );
        if (cancelled || !client) {
          setAvailable(false);
          return;
        }
        tokenClientRef.current = client;
        setAvailable(true);
      } catch {
        if (!cancelled) {
          setAvailable(false);
          setError('Google sign-in could not be loaded.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void mount();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startGoogleSignIn = () => {
    if (disabled || busy || !tokenClientRef.current) return;
    setError(null);
    setBusy(true);
    try {
      tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
    } catch {
      setBusy(false);
      setError('Could not open Google sign-in. Try again.');
    }
  };

  if (!loading && !available && !error) {
    return null;
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1" style={{ background: ui.borderColor }} />
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textMuted }}>
          {label}
        </span>
        <div className="h-px flex-1" style={{ background: ui.borderColor }} />
      </div>

      <button
        type="button"
        onClick={startGoogleSignIn}
        disabled={disabled || busy || loading || !available}
        className={cn(
          'flex h-11 w-full items-center justify-center gap-3 rounded-xl border text-sm font-semibold transition',
          'hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
        )}
        style={{
          ...cardStyleFor(ui),
          color: ui.text,
          borderColor: ui.borderColor,
          background: ui.isDark ? 'rgba(255,255,255,0.04)' : ui.fieldBg,
        }}
      >
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white"
          aria-hidden
        >
          <GoogleMark className="h-4 w-4" />
        </span>
        <span>{busy ? 'Connecting to Google…' : 'Continue with Google'}</span>
      </button>

      {loading ? (
        <p className="text-center text-xs" style={{ color: ui.textMuted }}>
          Loading Google…
        </p>
      ) : null}
      {error ? <FlowAlert variant="error">{error}</FlowAlert> : null}
    </div>
  );
};
