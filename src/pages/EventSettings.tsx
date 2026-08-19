import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { resolveLayoutTemplateId, LANDING_LAYOUT_TEMPLATES } from '../templates/templates';
import {
  ArrowLeft,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  CreditCard,
  Landmark,
  MapPin,
  Plus,
  Ticket as TicketIcon,
  Trash2,
} from 'lucide-react';
import { api, toApiUrl } from '../api/client';
import { Attendee, CheckoutFieldDefinition, Event, OrganizerPaidEventReadiness, Ticket as EventTicket } from '../types';
import { normalizeCheckoutFields } from '../utils/checkoutFields';
import { slugify } from '../utils/slug';
import { formatLKR } from '../utils/money';
import { cn } from '../utils/cn';
import { BannerUploadSquare } from '../components/ui/BannerUploadSquare';
import { EventLocationFields } from '../components/ui/EventLocationFields';
import { CheckoutFieldsEditor } from '../components/organizer/CheckoutFieldsEditor';
import { EventPolicyEditorModal } from '../components/organizer/EventPolicyEditorModal';
import { CustomDomainPanel } from '../components/organizer/CustomDomainPanel';
import { PaidEventSetupGate } from '../components/organizer/PaidEventSetupGate';
import {
  EventLocationMode,
  OnlineEventPlatform,
  formatEventLocationDisplay,
  isValidMeetingUrl,
  resolveEventLocationMode,
  resolveOnlinePlatform,
} from '../utils/eventLocation';
import { type LandingDesignValue } from '../components/organizer/LandingCustomizer';
import { LandingDesignDock } from '../components/organizer/LandingDesignDock';
import { EventCategoryPicker } from '../components/organizer/EventCategoryPicker';
import { EventLandingLivePreview } from '../components/organizer/EventLandingLivePreview';
import { ArenaGalleryEditor } from '../components/organizer/ArenaGalleryEditor';
import { normalizeArenaGalleryImages } from '../components/landing/arenaGallery';
import { normalizeLandingCustomization, type EventThemeId } from '../themes/eventThemes';
import { resolveTemplateDesignDefaults } from '../themes/templateDefaults';
import { landingCustomizationFromDesign } from '../themes/organizerLiveDesign';
import { resolveLandingFontKey } from '../themes/landingFonts';
import { APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { accentButtonStyleFor, accentSegmentStyleFor, cardMutedStyleFor, cardStyleFor, fieldClassFor, fieldStyleFor } from '../themes/flowUi';
import { absoluteAppUrl } from '../lib/publicAppUrl';
import { TurnoutDateTimePicker, formatScheduleDay, formatScheduleTime } from '../components/ui/TurnoutDateTimePicker';
import { TurnoutColorPicker } from '../components/ui/TurnoutColorPicker';
import { DEFAULT_EVENT_POLICY_HTML, resolveEventPolicyHtml } from '../utils/eventPolicy';

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

type SettingsCollapsibleSectionProps = {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  panelClassName: string;
  cardStyle: React.CSSProperties;
  ui: { text: string; textMuted: string; borderColor: string };
};

function SettingsCollapsibleSection({
  title,
  subtitle,
  icon,
  open,
  onToggle,
  children,
  panelClassName,
  cardStyle,
  ui,
}: SettingsCollapsibleSectionProps) {
  return (
    <div className={cn(panelClassName, 'mb-5 overflow-hidden')} style={cardStyle}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-3">
          {icon}
          <div className="min-w-0">
            <h2 className="text-base font-semibold" style={{ color: ui.text }}>
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 truncate text-sm" style={{ color: ui.textMuted }}>
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 transition', open && 'rotate-180')}
          style={{ color: ui.textMuted }}
        />
      </button>
      {open ? (
        <div className="border-t px-5 pb-5 pt-4" style={{ borderColor: ui.borderColor }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export const EventSettings: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [themeId, setThemeId] = useState<EventThemeId>('minimal');
  const [design, setDesign] = useState<LandingDesignValue>(() => {
    const defaults = resolveTemplateDesignDefaults('template-2');
    return {
      templateId: defaults.templateId,
      eventCategory: 'default',
      primaryColor: defaults.primaryColor,
      secondaryColor: defaults.secondaryColor,
      fontFamily: defaults.fontFamily,
      displayMode: defaults.displayMode,
      landingStyle: defaults.landingStyle,
    };
  });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [locationMode, setLocationMode] = useState<EventLocationMode>('physical');
  const [location, setLocation] = useState('');
  const [onlinePlatform, setOnlinePlatform] = useState<OnlineEventPlatform>('google_meet');
  const [onlineUrl, setOnlineUrl] = useState('');
  const [date, setDate] = useState('');
  const [scheduleTba, setScheduleTba] = useState(false);
  const [bannerUrl, setBannerUrl] = useState('');
  const [arenaGalleryImages, setArenaGalleryImages] = useState<string[]>([]);
  const [isUploadingArenaGallery, setIsUploadingArenaGallery] = useState(false);
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    details: true,
    schedule: true,
    location: true,
    publicUrl: false,
    tickets: true,
    checkout: false,
    policy: false,
    payments: false,
    advanced: false,
  });
  const [showPdfDesign, setShowPdfDesign] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [allowPayhere, setAllowPayhere] = useState(true);
  const [allowBankTransfer, setAllowBankTransfer] = useState(false);
  const [savingPaymentMethods, setSavingPaymentMethods] = useState(false);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const isSectionOpen = (id: string) => !!openSections[id];
  const [ticketPdfTemplateId, setTicketPdfTemplateId] = useState<'classic' | 'midnight' | 'sunset'>('classic');
  const [ticketPdfPrimaryColor, setTicketPdfPrimaryColor] = useState('#4f46e5');
  const [ticketPdfAccentColor, setTicketPdfAccentColor] = useState('#10b981');
  const [ticketPdfBadgeText, setTicketPdfBadgeText] = useState('VIP ACCESS');
  const [ticketPdfFooterNote, setTicketPdfFooterNote] = useState('Please bring this ticket and a valid ID.');
  const [ticketForm, setTicketForm] = useState({ name: '', price: 0, quantity: 100, description: '' });
  const [checkoutFields, setCheckoutFields] = useState<CheckoutFieldDefinition[]>([]);
  const [eventPolicyHtml, setEventPolicyHtml] = useState(DEFAULT_EVENT_POLICY_HTML);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paidEventReadiness, setPaidEventReadiness] = useState<OrganizerPaidEventReadiness | null>(null);

  const ui = APP_FLOW_UI;
  const cardStyle = cardStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);
  const panelCn = cn('rounded-2xl border transition-[background,border-color,box-shadow] duration-300');
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);

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
      const mode = resolveEventLocationMode(ev.customization);
      setLocationMode(mode);
      setOnlinePlatform(resolveOnlinePlatform(ev.customization));
      setOnlineUrl(ev.customization?.onlineUrl || '');
      setLocation(mode === 'online' ? '' : ev.location);
      setDate(toDatetimeLocalValue(new Date(ev.date)));
      setScheduleTba(!!ev.customization?.scheduleTba);
      setBannerUrl(ev.bannerUrl || '');
      setArenaGalleryImages(normalizeArenaGalleryImages(ev.customization?.arenaGalleryImages));
      setSlug(ev.slug);
      const landing = normalizeLandingCustomization(ev.customization, resolveLayoutTemplateId(ev.templateId));
      const templateDefaults = resolveTemplateDesignDefaults(ev.templateId);
      setThemeId('minimal');
      setDesign({
        templateId: resolveLayoutTemplateId(ev.templateId),
        eventCategory: landing.eventCategory || 'default',
        primaryColor: landing.primaryColor || templateDefaults.primaryColor,
        secondaryColor: landing.secondaryColor || templateDefaults.secondaryColor,
        fontFamily: resolveLandingFontKey(landing.fontFamily),
        displayMode:
          landing.displayMode === 'light' || landing.displayMode === 'dark' || landing.displayMode === 'auto'
            ? landing.displayMode
            : templateDefaults.displayMode,
        landingStyle:
          landing.landingStyle === 'minimal' || landing.landingStyle === 'bold' || landing.landingStyle === 'glass'
            ? landing.landingStyle
            : templateDefaults.landingStyle,
        buttonColor: landing.buttonColor,
        headingColor: landing.headingColor,
        bodyTextColor: landing.bodyTextColor,
        mutedTextColor: landing.mutedTextColor,
        pageBackgroundColor: landing.pageBackgroundColor,
        surfaceColor: landing.surfaceColor,
        surfaceMutedColor: landing.surfaceMutedColor,
        borderColor: landing.borderColor,
        headerBgColor: landing.headerBgColor,
        footerBgColor: landing.footerBgColor,
        h1FontSize: landing.h1FontSize,
        h2FontSize: landing.h2FontSize,
        bodyFontSize: landing.bodyFontSize,
        smallFontSize: landing.smallFontSize,
        h1Bold: landing.h1Bold,
        h1Italic: landing.h1Italic,
        h1Underline: landing.h1Underline,
        h2Bold: landing.h2Bold,
        h2Italic: landing.h2Italic,
        h2Underline: landing.h2Underline,
        bodyBold: landing.bodyBold,
        bodyItalic: landing.bodyItalic,
        bodyUnderline: landing.bodyUnderline,
        smallBold: landing.smallBold,
        smallItalic: landing.smallItalic,
        smallUnderline: landing.smallUnderline,
      });
      setTicketPdfTemplateId((ev.customization?.ticketPdfTemplateId as 'classic' | 'midnight' | 'sunset') || 'classic');
      setTicketPdfPrimaryColor(
        ev.customization?.ticketPdfPrimaryColor || landing.primaryColor || templateDefaults.primaryColor
      );
      setTicketPdfAccentColor(
        ev.customization?.ticketPdfAccentColor || landing.secondaryColor || templateDefaults.secondaryColor
      );
      setTicketPdfBadgeText(ev.customization?.ticketPdfBadgeText || 'VIP ACCESS');
      setTicketPdfFooterNote(ev.customization?.ticketPdfFooterNote || 'Please bring this ticket and a valid ID.');
      setCheckoutFields(normalizeCheckoutFields(ev.customization?.checkoutFields));
      setEventPolicyHtml(resolveEventPolicyHtml(ev.customization?.eventPolicyHtml));
      const pm = ev.customization?.paymentMethods;
      const payhereOn =
        typeof ev.allowPayhere === 'boolean'
          ? ev.allowPayhere
          : typeof pm?.payhere === 'boolean'
            ? pm.payhere
            : typeof ev.customization?.allowPayhere === 'boolean'
              ? ev.customization.allowPayhere
              : true;
      setAllowPayhere(payhereOn);
      setAllowBankTransfer(!!ev.customization?.allowBankTransfer || !!ev.allowBankTransfer || !!pm?.bankTransfer);

      const [ticketsRes, attendeesRes] = await Promise.all([
        api.get<{ tickets: EventTicket[] }>(`/api/events/${eventId}/tickets`),
        api.get<{ attendees: Attendee[]; stats: { total: number; checkedIn: number; pending: number } }>(
          `/api/events/${eventId}/attendees?limit=1`
        ),
      ]);
      setTickets(ticketsRes.tickets);
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

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ readiness: OrganizerPaidEventReadiness }>('/api/organizer/paid-event-readiness');
        setPaidEventReadiness(res.readiness);
      } catch {
        setPaidEventReadiness(null);
      }
    })();
  }, []);

  const publicUrl = useMemo(() => (slug ? `/e/${slug}` : ''), [slug]);
  const staffCheckInUrl = useMemo(
    () => (eventId ? absoluteAppUrl(`/staff/checkin/${eventId}`) : ''),
    [eventId]
  );
  const soldTickets = useMemo(() => tickets.reduce((sum, t) => sum + t.sold, 0), [tickets]);
  const totalRevenue = useMemo(() => tickets.reduce((sum, t) => sum + t.sold * t.price, 0), [tickets]);
  const [attendeeStats, setAttendeeStats] = useState({ total: 0, checkedIn: 0, pending: 0 });
  const checkedInCount = attendeeStats.checkedIn;
  const attendeeTotal = attendeeStats.total;
  const readinessScore = useMemo(() => {
    let score = 0;
    if (slug.length >= 3) score += 20;
    if (tickets.length > 0) score += 20;
    const locationOk =
      locationMode === 'online' ? isValidMeetingUrl(onlineUrl) : location.trim().length > 2;
    if (locationOk) score += 20;
    if (scheduleTba || !!date) score += 20;
    if (event?.status === 'published') score += 20;
    return score;
  }, [date, event?.status, location, locationMode, onlineUrl, scheduleTba, slug, tickets.length]);

  const previewEvent = useMemo((): Event | null => {
    if (!event) return null;
    const baseCustomization = landingCustomizationFromDesign(design, themeId);
    const resolvedLocation =
      locationMode === 'online'
        ? formatEventLocationDisplay({ mode: 'online', platform: onlinePlatform })
        : location.trim() || 'Venue to be announced';
    return {
      ...event,
      title: title.trim() || 'Your event title',
      description:
        description.trim() || event.description || 'Join us for an unforgettable live experience. Reserve your passes online.',
      location: resolvedLocation,
      date: !scheduleTba && date ? new Date(date).toISOString() : event.date,
      bannerUrl: bannerUrl ? normalizeBannerUrl(bannerUrl) : event.bannerUrl,
      slug: slug || event.slug,
      templateId: design.templateId,
      status: 'published',
      customization: {
        ...event.customization,
        ...baseCustomization,
        scheduleTba,
        locationMode,
        onlinePlatform: locationMode === 'online' ? onlinePlatform : undefined,
        onlineUrl: locationMode === 'online' ? onlineUrl.trim() || undefined : undefined,
        heroSubtext: shortDescription.trim(),
        heroText: title.trim() || event.title,
        layout: event.customization?.layout || 'standard',
        arenaGalleryImages,
      },
    };
  }, [
    arenaGalleryImages,
    bannerUrl,
    date,
    description,
    design,
    event,
    location,
    locationMode,
    onlinePlatform,
    onlineUrl,
    scheduleTba,
    shortDescription,
    slug,
    themeId,
    title,
  ]);

  const previewTickets = useMemo((): EventTicket[] => {
    if (tickets.length > 0) return tickets;
    if (!eventId) return [];
    return [
      {
        id: 'preview-tier',
        eventId,
        name: 'General Admission',
        price: 2500,
        quantity: 100,
        sold: 0,
        description: 'Add ticket tiers in settings to preview real pricing.',
      },
    ];
  }, [eventId, tickets]);

  const uploadBannerFile = async (file: File) => {
    setIsUploadingBanner(true);
    setBannerUploadError(null);
    try {
      const url = await uploadImageFile(file);
      if (url) setBannerUrl(url);
      else setBannerUploadError('Upload failed');
    } catch {
      setBannerUploadError('Upload failed. Check your connection.');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const uploadImageFile = async (file: File): Promise<string | null> => {
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
    if (res.ok && data?.bannerUrl) return normalizeBannerUrl(data.bannerUrl);
    return null;
  };

  const uploadArenaGalleryFile = async (file: File) => {
    setIsUploadingArenaGallery(true);
    setBannerUploadError(null);
    try {
      const url = await uploadImageFile(file);
      if (!url) {
        setBannerUploadError('Gallery upload failed');
        return;
      }
      setArenaGalleryImages((prev) => normalizeArenaGalleryImages([...prev, url]));
    } catch {
      setBannerUploadError('Gallery upload failed. Check your connection.');
    } finally {
      setIsUploadingArenaGallery(false);
    }
  };

  const saveBranding = async () => {
    if (!eventId) return;
    setSavingBranding(true);
    setError(null);
    setFeedback(null);
    try {
      if (locationMode === 'physical' && !location.trim()) {
        setError('Add a venue or place for this event.');
        setSavingBranding(false);
        return;
      }
      if (locationMode === 'online' && !isValidMeetingUrl(onlineUrl)) {
        setError('Enter a valid meeting or stream link (https://…).');
        setSavingBranding(false);
        return;
      }

      const resolvedLocation =
        locationMode === 'online'
          ? formatEventLocationDisplay({ mode: 'online', platform: onlinePlatform })
          : location.trim();

      const res = await api.post<{ event: Event }>(`/api/events/${eventId}/branding`, {
        themeId,
        title: title.trim(),
        description: description.trim(),
        location: resolvedLocation,
        locationMode,
        onlinePlatform: locationMode === 'online' ? onlinePlatform : null,
        onlineUrl: locationMode === 'online' ? onlineUrl.trim() : null,
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
        buttonColor: design.buttonColor || null,
        headingColor: design.headingColor || null,
        bodyTextColor: design.bodyTextColor || null,
        mutedTextColor: design.mutedTextColor || null,
        pageBackgroundColor: design.pageBackgroundColor || null,
        surfaceColor: design.surfaceColor || null,
        surfaceMutedColor: design.surfaceMutedColor || null,
        borderColor: design.borderColor || null,
        headerBgColor: design.headerBgColor || null,
        footerBgColor: design.footerBgColor || null,
        h1FontSize: design.h1FontSize ?? null,
        h2FontSize: design.h2FontSize ?? null,
        bodyFontSize: design.bodyFontSize ?? null,
        smallFontSize: design.smallFontSize ?? null,
        h1Bold: design.h1Bold ?? null,
        h1Italic: design.h1Italic ?? null,
        h1Underline: design.h1Underline ?? null,
        h2Bold: design.h2Bold ?? null,
        h2Italic: design.h2Italic ?? null,
        h2Underline: design.h2Underline ?? null,
        bodyBold: design.bodyBold ?? null,
        bodyItalic: design.bodyItalic ?? null,
        bodyUnderline: design.bodyUnderline ?? null,
        smallBold: design.smallBold ?? null,
        smallItalic: design.smallItalic ?? null,
        smallUnderline: design.smallUnderline ?? null,
        templateId: design.templateId,
        checkoutFields: normalizeCheckoutFields(checkoutFields),
        eventPolicyHtml,
        arenaGalleryImages,
      });
      setEvent(res.event);
      setArenaGalleryImages(normalizeArenaGalleryImages(res.event.customization?.arenaGalleryImages));
      setCheckoutFields(normalizeCheckoutFields(res.event.customization?.checkoutFields));
      setEventPolicyHtml(resolveEventPolicyHtml(res.event.customization?.eventPolicyHtml));
      setDesign((prev) => ({
        ...prev,
        templateId: resolveLayoutTemplateId(res.event.templateId),
        eventCategory: (res.event.customization?.eventCategory as string) || prev.eventCategory,
        primaryColor: res.event.customization?.primaryColor || prev.primaryColor,
        secondaryColor: res.event.customization?.secondaryColor || prev.secondaryColor,
        fontFamily: resolveLandingFontKey(res.event.customization?.fontFamily) || prev.fontFamily,
        displayMode: (res.event.customization?.displayMode as LandingDesignValue['displayMode']) || prev.displayMode,
        landingStyle: (res.event.customization?.landingStyle as LandingDesignValue['landingStyle']) || prev.landingStyle,
        buttonColor: res.event.customization?.buttonColor,
        headingColor: res.event.customization?.headingColor,
        bodyTextColor: res.event.customization?.bodyTextColor,
        mutedTextColor: res.event.customization?.mutedTextColor,
        pageBackgroundColor: res.event.customization?.pageBackgroundColor,
        surfaceColor: res.event.customization?.surfaceColor,
        surfaceMutedColor: res.event.customization?.surfaceMutedColor,
        borderColor: res.event.customization?.borderColor,
        headerBgColor: res.event.customization?.headerBgColor,
        footerBgColor: res.event.customization?.footerBgColor,
        h1FontSize: res.event.customization?.h1FontSize,
        h2FontSize: res.event.customization?.h2FontSize,
        bodyFontSize: res.event.customization?.bodyFontSize,
        smallFontSize: res.event.customization?.smallFontSize,
        h1Bold: res.event.customization?.h1Bold,
        h1Italic: res.event.customization?.h1Italic,
        h1Underline: res.event.customization?.h1Underline,
        h2Bold: res.event.customization?.h2Bold,
        h2Italic: res.event.customization?.h2Italic,
        h2Underline: res.event.customization?.h2Underline,
        bodyBold: res.event.customization?.bodyBold,
        bodyItalic: res.event.customization?.bodyItalic,
        bodyUnderline: res.event.customization?.bodyUnderline,
        smallBold: res.event.customization?.smallBold,
        smallItalic: res.event.customization?.smallItalic,
        smallUnderline: res.event.customization?.smallUnderline,
      }));
      setFeedback('Event details and theme saved.');
    } catch (e: any) {
      setError(e?.message || e?.error || 'Failed to save changes');
    } finally {
      setSavingBranding(false);
    }
  };

  const saveEventPolicy = async (html: string) => {
    if (!eventId) return;
    setSavingPolicy(true);
    setError(null);
    try {
      const next = resolveEventPolicyHtml(html);
      const res = await api.post<{ event: Event }>(`/api/events/${eventId}/branding`, {
        eventPolicyHtml: next,
      });
      setEvent(res.event);
      setEventPolicyHtml(resolveEventPolicyHtml(res.event.customization?.eventPolicyHtml));
      setPolicyModalOpen(false);
      setFeedback('Event policy saved.');
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      setError(err?.message || err?.error || 'Failed to save event policy');
    } finally {
      setSavingPolicy(false);
    }
  };

  const savePaymentMethods = async (next: { payhere: boolean; bankTransfer: boolean }) => {
    if (!eventId) return;
    setSavingPaymentMethods(true);
    setError(null);
    try {
      const res = await api.post<{ event: Event }>(`/api/events/${eventId}/branding`, {
        paymentMethods: {
          payhere: next.payhere,
          bankTransfer: next.bankTransfer,
        },
      });
      setEvent(res.event);
      const pm = res.event.customization?.paymentMethods;
      setAllowPayhere(
        typeof res.event.allowPayhere === 'boolean'
          ? res.event.allowPayhere
          : typeof pm?.payhere === 'boolean'
            ? pm.payhere
            : true
      );
      setAllowBankTransfer(
        !!res.event.customization?.allowBankTransfer || !!res.event.allowBankTransfer || !!pm?.bankTransfer
      );
      setFeedback('Payment methods updated for this event.');
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      setError(err?.message || err?.error || 'Failed to update payment methods');
      await loadAll();
    } finally {
      setSavingPaymentMethods(false);
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
    if (ticketForm.price > 0 && paidEventReadiness && !paidEventReadiness.isReady) {
      setError('Complete business and payment setup in Organization settings before adding paid tickets.');
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
      if (e?.error === 'paid_event_setup_required') {
        setPaidEventReadiness(e.readiness || paidEventReadiness);
        setError(e?.message || 'Complete Organization setup before selling paid tickets.');
        return;
      }
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
      await navigator.clipboard.writeText(staffCheckInUrl);
      setCopyMsg('Staff link copied');
      window.setTimeout(() => setCopyMsg(null), 2500);
    } catch {
      setCopyMsg('Could not copy');
    }
  };

  if (loading) {
    return (
      <div
        className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center"
        style={{ background: ui.pageBg }}
      >
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: ui.borderColor, borderTopColor: ui.accent }}
        />
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
      className="flex min-h-[calc(100vh-3.5rem)] flex-col transition-[background] duration-700 ease-in-out"
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
            <button
              type="button"
              onClick={() => setShowLivePreview((v) => !v)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition',
                showLivePreview && 'turnout-btn-accent'
              )}
              style={showLivePreview ? accentButtonStyleFor(ui) : { ...cardStyle, color: ui.text }}
            >
              <Eye className="h-4 w-4" />
              {showLivePreview ? 'Hide preview' : 'Live preview'}
            </button>
            <button
              type="button"
              onClick={saveBranding}
              disabled={savingBranding}
              className="turnout-btn-accent rounded-xl px-4 py-2 text-sm font-semibold transition hover:brightness-105 disabled:opacity-40"
              style={accentButtonStyleFor(ui)}
            >
              {savingBranding ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => updateEventStatus(event.status === 'published' ? 'draft' : 'published')}
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{ ...cardStyle, color: ui.text }}
            >
              {event.status === 'published' ? 'Unpublish' : 'Publish'}
            </button>
            <span
              className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={{
                ...cardStyle,
                color: event.status === 'published' ? ui.accent : ui.textMuted,
              }}
            >
              {statusLabel[event.status]}
            </span>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className={cn(
            'mx-auto grid w-full max-w-[1440px] gap-8 px-4 py-6 pb-44 sm:px-8 lg:gap-10 lg:py-8 lg:pb-44',
            showLivePreview
              ? 'lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)_minmax(0,460px)]'
              : 'lg:grid-cols-[360px_1fr]'
          )}
        >
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

            {design.templateId === 'template-6' || design.templateId === 'template-10' ? (
              <ArenaGalleryEditor
                images={arenaGalleryImages}
                disabled={savingBranding}
                uploading={isUploadingArenaGallery}
                onUpload={uploadArenaGalleryFile}
                onRemove={(index) => setArenaGalleryImages((prev) => prev.filter((_, i) => i !== index))}
                ui={{
                  borderColor: ui.borderColor,
                  text: ui.text,
                  textMuted: ui.textMuted,
                  textSubtle: ui.textSubtle,
                  cardBg: ui.cardMutedBg,
                }}
              />
            ) : null}

            <EventCategoryPicker
              value={design.eventCategory}
              design={design}
              onChange={setDesign}
              ui={{
                text: ui.text,
                textMuted: ui.textMuted,
                textSubtle: ui.textSubtle,
                borderColor: ui.borderColor,
                accent: ui.accent,
                cardBg: ui.cardMutedBg,
              }}
            />

            <div className="rounded-xl border px-3.5 py-2.5" style={{ ...fieldStyle, borderColor: ui.borderColor }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                Layout template
              </p>
              <p className="mt-0.5 text-sm font-medium" style={{ color: ui.text }}>
                {LANDING_LAYOUT_TEMPLATES.find((t) => t.id === design.templateId)?.name ?? 'Showcase'}
              </p>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: ui.textSubtle }}>
              Customize design below — changes apply live in preview. Tap Save changes when you are done.
            </p>

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

            <SettingsCollapsibleSection
              title="Event details"
              subtitle={title.trim() || 'Name and descriptions'}
              open={isSectionOpen('details')}
              onToggle={() => toggleSection('details')}
              panelClassName={panelCn}
              cardStyle={cardStyle}
              ui={ui}
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event name"
                className="mb-4 w-full border-0 bg-transparent p-0 text-2xl font-semibold tracking-tight focus:outline-none sm:text-3xl"
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
                Shown under the title on your public page. Leave blank for no subtitle.
              </p>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                Full description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Event description"
                rows={4}
                className={cn(fieldClass, 'resize-y')}
                style={fieldStyle}
              />
            </SettingsCollapsibleSection>

            <SettingsCollapsibleSection
              title="Schedule"
              subtitle={scheduleTba ? 'To be announced' : `${formatScheduleDay(date)} · ${formatScheduleTime(date)}`}
              open={isSectionOpen('schedule')}
              onToggle={() => toggleSection('schedule')}
              panelClassName={panelCn}
              cardStyle={cardMutedStyle}
              ui={ui}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                  When
                </p>
                <div className="inline-flex rounded-xl border p-1" style={cardStyle}>
                  <button
                    type="button"
                    onClick={() => setScheduleTba(true)}
                    className="rounded-lg px-3.5 py-1.5 text-sm font-semibold transition"
                    style={accentSegmentStyleFor(ui, scheduleTba)}
                  >
                    To be announced
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleTba(false)}
                    className="rounded-lg px-3.5 py-1.5 text-sm font-semibold transition"
                    style={accentSegmentStyleFor(ui, !scheduleTba)}
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
                    <TurnoutDateTimePicker
                      value={date}
                      onChange={setDate}
                      fieldClassName={fieldClass}
                      fieldStyle={fieldStyle}
                      tone={ui.isDark ? 'dark' : 'light'}
                    />
                  </div>
                </div>
              )}
            </SettingsCollapsibleSection>

            <SettingsCollapsibleSection
              title="Location"
              subtitle={
                locationMode === 'online'
                  ? formatEventLocationDisplay({ mode: 'online', platform: onlinePlatform })
                  : location.trim() || 'Venue or place'
              }
              icon={<MapPin className="h-5 w-5 shrink-0" style={{ color: ui.accent }} />}
              open={isSectionOpen('location')}
              onToggle={() => toggleSection('location')}
              panelClassName={panelCn}
              cardStyle={cardStyle}
              ui={ui}
            >
              <EventLocationFields
                ui={ui}
                mode={locationMode}
                physicalLocation={location}
                onlinePlatform={onlinePlatform}
                onlineUrl={onlineUrl}
                onModeChange={setLocationMode}
                onPhysicalLocationChange={setLocation}
                onOnlinePlatformChange={setOnlinePlatform}
                onOnlineUrlChange={setOnlineUrl}
              />
            </SettingsCollapsibleSection>

            <SettingsCollapsibleSection
              title="Public URL"
              subtitle={slug ? `/e/${slug}` : 'Share link with attendees'}
              open={isSectionOpen('publicUrl')}
              onToggle={() => toggleSection('publicUrl')}
              panelClassName={panelCn}
              cardStyle={cardStyle}
              ui={ui}
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={slug} onChange={(e) => setSlug(e.target.value)} className={fieldClass} style={fieldStyle} />
                <button
                  type="button"
                  onClick={saveSlug}
                  disabled={savingSlug}
                  className="turnout-btn-accent rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                  style={accentButtonStyleFor(ui)}
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
            </SettingsCollapsibleSection>

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

            <SettingsCollapsibleSection
              title="Tickets"
              subtitle={`${tickets.length} tier${tickets.length === 1 ? '' : 's'} · ${soldTickets} sold`}
              icon={<TicketIcon className="h-5 w-5 shrink-0" style={{ color: ui.accent }} />}
              open={isSectionOpen('tickets')}
              onToggle={() => toggleSection('tickets')}
              panelClassName={panelCn}
              cardStyle={cardStyle}
              ui={ui}
            >
              <div className="space-y-3">
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

              {ticketForm.price > 0 && paidEventReadiness && !paidEventReadiness.isReady ? (
                <div className="mt-4">
                  <PaidEventSetupGate readiness={paidEventReadiness} title="Paid ticket setup required" />
                </div>
              ) : null}

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
                className="turnout-btn-accent mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                style={accentButtonStyleFor(ui)}
              >
                <Plus className="h-4 w-4" />
                {savingTicket ? 'Saving…' : editingTicketId ? 'Update tier' : 'Add tier'}
              </button>
            </SettingsCollapsibleSection>

            <SettingsCollapsibleSection
              title="Checkout questions"
              subtitle={
                checkoutFields.length
                  ? `${checkoutFields.length} custom field${checkoutFields.length === 1 ? '' : 's'}`
                  : 'NIC, company, dietary needs, etc.'
              }
              open={isSectionOpen('checkout')}
              onToggle={() => toggleSection('checkout')}
              panelClassName={panelCn}
              cardStyle={cardStyle}
              ui={ui}
            >
              <p className="mb-4 text-sm" style={{ color: ui.textMuted }}>
                Collect extra details from each ticket holder. Choose field type (short text, long text, number,
                dropdown, or radio) and save with event details.
              </p>
              <CheckoutFieldsEditor
                fields={checkoutFields}
                onChange={setCheckoutFields}
                ui={ui}
                fieldClass={fieldClass}
                fieldStyle={fieldStyle}
                cardMutedStyle={cardMutedStyle}
              />
            </SettingsCollapsibleSection>

            <SettingsCollapsibleSection
              title="Event policy"
              subtitle="Default template ready · edit anytime"
              open={isSectionOpen('policy')}
              onToggle={() => toggleSection('policy')}
              panelClassName={panelCn}
              cardStyle={cardStyle}
              ui={ui}
            >
              <p className="mb-4 text-sm" style={{ color: ui.textMuted }}>
                Every event starts with a clear ticket &amp; refund policy. Customize it for your venue, or insert the
                default template again anytime.
              </p>
              <div className="rounded-2xl border p-4" style={cardMutedStyle}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div
                      className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full"
                      style={{ background: ui.accentSoft, color: ui.accent }}
                    >
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: ui.text }}>
                        Event policy
                      </p>
                      <p className="mt-0.5 text-sm" style={{ color: ui.textMuted }}>
                        Shown on your public event page for attendees.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPolicyModalOpen(true)}
                    className="shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold"
                    style={accentButtonStyleFor(ui)}
                  >
                    Edit policy
                  </button>
                </div>
                <div
                  className="event-policy-content max-h-40 overflow-hidden text-sm leading-relaxed opacity-90"
                  style={{ color: ui.textMuted }}
                  dangerouslySetInnerHTML={{ __html: eventPolicyHtml }}
                />
              </div>
            </SettingsCollapsibleSection>

            <SettingsCollapsibleSection
              title="Payment methods"
              subtitle={
                [allowPayhere ? 'Online checkout' : null, allowBankTransfer ? 'Bank transfer' : null]
                  .filter(Boolean)
                  .join(' · ') || 'None enabled'
              }
              icon={<CreditCard className="h-5 w-5 shrink-0" style={{ color: ui.accent }} />}
              open={isSectionOpen('payments')}
              onToggle={() => toggleSection('payments')}
              panelClassName={panelCn}
              cardStyle={cardStyle}
              ui={ui}
            >
              <p className="mb-4 text-sm" style={{ color: ui.textMuted }}>
                Choose which payment methods attendees can use for this event. Configure providers in{' '}
                <Link to="/dashboard/organization" className="font-semibold underline underline-offset-2">
                  Organization → Payments
                </Link>
                .
              </p>

              <div className="overflow-hidden rounded-2xl border" style={cardMutedStyle}>
                <label className="flex items-start gap-3 border-b px-4 py-3.5" style={{ borderColor: ui.borderColor }}>
                  <input
                    type="checkbox"
                    checked={allowPayhere}
                    disabled={savingPaymentMethods}
                    onChange={(e) => {
                      const nextPayhere = e.target.checked;
                      setAllowPayhere(nextPayhere);
                      void savePaymentMethods({ payhere: nextPayhere, bankTransfer: allowBankTransfer });
                    }}
                    className="mt-1 h-4 w-4"
                    style={{ accentColor: ui.accent }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold" style={{ color: ui.text }}>
                        Online checkout
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={
                          allowPayhere
                            ? { background: 'rgba(16, 185, 129, 0.14)', color: '#059669' }
                            : { background: 'rgba(245, 158, 11, 0.16)', color: '#d97706' }
                        }
                      >
                        {allowPayhere ? 'Active' : 'Inactive'}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-sm" style={{ color: ui.textMuted }}>
                      Card / online checkout with instant confirmation
                    </span>
                  </span>
                  <CreditCard className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ui.textMuted }} />
                </label>

                <label className="flex items-start gap-3 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={allowBankTransfer}
                    disabled={savingPaymentMethods}
                    onChange={(e) => {
                      const nextBank = e.target.checked;
                      setAllowBankTransfer(nextBank);
                      void savePaymentMethods({ payhere: allowPayhere, bankTransfer: nextBank });
                    }}
                    className="mt-1 h-4 w-4"
                    style={{ accentColor: ui.accent }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold" style={{ color: ui.text }}>
                        Bank transfer
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={
                          allowBankTransfer
                            ? { background: 'rgba(16, 185, 129, 0.14)', color: '#059669' }
                            : { background: 'rgba(245, 158, 11, 0.16)', color: '#d97706' }
                        }
                      >
                        {allowBankTransfer ? 'Active' : 'Inactive'}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-sm" style={{ color: ui.textMuted }}>
                      Attendee transfers funds, uploads slip, you confirm
                    </span>
                  </span>
                  <Landmark className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ui.textMuted }} />
                </label>
              </div>

              {paidEventReadiness &&
              allowBankTransfer &&
              !(
                paidEventReadiness.bank.bankAccountHolderName &&
                paidEventReadiness.bank.bankName &&
                paidEventReadiness.bank.bankBranch &&
                paidEventReadiness.bank.bankAccountConfigured
              ) ? (
                <p className="mt-3 text-sm" style={{ color: ui.textMuted }}>
                  Add account holder, bank, branch, and account number in Organization settings before bank transfer will
                  appear at checkout.
                </p>
              ) : null}

              {allowBankTransfer && eventId ? (
                <p className="mt-3 text-sm" style={{ color: ui.textMuted }}>
                  Review and confirm transfer slips from{' '}
                  <Link
                    to={`/dashboard/events/${eventId}/checkin?tab=transfers`}
                    className="font-semibold underline underline-offset-2"
                    style={{ color: ui.accent }}
                  >
                    Check-in → Bank transfers
                  </Link>
                  .
                </p>
              ) : null}
            </SettingsCollapsibleSection>

            <SettingsCollapsibleSection
              title="More options"
              subtitle="PDF tickets, check-in, publish"
              open={isSectionOpen('advanced')}
              onToggle={() => toggleSection('advanced')}
              panelClassName={panelCn}
              cardStyle={cardStyle}
              ui={ui}
            >
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
                        <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5" style={fieldStyle}>
                          <span className="text-sm font-medium" style={{ color: ui.text }}>
                            Primary
                          </span>
                          <TurnoutColorPicker
                            value={ticketPdfPrimaryColor}
                            onChange={setTicketPdfPrimaryColor}
                            tone={ui.isDark ? 'dark' : 'light'}
                            ariaLabel="Ticket PDF primary colour"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5" style={fieldStyle}>
                          <span className="text-sm font-medium" style={{ color: ui.text }}>
                            Accent
                          </span>
                          <TurnoutColorPicker
                            value={ticketPdfAccentColor}
                            onChange={setTicketPdfAccentColor}
                            tone={ui.isDark ? 'dark' : 'light'}
                            ariaLabel="Ticket PDF accent colour"
                          />
                        </div>
                      </div>
                      <input value={ticketPdfBadgeText} onChange={(e) => setTicketPdfBadgeText(e.target.value)} className={fieldClass} style={fieldStyle} />
                      <input value={ticketPdfFooterNote} onChange={(e) => setTicketPdfFooterNote(e.target.value)} className={fieldClass} style={fieldStyle} />
                      <button
                        type="button"
                        onClick={saveTicketDesign}
                        disabled={savingTicketDesign}
                        className="turnout-btn-accent rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                        style={accentButtonStyleFor(ui)}
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
            </SettingsCollapsibleSection>
          </div>

          {showLivePreview && previewEvent && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                aria-hidden
                onClick={() => setShowLivePreview(false)}
              />
              <aside className="fixed inset-0 z-50 flex flex-col p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:static lg:z-auto lg:col-start-3 lg:row-start-1 lg:min-h-[calc(100vh-8rem)] lg:p-0 lg:pt-0">
                <EventLandingLivePreview
                  event={previewEvent}
                  tickets={previewTickets}
                  publicUrl={publicUrl || undefined}
                  onClose={() => setShowLivePreview(false)}
                  className="h-full min-h-0 shadow-2xl lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]"
                />
              </aside>
            </>
          )}
        </div>
      </div>

      <LandingDesignDock design={design} onDesignChange={setDesign} />
      <EventPolicyEditorModal
        open={policyModalOpen}
        value={eventPolicyHtml}
        ui={ui}
        saving={savingPolicy}
        onClose={() => setPolicyModalOpen(false)}
        onSave={(html) => void saveEventPolicy(html)}
      />
    </div>
  );
};
