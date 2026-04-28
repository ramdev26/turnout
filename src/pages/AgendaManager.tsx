import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Session, Speaker } from '../types';
import { OrganizerShell } from '../components/organizer/OrganizerShell';

export const AgendaManager: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // speaker form
  const [spName, setSpName] = useState('');
  const [spTitle, setSpTitle] = useState('');
  const [spCompany, setSpCompany] = useState('');
  const [spBio, setSpBio] = useState('');
  const [spAvatarUrl, setSpAvatarUrl] = useState('');

  // session form
  const [seTitle, setSeTitle] = useState('');
  const [seDescription, setSeDescription] = useState('');
  const [seStartsAt, setSeStartsAt] = useState('');
  const [seEndsAt, setSeEndsAt] = useState('');
  const [seLocation, setSeLocation] = useState('');
  const [seSpeakerIds, setSeSpeakerIds] = useState<string[]>([]);

  const speakerById = useMemo(() => Object.fromEntries(speakers.map((s) => [s.id, s])), [speakers]);
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

  const loadAll = async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const [sp, se] = await Promise.all([
        api.get<{ speakers: Speaker[] }>(`/api/events/${eventId}/speakers`),
        api.get<{ sessions: Session[] }>(`/api/events/${eventId}/sessions`),
      ]);
      setSpeakers(sp.speakers);
      setSessions(se.sessions);
    } catch (e: any) {
      setError(e?.error || 'Failed to load agenda');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const addSpeaker = async () => {
    if (!eventId) return;
    await api.post(`/api/events/${eventId}/speakers`, {
      name: spName,
      title: spTitle,
      company: spCompany,
      bio: spBio,
      avatarUrl: spAvatarUrl,
    });
    setSpName('');
    setSpTitle('');
    setSpCompany('');
    setSpBio('');
    setSpAvatarUrl('');
    await loadAll();
  };

  const deleteSpeaker = async (speakerId: string) => {
    if (!eventId) return;
    await api.post(`/api/events/${eventId}/speakers/${speakerId}/delete`);
    await loadAll();
  };

  const addSession = async () => {
    if (!eventId) return;
    await api.post(`/api/events/${eventId}/sessions`, {
      title: seTitle,
      description: seDescription,
      startsAt: seStartsAt,
      endsAt: seEndsAt,
      location: seLocation,
      speakerIds: seSpeakerIds,
    });
    setSeTitle('');
    setSeDescription('');
    setSeStartsAt('');
    setSeEndsAt('');
    setSeLocation('');
    setSeSpeakerIds([]);
    await loadAll();
  };

  const deleteSession = async (sessionId: string) => {
    if (!eventId) return;
    await api.post(`/api/events/${eventId}/sessions/${sessionId}/delete`);
    await loadAll();
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <OrganizerShell title="Agenda & Speakers" subtitle="Add speakers and sessions (Backstage-style)." links={eventLinks}>
      <div className="mx-auto max-w-6xl py-2">
      <div className="mb-6 flex items-start justify-between gap-4">
        <Link
          to={`/dashboard/events/${eventId}/settings`}
          className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
        >
          Back to settings
        </Link>
      </div>

      {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Speakers</h2>
          <div className="mt-4 grid gap-3">
            <input
              value={spName}
              onChange={(e) => setSpName(e.target.value)}
              placeholder="Name"
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={spTitle}
                onChange={(e) => setSpTitle(e.target.value)}
                placeholder="Title (optional)"
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm"
              />
              <input
                value={spCompany}
                onChange={(e) => setSpCompany(e.target.value)}
                placeholder="Company (optional)"
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm"
              />
            </div>
            <input
              value={spAvatarUrl}
              onChange={(e) => setSpAvatarUrl(e.target.value)}
              placeholder="Avatar URL (optional)"
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm"
            />
            <textarea
              value={spBio}
              onChange={(e) => setSpBio(e.target.value)}
              placeholder="Bio (optional)"
              rows={3}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addSpeaker}
              disabled={!spName.trim()}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 py-3 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
            >
              Add speaker
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {speakers.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">No speakers yet.</div>
            ) : (
              speakers.map((s) => (
                <div key={s.id} className="flex items-start justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-4">
                  <div>
                    <div className="text-sm font-extrabold text-neutral-900">{s.name}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {[s.title, s.company].filter(Boolean).join(' • ') || '—'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteSpeaker(s.id)}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Sessions</h2>
          <div className="mt-4 grid gap-3">
            <input
              value={seTitle}
              onChange={(e) => setSeTitle(e.target.value)}
              placeholder="Session title"
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm"
            />
            <textarea
              value={seDescription}
              onChange={(e) => setSeDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={3}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={seStartsAt}
                onChange={(e) => setSeStartsAt(e.target.value)}
                type="datetime-local"
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm"
              />
              <input
                value={seEndsAt}
                onChange={(e) => setSeEndsAt(e.target.value)}
                type="datetime-local"
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm"
              />
            </div>
            <input
              value={seLocation}
              onChange={(e) => setSeLocation(e.target.value)}
              placeholder="Location (optional)"
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm"
            />
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-xs font-extrabold uppercase tracking-wider text-neutral-500">Speakers for this session</div>
              <div className="mt-3 flex flex-col gap-2">
                {speakers.length === 0 ? (
                  <div className="text-sm text-neutral-600">Add speakers first.</div>
                ) : (
                  speakers.map((sp) => {
                    const checked = seSpeakerIds.includes(sp.id);
                    return (
                      <label key={sp.id} className="flex items-center gap-2 text-sm text-neutral-800">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSeSpeakerIds((prev) =>
                              e.target.checked ? [...prev, sp.id] : prev.filter((id) => id !== sp.id)
                            );
                          }}
                        />
                        <span className="font-semibold">{sp.name}</span>
                        <span className="text-xs text-neutral-500">{speakerById[sp.id]?.company || ''}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={addSession}
              disabled={!seTitle.trim() || !seStartsAt || !seEndsAt}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 py-3 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
            >
              Add session
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {sessions.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">No sessions yet.</div>
            ) : (
              sessions.map((s) => (
                <div key={s.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-extrabold text-neutral-900">{s.title}</div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {new Date(s.startsAt).toLocaleString()} → {new Date(s.endsAt).toLocaleString()}
                        {s.location ? ` • ${s.location}` : ''}
                      </div>
                      <div className="mt-2 text-xs text-neutral-600">
                        Speakers:{' '}
                        {s.speakerIds.length
                          ? s.speakerIds.map((id) => speakerById[id]?.name || 'Unknown').join(', ')
                          : '—'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteSession(s.id)}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </div>
    </OrganizerShell>
  );
};

