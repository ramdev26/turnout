import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { api } from '../../api/client';
import { Attendee } from '../../types';
import { parseQrCheckInPayload } from '../../utils/qrCheckIn';
import { APP_FLOW_UI } from '../flow/FlowPrimitives';
import { accentButtonStyleFor, cardMutedStyleFor, cardStyleFor, fieldClassFor, fieldStyleFor } from '../../themes/flowUi';
import { cn } from '../../utils/cn';
import { Camera, CheckCircle2, Keyboard, RefreshCw, ScanLine, XCircle } from 'lucide-react';

const READER_ID = 'checkin-qr-reader';
const SCAN_COOLDOWN_MS = 2800;

type CheckinResult = {
  ok: boolean;
  alreadyCheckedIn?: boolean;
  message?: string;
  attendee?: Attendee;
};

export type CheckInScannerPanelProps = {
  eventId: string;
  /** Organizer session — no PIN. Staff door mode sends staffPin on each check-in. */
  staffPin?: string | null;
  /** Per-volunteer browser session for scan history tracking. */
  volunteerSessionId?: string | null;
  className?: string;
  onCheckInSuccess?: (result: CheckinResult) => void;
};

export const CheckInScannerPanel: React.FC<CheckInScannerPanelProps> = ({
  eventId,
  staffPin = null,
  volunteerSessionId = null,
  className,
  onCheckInSuccess,
}) => {
  const ui = APP_FLOW_UI;
  const cardStyle = cardStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);

  const [lastAttendee, setLastAttendee] = useState<Attendee | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const qrRef = useRef<Html5Qrcode | null>(null);
  const readerIdRef = useRef(`${READER_ID}-${eventId}`);
  const processingRef = useRef(false);
  const lastScannedTokenRef = useRef<string | null>(null);
  const cooldownUntilRef = useRef(0);
  const staffPinRef = useRef(staffPin);
  staffPinRef.current = staffPin;
  const volunteerSessionIdRef = useRef(volunteerSessionId);
  volunteerSessionIdRef.current = volunteerSessionId;

  const playSuccessFeedback = () => {
    try {
      if (navigator.vibrate) navigator.vibrate(80);
    } catch {
      // ignore
    }
  };

  const submitCheckIn = useCallback(
    async (rawScan: string) => {
      if (!eventId || processingRef.current) return;

      const parsed = parseQrCheckInPayload(rawScan, eventId);
      if (parsed.error === 'empty' || parsed.error === 'invalid' || !parsed.qrToken) {
        setStatus('error');
        setStatusMsg('Unrecognized QR code. Scan the ticket QR from the confirmation email.');
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
        const body: { qrToken: string; staffPin?: string; volunteerSessionId?: string } = { qrToken: parsed.qrToken };
        if (staffPinRef.current) body.staffPin = staffPinRef.current;
        if (volunteerSessionIdRef.current) body.volunteerSessionId = volunteerSessionIdRef.current;

        const res = await api.post<CheckinResult>(`/api/events/${eventId}/checkin`, body);
        setLastAttendee(res.attendee || null);
        if (res.alreadyCheckedIn) {
          setStatus('warning');
          setStatusMsg(res.message || 'Already checked in');
        } else {
          setStatus('success');
          setStatusMsg(res.message || 'Checked in successfully');
          playSuccessFeedback();
        }
        setManualToken('');
        onCheckInSuccess?.(res);
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
    [eventId, onCheckInSuccess]
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
    if (qrRef.current) return;
    setCameraError(null);

    const readerId = readerIdRef.current;
    const reader = document.getElementById(readerId);
    if (!reader) {
      setCameraError('Scanner view not ready. Tap restart camera.');
      return;
    }

    const instance = new Html5Qrcode(readerId, { verbose: false });
    qrRef.current = instance;

    const onScan = (decodedText: string) => {
      void submitCheckIn(decodedText);
    };

    const config = {
      fps: 12,
      qrbox: (w: number, h: number) => {
        const edge = Math.min(w, h);
        const size = Math.floor(edge * 0.78);
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
        setCameraError('Using front camera. For best results, allow rear camera access.');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not access camera';
        setCameraError(
          message.includes('NotAllowed') || message.includes('Permission')
            ? 'Camera permission denied. Allow camera in browser settings or use manual entry.'
            : `Camera unavailable: ${message}`
        );
        qrRef.current = null;
        setShowManual(true);
      }
    }
  }, [submitCheckIn]);

  const restartCamera = async () => {
    setRestarting(true);
    await stopCamera();
    await startCamera();
    setRestarting(false);
    setStatus('idle');
    setStatusMsg('Camera restarted — align QR inside the frame');
  };

  useEffect(() => {
    const t = window.setTimeout(() => {
      void startCamera();
    }, 250);
    return () => {
      window.clearTimeout(t);
      void stopCamera();
    };
  }, [startCamera, stopCamera]);

  const statusBorder =
    status === 'success'
      ? ui.accent
      : status === 'warning'
        ? '#fbbf24'
        : status === 'error'
          ? '#f87171'
          : ui.borderColor;

  const statusBg =
    status === 'success'
      ? ui.accentSoft
      : status === 'warning'
        ? 'rgba(245, 158, 11, 0.12)'
        : status === 'error'
          ? 'rgba(248, 113, 113, 0.12)'
          : ui.cardMutedBg;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="relative overflow-hidden rounded-2xl border" style={cardStyle}>
        <div
          id={readerIdRef.current}
          className="min-h-[min(52vh,360px)] w-full bg-black sm:min-h-[min(48vh,420px)] [&>video]:!h-full [&>video]:!w-full [&>video]:object-cover"
        />
        {!cameraReady && !cameraError && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{ background: 'rgba(5, 46, 48, 0.92)' }}
          >
            <Camera className="h-8 w-8 animate-pulse" style={{ color: ui.accent }} />
            <p className="text-sm" style={{ color: ui.textMuted }}>
              Starting camera…
            </p>
          </div>
        )}
        {cameraReady && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
            <div
              className="aspect-square w-[min(72vw,280px)] rounded-2xl border-2 sm:w-[min(42vw,300px)]"
              style={{ borderColor: ui.accent, boxShadow: '0 0 0 9999px rgba(5, 46, 48, 0.42)' }}
            />
          </div>
        )}
        <div className="absolute right-3 top-3 z-10">
          <button
            type="button"
            onClick={() => void restartCamera()}
            disabled={restarting}
            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold backdrop-blur-sm disabled:opacity-50"
            style={{ ...cardMutedStyle, color: ui.text }}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', restarting && 'animate-spin')} />
            {restarting ? 'Restarting…' : 'Restart camera'}
          </button>
        </div>
      </div>

      {cameraError && (
        <p className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: '#fbbf24', background: 'rgba(245,158,11,0.12)', color: ui.text }}>
          {cameraError}
        </p>
      )}

      <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: statusBorder, background: statusBg }}>
        <div className="flex items-start gap-3">
          {status === 'success' && <CheckCircle2 className="h-6 w-6 shrink-0" style={{ color: ui.accent }} />}
          {status === 'warning' && <CheckCircle2 className="h-6 w-6 shrink-0 text-amber-400" />}
          {status === 'error' && <XCircle className="h-6 w-6 shrink-0 text-red-400" />}
          {status === 'idle' && <ScanLine className="h-6 w-6 shrink-0" style={{ color: ui.textMuted }} />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium" style={{ color: ui.text }}>
              {statusMsg || (cameraReady ? 'Align the ticket QR inside the frame' : 'Preparing scanner…')}
            </p>
            {lastAttendee && (
              <div className="mt-3">
                <p className="text-lg font-bold" style={{ color: ui.text }}>
                  {lastAttendee.fullName}
                </p>
                <p className="text-sm" style={{ color: ui.textMuted }}>
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
        className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold"
        style={{ ...cardStyle, color: ui.text }}
      >
        <Keyboard className="h-4 w-4" />
        {showManual ? 'Hide manual entry' : 'Enter code manually'}
      </button>

      {showManual && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submitCheckIn(manualToken)}
            placeholder="Paste QR token"
            className={cn(fieldClass, 'flex-1 font-mono text-sm')}
            style={fieldStyle}
          />
          <button
            type="button"
            onClick={() => void submitCheckIn(manualToken)}
            className="turnout-btn-accent shrink-0 rounded-xl px-5 py-3 text-sm font-semibold"
            style={accentButtonStyleFor(ui)}
          >
            Check in
          </button>
        </div>
      )}

      <p className="text-center text-xs" style={{ color: ui.textSubtle }}>
        Hold steady, brighten the guest&apos;s screen, and fill the frame with the QR code.
      </p>
    </div>
  );
};
