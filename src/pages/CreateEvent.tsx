import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { resolveLayoutTemplateId } from '../templates/templates';
import { useFieldArray, useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Eye,
  FileText,
  Globe,
  MapPin,
  Plus,
  Ticket,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { Event, EventCustomization, OrganizerPaidEventReadiness, Ticket as EventTicket } from '../types';
import { api, toApiUrl } from '../api/client';
import { BannerUploadSquare } from '../components/ui/BannerUploadSquare';
import { EventLocationFields } from '../components/ui/EventLocationFields';
import { type LandingDesignValue } from '../components/organizer/LandingCustomizer';
import { LandingDesignDock } from '../components/organizer/LandingDesignDock';
import { EventLandingLivePreview } from '../components/organizer/EventLandingLivePreview';
import { PaidEventSetupGate } from '../components/organizer/PaidEventSetupGate';
import { ArenaGalleryEditor } from '../components/organizer/ArenaGalleryEditor';
import { formatEventLocationDisplay, isValidMeetingUrl } from '../utils/eventLocation';
import { APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { cn } from '../utils/cn';
import { EVENT_THEMES, type CreateThemeUI, type EventThemeId } from '../themes/eventThemes';
import { EVENT_CATEGORIES } from '../themes/eventCategories';
import { resolveTemplateDesignDefaults } from '../themes/templateDefaults';
import { landingCustomizationFromDesign } from '../themes/organizerLiveDesign';
import { accentButtonStyleFor, accentSegmentStyleFor, cardMutedStyleFor, cardStyleFor } from '../themes/flowUi';
import { TurnoutDateTimePicker, formatScheduleDay, formatScheduleTime } from '../components/ui/TurnoutDateTimePicker';
import { DEFAULT_EVENT_POLICY_HTML } from '../utils/eventPolicy';
import { normalizeEventGalleryImages } from '../components/landing/arenaGallery';

const ticketTierSchema = z.object({
  name: z.string().min(1, 'Tier name is required'),
  price: z.number().min(0, 'Price must be 0 or more'),
  quantity: z.number().min(1, 'At least 1 seat'),
});

const eventSchema = z
  .object({
    title: z.string().min(3, 'Event name must be at least 3 characters'),
    slug: z.string().optional(),
    description: z.string().optional(),
    shortDescription: z.string().max(160, 'Keep it under 160 characters').optional(),
    date: z.string().optional().or(z.literal('')),
    endDate: z.string().optional(),
    locationMode: z.enum(['physical', 'online']),
    location: z.string(),
    onlinePlatform: z.enum(['google_meet', 'zoom', 'youtube', 'other']),
    onlineUrl: z.string().optional(),
    bannerUrl: z
      .string()
      .refine(
        (value) =>
          value === '' ||
          /^https?:\/\//i.test(value) ||
          value.startsWith('/api/uploads/banners/') ||
          value.startsWith('data:image/'),
        'Must be a valid image URL'
      )
      .optional()
      .or(z.literal('')),
    tickets: z.array(ticketTierSchema).min(1, 'Add at least one ticket tier'),
    requireApproval: z.boolean(),
    useCustomDomain: z.boolean(),
    customDomain: z.string().optional(),
    dnsProvider: z.enum(['cloudflare', 'godaddy', 'namecheap', 'other']),
    dnsRecordType: z.enum(['CNAME', 'A']),
    dnsRecordTarget: z.string().optional(),
    dnsConfigured: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.locationMode === 'physical') {
      if (!(data.location || '').trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Location is required',
          path: ['location'],
        });
      }
    } else if (!isValidMeetingUrl(data.onlineUrl || '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid meeting or stream link (https://…)',
        path: ['onlineUrl'],
      });
    }
    if (data.endDate && data.date) {
      const start = new Date(data.date).getTime();
      const end = new Date(data.endDate).getTime();
      if (!Number.isNaN(start) && !Number.isNaN(end) && end < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'End must be after start',
          path: ['endDate'],
        });
      }
    }
    if (data.useCustomDomain) {
      const domain = (data.customDomain || '').trim();
      if (domain.length < 4 || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Enter a valid domain',
          path: ['customDomain'],
        });
      }
    }
  });

type EventFormValues = z.infer<typeof eventSchema>;

type CreateEventDraftV1 = {
  version: 1;
  savedAt: number;
  form: EventFormValues;
  ui: {
    ticketMode: 'free' | 'paid';
    freeUnlimited: boolean;
    visibility: 'public' | 'private';
    hasSchedule: boolean;
    hasEnd: boolean;
    eventGalleryImages: string[];
  };
  design: LandingDesignValue;
};

const CREATE_EVENT_DRAFT_VERSION = 1;
const CREATE_EVENT_DRAFT_KEY_PREFIX = 'turnout:create-event-draft:';

function createEventDraftKey(userId?: string): string {
  return `${CREATE_EVENT_DRAFT_KEY_PREFIX}${userId || 'anonymous'}`;
}

function fieldClassFor(ui: CreateThemeUI): string {
  return cn(
    'w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2',
    ui.isDark
      ? 'text-white placeholder:text-white/40 focus:ring-white/15'
      : 'text-neutral-900 placeholder:text-neutral-400 focus:ring-black/5'
  );
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultStartDate(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toDatetimeLocalValue(d);
}

function defaultEndDate(startIso: string): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) {
    const fallback = new Date();
    fallback.setHours(fallback.getHours() + 2);
    return toDatetimeLocalValue(fallback);
  }
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return toDatetimeLocalValue(end);
}

function Toggle({
  checked,
  onChange,
  label,
  accent,
  offColor,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  accent: string;
  offColor: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative h-7 w-12 shrink-0 rounded-full transition"
      style={{ backgroundColor: checked ? accent : offColor }}
    >
      <span
        className={cn(
          'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition',
          checked ? 'left-6' : 'left-1'
        )}
      />
    </button>
  );
}

export const CreateEvent: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  // Single base theme (Minimal). Event "category" presets drive the styling.
  const themeId: EventThemeId = 'minimal';
  const [ticketMode, setTicketMode] = useState<'free' | 'paid'>('free');
  const [freeUnlimited, setFreeUnlimited] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const [eventGalleryImages, setEventGalleryImages] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  // Default: "When" / to-be-announced. Organizers can opt in to a fixed schedule.
  const [hasSchedule, setHasSchedule] = useState(false);
  // End time is optional — most events only need a start.
  const [hasEnd, setHasEnd] = useState(false);
  const [paidEventReadiness, setPaidEventReadiness] = useState<OrganizerPaidEventReadiness | null>(null);
  const [showPaidSetupGate, setShowPaidSetupGate] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);

  const selectedTheme = EVENT_THEMES[themeId] || EVENT_THEMES.minimal;
  const [design, setDesign] = useState<LandingDesignValue>(() => {
    const defaults = resolveTemplateDesignDefaults('template-2');
    return {
      templateId: defaults.templateId,
      eventCategory: EVENT_CATEGORIES[0].id,
      primaryColor: defaults.primaryColor,
      secondaryColor: defaults.secondaryColor,
      fontFamily: defaults.fontFamily,
      displayMode: defaults.displayMode,
      landingStyle: defaults.landingStyle,
    };
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    setFocus,
    watch,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      description: '',
      shortDescription: '',
      date: defaultStartDate(),
      endDate: '',
      locationMode: 'physical',
      location: '',
      onlinePlatform: 'google_meet',
      onlineUrl: '',
      bannerUrl: '',
      tickets: [{ name: 'General Admission', price: 0, quantity: 500 }],
      requireApproval: false,
      useCustomDomain: false,
      customDomain: '',
      dnsProvider: 'cloudflare',
      dnsRecordType: 'CNAME',
      dnsRecordTarget: 'cname.vercel-dns.com',
      dnsConfigured: false,
    },
  });

  const submitErrorRef = React.useRef<HTMLDivElement>(null);
  const hydratedDraftRef = React.useRef(false);
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'tickets' });

  const title = watch('title');
  const slug = watch('slug');
  const description = watch('description');
  const shortDescription = watch('shortDescription');
  const date = watch('date');
  const endDate = watch('endDate');
  const locationMode = watch('locationMode');
  const location = watch('location');
  const onlinePlatform = watch('onlinePlatform');
  const onlineUrl = watch('onlineUrl');
  const bannerUrl = watch('bannerUrl');
  const tickets = watch('tickets');
  const requireApproval = watch('requireApproval');
  const useCustomDomain = watch('useCustomDomain');
  const customDomain = watch('customDomain');
  const dnsProvider = watch('dnsProvider');
  const dnsRecordType = watch('dnsRecordType');
  const dnsRecordTarget = watch('dnsRecordTarget');
  const dnsConfigured = watch('dnsConfigured');

  const ui = APP_FLOW_UI;
  const cardStyle = cardStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);
  const fieldClass = fieldClassFor(ui);
  const panelCn = cn('rounded-2xl border transition-[background,border-color,box-shadow] duration-300');

  useEffect(() => {
    if (hasEnd && !endDate && date) {
      setValue('endDate', defaultEndDate(date), { shouldValidate: true });
    }
    if (!hasEnd && endDate) {
      setValue('endDate', '', { shouldValidate: true });
    }
  }, [date, endDate, hasEnd, setValue]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await api.get<{ readiness: OrganizerPaidEventReadiness }>('/api/organizer/paid-event-readiness');
        setPaidEventReadiness(res.readiness);
      } catch {
        setPaidEventReadiness(null);
      }
    })();
  }, [user]);

  const totalSeats = useMemo(
    () => tickets.reduce((sum, t) => sum + (Number.isFinite(t.quantity) ? t.quantity : 0), 0),
    [tickets]
  );

  useEffect(() => {
    if (hydratedDraftRef.current) return;
    const storageKey = createEventDraftKey(user?.uid);
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        hydratedDraftRef.current = true;
        return;
      }
      const parsed = JSON.parse(raw) as Partial<CreateEventDraftV1>;
      if (parsed?.version !== CREATE_EVENT_DRAFT_VERSION || !parsed.form || !parsed.ui || !parsed.design) {
        localStorage.removeItem(storageKey);
        hydratedDraftRef.current = true;
        return;
      }

      const safeGallery = normalizeEventGalleryImages(parsed.ui.eventGalleryImages);
      reset(parsed.form as EventFormValues);
      setTicketMode(parsed.ui.ticketMode === 'paid' ? 'paid' : 'free');
      setFreeUnlimited(Boolean(parsed.ui.freeUnlimited));
      setVisibility(parsed.ui.visibility === 'private' ? 'private' : 'public');
      setHasSchedule(Boolean(parsed.ui.hasSchedule));
      setHasEnd(Boolean(parsed.ui.hasEnd));
      setEventGalleryImages(safeGallery);
      setDesign(parsed.design as LandingDesignValue);
    } catch {
      // Ignore malformed local drafts and continue with defaults.
    } finally {
      hydratedDraftRef.current = true;
    }
  }, [reset, user?.uid]);

  const normalizeBannerUrl = (url: string) => {
    if (!url || /^https?:\/\//i.test(url) || url.startsWith('data:image/')) return url;
    return toApiUrl(url);
  };

  useEffect(() => {
    if (!hydratedDraftRef.current) return;
    const storageKey = createEventDraftKey(user?.uid);
    const payload: CreateEventDraftV1 = {
      version: 1,
      savedAt: Date.now(),
      form: {
        title,
        slug,
        description,
        shortDescription,
        date,
        endDate,
        locationMode,
        location,
        onlinePlatform,
        onlineUrl,
        bannerUrl,
        tickets,
        requireApproval,
        useCustomDomain,
        customDomain,
        dnsProvider,
        dnsRecordType,
        dnsRecordTarget,
        dnsConfigured,
      },
      ui: {
        ticketMode,
        freeUnlimited,
        visibility,
        hasSchedule,
        hasEnd,
        eventGalleryImages,
      },
      design,
    };

    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch {
        // Ignore storage quota or privacy-mode errors.
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [
    bannerUrl,
    date,
    description,
    design,
    endDate,
    eventGalleryImages,
    freeUnlimited,
    hasEnd,
    hasSchedule,
    location,
    locationMode,
    onlinePlatform,
    onlineUrl,
    requireApproval,
    slug,
    customDomain,
    dnsProvider,
    dnsRecordType,
    dnsRecordTarget,
    dnsConfigured,
    shortDescription,
    ticketMode,
    tickets,
    title,
    useCustomDomain,
    user?.uid,
    visibility,
  ]);

  const switchToFreeMode = () => {
    setTicketMode('free');
    const first = tickets[0];
    replace([
      {
        name: first?.name || 'General Admission',
        price: 0,
        quantity: freeUnlimited ? 500 : Math.max(1, first?.quantity || 100),
      },
    ]);
  };

  const switchToPaidMode = () => {
    // Always enter paid mode so organizers can configure tiers. If payout setup is
    // incomplete, show the gate and still block publish via onSubmit / API assert.
    setTicketMode('paid');
    setShowPaidSetupGate(Boolean(paidEventReadiness && !paidEventReadiness.isReady));
    if (tickets.length === 1 && (tickets[0]?.price || 0) <= 0) {
      replace([
        { name: 'Early Bird', price: 1500, quantity: 50 },
        { name: 'General Admission', price: 2500, quantity: 150 },
      ]);
    }
  };

  const uploadBannerFile = async (file: File) => {
    setBannerUploadError(null);
    setIsUploadingBanner(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(toApiUrl('/api/uploads/banner'), {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const text = await res.text();
      let data: { bannerUrl?: string; error?: string; message?: string } | null = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      if (res.ok && data?.bannerUrl) {
        setValue('bannerUrl', normalizeBannerUrl(data.bannerUrl), { shouldDirty: true, shouldValidate: true });
        return;
      }
      setBannerUploadError(data?.message || 'Upload failed. Try again.');
    } catch {
      setBannerUploadError('Upload failed. Check your connection.');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const uploadGalleryFile = async (file: File) => {
    setBannerUploadError(null);
    setIsUploadingGallery(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(toApiUrl('/api/uploads/banner'), {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const text = await res.text();
      let data: { bannerUrl?: string; error?: string; message?: string } | null = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      if (res.ok && data?.bannerUrl) {
        const url = normalizeBannerUrl(data.bannerUrl);
        setEventGalleryImages((prev) => normalizeEventGalleryImages([...prev, url]));
        return;
      }
      setBannerUploadError(data?.message || 'Upload failed. Try again.');
    } catch {
      setBannerUploadError('Upload failed. Check your connection.');
    } finally {
      setIsUploadingGallery(false);
    }
  };

  const collectFormErrorMessages = (formErrors: FieldErrors<EventFormValues>): string[] => {
    const messages: string[] = [];
    const push = (message?: string) => {
      if (message && !messages.includes(message)) messages.push(message);
    };

    push(formErrors.title?.message);
    if (hasSchedule) {
      if (!(date || '').trim()) push('Start date & time is required');
      else push(formErrors.date?.message);
      push(formErrors.endDate?.message);
    }
    push(formErrors.location?.message);
    push(formErrors.onlineUrl?.message);
    push(formErrors.shortDescription?.message);
    push(formErrors.bannerUrl?.message);
    push(formErrors.customDomain?.message);
    push(formErrors.tickets?.message || formErrors.tickets?.root?.message);

    const ticketErrors = formErrors.tickets;
    if (Array.isArray(ticketErrors)) {
      ticketErrors.forEach((tier, index) => {
        if (!tier) return;
        push(tier.name?.message ? `Ticket ${index + 1}: ${tier.name.message}` : undefined);
        push(tier.price?.message ? `Ticket ${index + 1}: ${tier.price.message}` : undefined);
        push(tier.quantity?.message ? `Ticket ${index + 1}: ${tier.quantity.message}` : undefined);
      });
    }

    return messages;
  };

  const showValidationFeedback = (formErrors: FieldErrors<EventFormValues> = errors) => {
    const messages = collectFormErrorMessages(formErrors);
    setSubmitError(
      messages.length > 0
        ? `Please complete the required fields: ${messages.join(' · ')}`
        : 'Please complete the required fields before creating your event.'
    );
    requestAnimationFrame(() => {
      submitErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    const firstField =
      formErrors.title
        ? 'title'
        : hasSchedule && (!(date || '').trim() || formErrors.date)
          ? 'date'
          : formErrors.location
            ? 'location'
            : formErrors.customDomain
              ? 'customDomain'
              : null;
    if (firstField === 'title' || firstField === 'location' || firstField === 'customDomain') {
      try {
        setFocus(firstField);
      } catch {
        /* field may be unmounted */
      }
    }
  };

  const onInvalid = (formErrors: FieldErrors<EventFormValues>) => {
    showValidationFeedback(formErrors);
  };

  const onSubmit = async (data: EventFormValues) => {
    if (!user) return;
    setSubmitError(null);

    if (hasSchedule && !(data.date || '').trim()) {
      showValidationFeedback({ date: { type: 'required', message: 'Start date & time is required' } });
      return;
    }

    if (ticketMode === 'paid') {
      const hasPaidTier = data.tickets.some((t) => t.price > 0);
      if (!hasPaidTier) {
        setSubmitError('Add at least one paid ticket tier with a price greater than 0.');
        submitErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (paidEventReadiness && !paidEventReadiness.isReady) {
        setShowPaidSetupGate(true);
        setSubmitError(
          paidEventReadiness.gatewayMode === 'own_payhere'
            ? 'Connect your own gateway and add an account card in Organization → Payments before publishing a paid event.'
            : 'Add your bank payout details in Organization → Payments before publishing a paid event.'
        );
        submitErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const customization: EventCustomization = {
        themeId: selectedTheme.id,
        eventCategory: design.eventCategory,
        primaryColor: design.primaryColor,
        secondaryColor: design.secondaryColor,
        fontFamily: design.fontFamily,
        displayMode: design.displayMode,
        landingStyle: design.landingStyle,
        buttonColor: design.buttonColor,
        headingColor: design.headingColor,
        bodyTextColor: design.bodyTextColor,
        mutedTextColor: design.mutedTextColor,
        pageBackgroundColor: design.pageBackgroundColor,
        surfaceColor: design.surfaceColor,
        surfaceMutedColor: design.surfaceMutedColor,
        borderColor: design.borderColor,
        headerBgColor: design.headerBgColor,
        footerBgColor: design.footerBgColor,
        h1FontSize: design.h1FontSize,
        h2FontSize: design.h2FontSize,
        bodyFontSize: design.bodyFontSize,
        smallFontSize: design.smallFontSize,
        h1Bold: design.h1Bold,
        h1Italic: design.h1Italic,
        h1Underline: design.h1Underline,
        h2Bold: design.h2Bold,
        h2Italic: design.h2Italic,
        h2Underline: design.h2Underline,
        bodyBold: design.bodyBold,
        bodyItalic: design.bodyItalic,
        bodyUnderline: design.bodyUnderline,
        smallBold: design.smallBold,
        smallItalic: design.smallItalic,
        smallUnderline: design.smallUnderline,
        eventPolicyHtml: DEFAULT_EVENT_POLICY_HTML,
        scheduleTba: !hasSchedule,
        locationMode: data.locationMode,
        onlinePlatform: data.locationMode === 'online' ? data.onlinePlatform : undefined,
        onlineUrl: data.locationMode === 'online' ? (data.onlineUrl || '').trim() : undefined,
        heroText: data.title,
        // If organizer leaves short description empty, keep landing subtitle blank.
        heroSubtext: (data.shortDescription || '').trim(),
        layout: 'centered',
        customDomain: data.useCustomDomain ? (data.customDomain || '').trim() : undefined,
        dnsProvider: data.useCustomDomain ? data.dnsProvider : undefined,
        dnsRecordType: data.useCustomDomain ? data.dnsRecordType : undefined,
        dnsRecordTarget: data.useCustomDomain ? (data.dnsRecordTarget || '').trim() : undefined,
        dnsConfigured: data.useCustomDomain ? data.dnsConfigured : false,
        eventGalleryImages,
        arenaGalleryImages: eventGalleryImages,
      };

      const payloadTickets =
        ticketMode === 'free'
          ? [
              {
                name: data.tickets[0]?.name || 'General Admission',
                price: 0,
                quantity: freeUnlimited ? 500 : Math.max(1, data.tickets[0]?.quantity || 100),
                description: data.requireApproval ? 'Requires organizer approval' : undefined,
              },
            ]
          : data.tickets.map((ticket) => ({
              name: ticket.name,
              price: ticket.price,
              quantity: ticket.quantity,
              description: data.requireApproval ? 'Requires organizer approval' : undefined,
            }));

      const resolvedLocation =
        data.locationMode === 'online'
          ? formatEventLocationDisplay({ mode: 'online', platform: data.onlinePlatform })
          : data.location.trim();

      const created = await api.post<{ eventId: string; slug: string }>('/api/events', {
        slug: data.slug,
        title: data.title,
        description: (data.description || '').trim() || `Join us for ${data.title}.`,
        date: data.date,
        location: resolvedLocation,
        bannerUrl: data.bannerUrl || `https://picsum.photos/seed/${Date.now()}/1200/600`,
        templateId: design.templateId,
        customization,
        tickets: payloadTickets,
      });

      try {
        localStorage.removeItem(createEventDraftKey(user?.uid));
      } catch {
        // Ignore storage errors on cleanup.
      }
      window.open(`/e/${created.slug}`, '_blank', 'noopener,noreferrer');
      navigate('/dashboard');
    } catch (error: any) {
      if (error?.error === 'paid_event_setup_required') {
        setPaidEventReadiness(error.readiness || paidEventReadiness);
        setShowPaidSetupGate(true);
        setSubmitError(error?.message || 'Complete Organization setup before selling paid tickets.');
        return;
      }
      setSubmitError(error?.message || error?.error || 'Failed to create event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const locationReady =
    locationMode === 'online'
      ? isValidMeetingUrl(onlineUrl || '')
      : Boolean((location || '').trim());

  const canSubmit = title.trim().length >= 3 && locationReady && (!hasSchedule || !!(date || '').trim());

  const previewEvent = useMemo((): Event => {
    const scheduleTba = !hasSchedule;
    const baseCustomization = landingCustomizationFromDesign(design, themeId);
    const resolvedLocation =
      locationMode === 'online'
        ? formatEventLocationDisplay({ mode: 'online', platform: onlinePlatform })
        : location.trim() || 'Venue to be announced';
    const customization: EventCustomization = {
      ...baseCustomization,
      scheduleTba,
      locationMode,
      onlinePlatform: locationMode === 'online' ? onlinePlatform : undefined,
      onlineUrl: locationMode === 'online' ? (onlineUrl || '').trim() || undefined : undefined,
      heroSubtext: (shortDescription || '').trim(),
      heroText: title.trim() || 'Your event title',
      layout: 'standard',
      primaryColor: design.primaryColor,
      secondaryColor: design.secondaryColor,
      fontFamily: design.fontFamily,
      eventGalleryImages,
      arenaGalleryImages: eventGalleryImages,
    };
    return {
      id: 'preview',
      slug: 'preview-event',
      organizerId: user?.uid || 'preview',
      organizerName: user?.displayName || 'Your organization',
      title: title.trim() || 'Your event title',
      description:
        (description || '').trim() ||
        `Join us for ${title.trim() || 'an unforgettable live experience'}. Reserve your passes online.`,
      date: hasSchedule && date ? new Date(date).toISOString() : new Date().toISOString(),
      location: resolvedLocation,
      bannerUrl: bannerUrl
        ? normalizeBannerUrl(bannerUrl)
        : 'https://picsum.photos/seed/turnout-create-preview/1200/600',
      templateId: design.templateId,
      customization,
      status: 'published',
      createdAt: new Date().toISOString(),
    };
  }, [
    bannerUrl,
    date,
    description,
    design,
    hasSchedule,
    location,
    locationMode,
    onlinePlatform,
    onlineUrl,
    shortDescription,
    eventGalleryImages,
    themeId,
    title,
    user?.displayName,
    user?.uid,
  ]);

  const previewTickets = useMemo((): EventTicket[] => {
    const tiers = Array.isArray(tickets) ? tickets : [];
    if (tiers.length === 0) {
      return [
        {
          id: 'preview-tier',
          eventId: 'preview',
          name: 'General Admission',
          price: ticketMode === 'paid' ? 2500 : 0,
          quantity: 100,
          sold: 0,
          description: 'Add ticket tiers to preview pricing.',
        },
      ];
    }
    return tiers.map((tier, index) => ({
      id: `preview-tier-${index}`,
      eventId: 'preview',
      name: tier.name?.trim() || 'General Admission',
      price: tier.price,
      quantity: tier.quantity,
      sold: 0,
      description: requireApproval ? 'Requires organizer approval' : undefined,
    }));
  }, [requireApproval, ticketMode, tickets]);

  const fieldStyle = { backgroundColor: ui.fieldBg, borderColor: ui.borderColor, color: ui.text };

  return (
    <div
      className="flex min-h-[calc(100vh-3.5rem)] flex-col transition-[background,color] duration-500 ease-in-out"
      style={{ background: ui.pageBg, color: ui.text }}
    >
      <header
        className="shrink-0 border-b px-4 py-4 backdrop-blur-md transition-[background,border-color] duration-700 sm:px-8"
        style={{ background: ui.headerBg, borderColor: ui.borderColor }}
      >
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition hover:opacity-80"
              style={{ color: ui.textMuted }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <h1 className="text-lg font-semibold sm:text-xl" style={{ color: ui.text }}>
              Create Event
            </h1>
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
            <span
              className="hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium sm:inline-flex"
              style={{ ...cardStyle, color: ui.text }}
            >
              <CalendarDays className="h-3.5 w-3.5" style={{ color: ui.textSubtle }} />
              Personal Calendar
            </span>
            <button
              type="button"
              onClick={() => setVisibility(visibility === 'public' ? 'private' : 'public')}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-90"
              style={{ ...cardStyle, color: ui.text }}
            >
              <Globe className="h-3.5 w-3.5" style={{ color: ui.textSubtle }} />
              {visibility === 'public' ? 'Public' : 'Private'}
            </button>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            className={cn(
              'mx-auto grid w-full max-w-[1440px] gap-8 px-4 py-6 pb-72 sm:px-8 lg:gap-10 lg:py-8 lg:pb-72',
              showLivePreview
                ? 'lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)_minmax(0,460px)]'
                : 'lg:grid-cols-[360px_1fr]'
            )}
          >
            {/* Left column */}
            <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
              <BannerUploadSquare
                previewUrl={bannerUrl ? normalizeBannerUrl(bannerUrl) : undefined}
                disabled={isUploadingBanner}
                onFileSelect={(file) => void uploadBannerFile(file)}
                frameClassName={ui.bannerFrame}
                placeholderClassName={ui.bannerPlaceholder}
              />
              {bannerUploadError && <p className="text-xs text-rose-600">{bannerUploadError}</p>}
              <ArenaGalleryEditor
                images={eventGalleryImages}
                disabled={isSubmitting}
                uploading={isUploadingGallery}
                onUpload={uploadGalleryFile}
                onRemove={(index) => setEventGalleryImages((prev) => prev.filter((_, i) => i !== index))}
                title="Event gallery"
                description="Cover image is image 1. Add multiple visuals for all layouts."
                emptyText="No extra images yet — add posters, venue shots, or sponsor creatives."
                ui={{
                  borderColor: ui.borderColor,
                  text: ui.text,
                  textMuted: ui.textMuted,
                  textSubtle: ui.textSubtle,
                  cardBg: ui.cardMutedBg,
                }}
              />

              <div className="rounded-2xl border p-4" style={cardMutedStyle}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                  Setup progress
                </p>
                <div className="mt-3 space-y-2.5">
                  {[
                    { label: 'Event name', done: (title || '').trim().length >= 3, icon: <FileText className="h-3.5 w-3.5" /> },
                    { label: 'Cover image', done: (bannerUrl || '').trim() !== '', icon: <Eye className="h-3.5 w-3.5" /> },
                    {
                      label: 'Location',
                      done:
                        locationMode === 'online'
                          ? isValidMeetingUrl((onlineUrl || '').trim())
                          : (location || '').trim().length >= 3,
                      icon: <MapPin className="h-3.5 w-3.5" />,
                    },
                    {
                      label: ticketMode === 'paid' ? 'Paid ticket added' : 'Free ticket ready',
                      done: ticketMode === 'paid' ? tickets.some((t) => Number(t.price) > 0) : true,
                      icon: <Ticket className="h-3.5 w-3.5" />,
                    },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2" style={cardStyle}>
                      <span
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
                        style={{
                          background: item.done ? ui.accentSoft : 'rgba(255,255,255,0.06)',
                          color: item.done ? ui.accent : ui.textMuted,
                        }}
                      >
                        {item.icon}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-xs font-medium" style={{ color: ui.text }}>
                        {item.label}
                      </p>
                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: item.done ? ui.accent : ui.textMuted }}
                      >
                        {item.done ? 'Done' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border p-4" style={cardMutedStyle}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                  Quick guidance
                </p>
                <ul className="mt-2 space-y-1.5 text-xs leading-relaxed" style={{ color: ui.textMuted }}>
                  <li>Use a clear banner image to boost conversions.</li>
                  <li>{ticketMode === 'paid' ? 'Add at least one paid ticket tier.' : 'Switch to Paid when you need pricing tiers.'}</li>
                  <li>{visibility === 'public' ? 'This event is currently visible to everyone.' : 'This event is private right now.'}</li>
                </ul>
              </div>

            </div>

            {/* Right column */}
            <div className="flex flex-col">
              {submitError && (
                <div
                  ref={submitErrorRef}
                  role="alert"
                  className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="mb-6 flex flex-wrap gap-2 sm:hidden">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
                  style={{ ...cardStyle, color: ui.text }}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Personal Calendar
                </span>
                <button
                  type="button"
                  onClick={() => setVisibility(visibility === 'public' ? 'private' : 'public')}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
                  style={{ ...cardStyle, color: ui.text }}
                >
                  <Globe className="h-3.5 w-3.5" />
                  {visibility === 'public' ? 'Public' : 'Private'}
                </button>
              </div>

              <input
                {...register('title')}
                placeholder="Event Name"
                className="mb-6 w-full border-0 bg-transparent p-0 text-3xl font-semibold tracking-tight focus:outline-none focus:ring-0 sm:text-4xl"
                style={{ color: ui.text }}
              />
              {errors.title && <p className="-mt-4 mb-4 text-xs text-rose-600">{errors.title.message}</p>}

              {/* Schedule — no timezone */}
              <div className="mb-5 rounded-2xl border p-5 transition-[background,border-color] duration-700" style={cardMutedStyle}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                    When
                  </p>
                  <div className="inline-flex rounded-xl border p-1" style={cardStyle}>
                    <button
                      type="button"
                      onClick={() => setHasSchedule(false)}
                      className="rounded-lg px-3.5 py-1.5 text-sm font-semibold transition"
                      style={accentSegmentStyleFor(ui, !hasSchedule)}
                    >
                      To be announced
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasSchedule(true)}
                      className="rounded-lg px-3.5 py-1.5 text-sm font-semibold transition"
                      style={accentSegmentStyleFor(ui, hasSchedule)}
                    >
                      Set date &amp; time
                    </button>
                  </div>
                </div>

                {!hasSchedule ? (
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-5 w-5 shrink-0" style={{ color: ui.textSubtle }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: ui.text }}>
                        Date &amp; time to be announced
                      </p>
                      <p className="text-xs" style={{ color: ui.textSubtle }}>
                        Attendees can reserve now; add the schedule whenever you’re ready.
                      </p>
                    </div>
                  </div>
                ) : (
                <div className="relative space-y-5">
                  {hasEnd && (
                    <div
                      className="absolute bottom-8 left-[7px] top-8 w-px border-l border-dashed"
                      style={{ borderColor: ui.lineDashed }}
                      aria-hidden
                    />
                  )}

                  <div className="relative space-y-2">
                    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                      <span
                        className="z-10 h-3.5 w-3.5 rounded-full border-2 bg-white"
                        style={{ borderColor: ui.dotActive }}
                      />
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
                      id="event-start-datetime"
                      label="Start date & time"
                      value={date}
                      onChange={(next) => setValue('date', next, { shouldValidate: true })}
                      fieldClassName={fieldClass}
                      fieldStyle={fieldStyle}
                      tone={ui.isDark ? 'dark' : 'light'}
                    />
                    {errors.date && <p className="text-xs text-rose-600">{errors.date.message}</p>}
                  </div>

                  {hasEnd ? (
                    <div className="relative space-y-2">
                      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                        <span
                          className="z-10 h-3.5 w-3.5 rounded-full border-2 bg-white"
                          style={{ borderColor: ui.dotInactive }}
                        />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                            End
                          </p>
                          <p className="text-sm font-medium" style={{ color: ui.text }}>
                            {formatScheduleDay(endDate || defaultEndDate(date))}
                          </p>
                        </div>
                        <p className="text-sm font-semibold" style={{ color: ui.text }}>
                          {formatScheduleTime(endDate || defaultEndDate(date))}
                        </p>
                      </div>
                      <TurnoutDateTimePicker
                        id="event-end-datetime"
                        label="End date & time"
                        value={endDate || defaultEndDate(date)}
                        min={date}
                        onChange={(next) => setValue('endDate', next, { shouldValidate: true })}
                        fieldClassName={fieldClass}
                        fieldStyle={fieldStyle}
                        tone={ui.isDark ? 'dark' : 'light'}
                      />
                      {errors.endDate && <p className="text-xs text-rose-600">{errors.endDate.message}</p>}
                      <button
                        type="button"
                        onClick={() => setHasEnd(false)}
                        className="ml-7 text-xs font-semibold transition hover:opacity-80"
                        style={{ color: ui.textMuted }}
                      >
                        Remove end time
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setHasEnd(true)}
                      className="ml-7 inline-flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-80"
                      style={{ color: ui.accent }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add end time
                    </button>
                  )}
                </div>
                )}
              </div>

              {/* Location */}
              <div className={cn(panelCn, 'mb-4 p-4')} style={cardStyle}>
                <div className="flex items-start gap-3">
                  <MapPin className="mt-1 h-4 w-4 shrink-0" style={{ color: ui.textSubtle }} />
                  <div className="min-w-0 flex-1">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                      Location
                    </p>
                    <EventLocationFields
                      ui={ui}
                      compact
                      mode={locationMode}
                      physicalLocation={location}
                      onlinePlatform={onlinePlatform}
                      onlineUrl={onlineUrl || ''}
                      onModeChange={(mode) => setValue('locationMode', mode, { shouldValidate: true })}
                      onPhysicalLocationChange={(value) => setValue('location', value, { shouldValidate: true })}
                      onOnlinePlatformChange={(platform) =>
                        setValue('onlinePlatform', platform, { shouldValidate: true })
                      }
                      onOnlineUrlChange={(url) => setValue('onlineUrl', url, { shouldValidate: true })}
                      error={errors.location?.message || errors.onlineUrl?.message || null}
                    />
                  </div>
                </div>
              </div>

              {/* Short description (hero subtitle) */}
              <div className={cn(panelCn, 'mb-4 p-4')} style={cardStyle}>
                <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                  Short description
                </label>
                <input
                  {...register('shortDescription')}
                  placeholder="One-line tagline shown under the title (optional)"
                  className="mt-1.5 w-full border-0 bg-transparent p-0 text-sm focus:outline-none"
                  style={{ color: ui.text }}
                  maxLength={160}
                />
                <p className="mt-1 text-xs" style={{ color: ui.textSubtle }}>
                  Appears under the event title on your landing page. Leave blank to use the start of the description.
                </p>
                {errors.shortDescription && (
                  <p className="mt-1 text-xs text-rose-600">{errors.shortDescription.message}</p>
                )}
              </div>

              {/* Description */}
              <div className={cn(panelCn, 'mb-6 p-4')} style={cardStyle}>
                <div className="flex items-start gap-3">
                  <FileText className="mt-1 h-4 w-4 shrink-0" style={{ color: ui.textSubtle }} />
                  <textarea
                    {...register('description')}
                    rows={3}
                    placeholder="Add full Description (optional)"
                    className="min-h-[72px] w-full resize-none border-0 bg-transparent p-0 text-sm focus:outline-none"
                    style={{ color: ui.text }}
                  />
                </div>
              </div>

              {/* Tickets */}
              <div className="mb-6">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                    Tickets
                  </p>
                  <div className="inline-flex rounded-xl border p-1" style={cardMutedStyle}>
                    <button
                      type="button"
                      onClick={switchToFreeMode}
                      className="rounded-lg px-4 py-1.5 text-sm font-semibold transition"
                      style={
                        ticketMode === 'free'
                          ? accentButtonStyleFor(ui)
                          : { color: ui.textMuted }
                      }
                    >
                      Free
                    </button>
                    <button
                      type="button"
                      onClick={switchToPaidMode}
                      className="rounded-lg px-4 py-1.5 text-sm font-semibold transition"
                      style={
                        ticketMode === 'paid'
                          ? accentButtonStyleFor(ui)
                          : { color: ui.textMuted }
                      }
                    >
                      Paid
                    </button>
                  </div>
                </div>

                {ticketMode === 'paid' && paidEventReadiness && !paidEventReadiness.isReady ? (
                  <div className="mb-4">
                    <PaidEventSetupGate
                      readiness={paidEventReadiness}
                      onDismiss={() => {
                        setShowPaidSetupGate(false);
                        switchToFreeMode();
                      }}
                    />
                  </div>
                ) : null}

                {ticketMode === 'free' ? (
                  <div className="space-y-3 rounded-2xl border p-4 transition-[background,border-color] duration-700" style={cardMutedStyle}>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium" style={{ color: ui.textMuted }}>
                        Ticket name
                      </label>
                      <input
                        {...register('tickets.0.name')}
                        placeholder="General Admission"
                        className={fieldClass}
                        style={fieldStyle}
                      />
                    </div>
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
                      style={cardStyle}
                    >
                      <div>
                        <p className="text-sm font-medium" style={{ color: ui.text }}>
                          Capacity
                        </p>
                        <p className="text-xs" style={{ color: ui.textSubtle }}>
                          {freeUnlimited ? 'Unlimited seats' : `${tickets[0]?.quantity || 0} seats`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFreeUnlimited(true);
                            setValue('tickets.0.quantity', 500, { shouldDirty: true });
                          }}
                          className="turnout-btn-accent rounded-lg px-3 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor: freeUnlimited ? ui.accent : ui.accentSoft,
                            color: freeUnlimited ? ui.accentOn : ui.textMuted,
                          }}
                        >
                          Unlimited
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFreeUnlimited(false);
                            setValue('tickets.0.quantity', 100, { shouldDirty: true });
                          }}
                          className="rounded-lg px-3 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor: !freeUnlimited ? ui.accent : ui.accentSoft,
                            color: !freeUnlimited ? ui.accentOn : ui.textMuted,
                          }}
                        >
                          Limited
                        </button>
                      </div>
                    </div>
                    {!freeUnlimited && (
                      <div>
                        <label className="mb-1.5 block text-xs font-medium" style={{ color: ui.textMuted }}>
                          Seat quantity
                        </label>
                        <input
                          {...register('tickets.0.quantity', { valueAsNumber: true })}
                          type="number"
                          min={1}
                          className={fieldClass}
                          style={fieldStyle}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className={cn(panelCn, 'p-4 shadow-sm')}
                        style={cardStyle}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Ticket className="h-4 w-4" style={{ color: ui.textSubtle }} />
                            <span className="text-sm font-semibold" style={{ color: ui.text }}>
                              Tier {index + 1}
                            </span>
                          </div>
                          {fields.length > 1 && (
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                              aria-label="Remove tier"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="sm:col-span-1">
                            <label className="mb-1.5 block text-xs font-medium" style={{ color: ui.textMuted }}>
                              Name
                            </label>
                            <input
                              {...register(`tickets.${index}.name` as const)}
                              placeholder="e.g. VIP, Early Bird"
                              className={fieldClass}
                              style={fieldStyle}
                            />
                            {errors.tickets?.[index]?.name && (
                              <p className="mt-1 text-xs text-rose-600">{errors.tickets[index]?.name?.message}</p>
                            )}
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-medium" style={{ color: ui.textMuted }}>
                              Price (LKR)
                            </label>
                            <input
                              {...register(`tickets.${index}.price` as const, { valueAsNumber: true })}
                              type="number"
                              min={0}
                              className={fieldClass}
                              style={fieldStyle}
                            />
                            {errors.tickets?.[index]?.price && (
                              <p className="mt-1 text-xs text-rose-600">{errors.tickets[index]?.price?.message}</p>
                            )}
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-medium" style={{ color: ui.textMuted }}>
                              Seats
                            </label>
                            <input
                              {...register(`tickets.${index}.quantity` as const, { valueAsNumber: true })}
                              type="number"
                              min={1}
                              className={fieldClass}
                              style={fieldStyle}
                            />
                            {errors.tickets?.[index]?.quantity && (
                              <p className="mt-1 text-xs text-rose-600">{errors.tickets[index]?.quantity?.message}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        append({
                          name: `Tier ${fields.length + 1}`,
                          price: 2500,
                          quantity: 50,
                        })
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-sm font-semibold transition hover:opacity-90"
                      style={{ ...cardMutedStyle, color: ui.text }}
                    >
                      <Plus className="h-4 w-4" />
                      Add ticket tier
                    </button>

                    <p className="text-xs" style={{ color: ui.textSubtle }}>
                      Total capacity across tiers:{' '}
                      <span className="font-semibold" style={{ color: ui.text }}>
                        {totalSeats.toLocaleString()}
                      </span>{' '}
                      seats
                    </p>
                  </div>
                )}

                {errors.tickets?.message && (
                  <p className="mt-2 text-xs text-rose-600">{errors.tickets.message}</p>
                )}
              </div>

              {/* Require approval */}
              <div
                className="mb-6 flex items-center justify-between rounded-2xl border px-4 py-3.5 transition-[background,border-color] duration-700"
                style={cardStyle}
              >
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4" style={{ color: ui.textSubtle }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: ui.text }}>
                      Require Approval
                    </p>
                    <p className="text-xs" style={{ color: ui.textSubtle }}>
                      Manually approve registrations
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={requireApproval}
                  onChange={(v) => setValue('requireApproval', v)}
                  label="Require approval"
                  accent={ui.accent}
                  offColor={ui.isDark ? 'rgba(255,255,255,0.25)' : '#d1d5db'}
                />
              </div>

              {/* Advanced */}
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center justify-between py-2 text-sm font-medium transition hover:opacity-80"
                style={{ color: ui.textMuted }}
              >
                More options (URL slug, custom domain)
                <ChevronDown className={cn('h-4 w-4 transition', showAdvanced && 'rotate-180')} />
              </button>
              {showAdvanced && (
                <div className="mb-6 space-y-3 rounded-2xl border p-4 transition-[background,border-color] duration-700" style={cardMutedStyle}>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium" style={{ color: ui.textMuted }}>
                      Custom URL slug
                    </label>
                    <input {...register('slug')} placeholder="my-event (optional)" className={fieldClass} style={fieldStyle} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: ui.text }}>
                      Custom domain
                    </span>
                    <Toggle
                      checked={useCustomDomain}
                      onChange={(v) => setValue('useCustomDomain', v)}
                      label="Custom domain"
                      accent={ui.accent}
                      offColor={ui.isDark ? 'rgba(255,255,255,0.25)' : '#d1d5db'}
                    />
                  </div>
                  {useCustomDomain && (
                    <div className="space-y-2">
                      <input
                        {...register('customDomain')}
                        placeholder="events.yourbrand.com"
                        className={fieldClass}
                        style={fieldStyle}
                      />
                      <p className="text-xs leading-relaxed" style={{ color: ui.textSubtle }}>
                        After creating the event, open <strong>Event settings</strong> for DNS records. Point a{' '}
                        <span className="font-mono">CNAME</span> to <span className="font-mono">cname.vercel-dns.com</span>{' '}
                        (or use the exact target shown in settings).
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="turnout-btn-accent mt-6 w-full rounded-xl px-8 py-3.5 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
                style={accentButtonStyleFor(ui)}
                onMouseEnter={(e) => {
                  if (!isSubmitting) e.currentTarget.style.backgroundColor = ui.accentHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = ui.accent;
                }}
              >
                {isSubmitting ? 'Creating…' : 'Create Event'}
              </button>
              {!canSubmit && !submitError && (
                <p className="mt-2 text-center text-xs" style={{ color: ui.textSubtle }}>
                  Tip: event name and a venue or meeting link are required
                  {hasSchedule ? ', plus a start date & time' : ''}.
                </p>
              )}
            </div>

            {showLivePreview && (
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
                    onClose={() => setShowLivePreview(false)}
                    className="h-full min-h-0 shadow-2xl lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]"
                  />
                </aside>
              </>
            )}
          </div>
        </div>

        {/* Floating landing design dock */}
        <LandingDesignDock design={design} onDesignChange={setDesign} />
      </form>
    </div>
  );
};
