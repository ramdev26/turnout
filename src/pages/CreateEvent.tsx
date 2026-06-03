import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  FileText,
  Globe,
  MapPin,
  Plus,
  Ticket,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { EventCustomization } from '../types';
import { api, toApiUrl } from '../api/client';
import { BannerUploadSquare } from '../components/ui/BannerUploadSquare';
import { LocationAutocomplete } from '../components/ui/LocationAutocomplete';
import { type LandingDesignValue } from '../components/organizer/LandingCustomizer';
import { LandingDesignDock } from '../components/organizer/LandingDesignDock';
import { cn } from '../utils/cn';
import { EVENT_THEMES, type CreateThemeUI, type EventThemeId } from '../themes/eventThemes';
import { EVENT_CATEGORIES } from '../themes/eventCategories';
import { useOrganizerLiveDesign } from '../themes/organizerLiveDesign';

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
    date: z.string().min(1, 'Start time is required'),
    endDate: z.string().optional(),
    location: z.string().min(1, 'Location is required'),
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

function fieldClassFor(ui: CreateThemeUI): string {
  return cn(
    'w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2',
    ui.isDark
      ? 'text-white placeholder:text-white/40 focus:ring-white/15'
      : 'text-neutral-900 placeholder:text-neutral-400 focus:ring-black/5'
  );
}

function openNativePicker(el: HTMLInputElement) {
  if (typeof el.showPicker === 'function') {
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  } else {
    el.focus();
  }
}

function ScheduleDateTimeField({
  id,
  label,
  labelColor,
  value,
  onChange,
  fieldClass,
  fieldStyle,
  isDark,
  min,
}: {
  id: string;
  label: string;
  labelColor: string;
  value: string;
  onChange: (next: string) => void;
  fieldClass: string;
  fieldStyle: React.CSSProperties;
  isDark: boolean;
  min?: string;
}) {
  const localValue = value.includes('T') ? value.slice(0, 16) : '';
  return (
    <label className="space-y-1" htmlFor={id}>
      <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: labelColor }}>
        <CalendarDays className="h-3.5 w-3.5 opacity-70" />
        {label}
      </span>
      <input
        id={id}
        type="datetime-local"
        value={localValue}
        min={min}
        step={300}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => openNativePicker(e.currentTarget)}
        className={cn(fieldClass, 'min-h-[44px] cursor-pointer')}
        style={{ ...fieldStyle, colorScheme: isDark ? 'dark' : 'light' }}
      />
    </label>
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
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  // Default: "When" / to-be-announced. Organizers can opt in to a fixed schedule.
  const [hasSchedule, setHasSchedule] = useState(false);
  // End time is optional — most events only need a start.
  const [hasEnd, setHasEnd] = useState(false);

  const selectedTheme = EVENT_THEMES[themeId] || EVENT_THEMES.minimal;
  const [design, setDesign] = useState<LandingDesignValue>(() => {
    const cat = EVENT_CATEGORIES[0];
    return {
      eventCategory: cat.id,
      primaryColor: cat.primaryColor,
      secondaryColor: cat.secondaryColor,
      fontFamily: cat.fontFamily,
      displayMode: 'auto',
      landingStyle: cat.landingStyle,
    };
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
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
      location: '',
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

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'tickets' });

  const title = watch('title');
  const date = watch('date');
  const endDate = watch('endDate');
  const location = watch('location');
  const bannerUrl = watch('bannerUrl');
  const tickets = watch('tickets');
  const requireApproval = watch('requireApproval');
  const useCustomDomain = watch('useCustomDomain');

  const { ui, landingVars, titleFont, bodyFont, panelClass, cardStyle, cardMutedStyle } = useOrganizerLiveDesign(
    design,
    themeId
  );
  const fieldClass = fieldClassFor(ui);
  const panelCn = cn(
    'rounded-2xl border transition-[background,border-color,box-shadow] duration-700',
    panelClass
  );

  useEffect(() => {
    if (hasEnd && !endDate && date) {
      setValue('endDate', defaultEndDate(date), { shouldValidate: true });
    }
    if (!hasEnd && endDate) {
      setValue('endDate', '', { shouldValidate: true });
    }
  }, [date, endDate, hasEnd, setValue]);

  const totalSeats = useMemo(
    () => tickets.reduce((sum, t) => sum + (Number.isFinite(t.quantity) ? t.quantity : 0), 0),
    [tickets]
  );

  const normalizeBannerUrl = (url: string) => {
    if (!url || /^https?:\/\//i.test(url) || url.startsWith('data:image/')) return url;
    return toApiUrl(url);
  };

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
    setTicketMode('paid');
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

  const onSubmit = async (data: EventFormValues) => {
    if (!user) return;
    setSubmitError(null);

    if (ticketMode === 'paid') {
      const hasPaidTier = data.tickets.some((t) => t.price > 0);
      if (!hasPaidTier) {
        setSubmitError('Add at least one paid ticket tier with a price greater than 0.');
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
        scheduleTba: !hasSchedule,
        heroText: data.title,
        // If organizer leaves short description empty, keep landing subtitle blank.
        heroSubtext: (data.shortDescription || '').trim(),
        layout: 'centered',
        customDomain: data.useCustomDomain ? (data.customDomain || '').trim() : undefined,
        dnsProvider: data.useCustomDomain ? data.dnsProvider : undefined,
        dnsRecordType: data.useCustomDomain ? data.dnsRecordType : undefined,
        dnsRecordTarget: data.useCustomDomain ? (data.dnsRecordTarget || '').trim() : undefined,
        dnsConfigured: data.useCustomDomain ? data.dnsConfigured : false,
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

      const created = await api.post<{ eventId: string; slug: string }>('/api/events', {
        slug: data.slug,
        title: data.title,
        description: (data.description || '').trim() || `Join us for ${data.title}.`,
        date: data.date,
        location: data.location,
        bannerUrl: data.bannerUrl || `https://picsum.photos/seed/${Date.now()}/1200/600`,
        templateId: selectedTheme.templateId,
        customization,
        tickets: payloadTickets,
      });

      window.open(`/e/${created.slug}`, '_blank', 'noopener,noreferrer');
      navigate('/dashboard');
    } catch (error: any) {
      setSubmitError(error?.message || error?.error || 'Failed to create event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = title.length >= 3 && !!date && !!location?.trim();

  const fieldStyle = { backgroundColor: ui.fieldBg, borderColor: ui.borderColor, color: ui.text };

  return (
    <div
      className="flex min-h-[calc(100vh-4rem)] flex-col transition-[background,color] duration-500 ease-in-out"
      style={{ ...landingVars, background: ui.pageBg, color: ui.text, fontFamily: bodyFont }}
    >
      <header
        className="shrink-0 border-b px-4 py-4 backdrop-blur-md transition-[background,border-color] duration-700 sm:px-8"
        style={{ background: ui.headerBg, borderColor: ui.borderColor }}
      >
        <div className="mx-auto flex max-w-[1440px] items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition hover:opacity-80"
              style={{ color: ui.textMuted }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <h1 className="text-lg font-semibold sm:text-xl" style={{ color: ui.text, fontFamily: titleFont }}>
              Create Event
            </h1>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
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

      <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid w-full max-w-[1440px] gap-8 px-4 py-6 pb-72 sm:px-8 lg:grid-cols-[360px_1fr] lg:gap-10 lg:py-8 lg:pb-72">
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

              <div className="rounded-xl border px-3.5 py-2.5" style={{ ...fieldStyle, borderColor: ui.borderColor }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                  Theme
                </p>
                <p className="mt-0.5 text-sm font-medium" style={{ color: ui.text }}>
                  Minimal
                </p>
              </div>

              <p className="text-xs leading-relaxed" style={{ color: ui.textSubtle }}>
                Use Customize design below — colour, font, and style update live on this page.
              </p>
            </div>

            {/* Right column */}
            <div className="flex flex-col">
              {submitError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {submitError}
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
                style={{ color: ui.text, fontFamily: titleFont }}
              />
              {errors.title && <p className="-mt-4 mb-4 text-xs text-rose-600">{errors.title.message}</p>}

              {/* Schedule — no timezone */}
              <div className="mb-5 rounded-2xl border p-5 transition-[background,border-color] duration-700" style={cardMutedStyle}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                    When
                  </p>
                  <div className={cn('inline-flex rounded-xl border p-1', panelClass)} style={cardStyle}>
                    <button
                      type="button"
                      onClick={() => setHasSchedule(false)}
                      className="rounded-lg px-3.5 py-1.5 text-sm font-semibold transition"
                      style={!hasSchedule ? { backgroundColor: ui.accent, color: '#fff' } : { color: ui.textMuted }}
                    >
                      To be announced
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasSchedule(true)}
                      className="rounded-lg px-3.5 py-1.5 text-sm font-semibold transition"
                      style={hasSchedule ? { backgroundColor: ui.accent, color: '#fff' } : { color: ui.textMuted }}
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
                    <ScheduleDateTimeField
                      id="event-start-datetime"
                      label="Start date & time"
                      labelColor={ui.textSubtle}
                      value={date}
                      onChange={(next) => setValue('date', next, { shouldValidate: true })}
                      fieldClass={fieldClass}
                      fieldStyle={fieldStyle}
                      isDark={ui.isDark}
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
                      <ScheduleDateTimeField
                        id="event-end-datetime"
                        label="End date & time"
                        labelColor={ui.textSubtle}
                        value={endDate || defaultEndDate(date)}
                        min={date}
                        onChange={(next) => setValue('endDate', next, { shouldValidate: true })}
                        fieldClass={fieldClass}
                        fieldStyle={fieldStyle}
                        isDark={ui.isDark}
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
                    <Controller
                      name="location"
                      control={control}
                      render={({ field }) => (
                        <LocationAutocomplete
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          placeholder="Search venue or place"
                          className="w-full border-0 bg-transparent p-0 text-sm font-medium focus:outline-none"
                          style={{ color: ui.text }}
                          hintClassName="mt-0.5 text-xs"
                          hintStyle={{ color: ui.textSubtle }}
                        />
                      )}
                    />
                    <p className="mt-0.5 text-xs" style={{ color: ui.textSubtle }}>
                      Venue or place name — not a street address
                    </p>
                    {errors.location && <p className="mt-1 text-xs text-rose-600">{errors.location.message}</p>}
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
                          ? { backgroundColor: ui.accent, color: '#fff' }
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
                          ? { backgroundColor: ui.accent, color: '#fff' }
                          : { color: ui.textMuted }
                      }
                    >
                      Paid
                    </button>
                  </div>
                </div>

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
                          className="rounded-lg px-3 py-1 text-xs font-semibold text-white"
                          style={{
                            backgroundColor: freeUnlimited ? ui.accent : ui.accentSoft,
                            color: freeUnlimited ? '#fff' : ui.textMuted,
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
                            color: !freeUnlimited ? '#fff' : ui.textMuted,
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
                disabled={isSubmitting || !canSubmit}
                className="mt-6 w-full rounded-xl px-8 py-3.5 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: ui.accent }}
                onMouseEnter={(e) => {
                  if (!isSubmitting && canSubmit) e.currentTarget.style.backgroundColor = ui.accentHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = ui.accent;
                }}
              >
                {isSubmitting ? 'Creating…' : 'Create Event'}
              </button>
              {!canSubmit && (
                <p className="mt-2 text-center text-xs" style={{ color: ui.textSubtle }}>
                  Add event name, start time, and location to continue.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Floating landing design dock */}
        <LandingDesignDock design={design} onDesignChange={setDesign} />
      </form>
    </div>
  );
};
