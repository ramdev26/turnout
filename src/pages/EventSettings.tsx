import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Attendee, Event, Session, Speaker, Ticket } from '../types';
import { slugify } from '../utils/slug';
import { formatLKR } from '../utils/money';
import { OrganizerShell } from '../components/organizer/OrganizerShell';

export const EventSettings: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [savingTicket, setSavingTicket] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [savingTicketDesign, setSavingTicketDesign] = useState(false);
  const [ticketPdfTemplateId, setTicketPdfTemplateId] = useState<'classic' | 'midnight' | 'sunset'>('classic');
  const [ticketPdfPrimaryColor, setTicketPdfPrimaryColor] = useState('#4f46e5');
  const [ticketPdfAccentColor, setTicketPdfAccentColor] = useState('#10b981');
  const [ticketPdfBadgeText, setTicketPdfBadgeText] = useState('VIP ACCESS');
  const [ticketPdfFooterNote, setTicketPdfFooterNote] = useState('Please bring this ticket and a valid ID.');
  const [ticketForm, setTicketForm] = useState({
    name: '',
    price: 0,
    quantity: 100,
    description: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const res = await api.get<{ event: Event }>(`/api/events/${eventId}`);
        setEvent(res.event);
        setSlug(res.event.slug);
        setTicketPdfTemplateId((res.event.customization?.ticketPdfTemplateId as 'classic' | 'midnight' | 'sunset') || 'classic');
        setTicketPdfPrimaryColor(res.event.customization?.ticketPdfPrimaryColor || '#4f46e5');
        setTicketPdfAccentColor(res.event.customization?.ticketPdfAccentColor || '#10b981');
        setTicketPdfBadgeText(res.event.customization?.ticketPdfBadgeText || 'VIP ACCESS');
        setTicketPdfFooterNote(res.event.customization?.ticketPdfFooterNote || 'Please bring this ticket and a valid ID.');
        const [ticketsRes, speakersRes, sessionsRes, attendeesRes] = await Promise.all([
          api.get<{ tickets: Ticket[] }>(`/api/events/${eventId}/tickets`),
          api.get<{ speakers: Speaker[] }>(`/api/events/${eventId}/speakers`),
          api.get<{ sessions: Session[] }>(`/api/events/${eventId}/sessions`),
          api.get<{ attendees: Attendee[] }>(`/api/events/${eventId}/attendees?limit=1000`),
        ]);
        setTickets(ticketsRes.tickets);
        setSpeakers(speakersRes.speakers);
        setSessions(sessionsRes.sessions);
        setAttendees(attendeesRes.attendees);
      } catch (e: any) {
        setError(e?.error || 'Failed to load event');
      }
    })();
  }, [eventId]);

  const publicUrl = useMemo(() => (slug ? `/e/${slug}` : ''), [slug]);
  const staffCheckInUrl = useMemo(() => `/staff/checkin/${eventId}`, [eventId]);
  const soldTickets = useMemo(() => tickets.reduce((sum, t) => sum + t.sold, 0), [tickets]);
  const totalRevenue = useMemo(() => tickets.reduce((sum, t) => sum + t.sold * t.price, 0), [tickets]);
  const checkedInCount = useMemo(() => attendees.filter((a) => !!a.checkedInAt).length, [attendees]);
  const checkInRate = soldTickets > 0 ? Math.round((checkedInCount / soldTickets) * 100) : 0;
  const soldOutTickets = useMemo(() => tickets.filter((t) => t.quantity > 0 && t.sold >= t.quantity).length, [tickets]);
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

  const readinessChecklist = useMemo(
    () => [
      { label: 'Public URL is set', done: slugify(slug) === slug && slug.length >= 3 },
      { label: 'At least one ticket type', done: tickets.length > 0 },
      { label: 'At least one speaker', done: speakers.length > 0 },
      { label: 'At least one session', done: sessions.length > 0 },
      { label: 'Event is published', done: event?.status === 'published' },
    ],
    [event?.status, sessions.length, slug, speakers.length, tickets.length]
  );
  const readinessScore = Math.round((readinessChecklist.filter((x) => x.done).length / readinessChecklist.length) * 100);

  const save = async () => {
    if (!eventId) return;
    setSaving(true);
    setError(null);
    try {
      const next = slugify(slug);
      const res = await api.post<{ slug: string }>(`/api/events/${eventId}/slug`, { slug: next });
      setSlug(res.slug);
      if (event) setEvent({ ...event, slug: res.slug });
      window.open(`/e/${res.slug}`, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setError(e?.error || 'Failed to update slug');
    } finally {
      setSaving(false);
    }
  };

  const updateEventStatus = async (nextStatus: 'draft' | 'published' | 'cancelled') => {
    if (!eventId || !event) return;
    setError(null);
    try {
      const res = await api.post<{ status: Event['status'] }>(`/api/events/${eventId}/status`, { status: nextStatus });
      setEvent({ ...event, status: res.status });
    } catch (e: any) {
      setError(e?.message || e?.error || 'Failed to update event status');
    }
  };

  const duplicateEvent = async () => {
    if (!eventId) return;
    setError(null);
    try {
      const res = await api.post<{ eventId: string; slug: string }>(`/api/events/${eventId}/duplicate`);
      navigate(`/dashboard/events/${res.eventId}/settings`);
    } catch (e: any) {
      setError(e?.error || 'Failed to duplicate event');
    }
  };

  const copyStaffLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${staffCheckInUrl}`);
      setCopyMsg('Staff check-in link copied');
    } catch {
      setCopyMsg('Could not copy link');
    } finally {
      window.setTimeout(() => setCopyMsg(null), 2500);
    }
  };

  const startEditTicket = (ticket: Ticket) => {
    setEditingTicketId(ticket.id);
    setTicketForm({
      name: ticket.name,
      price: ticket.price,
      quantity: ticket.quantity,
      description: ticket.description || '',
    });
  };

  const resetTicketForm = () => {
    setEditingTicketId(null);
    setTicketForm({
      name: '',
      price: 0,
      quantity: 100,
      description: '',
    });
  };

  const refreshTickets = async () => {
    if (!eventId) return;
    const res = await api.get<{ tickets: Ticket[] }>(`/api/events/${eventId}/tickets`);
    setTickets(res.tickets);
  };

  const saveTicket = async () => {
    if (!eventId) return;
    setSavingTicket(true);
    setError(null);
    try {
      if (!ticketForm.name.trim()) {
        setError('Ticket name is required');
        return;
      }
      if (editingTicketId) {
        await api.post(`/api/events/${eventId}/tickets/${editingTicketId}`, {
          name: ticketForm.name,
          price: ticketForm.price,
          quantity: ticketForm.quantity,
          description: ticketForm.description || undefined,
        });
      } else {
        await api.post(`/api/events/${eventId}/tickets`, {
          name: ticketForm.name,
          price: ticketForm.price,
          quantity: ticketForm.quantity,
          description: ticketForm.description || undefined,
        });
      }
      await refreshTickets();
      resetTicketForm();
    } catch (e: any) {
      setError(e?.error || 'Failed to save ticket');
    } finally {
      setSavingTicket(false);
    }
  };

  const deleteTicket = async (ticketId: string) => {
    if (!eventId) return;
    setError(null);
    try {
      await api.post(`/api/events/${eventId}/tickets/${ticketId}/delete`);
      await refreshTickets();
      if (editingTicketId === ticketId) resetTicketForm();
    } catch (e: any) {
      setError(e?.error || 'Failed to delete ticket');
    }
  };

  const saveTicketDesign = async () => {
    if (!eventId || !event) return;
    setSavingTicketDesign(true);
    setError(null);
    try {
      const res = await api.post<{ customization: Event['customization'] }>(`/api/events/${eventId}/ticket-design`, {
        templateId: ticketPdfTemplateId,
        primaryColor: ticketPdfPrimaryColor,
        accentColor: ticketPdfAccentColor,
        badgeText: ticketPdfBadgeText,
        footerNote: ticketPdfFooterNote,
      });
      setEvent({ ...event, customization: { ...event.customization, ...res.customization } });
    } catch (e: any) {
      setError(e?.error || 'Failed to save ticket design');
    } finally {
      setSavingTicketDesign(false);
    }
  };

  if (!event) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="text-lg font-bold">Event settings</div>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : <p className="mt-3 text-sm text-neutral-500">Loading…</p>}
          <div className="mt-6">
            <Link className="text-sm font-semibold text-indigo-600 hover:text-indigo-700" to="/dashboard">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <OrganizerShell title="Event settings" subtitle={event.title} links={eventLinks}>
      <div className="mx-auto max-w-6xl py-2">
      <div className="mb-6 flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
        >
          Back to dashboard
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
            <h2 className="text-lg font-extrabold text-neutral-900">Public website</h2>
            <p className="mt-1 text-sm text-neutral-500">Edit your public URL and open the event website.</p>

            <div className="mt-6 flex flex-col gap-2">
              <label className="text-sm font-semibold">Public URL slug</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="rounded-lg border border-neutral-200 px-4 py-2 focus:border-indigo-500 focus:outline-none"
              />
              <div className="text-xs text-neutral-500">
                Public link: <span className="font-mono">{publicUrl}</span>
              </div>
            </div>

            {error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save slug'}
              </button>
              <button
                type="button"
                onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}
                className="rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
              >
                Open website
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
            <h2 className="text-lg font-extrabold text-neutral-900">Ticket categories</h2>
            <p className="mt-1 text-sm text-neutral-500">Add new ticket tiers or edit existing ones even after publishing.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                value={ticketForm.name}
                onChange={(e) => setTicketForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ticket name"
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
              />
              <input
                value={ticketForm.price}
                onChange={(e) => setTicketForm((prev) => ({ ...prev, price: Number(e.target.value) }))}
                type="number"
                min={0}
                step="0.01"
                placeholder="Price"
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
              />
              <input
                value={ticketForm.quantity}
                onChange={(e) => setTicketForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
                type="number"
                min={1}
                placeholder="Quantity"
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
              />
              <input
                value={ticketForm.description}
                onChange={(e) => setTicketForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Description (optional)"
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={saveTicket}
                disabled={savingTicket}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingTicket ? 'Saving…' : editingTicketId ? 'Update Ticket' : 'Add Ticket'}
              </button>
              {editingTicketId && (
                <button
                  type="button"
                  onClick={resetTicketForm}
                  className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {tickets.length === 0 ? (
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">No tickets yet.</div>
              ) : (
                tickets.map((ticket) => (
                  <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    <div>
                      <div className="text-sm font-bold text-neutral-900">
                        {ticket.name} • LKR {ticket.price.toFixed(2)}
                      </div>
                      <div className="text-xs text-neutral-500">
                        Qty: {ticket.quantity} • Sold: {ticket.sold}
                        {ticket.description ? ` • ${ticket.description}` : ''}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditTicket(ticket)}
                        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTicket(ticket.id)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
            <h2 className="text-lg font-extrabold text-neutral-900">Ticket PDF designer</h2>
            <p className="mt-1 text-sm text-neutral-500">Build a signature look with prebuilt templates, custom badge text, and a live preview.</p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                { id: 'classic', title: 'Classic Glow', desc: 'Clean white ticket with brand gradient header.' },
                { id: 'midnight', title: 'Midnight Neon', desc: 'Dark premium style for nightlife or concerts.' },
                { id: 'sunset', title: 'Sunset Festival', desc: 'Warm vibrant palette for outdoor/festival events.' },
              ].map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setTicketPdfTemplateId(tpl.id as 'classic' | 'midnight' | 'sunset')}
                  className={`rounded-xl border p-4 text-left transition ${
                    ticketPdfTemplateId === tpl.id ? 'border-indigo-500 bg-indigo-50' : 'border-neutral-200 bg-white hover:bg-neutral-50'
                  }`}
                >
                  <div className="text-sm font-extrabold text-neutral-900">{tpl.title}</div>
                  <div className="mt-1 text-xs text-neutral-500">{tpl.desc}</div>
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Primary color</label>
                <input
                  type="color"
                  value={ticketPdfPrimaryColor}
                  onChange={(e) => setTicketPdfPrimaryColor(e.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-neutral-200 bg-white p-1"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Accent color</label>
                <input
                  type="color"
                  value={ticketPdfAccentColor}
                  onChange={(e) => setTicketPdfAccentColor(e.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-neutral-200 bg-white p-1"
                />
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Badge text</label>
                <input
                  value={ticketPdfBadgeText}
                  onChange={(e) => setTicketPdfBadgeText(e.target.value.slice(0, 40))}
                  placeholder="VIP ACCESS"
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Footer note</label>
                <input
                  value={ticketPdfFooterNote}
                  onChange={(e) => setTicketPdfFooterNote(e.target.value.slice(0, 160))}
                  placeholder="Please bring this ticket and a valid ID."
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div
              className={`mt-5 overflow-hidden rounded-2xl border ${
                ticketPdfTemplateId === 'midnight' ? 'border-neutral-700 bg-neutral-900' : 'border-neutral-200 bg-white'
              }`}
            >
              <div
                className="px-5 py-4"
                style={{
                  background:
                    ticketPdfTemplateId === 'sunset'
                      ? `linear-gradient(120deg, ${ticketPdfAccentColor}, ${ticketPdfPrimaryColor})`
                      : `linear-gradient(120deg, ${ticketPdfPrimaryColor}, ${ticketPdfAccentColor})`,
                }}
              >
                <div className="text-xs font-bold uppercase tracking-wider text-white/90">{ticketPdfBadgeText || 'VIP ACCESS'}</div>
                <div className="mt-1 text-lg font-black text-white">{event.title}</div>
              </div>
              <div className={`grid gap-4 p-5 md:grid-cols-[1fr_120px] ${ticketPdfTemplateId === 'midnight' ? 'text-neutral-100' : 'text-neutral-800'}`}>
                <div>
                  <div className="text-xs uppercase tracking-wide opacity-70">Preview</div>
                  <div className="mt-2 text-sm font-bold">Attendee Name</div>
                  <div className="text-xs opacity-70">attendee@email.com</div>
                  <div className="mt-3 rounded-lg px-3 py-2 font-mono text-xs" style={{ backgroundColor: ticketPdfPrimaryColor, color: '#fff' }}>
                    QR-TOKEN-EXAMPLE
                  </div>
                </div>
                <div className="flex items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white/80 text-xs text-neutral-500">
                  QR AREA
                </div>
              </div>
              <div className={`border-t px-5 py-3 text-xs ${ticketPdfTemplateId === 'midnight' ? 'border-neutral-700 text-neutral-300' : 'border-neutral-200 text-neutral-500'}`}>
                {ticketPdfFooterNote || 'Please bring this ticket and a valid ID.'}
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={saveTicketDesign}
                disabled={savingTicketDesign}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingTicketDesign ? 'Saving design…' : 'Save ticket PDF design'}
              </button>
              <div className="text-xs text-neutral-500">Tip: changes apply to all new ticket downloads instantly.</div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
            <h2 className="text-lg font-extrabold text-neutral-900">Organizer command center</h2>
            <p className="mt-1 text-sm text-neutral-500">Readiness scoring, ticket health, and live event ops metrics.</p>

            <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-xs font-extrabold uppercase tracking-wider text-neutral-500">Readiness score</div>
              <div className="mt-1 text-3xl font-black text-neutral-900">{readinessScore}%</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200">
                <div className="h-full rounded-full bg-indigo-600" style={{ width: `${readinessScore}%` }} />
              </div>
              <div className="mt-4 space-y-2 text-sm">
                {readinessChecklist.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-neutral-700">{item.label}</span>
                    <span className={item.done ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>{item.done ? 'Done' : 'Pending'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-neutral-200 p-4">
                <div className="text-xs font-extrabold uppercase tracking-wider text-neutral-500">Revenue</div>
                <div className="mt-1 text-xl font-black text-neutral-900">{formatLKR(totalRevenue)}</div>
                <div className="mt-1 text-xs text-neutral-500">{soldTickets} tickets sold</div>
              </div>
              <div className="rounded-xl border border-neutral-200 p-4">
                <div className="text-xs font-extrabold uppercase tracking-wider text-neutral-500">Check-in rate</div>
                <div className="mt-1 text-xl font-black text-neutral-900">{checkInRate}%</div>
                <div className="mt-1 text-xs text-neutral-500">
                  {checkedInCount} checked-in of {soldTickets} sold
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
              <div className="font-extrabold text-neutral-800">Ticket health alerts</div>
              {tickets.length === 0 ? (
                <div className="mt-2 text-neutral-600">No tickets configured yet.</div>
              ) : soldOutTickets > 0 ? (
                <div className="mt-2 text-amber-700">
                  {soldOutTickets} ticket tier{soldOutTickets > 1 ? 's are' : ' is'} sold out. Consider adding a new tier or increasing capacity.
                </div>
              ) : (
                <div className="mt-2 text-emerald-700">All ticket tiers still have capacity.</div>
              )}
            </div>
          </div>
        </div>

        <div className="h-fit rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm xl:sticky xl:top-24">
          <h2 className="text-lg font-extrabold text-neutral-900">Event management</h2>
          <p className="mt-1 text-sm text-neutral-500">Quick links and staff operations.</p>

          <div className="mt-5 flex flex-col gap-3">
            <Link
              to={`/dashboard/events/${eventId}/agenda`}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-50"
            >
              Agenda & Speakers
            </Link>
            <Link
              to={`/dashboard/events/${eventId}/checkin`}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-50"
            >
              Attendees & Check-in
            </Link>
            <Link
              to={`/dashboard/events/${eventId}/runbook`}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-50"
            >
              Event runbook
            </Link>
            <button
              type="button"
              onClick={copyStaffLink}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm font-bold text-neutral-800 hover:bg-neutral-50"
            >
              Copy staff scanner link
              <div className="mt-1 font-mono text-xs font-medium text-neutral-500">{staffCheckInUrl}</div>
            </button>
            <button
              type="button"
              onClick={duplicateEvent}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm font-bold text-neutral-800 hover:bg-neutral-50"
            >
              Duplicate this event
              <div className="mt-1 text-xs font-medium text-neutral-500">Clones tickets + design into a new draft event</div>
            </button>
            <button
              type="button"
              onClick={() => updateEventStatus(event.status === 'published' ? 'draft' : 'published')}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm font-bold text-neutral-800 hover:bg-neutral-50"
            >
              {event.status === 'published' ? 'Unpublish event' : 'Publish event'}
              <div className="mt-1 text-xs font-medium text-neutral-500">
                Current status: <span className="font-semibold">{event.status}</span>
              </div>
            </button>
            {copyMsg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">{copyMsg}</div>}
          </div>
        </div>
      </div>

      </div>
    </OrganizerShell>
  );
};

