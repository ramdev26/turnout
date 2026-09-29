import React, { useState } from 'react';
import { KeyRound, Loader2, Lock } from 'lucide-react';
import type { Event } from '../../types';
import { api } from '../../api/client';
import { landingCssVars } from '../../themes/eventThemes';
import { formatApiError } from '../../utils/apiError';
import {
  setEventAccessToken,
  setPendingEventAccessContext,
} from '../../lib/eventAccessToken';

type Props = {
  event: Event;
  initialCode?: string;
  onUnlocked: (event: Event, accessToken?: string | null) => void;
};

export function EventAccessGate({ event, initialCode = '', onUnlocked }: Props) {
  const [code, setCode] = useState(initialCode);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const themeVars = landingCssVars(event.customization, event.templateId);

  const unlock = async (raw?: string) => {
    const trimmed = (raw ?? code).trim();
    if (!trimmed) {
      setError('Enter the access code you were given.');
      return;
    }
    setUnlocking(true);
    setError(null);
    try {
      const res = await api.post<{
        ok: boolean;
        accessRequired?: boolean;
        accessToken?: string | null;
        event: Event;
      }>(`/api/events/${event.id}/access/unlock`, { code: trimmed });
      if (res.accessToken) {
        setEventAccessToken(event.id, res.accessToken);
        setPendingEventAccessContext(event.id);
      }
      onUnlocked(res.event, res.accessToken);
    } catch (e) {
      setError(formatApiError(e, 'That access code did not work.'));
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ ...themeVars, background: 'var(--landing-page-bg)' }}
    >
      <div
        className="w-full max-w-md rounded-3xl border p-8 shadow-sm"
        style={{
          borderColor: 'var(--landing-border)',
          background: 'var(--landing-surface)',
          color: 'var(--landing-text)',
        }}
      >
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--primary)' }}
        >
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-center text-2xl font-semibold tracking-tight">{event.title}</h1>
        <p className="mt-2 text-center text-sm" style={{ color: 'var(--landing-text-muted)' }}>
          This is a private event. Enter the access code from your invitation to continue.
        </p>

        <label className="mt-6 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
          Access code
        </label>
        <input
          type="text"
          autoComplete="one-time-code"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void unlock();
          }}
          placeholder="XXXX-XXXX"
          className="mt-2 w-full rounded-xl border px-4 py-3 font-mono text-base font-semibold tracking-wider outline-none"
          style={{
            borderColor: 'var(--landing-border)',
            background: 'var(--landing-page-bg)',
            color: 'var(--landing-text)',
          }}
        />

        {error ? (
          <p className="mt-3 text-center text-sm font-medium text-rose-600" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={unlocking || !code.trim()}
          onClick={() => void unlock()}
          className="landing-btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-bold disabled:opacity-50"
        >
          {unlocking ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
          {unlocking ? 'Checking…' : 'Unlock event'}
        </button>
      </div>
    </div>
  );
}
