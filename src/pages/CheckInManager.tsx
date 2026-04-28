import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Attendee } from '../types';
import { OrganizerShell } from '../components/organizer/OrganizerShell';

export const CheckInManager: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const checkedInCount = useMemo(() => attendees.filter((a) => a.checkedInAt).length, [attendees]);
  const eventLinks = useMemo(
    () => [
      { to: '/dashboard', label: 'Dashboard', exact: true },
      { to: `/dashboard/events/${eventId}/settings`, label: 'Settings', exact: true },
      { to: `/dashboard/events/${eventId}/agenda`, label: 'Agenda' },
      { to: `/dashboard/events/${eventId}/checkin`, label: 'Check-in' },
      { to: `/dashboard/events/${eventId}/runbook`, label: 'Runbook' },
    ],
    [eventId]
  );

  const load = async () => {
    if (!eventId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get<{ attendees: Attendee[] }>(`/api/events/${eventId}/attendees?limit=200&q=${encodeURIComponent(q)}`);
      setAttendees(res.attendees);
    } catch (e: any) {
      setErr(e?.error || 'Failed to load attendees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const checkIn = async () => {
    if (!eventId) return;
    setMsg(null);
    setErr(null);
    const token = qrToken.trim();
    if (!token) return;
    try {
      const res = await api.post<{ ok: boolean; alreadyCheckedIn: boolean; checkedInAt: string }>(`/api/events/${eventId}/checkin`, {
        qrToken: token,
      });
      setMsg(res.alreadyCheckedIn ? 'Already checked in' : 'Checked in successfully');
      setQrToken('');
      await load();
    } catch (e: any) {
      setErr(e?.error || 'Check-in failed');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <OrganizerShell
      title="Attendees & Check-in"
      subtitle={`Checked in: ${checkedInCount} / ${attendees.length}`}
      links={eventLinks}
    >
      <div className="mx-auto max-w-6xl py-2">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex gap-2">
          <a
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
            href={`/api/events/${eventId}/attendees.csv`}
            target="_blank"
            rel="noreferrer"
          >
            Export CSV
          </a>
          <Link
            to={`/dashboard/events/${eventId}/settings`}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
          >
            Back to settings
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Check-in</h2>
          <p className="mt-1 text-sm text-neutral-500">Paste/scan a QR token and mark the attendee as checked-in.</p>
          <div className="mt-4 flex gap-2">
            <input
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              placeholder="QR token"
              className="flex-1 rounded-lg border border-neutral-200 px-4 py-2 text-sm"
            />
            <button
              type="button"
              onClick={checkIn}
              className="rounded-lg bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-105"
            >
              Check in
            </button>
          </div>
          {msg && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{msg}</div>}
          {err && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{err}</div>}

          <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
            Tip: QR tokens are shown on the order success page for now. Next we’ll generate real QR images.
          </div>
        </div>

        <div className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Attendees</h2>
            <button
              type="button"
              onClick={load}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
            >
              Refresh
            </button>
          </div>
          <div className="mt-4 flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, ticket, token…"
              className="flex-1 rounded-lg border border-neutral-200 px-4 py-2 text-sm"
            />
            <button
              type="button"
              onClick={load}
              className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
            >
              Search
            </button>
          </div>

          <div className="mt-5 max-h-[520px] overflow-auto rounded-xl border border-neutral-200">
            {attendees.length === 0 ? (
              <div className="p-4 text-sm text-neutral-600">No attendees found.</div>
            ) : (
              <div className="divide-y divide-neutral-200">
                {attendees.map((a) => (
                  <div key={a.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-extrabold text-neutral-900">{a.fullName}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {a.email} {a.phone ? `• ${a.phone}` : ''} • {a.ticketName}
                        </div>
                        <div className="mt-2 rounded-lg bg-neutral-900 p-2 font-mono text-[11px] text-neutral-200">{a.qrToken}</div>
                      </div>
                      <div className="text-right">
                        {a.checkedInAt ? (
                          <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">Checked in</div>
                        ) : (
                          <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800">Not checked in</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </OrganizerShell>
  );
};

