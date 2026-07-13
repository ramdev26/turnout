import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { CheckInScannerPanel } from '../components/organizer/CheckInScannerPanel';
import { Lock } from 'lucide-react';
import { accentButtonStyleFor } from '../themes/flowUi';
import { APP_FLOW_UI } from '../components/flow/FlowPrimitives';

const STAFF_PIN_KEY = (eventId: string) => `turnout_staff_pin_${eventId}`;

export const StaffCheckInScanner: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const ui = APP_FLOW_UI;
  const [pin, setPin] = useState('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const verifyPin = useCallback(async (pinValue: string, showErrors = true) => {
    if (!eventId) return false;
    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await api.post<{ ok: boolean; eventTitle: string }>(`/api/events/${eventId}/checkin/verify-pin`, {
        staffPin: pinValue,
      });
      setEventTitle(res.eventTitle);
      sessionStorage.setItem(STAFF_PIN_KEY(eventId), pinValue);
      setStoredPin(pinValue);
      return true;
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      if (err?.error === 'invalid_staff_pin' || err?.error === 'checkin_unauthorized') {
        sessionStorage.removeItem(STAFF_PIN_KEY(eventId));
        setStoredPin(null);
      }
      if (showErrors) setUnlockError(err?.message || err?.error || 'Invalid PIN');
      return false;
    } finally {
      setUnlocking(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    const saved = sessionStorage.getItem(STAFF_PIN_KEY(eventId));
    if (saved) {
      setStoredPin(saved);
      void verifyPin(saved, false);
    }
  }, [eventId, verifyPin]);

  const handleUnlock = async () => {
    const ok = await verifyPin(pin.trim());
    if (ok) setPin('');
  };

  const signOutStaff = () => {
    if (eventId) sessionStorage.removeItem(STAFF_PIN_KEY(eventId));
    setStoredPin(null);
    setEventTitle(null);
  };

  if (!eventId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: ui.pageBg, color: ui.text }}>
        <p>Invalid check-in link.</p>
      </div>
    );
  }

  if (!storedPin) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
        style={{ background: ui.pageBg, color: ui.text }}
      >
        <div className="w-full max-w-md rounded-3xl border p-8" style={{ borderColor: ui.borderColor, background: ui.cardBg }}>
          <div className="flex items-center gap-3">
            <div
              className="grid h-12 w-12 place-items-center rounded-2xl"
              style={{ background: ui.accentSoft, color: ui.accent }}
            >
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Volunteer check-in</h1>
              <p className="text-sm" style={{ color: ui.textMuted }}>
                Enter the PIN from the organizer
              </p>
            </div>
          </div>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
            onKeyDown={(e) => e.key === 'Enter' && void handleUnlock()}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            className="mt-6 w-full rounded-2xl border px-5 py-4 text-center font-mono text-2xl tracking-[0.35em] outline-none focus:ring-2"
            style={{
              borderColor: ui.borderColor,
              background: ui.fieldBg,
              color: ui.text,
            }}
          />
          {unlockError && <p className="mt-3 text-center text-sm text-red-400">{unlockError}</p>}
          <button
            type="button"
            onClick={() => void handleUnlock()}
            disabled={unlocking || pin.length < 4}
            className="turnout-btn-accent mt-6 w-full rounded-2xl py-3.5 text-sm font-bold disabled:opacity-50"
            style={accentButtonStyleFor(ui)}
          >
            {unlocking ? 'Verifying…' : 'Start scanning'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]"
      style={{ background: ui.pageBg, color: ui.text }}
    >
      <header className="border-b px-4 py-4" style={{ borderColor: ui.borderColor }}>
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: ui.accent }}>
              Door check-in
            </p>
            <h1 className="text-lg font-semibold">{eventTitle || 'Event'}</h1>
          </div>
          <button type="button" onClick={signOutStaff} className="text-xs font-medium" style={{ color: ui.textMuted }}>
            Exit
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4">
        <CheckInScannerPanel eventId={eventId} staffPin={storedPin} />
      </main>
    </div>
  );
};
