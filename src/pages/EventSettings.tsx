import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  Copy,
  ExternalLink,
  MapPin,
  Plus,
  Ticket as TicketIcon,
  Trash2,
} from 'lucide-react';
import { api, toApiUrl } from '../api/client';
import { Attendee, Event, Session, Speaker, Ticket as EventTicket } from '../types';
import { slugify } from '../utils/slug';
import { formatLKR } from '../utils/money';
import { cn } from '../utils/cn';
import { BannerUploadSquare } from '../components/ui/BannerUploadSquare';
import { CustomDomainPanel } from '../components/organizer/CustomDomainPanel';
import { LandingCustomizer, LandingDesignPreview, type LandingDesignValue } from '../components/organizer/LandingCustomizer';
import {
  EVENT_THEMES,
  normalizeLandingCustomization,
  type EventThemeId,
} from '../themes/eventThemes';
import { resolveLandingFontKey } from '../themes/landingFonts';
import { cardMutedStyleFor, cardStyleFor, fieldClassFor, fieldStyleFor } from '../themes/flowUi';

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatScheduleDay(value: string): string {
  if (!value) return 'Select date';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Select date';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatScheduleTime(value: string): string {
  if (!value) return '--:--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function normalizeBannerUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('/api/')) return url;
  return toApiUrl(url);
}

const statusLabel: Record<Event['status'], string> = {
  published: 'Published',
  draft: 'Draft',
  cancelled: 'Cancelled',
};

export const EventSettings: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [themeId, setThemeId] = useState<EventThemeId>('minimal');
  const [design, setDesign] = useState<LandingDesignValue>({
    eventCategory: 'default',
    primaryColor: '#059669',
    secondaryColor: '#10b981',
    fontFamily: 'fraunces',
    displayMode: 'auto',
    landingStyle: 'glass',
  });
  const [savingDesign, setSavingDesign] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [scheduleTba, setScheduleTba] = useState(false);
  const [bannerUrl, setBannerUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingSlug, setSavingSlug] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [savingTicket, setSavingTicket] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [savingTicketDesign, setSavingTicketDesign] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPdfDesign, setShowPdfDesign] = useState(false);
  const [ticketPdfTemplateId, setTicketPdfTemplateId] = useState<'classic' | 'midnight' | 'sunset'>('classic');
  const [ticketPdfPrimaryColor, setTicketPdfPrimaryColor] = useState('#4f46e5');
  const [ticketPdfAccentColor, setTicketPdfAccentColor] = useState('#10b981');
  const [ticketPdfBadgeText, setTicketPdfBadgeText] = useState('VIP ACCESS');
  const [ticketPdfFooterNote, setTicketPdfFooterNote] = useState('Please bring this ticket and a valid ID.');
  const [ticketForm, setTicketForm] = useState({ name: '', price: 0, quantity: 100, description: '' });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTheme = EVENT_THEMES[themeId] || EVENT_THEMES.minimal;
  const ui = selectedTheme.ui;
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);
  const cardStyle = cardStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);

  const loadAll = async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ event: Event }>(`/api/events/${eventId}`);
      const ev = res.event;
      setEvent(ev);
      setTitle(ev.title);
      setDescription(ev.description || '');
      setShortDescription(ev.customization?.heroSubtext || '');
      setLocation(ev.location);
      setDate(toDatetimeLocalValue(new Date(ev.date)));
      setScheduleTba(!!ev.customization?.scheduleTba);
      setBannerUrl(ev.bannerUrl || '');
      setSlug(ev.slug);
      const landing = normalizeLandingCustomization(ev.customization);
      const minimal = EVENT_THEMES.minimal;
      setThemeId('minimal');
      setDesign({
        eventCategory: landing.eventCategory || 'default',
        primaryColor: landing.primaryColor || minimal.primary,
        secondaryColor: landing.secondaryColor || minimal.secondary,
        fontFamily: resolveLandingFontKey(landing.fontFamily),
        displayMode:
          landing.displayMode === 'light' || landing.displayMode === 'dark' ? landing.displayMode : 'auto',
        landingStyle:
          landing.landingStyle === 'minimal' || landing.landingStyle === 'bold' ? landing.landingStyle : 'glass',
      });
      setTicketPdfTemplateId((ev.customization?.ticketPdfTemplateId as 'classic' | 'midnight' | 'sunset') || 'classic');
      setTicketPdfPrimaryColor(ev.customization?.ticketPdfPrimaryColor || landing.primaryColor || minimal.primary);
      setTicketPdfAccentColor(ev.customization?.ticketPdfAccentColor || landing.secondaryColor || minimal.secondary);
      setTicketPdfBadgeText(ev.customization?.ticketPdfBadgeText || 'VIP ACCESS');
      setTicketPdfFooterNote(ev.customization?.ticketPdfFooterNote || 'Please bring this ticket and a valid ID.');

      const [ticketsRes, speakersRes, sessionsRes, attendeesRes] = await Promise.all([
        api.get<{ tickets: EventTicket[] }>(`/api/events/${eventId}/tickets`),
        api.get<{ speakers: Speaker[] }>(`/api/events/${eventId}/speakers`),
        api.get<{ sessions: Session[] }>(`/api/events/${eventId}/sessions`),
        api.get<{ attendees: Attendee[]; stats: { total: number; checkedIn: number; pending: number } }>(
          `/api/events/${eventId}/attendees?limit=1`
        ),
      ]);
      setTickets(ticketsRes.tickets);
      setSpeakers(speakersRes.speakers);
      setSessions(sessionsRes.sessions);
      setAttendees(attendeesRes.attendees);
      setAttendeeStats(attendeesRes.stats ?? { total: attendeesRes.attendees.length, checkedIn: 0, pending: 0 });
    } catch (e: any) {
      setError(e?.message || e?.error || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [eventId]);

  const publicUrl = useMemo(() => (slug ? `/e/${slug}` : ''), [slug]);
  const staffCheckInUrl = useMemo(() => `/staff/checkin/${eventId}`, [eventId]);
  const soldTickets = useMemo(() => tickets.reduce((sum, t) => sum + t.sold, 0), [tickets]);
  const totalRevenue = useMemo(() => tickets.reduce((sum, t) => sum + t.sold * t.price, 0), [tickets]);
  const [attendeeStats, setAttendeeStats] = useState({ total: 0, checkedIn: 0, pending: 0 });
  const checkedInCount = attendeeStats.checkedIn;
  const attendeeTotal = attendeeStats.total;
  const readinessScore = useMemo(() => {
    let score = 0;
    if (slug.length >= 3) score += 20;
    if (tickets.length > 0) score += 20;
    if (speakers.length > 0) score += 20;
    if (sessions.length > 0) score += 20;
    if (event?.status === 'published') score += 20;
    return score;
  }, [event?.status, sessions.length, slug, speakers.length, tickets.length]);

  const uploadBannerFile = async (file: File) => {
    setIsUploadingBanner(true);
    setBannerUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(toApiUrl('/api/uploads/banner'), {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const text = await res.text();
      let data: { bannerUrl?: string; message?: string } | null = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      if (res.ok && data?.bannerUrl) {
        setBannerUrl(normalizeBannerUrl(data.bannerUrl));
        return;
      }
      setBannerUploadError(data?.message || 'Upload failed');
    } catch {
      setBannerUploadError('Upload failed. Check your connection.');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const saveBranding = async () => {
    if (!eventId) return;
    setSavingBranding(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await api.post<{ event: Event }>(`/api/events/${eventId}/branding`, {
        themeId,
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        date: new Date(date).toISOString(),
        bannerUrl: bannerUrl || undefined,
        heroSubtext: shortDescription.trim(),
        scheduleTba,
        eventCategory: design.eventCategory,
        primaryColor: design.primaryColor,
        secondaryColor: design.secondaryColor,
        fontFamily: design.fontFamily,
        displayMode: design.displayMode,
        landingStyle: design.landingStyle,
      });
      setEvent(res.event);
      setFeedback('Event details and theme saved.');
    } catch (e: any) {
      setError(e?.message || e?.error || 'Failed to save changes');
    } finally {
      setSavingBranding(false);
    }
  };

  const saveDesign = async () => {
    if (!eventId || !event) return;
    setSavingDesign(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await api.post<{ event: Event }>(`/api/events/${eventId}/branding`, {
        themeId,
        eventCategory: design.eventCategory,
        primaryColor: design.primaryColor,
        secondaryColor: design.secondaryColor,
        fontFamily: design.fontFamily,
        displayMode: design.displayMode,
        landingStyle: design.landingStyle,
      });
      setEvent(res.event);
      setFeedback('Landing design saved. Your public page is updated.');
    } catch (e: any) {
      setError(e?.message || e?.error || 'Failed to save landing design');
    } finally {
      setSavingDesign(false);
    }
  };

  const saveSlug = async () => {
    if (!eventId) return;
    setSavingSlug(true);
    setError(null);
    try {
      const res = await api.post<{ slug: string }>(`/api/events/${eventId}/slug`, { slug: slugify(slug) });
      setSlug(res.slug);
      if (event) setEvent({ ...event, slug: res.slug });
      setFeedback('Public URL updated.');
    } catch (e: any) {
      setError(e?.message || e?.error || 'Failed to update URL');
    } finally {
      setSavingSlug(false);
    }
  };

  const updateEventStatus = async (nextStatus: Event['status']) => {
    if (!eventId || !event) return;
    setError(null);
    try {
      const res = await api.post<{ status: Event['status'] }>(`/api/events/${eventId}/status`, { status: nextStatus });
      setEvent({ ...event, status: res.status });
      setFeedback(nextStatus === 'published' ? 'Event is now live.' : 'Event status updated.');
    } catch (e: any) {
      setError(e?.message || e?.error || 'Failed to update status');
    }
  };

  const refreshTickets = async () => {
    if (!eventId) return;
    const res = await api.get<{ tickets: EventTicket[] }>(`/api/events/${eventId}/tickets`);
    setTickets(res.tickets);
  };

  const saveTicket = async () => {
    if (!eventId || !ticketForm.name.trim()) {
      setError('Ticket name is required');
      return;
    }
    setSavingTicket(true);
    setError(null);
    try {
      if (editingTicketId) {
        await api.post(`/api/events/${eventId}/tickets/${editingTicketId}`, ticketForm);
      } else {
        await api.post(`/api/events/${eventId}/tickets`, ticketForm);
      }
      await refreshTickets();
      setEditingTicketId(null);
      setTicketForm({ name: '', price: 0, quantity: 100, description: '' });
      setFeedback('Tickets updated.');
    } catch (e: any) {
      setError(e?.message || e?.error || 'Failed to save ticket');
    } finally {
      setSavingTicket(false);
    }
  };

  const deleteTicket = async (ticketId: string) => {
    if (!eventId) return;
    try {
      await api.post(`/api/events/${eventId}/tickets/${ticketId}/delete`);
      await refreshTickets();
      if (editingTicketId === ticketId) {
        setEditingTicketId(null);
        setTicketForm({ name: '', price: 0, quantity: 100, description: '' });
      }
    } catch (e: any) {
      setError(e?.error || 'Failed to delete ticket');
    }
  };

  const saveTicketDesign = async () => {
    if (!eventId || !event) return;
    setSavingTicketDesign(true);
    try {
      const res = await api.post<{ customization: Event['customization'] }>(`/api/events/${eventId}/ticket-design`, {
        templateId: ticketPdfTemplateId,
        primaryColor: ticketPdfPrimaryColor,
        accentColor: ticketPdfAccentColor,
        badgeText: ticketPdfBadgeText,
        footerNote: ticketPdfFooterNote,
      });
      setEvent({ ...event, customization: { ...event.customization, ...res.customization } });
      setFeedback('Ticket PDF design saved.');
    } catch (e: any) {
      setError(e?.error || 'Failed to save ticket design');
    } finally {
      setSavingTicketDesign(false);
    }
  };

  const copyStaffLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${staffCheckInUrl}`);
      setCopyMsg('Staff link copied');
      window.setTimeout(() => setCopyMsg(null), 2500);
    } catch {
      setCopyMsg('Could not copy');
    }
  };

  const navPill = (to: string, label: string, active: boolean) => (
    <Link
      to={to}
      className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
      style={
        active
          ? { background: ui.accentSoft, borderColor: ui.accent, color: ui.accent }
          : { ...cardStyle, color: ui.textMuted }
      }
    >
      {label}
    </Link>
  );

  if (loading) {
    return (
      <div
        className="flex min-h-[calc(100vh-4rem)] items-center justify-center"
        style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)' }}
      >
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: ui.accent }} />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-semibold text-neutral-900">Event not found</p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <Link to="/dashboard" className="mt-6 inline-block text-sm font-semibold text-teal-700">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[calc(100vh-4rem)] flex-col transition-[background] duration-700 ease-in-out"
      style={{ background: ui.pageBg, color: ui.text }}
    >
      <header
        className="shrink-0 border-b px-4 py-4 backdrop-blur-md sm:px-8"
        style={{ background: ui.headerBg, borderColor: ui.borderColor }}
      >
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition hover:opacity-80"
              style={{ color: ui.textMuted }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <div>
              <h1 className="text-lg font-semibold sm:text-xl" style={{ color: ui.text }}>
                Event settings
              </h1>
              <p className="text-sm" style={{ color: ui.textMuted }}>
                {event.title}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={{
                ...cardStyle,
                color: event.status === 'published' ? ui.accent : ui.textMuted,
              }}
            >
              {statusLabel[event.status]}
            </span>
            {navPill(`/dashboard/events/${eventId}/settings`, 'Settings', true)}
            {navPill(`/dashboard/events/${eventId}/agenda`, 'Agenda', false)}
            {navPill(`/dashboard/events/${eventId}/checkin`, 'Check-in', false)}
            {navPill(`/dashboard/events/${eventId}/runbook`, 'Runbook', false)}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-[1440px] gap-8 px-4 py-6 sm:px-8 lg:grid-cols-[360px_1fr] lg:py-8">
          {/* Left */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            <BannerUploadSquare
              previewUrl={bannerUrl ? normalizeBannerUrl(bannerUrl) : undefined}
              disabled={isUploadingBanner}
              onFileSelect={(file) => void uploadBannerFile(file)}
              frameClassName={ui.bannerFrame}
              placeholderClassName={ui.bannerPlaceholder}
            />
            {bannerUploadError && <p className="text-xs text-rose-600">{bannerUploadError}</p>}

            <div className="rounded-xl border px-3.5 py-2.5" style={{ ...fieldStyle, borderColor: ui.borderColor }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                Theme
              </p>
              <p className="mt-0.5 text-sm font-medium" style={{ color: ui.text }}>
                Minimal
              </p>
            </div>

            <div className="rounded-2xl border p-4" style={cardMutedStyle}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                Live preview
              </p>
              <div className="mt-3">
                <LandingDesignPreview
                  value={design}
                  title={title || event.title}
                  bannerUrl={bannerUrl ? normalizeBannerUrl(bannerUrl) : undefined}
                />
              </div>
            </div>

            <div className="rounded-2xl border p-4" style={cardMutedStyle}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                Event health
              </p>
              <p className="mt-1 text-3xl font-bold" style={{ color: ui.text }}>
                {readinessScore}%
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: ui.borderColor }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${readinessScore}%`, background: ui.accent }} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p style={{ color: ui.textMuted }}>Sold</p>
                  <p className="font-semibold" style={{ color: ui.text }}>
                    {soldTickets}
                  </p>
                </div>
                <div>
                  <p style={{ color: ui.textMuted }}>Revenue</p>
                  <p className="font-semibold" style={{ color: ui.text }}>
                    {formatLKR(totalRevenue)}
                  </p>
                </div>
                <div>
                  <p style={{ color: ui.textMuted }}>Check-in</p>
                  <p className="font-semibold" style={{ color: ui.text }}>
                    {checkedInCount}/{attendeeTotal || soldTickets}
                  </p>
                </div>
                <div>
                  <p style={{ color: ui.textMuted }}>Tickets</p>
                  <p className="font-semibold" style={{ color: ui.text }}>
                    {tickets.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="flex flex-col pb-24">
            {(error || feedback) && (
              <div
                className={cn(
                  'mb-4 rounded-xl border px-4 py-3 text-sm font-medium',
                  error ? 'border-red-200 bg-red-50 text-red-700' : ''
                )}
                style={!error ? { borderColor: ui.accent, background: ui.accentSoft, color: ui.text } : undefined}
              >
                {error || feedback}
              </div>
            )}

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event name"
              className="mb-2 w-full border-0 bg-transparent p-0 text-3xl font-semibold tracking-tight focus:outline-none sm:text-4xl"
              style={{ color: ui.text }}
            />

            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
              Short description
            </label>
            <input
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="One-line tagline shown under the title (optional)"
              maxLength={160}
              className={cn(fieldClass, 'mb-1')}
              style={fieldStyle}
            />
            <p className="mb-4 text-xs" style={{ color: ui.textSubtle }}>
              Appears under the event title. Leave blank to use the start of the description.
            </p>

            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
              Full description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Event description"
              rows={3}
              className={cn(fieldClass, 'mb-5 resize-y')}
              style={fieldStyle}
            />

            {/* Landing design */}
            <div className="mb-5 rounded-2xl border p-5" style={cardStyle}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold" style={{ color: ui.text }}>
                    Landing design
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                    Personalize the colour, style, font, and display of your public page.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={saveDesign}
                  disabled={savingDesign}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: ui.accent }}
                >
                  {savingDesign ? 'Saving…' : 'Save design'}
                </button>
              </div>
              <div className="mt-5">
                <LandingCustomizer value={design} onChange={setDesign} ui={ui} />
              </div>
            </div>

            {/* Schedule */}
            <div className="mb-5 rounded-2xl border p-5" style={cardMutedStyle}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                  When
                </p>
                <div className="inline-flex rounded-xl border p-1" style={cardStyle}>
                  <button
                    type="button"
                    onClick={() => setScheduleTba(true)}
                    className="rounded-lg px-3.5 py-1.5 text-sm font-semibold transition"
                    style={scheduleTba ? { backgroundColor: ui.accent, color: '#fff' } : { color: ui.textMuted }}
                  >
                    To be announced
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleTba(false)}
                    className="rounded-lg px-3.5 py-1.5 text-sm font-semibold transition"
                    style={!scheduleTba ? { backgroundColor: ui.accent, color: '#fff' } : { color: ui.textMuted }}
                  >
                    Set date &amp; time
                  </button>
                </div>
              </div>
              {scheduleTba ? (
                <p className="text-sm" style={{ color: ui.textMuted }}>
                  Date &amp; time to be announced. Switch to “Set date &amp; time” to add a schedule.
                </p>
              ) : (
                <div className="relative space-y-5">
                  <div className="absolute bottom-8 left-[7px] top-8 w-px border-l border-dashed" style={{ borderColor: ui.lineDashed }} aria-hidden />
                  <div className="relative space-y-2">
                    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                      <span className="z-10 h-3.5 w-3.5 rounded-full border-2 bg-white" style={{ borderColor: ui.dotActive }} />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                          Start
                        </p>
                        <p className="text-sm font-medium" style={{ color: ui.text }}>
                          {formatScheduleDay(date)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold" style={{ color: ui.text }}>
                        {formatScheduleTime(date)}
                      </p>
                    </div>
                    <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} style={fieldStyle} />
                  </div>
                </div>
              )}
            </div>

            <div className="mb-5 rounded-2xl border p-4" style={cardStyle}>
              <div className="flex items-start gap-3">
                <MapPin className="mt-1 h-4 w-4 shrink-0" style={{ color: ui.textSubtle }} />
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Event location"
                  className="w-full border-0 bg-transparent p-0 text-sm font-medium focus:outline-none"
                  style={{ color: ui.text }}
                />
              </div>
            </div>

            {/* Public URL */}
            <div className="mb-5 rounded-2xl border p-5" style={cardStyle}>
              <h2 className="text-base font-semibold" style={{ color: ui.text }}>
                Public URL
              </h2>
              <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                Share this link with attendees
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input value={slug} onChange={(e) => setSlug(e.target.value)} className={fieldClass} style={fieldStyle} />
                <button
                  type="button"
                  onClick={saveSlug}
                  disabled={savingSlug}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: ui.accent }}
                >
                  {savingSlug ? 'Saving…' : 'Save URL'}
                </button>
              </div>
              <p className="mt-2 font-mono text-xs" style={{ color: ui.textSubtle }}>
                {typeof window !== 'undefined' ? window.location.origin : ''}
                {publicUrl}
              </p>
              <button
                type="button"
                onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold"
                style={{ color: ui.accent }}
              >
                <ExternalLink className="h-4 w-4" />
                Open public page
              </button>
            </div>

            {eventId && (
              <CustomDomainPanel
                eventId={eventId}
                ui={ui}
                onUpdated={(domain) => {
                  setEvent((prev) =>
                    prev
                      ? {
                          ...prev,
                          customDomain: domain,
                          customization: { ...prev.customization, customDomain: domain || undefined },
                        }
                      : prev
                  );
                }}
              />
            )}

            {/* Tickets */}
            <div className="mb-5 rounded-2xl border p-5" style={cardStyle}>
              <div className="flex items-center gap-2">
                <TicketIcon className="h-5 w-5" style={{ color: ui.accent }} />
                <h2 className="text-base font-semibold" style={{ color: ui.text }}>
                  Tickets
                </h2>
              </div>
              <div className="mt-4 space-y-3">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="rounded-xl border p-4"
                    style={cardMutedStyle}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold" style={{ color: ui.text }}>
                          {ticket.name}
                        </p>
                        <p className="text-sm" style={{ color: ui.textMuted }}>
                          {formatLKR(ticket.price)} · {ticket.sold}/{ticket.quantity} sold
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTicketId(ticket.id);
                            setTicketForm({
                              name: ticket.name,
                              price: ticket.price,
                              quantity: ticket.quantity,
                              description: ticket.description || '',
                            });
                          }}
                          className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                          style={{ ...cardStyle, color: ui.text }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTicket(ticket.id)}
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input
                  placeholder="Tier name"
                  value={ticketForm.name}
                  onChange={(e) => setTicketForm((p) => ({ ...p, name: e.target.value }))}
                  className={fieldClass}
                  style={fieldStyle}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Price (LKR)"
                  value={ticketForm.price}
                  onChange={(e) => setTicketForm((p) => ({ ...p, price: Number(e.target.value) }))}
                  className={fieldClass}
                  style={fieldStyle}
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Quantity"
                  value={ticketForm.quantity}
                  onChange={(e) => setTicketForm((p) => ({ ...p, quantity: Number(e.target.value) }))}
                  className={fieldClass}
                  style={fieldStyle}
                />
                <input
                  placeholder="Description (optional)"
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm((p) => ({ ...p, description: e.target.value }))}
                  className={fieldClass}
                  style={fieldStyle}
                />
              </div>
              <button
                type="button"
                onClick={saveTicket}
                disabled={savingTicket}
                className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: ui.accent }}
              >
                <Plus className="h-4 w-4" />
                {savingTicket ? 'Saving…' : editingTicketId ? 'Update tier' : 'Add tier'}
              </button>
            </div>

            {/* Advanced */}
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="mb-4 flex w-full items-center justify-between py-2 text-sm font-medium"
              style={{ color: ui.textMuted }}
            >
              More options (PDF tickets, staff tools)
              <ChevronDown className={cn('h-4 w-4 transition', showAdvanced && 'rotate-180')} />
            </button>

            {showAdvanced && (
              <div className="space-y-4">
                <div className="rounded-2xl border p-5" style={cardStyle}>
                  <button
                    type="button"
                    onClick={() => setShowPdfDesign((v) => !v)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span className="font-semibold" style={{ color: ui.text }}>
                      Ticket PDF design
                    </span>
                    <ChevronDown className={cn('h-4 w-4', showPdfDesign && 'rotate-180')} style={{ color: ui.textMuted }} />
                  </button>
                  {showPdfDesign && (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-2 sm:grid-cols-3">
                        {(['classic', 'midnight', 'sunset'] as const).map((tpl) => (
                          <button
                            key={tpl}
                            type="button"
                            onClick={() => setTicketPdfTemplateId(tpl)}
                            className="rounded-xl border p-3 text-left text-sm font-semibold capitalize"
                            style={
                              ticketPdfTemplateId === tpl
                                ? { borderColor: ui.accent, background: ui.accentSoft, color: ui.accent }
                                : cardStyle
                            }
                          >
                            {tpl}
                          </button>
                        ))}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input type="color" value={ticketPdfPrimaryColor} onChange={(e) => setTicketPdfPrimaryColor(e.target.value)} className={fieldClass} style={fieldStyle} />
                        <input type="color" value={ticketPdfAccentColor} onChange={(e) => setTicketPdfAccentColor(e.target.value)} className={fieldClass} style={fieldStyle} />
                      </div>
                      <input value={ticketPdfBadgeText} onChange={(e) => setTicketPdfBadgeText(e.target.value)} className={fieldClass} style={fieldStyle} />
                      <input value={ticketPdfFooterNote} onChange={(e) => setTicketPdfFooterNote(e.target.value)} className={fieldClass} style={fieldStyle} />
                      <button
                        type="button"
                        onClick={saveTicketDesign}
                        disabled={savingTicketDesign}
                        className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                        style={{ backgroundColor: ui.accent }}
                      >
                        {savingTicketDesign ? 'Saving…' : 'Save PDF design'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border p-5" style={cardMutedStyle}>
                  <p className="text-sm font-semibold" style={{ color: ui.text }}>
                    Quick actions
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    <Link
                      to={`/dashboard/events/${eventId}/checkin`}
                      className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"
                      style={{ ...cardStyle, color: ui.text }}
                    >
                      Open check-in &amp; staff PIN
                    </Link>
                    <button
                      type="button"
                      onClick={copyStaffLink}
                      className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"
                      style={{ ...cardStyle, color: ui.text }}
                    >
                      <Copy className="h-4 w-4" />
                      Copy staff scanner link
                    </button>
                    {copyMsg && (
                      <p className="text-xs" style={{ color: ui.textMuted }}>
                        {copyMsg}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => updateEventStatus(event.status === 'published' ? 'draft' : 'published')}
                      className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
                      style={{ ...cardStyle, color: ui.text }}
                    >
                      {event.status === 'published' ? 'Unpublish event' : 'Publish event'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer
        className="shrink-0 border-t px-4 py-4 backdrop-blur-md sm:px-8"
        style={{ background: ui.footerBg, borderColor: ui.borderColor }}
      >
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm" style={{ color: ui.textSubtle }}>
            Changes to theme and event details apply to your public landing page.
          </p>
          <button
            type="button"
            onClick={saveBranding}
            disabled={savingBranding}
            className="w-full rounded-xl px-8 py-3.5 text-base font-semibold text-white transition hover:brightness-105 disabled:opacity-40 sm:w-auto"
            style={{ backgroundColor: ui.accent }}
          >
            {savingBranding ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </footer>
    </div>
  );
};
