import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Session, Speaker } from '../types';
import { OrganizerFlowShell } from '../components/organizer/OrganizerFlowShell';
import { FlowPage, FlowCard, FlowInput, FlowTextarea, FlowButton, FlowAlert } from '../components/flow/FlowPrimitives';
import { eventWorkspaceNav } from '../utils/organizerNav';
import { APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { cardMutedStyleFor } from '../themes/flowUi';

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
  const navLinks = useMemo(() => (eventId ? eventWorkspaceNav(eventId) : []), [eventId]);
  const ui = APP_FLOW_UI;

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
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: ui.accent, borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <OrganizerFlowShell title="Agenda & Speakers" subtitle="Add speakers and sessions." navLinks={navLinks} maxWidth="wide">
      <FlowPage className="max-w-6xl">
      {error && <FlowAlert variant="error">{error}</FlowAlert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <FlowCard>
          <h2 className="text-xl font-semibold" style={{ color: ui.text }}>Speakers</h2>
          <div className="mt-4 grid gap-3">
            <FlowInput value={spName} onChange={(e) => setSpName(e.target.value)} placeholder="Name" />
            <div className="grid gap-3 sm:grid-cols-2">
              <FlowInput value={spTitle} onChange={(e) => setSpTitle(e.target.value)} placeholder="Title (optional)" />
              <FlowInput value={spCompany} onChange={(e) => setSpCompany(e.target.value)} placeholder="Company (optional)" />
            </div>
            <FlowInput value={spAvatarUrl} onChange={(e) => setSpAvatarUrl(e.target.value)} placeholder="Avatar URL (optional)" />
            <FlowTextarea value={spBio} onChange={(e) => setSpBio(e.target.value)} placeholder="Bio (optional)" rows={3} />
            <FlowButton type="button" onClick={addSpeaker} disabled={!spName.trim()} className="w-full">
              Add speaker
            </FlowButton>
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
        </FlowCard>

        <FlowCard>
          <h2 className="text-xl font-semibold" style={{ color: ui.text }}>Sessions</h2>
          <div className="mt-4 grid gap-3">
            <FlowInput value={seTitle} onChange={(e) => setSeTitle(e.target.value)} placeholder="Session title" />
            <FlowTextarea value={seDescription} onChange={(e) => setSeDescription(e.target.value)} placeholder="Description (optional)" rows={3} />
            <div className="grid gap-3 sm:grid-cols-2">
              <FlowInput value={seStartsAt} onChange={(e) => setSeStartsAt(e.target.value)} type="datetime-local" />
              <FlowInput value={seEndsAt} onChange={(e) => setSeEndsAt(e.target.value)} type="datetime-local" />
            </div>
            <FlowInput value={seLocation} onChange={(e) => setSeLocation(e.target.value)} placeholder="Location (optional)" />
            <div className="rounded-xl border p-4" style={cardMutedStyleFor(ui)}>
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
            <FlowButton type="button" onClick={addSession} disabled={!seTitle.trim() || !seStartsAt || !seEndsAt} className="w-full">
              Add session
            </FlowButton>
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
        </FlowCard>
      </div>
      </FlowPage>
    </OrganizerFlowShell>
  );
};

