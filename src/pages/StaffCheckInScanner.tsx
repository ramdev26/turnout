import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { api } from '../api/client';
import { Attendee } from '../types';
import { CheckCircle2, Lock, ScanLine, XCircle } from 'lucide-react';
import { cn } from '../utils/cn';

const STAFF_PIN_KEY = (eventId: string) => `turnout_staff_pin_${eventId}`;

type CheckinResult = {
  ok: boolean;
  alreadyCheckedIn?: boolean;
  message?: string;
  attendee?: Attendee;
};

export const StaffCheckInScanner: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [pin, setPin] = useState('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [lastAttendee, setLastAttendee] = useState<Attendee | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [scanLocked, setScanLocked] = useState(false);

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const containerId = 'qr-reader-container';
  const scanCooldownRef = useRef(false);

  useEffect(() => {
    if (!eventId) return;
    const saved = sessionStorage.getItem(STAFF_PIN_KEY(eventId));
    if (saved) {
      setStoredPin(saved);
      void verifyPin(saved, false);
    }
  }, [eventId]);

  const verifyPin = async (pinValue: string, showErrors = true) => {
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
      if (showErrors) setUnlockError(err?.message || err?.error || 'Invalid PIN');
      sessionStorage.removeItem(STAFF_PIN_KEY(eventId));
      setStoredPin(null);
      return false;
    } finally {
      setUnlocking(false);
    }
  };

  const handleUnlock = async () => {
    const ok = await verifyPin(pin.trim());
    if (ok) setPin('');
  };

  const performCheckIn = useCallback(
    async (decodedText: string) => {
      if (!eventId || !storedPin || scanCooldownRef.current) return;

      scanCooldownRef.current = true;
      setScanLocked(true);
      setStatus('idle');
      setStatusMsg('Checking in…');

      let qrToken = decodedText.trim();
      try {
        const parsed = JSON.parse(decodedText);
        if (parsed && typeof parsed.qrToken === 'string') qrToken = parsed.qrToken;
        else if (parsed && typeof parsed.token === 'string') qrToken = parsed.token;
      } catch {
        // raw token
      }

      try {
        const res = await api.post<CheckinResult>(`/api/events/${eventId}/checkin`, {
          qrToken,
          staffPin: storedPin,
        });
        setLastAttendee(res.attendee || null);
        if (res.alreadyCheckedIn) {
          setStatus('warning');
          setStatusMsg(res.message || 'Already checked in');
        } else {
          setStatus('success');
          setStatusMsg(res.message || 'Checked in');
        }
      } catch (e: unknown) {
        const err = e as { message?: string; error?: string };
        setStatus('error');
        setStatusMsg(err?.message || err?.error || 'Check-in failed');
        setLastAttendee(null);
      }

      window.setTimeout(() => {
        scanCooldownRef.current = false;
        setScanLocked(false);
      }, 2500);
    },
    [eventId, storedPin]
  );

  useEffect(() => {
    if (!eventId || !storedPin) return;
    if (scannerRef.current) return;

    const scanner = new Html5QrcodeScanner(
      containerId,
      { fps: 10, qrbox: { width: 260, height: 260 }, rememberLastUsedCamera: true },
      false
    );

    scanner.render(
      (text) => void performCheckIn(text),
      (errMsg) => {
        if (errMsg && !String(errMsg).includes('NotFoundException')) {
          // ignore continuous scan noise
        }
      }
    );

    scannerRef.current = scanner;
    return () => {
      scanner.clear().catch(() => {});
      scannerRef.current = null;
    };
  }, [eventId, storedPin, performCheckIn]);

  const signOutStaff = () => {
    if (eventId) sessionStorage.removeItem(STAFF_PIN_KEY(eventId));
    setStoredPin(null);
    setEventTitle(null);
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
  };

  if (!storedPin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="flex items-center gap-3 text-white">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-500/20 text-teal-400">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Staff check-in</h1>
              <p className="text-sm text-white/60">Enter the 6-digit PIN from the organizer</p>
            </div>
          </div>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
            onKeyDown={(e) => e.key === 'Enter' && void handleUnlock()}
            inputMode="numeric"
            placeholder="••••••"
            className="mt-6 w-full rounded-2xl border border-white/15 bg-black/30 px-5 py-4 text-center font-mono text-2xl tracking-[0.35em] text-white outline-none focus:border-teal-500"
          />
          {unlockError && <p className="mt-3 text-center text-sm text-red-400">{unlockError}</p>}
          <button
            type="button"
            onClick={() => void handleUnlock()}
            disabled={unlocking || pin.length < 4}
            className="mt-6 w-full rounded-2xl bg-teal-500 py-3.5 text-sm font-bold text-white hover:bg-teal-400 disabled:opacity-50"
          >
            {unlocking ? 'Verifying…' : 'Start scanning'}
          </button>
          <p className="mt-6 text-center text-xs text-white/40">
            Organizer?{' '}
            <Link to="/login" className="text-teal-400 underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-white/10 px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-teal-400">Door check-in</p>
            <h1 className="text-lg font-semibold">{eventTitle || 'Event'}</h1>
          </div>
          <button type="button" onClick={signOutStaff} className="text-xs font-medium text-white/50 hover:text-white">
            Exit
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        <div
          className={cn(
            'overflow-hidden rounded-3xl border',
            scanLocked ? 'pointer-events-none opacity-70' : 'border-white/10'
          )}
        >
          <div id={containerId} />
        </div>

        <div
          className={cn(
            'mt-6 rounded-2xl border p-5 transition-colors',
            status === 'success' && 'border-emerald-500/40 bg-emerald-500/10',
            status === 'warning' && 'border-amber-500/40 bg-amber-500/10',
            status === 'error' && 'border-red-500/40 bg-red-500/10',
            status === 'idle' && 'border-white/10 bg-white/5'
          )}
        >
          <div className="flex items-start gap-3">
            {status === 'success' && <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />}
            {status === 'warning' && <CheckCircle2 className="h-6 w-6 shrink-0 text-amber-400" />}
            {status === 'error' && <XCircle className="h-6 w-6 shrink-0 text-red-400" />}
            {status === 'idle' && <ScanLine className="h-6 w-6 shrink-0 text-white/40" />}
            <div>
              <p className="text-sm font-medium text-white/90">{statusMsg || 'Point camera at ticket QR code'}</p>
              {lastAttendee && (
                <div className="mt-3">
                  <p className="text-lg font-bold">{lastAttendee.fullName}</p>
                  <p className="text-sm text-white/60">
                    {lastAttendee.ticketName} · {lastAttendee.email}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {eventId && (
          <p className="mt-6 text-center text-xs text-white/30">
            Full list available to the organizer in{' '}
            <Link to={`/dashboard/events/${eventId}/checkin`} className="text-teal-500/80 underline">
              dashboard check-in
            </Link>
          </p>
        )}
      </main>
    </div>
  );
};
