import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { api } from '../api/client';
import { OrganizerShell } from '../components/organizer/OrganizerShell';

export const StaffCheckInScanner: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const containerId = 'qr-reader-container';
  const eventLinks = [
    { to: '/dashboard', label: 'Dashboard', exact: true },
    { to: `/dashboard/events/${eventId}/settings`, label: 'Settings', exact: true },
    { to: `/dashboard/events/${eventId}/agenda`, label: 'Agenda' },
    { to: `/dashboard/events/${eventId}/checkin`, label: 'Check-in' },
    { to: `/dashboard/events/${eventId}/runbook`, label: 'Runbook' },
  ];

  useEffect(() => {
    if (!eventId) return;
    if (scannerRef.current) return;

    const scanner = new Html5QrcodeScanner(
      containerId,
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
      },
      false
    );

    scanner.render(
      async (decodedText) => {
        try {
          setError(null);
          setStatus('Checking in…');
          let qrToken = decodedText.trim();
          try {
            const parsed = JSON.parse(decodedText);
            if (parsed && typeof parsed.qrToken === 'string') {
              qrToken = parsed.qrToken;
            }
          } catch {
            // not JSON, treat as raw token
          }

          const res = await api.post<{ alreadyCheckedIn: boolean; checkedInAt: string }>(
            `/api/events/${eventId}/checkin`,
            { qrToken }
          );
          setLastResult(qrToken);
          setStatus(res.alreadyCheckedIn ? 'Already checked in' : 'Checked in successfully');
        } catch (e: any) {
          setError(e?.error || 'Check-in failed');
          setStatus(null);
        }
      },
      (errMsg) => {
        // Ignore continuous decode errors (common when scanning)
        if (!errMsg?.includes('NotFoundException')) {
          setError(errMsg);
        }
      }
    );

    scannerRef.current = scanner;
    return () => {
      scanner.clear().catch(() => {});
      scannerRef.current = null;
    };
  }, [eventId]);

  return (
    <OrganizerShell title="Staff check-in scanner" subtitle={`Event ID: ${eventId || 'unknown'}`} links={eventLinks}>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div className="flex items-center justify-end gap-4">
          <Link
            to={`/dashboard/events/${eventId}/checkin`}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
          >
            Back to check-in list
          </Link>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div id={containerId} className="h-[320px]" />
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-xs">
          <div className="font-bold text-neutral-700">Result</div>
          {status && <div className="mt-2 text-emerald-700">{status}</div>}
          {error && <div className="mt-2 text-red-600">{error}</div>}
          {lastResult && (
            <div className="mt-2 text-[11px] text-neutral-600">
              Last token:
              <div className="mt-1 break-all rounded-lg bg-neutral-900 p-2 font-mono text-neutral-100">{lastResult}</div>
            </div>
          )}
          {!status && !error && !lastResult && (
            <div className="mt-2 text-neutral-500">Point the camera at a ticket QR code to check in.</div>
          )}
        </div>
      </div>
    </OrganizerShell>
  );
};

