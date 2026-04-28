import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '../store/useAuthStore';
import { Calendar, Clock3, MapPin, Image as ImageIcon } from 'lucide-react';
import { EventCustomization } from '../types';
import { api, toApiUrl } from '../api/client';

const eventSchema = z.object({
  title: z.string().min(3, 'Event name must be at least 3 characters'),
  slug: z.string().optional(),
  description: z.string().min(3, 'Description must be at least 3 characters'),
  date: z.string().min(1, 'Date is required'),
  endDate: z.string().optional(),
  location: z.string().min(1, 'Location is required'),
  bannerUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  tickets: z.array(z.object({
    name: z.string().min(1, 'Ticket name is required'),
    price: z.number().min(0, 'Price must be 0 or more'),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
  })).min(1, 'At least one ticket is required'),
  requireApproval: z.boolean(),
  useCustomDomain: z.boolean(),
  customDomain: z.string().optional(),
  dnsProvider: z.enum(['cloudflare', 'godaddy', 'namecheap', 'other']),
  dnsRecordType: z.enum(['CNAME', 'A']),
  dnsRecordTarget: z.string().optional(),
  dnsConfigured: z.boolean(),
}).superRefine((data, ctx) => {
  if (!data.endDate || !data.date) return;
  const start = new Date(data.date).getTime();
  const end = new Date(data.endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return;
  if (end < start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End time must be after start time',
      path: ['endDate'],
    });
  }
  if (data.useCustomDomain) {
    const domain = (data.customDomain || '').trim();
    if (domain.length < 4 || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid domain (example: events.yourbrand.com)',
        path: ['customDomain'],
      });
    }
    const target = (data.dnsRecordTarget || '').trim();
    if (target === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DNS target is required',
        path: ['dnsRecordTarget'],
      });
    }
  }
});

type EventFormValues = z.infer<typeof eventSchema>;

const THEME_PRESETS: Record<
  string,
  { name: string; primary: string; secondary: string; previewBackground: string; previewText: string; previewFrame: string }
> = {
  'neo-green': {
    name: 'Neo Green Minimal',
    primary: '#34d399',
    secondary: '#10b981',
    previewBackground:
      'bg-[radial-gradient(circle_at_25%_25%,rgba(52,211,153,0.65),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.45),transparent_40%),linear-gradient(160deg,#dcfce7_0%,#bbf7d0_50%,#86efac_100%)]',
    previewText: 'text-emerald-950/90',
    previewFrame: 'border-emerald-200/80',
  },
  midnight: {
    name: 'Midnight',
    primary: '#4f46e5',
    secondary: '#7c3aed',
    previewBackground:
      'bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.45),transparent_48%),radial-gradient(circle_at_80%_30%,rgba(79,70,229,0.55),transparent_42%),linear-gradient(160deg,#0f172a_0%,#312e81_55%,#4c1d95_100%)]',
    previewText: 'text-white/90',
    previewFrame: 'border-indigo-300/70',
  },
  sunset: {
    name: 'Sunset',
    primary: '#f97316',
    secondary: '#ec4899',
    previewBackground:
      'bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.55),transparent_45%),radial-gradient(circle_at_80%_25%,rgba(236,72,153,0.45),transparent_45%),linear-gradient(165deg,#fff7ed_0%,#fdba74_40%,#fb7185_75%,#f9a8d4_100%)]',
    previewText: 'text-rose-950/90',
    previewFrame: 'border-orange-300/70',
  },
  minimal: {
    name: 'Minimal Light',
    primary: '#0f172a',
    secondary: '#64748b',
    previewBackground:
      'bg-[radial-gradient(circle_at_30%_25%,rgba(148,163,184,0.35),transparent_45%),radial-gradient(circle_at_75%_25%,rgba(203,213,225,0.45),transparent_48%),linear-gradient(160deg,#fafafa_0%,#f1f5f9_55%,#e2e8f0_100%)]',
    previewText: 'text-slate-800/90',
    previewFrame: 'border-slate-300/70',
  },
};

export const CreateEvent: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ticketMode, setTicketMode] = useState<'free' | 'paid'>('free');
  const { register, control, handleSubmit, setValue, getValues, formState: { errors }, watch } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      tickets: [{ name: 'General Admission', price: 0, quantity: 100 }],
      requireApproval: false,
      useCustomDomain: false,
      customDomain: '',
      dnsProvider: 'cloudflare',
      dnsRecordType: 'CNAME',
      dnsRecordTarget: '',
      dnsConfigured: false,
    },
  });
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'tickets',
  });
  const tickets = watch('tickets');
  const requireApproval = watch('requireApproval');
  const useCustomDomain = watch('useCustomDomain');
  const dnsProvider = watch('dnsProvider');
  const dnsConfigured = watch('dnsConfigured');
  const customDomain = watch('customDomain');
  const dnsRecordType = watch('dnsRecordType');
  const dnsRecordTarget = watch('dnsRecordTarget');
  const selectedThemeId = searchParams.get('theme') || 'neo-green';
  const selectedTheme = THEME_PRESETS[selectedThemeId] || THEME_PRESETS['neo-green'];

  const applyDnsProviderPreset = (provider: 'cloudflare' | 'godaddy' | 'namecheap' | 'other') => {
    setValue('dnsProvider', provider, { shouldDirty: true });
    if (provider === 'other') return;
    setValue('dnsRecordType', 'CNAME', { shouldDirty: true, shouldValidate: true });
    setValue('dnsRecordTarget', 'sites.turnout.app', { shouldDirty: true, shouldValidate: true });
  };

  const copyToClipboard = async (value: string) => {
    if (!value || !navigator?.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // no-op if clipboard API is unavailable
    }
  };

  const switchToFreeMode = () => {
    setTicketMode('free');
    const first = getValues('tickets.0');
    replace([
      {
        name: first?.name || 'General Admission',
        price: 0,
        quantity: first?.quantity && first.quantity > 0 ? first.quantity : 100,
      },
    ]);
  };

  const switchToPaidMode = () => {
    setTicketMode('paid');
    const current = getValues('tickets');
    if (!current.length) {
      replace([{ name: 'General Admission', price: 2500, quantity: 100 }]);
      return;
    }
    if ((current[0]?.price || 0) <= 0) {
      setValue('tickets.0.price', 2500, { shouldDirty: true, shouldValidate: true });
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
      const data = text ? JSON.parse(text) : null;
      if (!res.ok || !data?.bannerUrl) {
        throw new Error(data?.error || 'upload_failed');
      }
      setValue('bannerUrl', data.bannerUrl, { shouldDirty: true, shouldValidate: true });
    } catch {
      setBannerUploadError('Image upload failed. Please try another image.');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const onSubmit = async (data: EventFormValues) => {
    if (!user) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const customization: EventCustomization = {
        primaryColor: selectedTheme.primary,
        secondaryColor: selectedTheme.secondary,
        fontFamily: 'Inter',
        heroText: data.title,
        heroSubtext: data.description.substring(0, 100),
        layout: 'centered' as const,
        customDomain: data.useCustomDomain ? (data.customDomain || '').trim() : undefined,
        dnsProvider: data.useCustomDomain ? data.dnsProvider : undefined,
        dnsRecordType: data.useCustomDomain ? data.dnsRecordType : undefined,
        dnsRecordTarget: data.useCustomDomain ? (data.dnsRecordTarget || '').trim() : undefined,
        dnsConfigured: data.useCustomDomain ? data.dnsConfigured : false,
      };

      const created = await api.post<{ eventId: string; slug: string }>('/api/events', {
        slug: data.slug,
        title: data.title,
        description: data.description,
        date: data.date,
        location: data.location,
        bannerUrl: data.bannerUrl || `https://picsum.photos/seed/${Date.now()}/1200/600`,
        templateId: 'template-1',
        customization,
        tickets: [
          ...data.tickets.map((ticket) => ({
            name: ticket.name,
            price: ticket.price,
            quantity: ticket.quantity,
            description: data.requireApproval ? 'Requires organizer approval' : undefined,
          })),
        ],
      });

      // Open the public page in a new tab (Zoho Backstage-style)
      window.open(`/e/${created.slug}`, '_blank', 'noopener,noreferrer');
      navigate('/dashboard');
    } catch (error: any) {
      setSubmitError(error?.message || error?.error || 'Failed to publish event. Please try again.');
      console.error('Error creating event:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10">
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[320px,1fr]">
        {submitError && (
          <div className="lg:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {submitError}
          </div>
        )}
        <div className="space-y-4">
          <div className={`overflow-hidden rounded-2xl border ${selectedTheme.previewFrame} shadow-[0_14px_40px_rgba(17,24,39,0.18)]`}>
            {watch('bannerUrl') ? (
              <img
                src={watch('bannerUrl')}
                alt="Event banner preview"
                className="h-[250px] w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={`relative flex h-[250px] items-center justify-center px-8 text-center ${selectedTheme.previewBackground}`}>
                <p className={`text-2xl font-semibold tracking-[0.35em] ${selectedTheme.previewText}`}>
                  YOU ARE INVITED
                </p>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-emerald-100 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-700/70">Theme</p>
            <p className="mt-1 text-sm font-semibold text-emerald-950">{selectedTheme.name}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-[0_12px_32px_rgba(16,185,129,0.12)]">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-4xl font-semibold tracking-tight text-emerald-950">Event Name</h1>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Public
            </span>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Event Name</label>
              <input
                {...register('title')}
                placeholder="Enter your event name"
                className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2.5 text-emerald-950 placeholder:text-emerald-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
              />
              {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 md:col-span-1">
                <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                  <Calendar className="h-3.5 w-3.5" />
                  Start
                </label>
                <input
                  {...register('date')}
                  type="datetime-local"
                  className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                />
                {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date.message}</p>}
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 md:col-span-1">
                <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                  <Clock3 className="h-3.5 w-3.5" />
                  End
                </label>
                <input
                  {...register('endDate')}
                  type="datetime-local"
                  className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                />
                {errors.endDate && <p className="mt-1 text-xs text-red-500">{errors.endDate.message}</p>}
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 md:col-span-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Timezone</label>
                <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm text-emerald-700">GMT+05:30</div>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
              <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                <MapPin className="h-3.5 w-3.5" />
                Add Event Location
              </label>
              <input
                {...register('location')}
                placeholder="Offline location or virtual link"
                className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2.5 text-sm text-emerald-950 placeholder:text-emerald-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
              />
              {errors.location && <p className="mt-1 text-xs text-red-500">{errors.location.message}</p>}
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Add Description</label>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Describe your event"
                className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2.5 text-sm text-emerald-950 placeholder:text-emerald-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
              />
              {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>}
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/20 p-4">
              <p className="text-sm font-semibold text-emerald-900">Event Options</p>
              <div className="mt-3 space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={switchToFreeMode}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      ticketMode === 'free'
                        ? 'border-emerald-400 bg-emerald-100 text-emerald-900'
                        : 'border-emerald-100 bg-white text-emerald-700 hover:border-emerald-300'
                    }`}
                  >
                    Free Event
                  </button>
                  <button
                    type="button"
                    onClick={switchToPaidMode}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      ticketMode === 'paid'
                        ? 'border-emerald-400 bg-emerald-100 text-emerald-900'
                        : 'border-emerald-100 bg-white text-emerald-700 hover:border-emerald-300'
                    }`}
                  >
                    Paid Event
                  </button>
                </div>
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="rounded-lg border border-emerald-100 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">Ticket {index + 1}</p>
                        {ticketMode === 'paid' && fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="text-xs font-semibold text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">Ticket Name</label>
                          <input
                            {...register(`tickets.${index}.name` as const)}
                            placeholder="General Admission"
                            className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">Price (LKR)</label>
                          <input
                            {...register(`tickets.${index}.price` as const, { valueAsNumber: true })}
                            type="number"
                            min={0}
                            disabled={ticketMode === 'free'}
                            className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40 disabled:bg-emerald-50 disabled:text-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">Quantity</label>
                          <input
                            {...register(`tickets.${index}.quantity` as const, { valueAsNumber: true })}
                            type="number"
                            min={1}
                            className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {ticketMode === 'paid' && (
                  <button
                    type="button"
                    onClick={() => append({ name: `Ticket ${fields.length + 1}`, price: 2500, quantity: 50 })}
                    className="w-full rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-200"
                  >
                    + Add Another Ticket Type
                  </button>
                )}

                <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Require Approval</p>
                    <p className="text-xs text-emerald-600">Attendees are accepted manually by organizer</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setValue('requireApproval', !requireApproval, { shouldDirty: true })}
                    className={`relative h-7 w-12 rounded-full transition ${
                      requireApproval ? 'bg-emerald-500' : 'bg-emerald-200'
                    }`}
                    aria-label="Toggle require approval"
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                        requireApproval ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                  <input
                    {...register('requireApproval')}
                    type="checkbox"
                    className="hidden"
                  />
                </div>
              </div>
              {(errors.tickets || errors.tickets?.[0]?.name || errors.tickets?.[0]?.price || errors.tickets?.[0]?.quantity) && (
                <p className="mt-2 text-xs text-red-500">
                  {errors.tickets?.message ||
                    errors.tickets?.[0]?.name?.message ||
                    errors.tickets?.[0]?.price?.message ||
                    errors.tickets?.[0]?.quantity?.message}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-900">Custom Domain</p>
                  <p className="text-xs text-emerald-700">Connect your own domain and configure DNS records</p>
                </div>
                <button
                  type="button"
                  onClick={() => setValue('useCustomDomain', !useCustomDomain, { shouldDirty: true })}
                  className={`relative h-7 w-12 rounded-full transition ${
                    useCustomDomain ? 'bg-emerald-500' : 'bg-emerald-200'
                  }`}
                  aria-label="Toggle custom domain"
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                      useCustomDomain ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
                <input {...register('useCustomDomain')} type="checkbox" className="hidden" />
              </div>

              {useCustomDomain && (
                <div className="mt-4 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">Domain</label>
                      <input
                        {...register('customDomain')}
                        placeholder="events.yourbrand.com"
                        className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                      />
                      {errors.customDomain && <p className="mt-1 text-xs text-red-500">{errors.customDomain.message}</p>}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">DNS Provider Preset</label>
                      <select
                        {...register('dnsProvider')}
                        onChange={(e) => applyDnsProviderPreset(e.target.value as 'cloudflare' | 'godaddy' | 'namecheap' | 'other')}
                        className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                      >
                        <option value="cloudflare">Cloudflare</option>
                        <option value="godaddy">GoDaddy</option>
                        <option value="namecheap">Namecheap</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">DNS Record Type</label>
                      <select
                        {...register('dnsRecordType')}
                        className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                      >
                        <option value="CNAME">CNAME</option>
                        <option value="A">A</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">DNS Host / Name</label>
                      <div className="flex gap-2">
                        <input
                          value={customDomain ? customDomain.split('.')[0] : 'events'}
                          readOnly
                          className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm text-emerald-950"
                        />
                        <button
                          type="button"
                          onClick={() => void copyToClipboard(customDomain ? customDomain.split('.')[0] : 'events')}
                          className="rounded-lg border border-emerald-200 bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-200"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">DNS Target / Value</label>
                    <div className="flex gap-2">
                      <input
                        {...register('dnsRecordTarget')}
                        placeholder="sites.turnout.app or 203.0.113.10"
                        className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                      />
                      <button
                        type="button"
                        onClick={() => void copyToClipboard(dnsRecordTarget || '')}
                        className="rounded-lg border border-emerald-200 bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-200"
                      >
                        Copy
                      </button>
                    </div>
                    {errors.dnsRecordTarget && <p className="mt-1 text-xs text-red-500">{errors.dnsRecordTarget.message}</p>}
                  </div>
                  <div className="rounded-lg border border-emerald-100 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">Quick DNS Setup</p>
                    <p className="mt-1 text-xs text-emerald-700">
                      Add this record at {dnsProvider === 'other' ? 'your DNS provider' : dnsProvider}:&nbsp;
                      <span className="font-semibold">Type</span> {dnsRecordType},&nbsp;
                      <span className="font-semibold">Host</span> {customDomain ? customDomain.split('.')[0] : 'events'},&nbsp;
                      <span className="font-semibold">Value</span> {dnsRecordTarget || 'sites.turnout.app'}.
                    </p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-white px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">DNS Configured</p>
                      <p className="text-xs text-emerald-600">Mark this once records are added at your domain provider</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setValue('dnsConfigured', !dnsConfigured, { shouldDirty: true })}
                      className={`relative h-7 w-12 rounded-full transition ${
                        dnsConfigured ? 'bg-emerald-500' : 'bg-emerald-200'
                      }`}
                      aria-label="Toggle dns configured"
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                          dnsConfigured ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                    <input {...register('dnsConfigured')} type="checkbox" className="hidden" />
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/20 p-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Banner</label>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-emerald-300 bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-200">
                  {isUploadingBanner ? 'Uploading image...' : 'Upload image'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    disabled={isUploadingBanner}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadBannerFile(file);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
                <div className="relative w-full">
                  <ImageIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-emerald-500" />
                  <input
                    {...register('bannerUrl')}
                    placeholder="https://example.com/banner.jpg"
                    className="w-full rounded-lg border border-emerald-100 bg-white py-2.5 pl-10 pr-3 text-sm text-emerald-950 placeholder:text-emerald-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                  />
                </div>
              </div>
              {bannerUploadError && <p className="mt-2 text-xs text-red-500">{bannerUploadError}</p>}
              {errors.bannerUrl && <p className="mt-2 text-xs text-red-500">{errors.bannerUrl.message}</p>}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Custom URL Slug</label>
                <input
                  {...register('slug')}
                  placeholder="my-event-slug"
                  className="w-full rounded-lg border border-emerald-100 bg-white px-3 py-2.5 text-sm text-emerald-950 placeholder:text-emerald-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-11 w-full rounded-lg border border-emerald-500 bg-gradient-to-r from-emerald-500 to-lime-500 px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(16,185,129,0.35)] transition hover:from-emerald-600 hover:to-lime-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
