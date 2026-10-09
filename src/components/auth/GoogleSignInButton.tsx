import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { parseAuthPayload } from '../../api/authResponse';
import { persistAuthTokenFromResponse, getAuthToken, clearAuthToken } from '../../api/authToken';
import { useAuthStore } from '../../store/useAuthStore';
import { formatApiError } from '../../utils/apiError';
import {
  loadGoogleOAuthConfig,
  prepareGoogleIdentity,
  type GoogleAuthRole,
} from '../../lib/googleAuth';
import { FlowAlert } from '../flow/FlowPrimitives';
import { APP_FLOW_UI } from '../flow/FlowPrimitives';

type Props = {
  role: GoogleAuthRole;
  /** Called after a successful Google auth session is established. */
  onSuccess: (userRole: string) => void;
  /** Optional label above the button divider context. */
  label?: string;
  disabled?: boolean;
};

export const GoogleSignInButton: React.FC<Props> = ({
  role,
  onSuccess,
  label = 'Or continue with Google',
  disabled = false,
}) => {
  const ui = APP_FLOW_UI;
  const { setUser } = useAuthStore();
  const buttonHostRef = useRef<HTMLDivElement | null>(null);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roleRef = useRef(role);
  roleRef.current = role;

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

        const googleId = await prepareGoogleIdentity(cfg.clientId);
        if (cancelled || !googleId || !buttonHostRef.current) {
          setAvailable(false);
          return;
        }

        buttonHostRef.current.innerHTML = '';
        googleId.initialize({
          client_id: cfg.clientId,
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: (response) => {
            void handleCredential(response.credential || '');
          },
        });
        googleId.renderButton(buttonHostRef.current, {
          type: 'standard',
          theme: ui.isDark ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: Math.min(360, buttonHostRef.current.clientWidth || 320),
        });
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
    // Re-render button if theme/role host changes; role is read via ref in callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.isDark]);

  const handleCredential = async (credential: string) => {
    if (!credential || disabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      const raw = await api.post<unknown>('/api/auth/google', {
        idToken: credential,
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

      <div
        ref={buttonHostRef}
        className={`flex min-h-[44px] w-full justify-center ${disabled || busy ? 'pointer-events-none opacity-60' : ''}`}
      />

      {loading ? (
        <p className="text-center text-xs" style={{ color: ui.textMuted }}>
          Loading Google…
        </p>
      ) : null}
      {busy ? (
        <p className="text-center text-xs" style={{ color: ui.textMuted }}>
          Signing in with Google…
        </p>
      ) : null}
      {error ? <FlowAlert variant="error">{error}</FlowAlert> : null}
    </div>
  );
};
