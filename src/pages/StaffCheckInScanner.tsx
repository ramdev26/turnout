import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { api } from '../api/client';
import { Attendee } from '../types';
import { parseQrCheckInPayload } from '../utils/qrCheckIn';
import { CheckCircle2, Lock, ScanLine, XCircle, Camera, Keyboard } from 'lucide-react';
import { cn } from '../utils/cn';
import { FLOW_FONT_FAMILY } from '../themes/flowUi';

const STAFF_PIN_KEY = (eventId: string) => `turnout_staff_pin_${eventId}`;
const READER_ID = 'staff-qr-reader';
const SCAN_COOLDOWN_MS = 2800;

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
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [showManual, setShowManual] = useState(false);

  const qrRef = useRef<Html5Qrcode | null>(null);
  const storedPinRef = useRef<string | null>(null);
  const processingRef = useRef(false);
  const lastScannedTokenRef = useRef<string | null>(null);
  const cooldownUntilRef = useRef(0);

  useEffect(() => {
    storedPinRef.current = storedPin;
  }, [storedPin]);

  useEffect(() => {
    if (!eventId) return;
    const saved = sessionStorage.getItem(STAFF_PIN_KEY(eventId));
    if (saved) {
      setStoredPin(saved);
      storedPinRef.current = saved;
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
      storedPinRef.current = pinValue;
      return true;
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      if (err?.error === 'invalid_staff_pin' || err?.error === 'checkin_unauthorized') {
        sessionStorage.removeItem(STAFF_PIN_KEY(eventId));
        setStoredPin(null);
        storedPinRef.current = null;
      }
      if (showErrors) setUnlockError(err?.message || err?.error || 'Invalid PIN');
      return false;
    } finally {
      setUnlocking(false);
    }
  };

  const handleUnlock = async () => {
    const ok = await verifyPin(pin.trim());
    if (ok) setPin('');
  };

  const playSuccessFeedback = () => {
    try {
      if (navigator.vibrate) navigator.vibrate(80);
    } catch {
      // ignore
    }
  };

  const submitCheckIn = useCallback(
    async (rawScan: string) => {
      if (!eventId || !storedPinRef.current || processingRef.current) return;

      const parsed = parseQrCheckInPayload(rawScan, eventId);
      if (parsed.error === 'empty' || parsed.error === 'invalid' || !parsed.qrToken) {
        setStatus('error');
        setStatusMsg('Unrecognized QR code. Scan the ticket QR from the confirmation page.');
        setLastAttendee(null);
        return;
      }
      if (parsed.error === 'wrong_event') {
        setStatus('error');
        setStatusMsg('This ticket belongs to a different event.');
        setLastAttendee(null);
        return;
      }

      const now = Date.now();
      if (parsed.qrToken === lastScannedTokenRef.current && now < cooldownUntilRef.current) {
        return;
      }

      processingRef.current = true;
      lastScannedTokenRef.current = parsed.qrToken;
      cooldownUntilRef.current = now + SCAN_COOLDOWN_MS;
      setStatus('idle');
      setStatusMsg('Checking in…');

      try {
        const res = await api.post<CheckinResult>(`/api/events/${eventId}/checkin`, {
          qrToken: parsed.qrToken,
          staffPin: storedPinRef.current,
        });
        setLastAttendee(res.attendee || null);
        if (res.alreadyCheckedIn) {
          setStatus('warning');
          setStatusMsg(res.message || 'Already checked in');
        } else {
          setStatus('success');
          setStatusMsg(res.message || 'Checked in');
          playSuccessFeedback();
        }
      } catch (e: unknown) {
        const err = e as { message?: string; error?: string };
        setStatus('error');
        setStatusMsg(err?.message || err?.error || 'Check-in failed');
        setLastAttendee(null);
        lastScannedTokenRef.current = null;
      } finally {
        window.setTimeout(() => {
          processingRef.current = false;
        }, SCAN_COOLDOWN_MS);
      }
    },
    [eventId]
  );

  const stopCamera = useCallback(async () => {
    const instance = qrRef.current;
    if (!instance) return;
    try {
      if (instance.getState() === Html5QrcodeScannerState.SCANNING) {
        await instance.stop();
      }
      await instance.clear();
    } catch {
      // ignore teardown errors
    }
    qrRef.current = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (!storedPinRef.current || qrRef.current) return;
    setCameraError(null);

    const reader = document.getElementById(READER_ID);
    if (!reader) {
      setCameraError('Scanner view not ready. Refresh the page.');
      return;
    }

    const instance = new Html5Qrcode(READER_ID, { verbose: false });
    qrRef.current = instance;

    const onScan = (decodedText: string) => {
      void submitCheckIn(decodedText);
    };

    const config = {
      fps: 12,
      qrbox: (w: number, h: number) => {
        const edge = Math.min(w, h);
        const size = Math.floor(edge * 0.72);
        return { width: size, height: size };
      },
      aspectRatio: 1,
      disableFlip: false,
    };

    const tryStart = async (constraints: { facingMode: string }) => {
      await instance.start(constraints, config, onScan, () => {});
    };

    try {
      await tryStart({ facingMode: 'environment' });
      setCameraReady(true);
    } catch {
      try {
        await tryStart({ facingMode: 'user' });
        setCameraReady(true);
        setCameraError('Using front camera. For best results, use the rear camera if available.');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not access camera';
        setCameraError(
          message.includes('NotAllowed') || message.includes('Permission')
            ? 'Camera permission denied. Allow camera access in browser settings, or use manual entry below.'
            : `Camera unavailable: ${message}`
        );
        qrRef.current = null;
        setShowManual(true);
      }
    }
  }, [submitCheckIn]);

  useEffect(() => {
    if (!storedPin) return;
    const t = window.setTimeout(() => {
      void startCamera();
    }, 300);
    return () => {
      window.clearTimeout(t);
      void stopCamera();
    };
  }, [storedPin, startCamera, stopCamera]);

  const signOutStaff = () => {
    void stopCamera();
    if (eventId) sessionStorage.removeItem(STAFF_PIN_KEY(eventId));
    setStoredPin(null);
    storedPinRef.current = null;
    setEventTitle(null);
  };

  if (!storedPin) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4"
        style={{ fontFamily: FLOW_FONT_FAMILY }}
      >
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="flex items-center gap-3 text-white">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-500/20 text-teal-400">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Staff check-in</h1>
              <p className="text-sm text-white/60">Enter the PIN from the organizer</p>
            </div>
          </div>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
            onKeyDown={(e) => e.key === 'Enter' && void handleUnlock()}
            inputMode="numeric"
            autoComplete="one-time-code"
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white" style={{ fontFamily: FLOW_FONT_FAMILY }}>
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

      <main className="mx-auto max-w-lg px-4 py-4">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black">
          <div id={READER_ID} className="min-h-[min(62vh,420px)] w-full [&>video]:object-cover" />
          {!cameraReady && !cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-900/90">
              <Camera className="h-8 w-8 animate-pulse text-teal-400" />
              <p className="text-sm text-white/70">Starting camera…</p>
            </div>
          )}
          {cameraReady && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-56 w-56 rounded-2xl border-2 border-teal-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
            </div>
          )}
        </div>

        {cameraError && (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {cameraError}
          </p>
        )}

        <div
          className={cn(
            'mt-4 rounded-2xl border p-5 transition-colors',
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
            {status === 'idle' && <ScanLine className="h-6 w-6 shrink-0 text-teal-400/80" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white/90">
                {statusMsg || (cameraReady ? 'Align QR inside the frame' : 'Preparing scanner…')}
              </p>
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

        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 py-3 text-sm font-semibold text-white/80"
        >
          <Keyboard className="h-4 w-4" />
          {showManual ? 'Hide manual entry' : 'Enter code manually'}
        </button>

        {showManual && (
          <div className="mt-3 flex gap-2">
            <input
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submitCheckIn(manualToken)}
              placeholder="Paste token or scan text"
              className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-mono text-sm text-white outline-none focus:border-teal-500"
            />
            <button
              type="button"
              onClick={() => void submitCheckIn(manualToken)}
              className="rounded-xl bg-teal-500 px-4 py-3 text-sm font-bold text-white"
            >
              Go
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-white/30">
          Tip: Hold the phone steady, brighten the screen, and fill the frame with the QR.
        </p>
      </main>
    </div>
  );
};
