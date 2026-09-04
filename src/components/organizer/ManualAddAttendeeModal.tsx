import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, UserPlus, X } from 'lucide-react';
import { api } from '../../api/client';
import type { Attendee, CheckoutFieldDefinition, Ticket } from '../../types';
import type { CreateThemeUI } from '../../themes/eventThemes';
import { accentButtonStyleFor, cardMutedStyleFor, cardStyleFor, fieldClassFor, fieldStyleFor } from '../../themes/flowUi';
import { FlowAlert, FlowInput, FlowLabel } from '../flow/FlowPrimitives';
import { TurnoutSelect } from '../ui/TurnoutSelect';
import { formatApiError } from '../../utils/apiError';
import { validateCustomFieldValues, resolveCheckoutFieldType } from '../../utils/checkoutFields';
import { cn } from '../../utils/cn';
import { formatLKRWhole } from '../../utils/money';
import { ticketEffectivePrice } from '../../utils/ticketPricing';

type ManualPaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'other';
type PaymentMode = 'complimentary' | 'paid';

type Props = {
  open: boolean;
  eventId: string;
  checkoutFields: CheckoutFieldDefinition[];
  ui: CreateThemeUI;
  onClose: () => void;
  onCreated: (attendee: Attendee, stats?: { total: number; checkedIn: number; pending: number }) => void;
};

const MANUAL_PAYMENT_OPTIONS: { id: ManualPaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'bank_transfer', label: 'Bank transfer' },
  { id: 'card', label: 'Card (offline POS)' },
  { id: 'other', label: 'Other' },
];

export function ManualAddAttendeeModal({ open, eventId, checkoutFields, ui, onClose, onCreated }: Props) {
  const cardStyle = cardStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketId, setTicketId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('complimentary');
  const [manualPaymentMethod, setManualPaymentMethod] = useState<ManualPaymentMethod>('cash');
  const [amount, setAmount] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, saving]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingTickets(true);
      setError(null);
      try {
        const res = await api.get<{ tickets: Ticket[] }>(`/api/events/${eventId}/tickets`);
        if (cancelled) return;
        const list = res.tickets || [];
        setTickets(list);
        const firstAvailable = list.find((t) => t.quantity - t.sold > 0) || list[0];
        setTicketId(firstAvailable?.id || '');
      } catch (e: unknown) {
        if (!cancelled) setError(formatApiError(e, 'Failed to load tickets'));
      } finally {
        if (!cancelled) setLoadingTickets(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, eventId]);

  useEffect(() => {
    if (!open) return;
    setFullName('');
    setEmail('');
    setPhone('');
    setCustomFields({});
    setPaymentMode('complimentary');
    setManualPaymentMethod('cash');
    setAmount('');
    setSendEmail(true);
    setError(null);
  }, [open]);

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === ticketId) || null,
    [tickets, ticketId]
  );
  const remaining = selectedTicket ? Math.max(0, selectedTicket.quantity - selectedTicket.sold) : 0;

  useEffect(() => {
    if (!selectedTicket) return;
    if (paymentMode === 'paid') {
      setAmount(String(ticketEffectivePrice(selectedTicket)));
    }
  }, [selectedTicket?.id, paymentMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCustomValue = (key: string, value: string) => {
    setCustomFields((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    setError(null);
    if (!ticketId) {
      setError('Select a ticket type.');
      return;
    }
    if (!fullName.trim()) {
      setError('Attendee name is required.');
      return;
    }
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (remaining < 1) {
      setError('This ticket type is sold out. Increase quantity in Event settings or choose another ticket.');
      return;
    }
    if (paymentMode === 'paid') {
      const parsed = Number(amount);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError('Enter a valid payment amount.');
        return;
      }
      if (parsed <= 0 && (selectedTicket?.price ?? 0) > 0) {
        setError('Enter the amount collected, or choose complimentary.');
        return;
      }
    }
    const fieldErr = validateCustomFieldValues(checkoutFields, customFields);
    if (fieldErr) {
      setError(fieldErr);
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        ticketId,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        customFields,
        sendEmail,
        paymentMode,
      };
      if (paymentMode === 'paid') {
        body.manualPaymentMethod = manualPaymentMethod;
        body.amount = Number(amount);
      }
      const res = await api.post<{
        attendee: Attendee;
        stats?: { total: number; checkedIn: number; pending: number };
      }>(`/api/events/${eventId}/attendees`, body);
      onCreated(res.attendee, res.stats);
      onClose();
    } catch (e: unknown) {
      setError(formatApiError(e, 'Could not register attendee'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close add attendee"
        className="absolute inset-0 bg-black/60"
        disabled={saving}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-add-attendee-title"
        className="relative z-10 flex max-h-[min(92vh,800px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:rounded-2xl"
        style={{ ...cardStyle, color: ui.text }}
      >
        <div
          className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5"
          style={{ borderColor: ui.borderColor, background: ui.cardMutedBg }}
        >
          <div className="min-w-0">
            <h2 id="manual-add-attendee-title" className="flex items-center gap-2 text-base font-semibold sm:text-lg">
              <UserPlus className="h-5 w-5 shrink-0" style={{ color: ui.accent }} />
              Register attendee
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm" style={{ color: ui.textMuted }}>
              Add someone manually — complimentary or with payment collected offline.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
            style={{ color: ui.textMuted }}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {error ? <FlowAlert variant="error">{error}</FlowAlert> : null}

          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <FlowLabel>Ticket type</FlowLabel>
              {loadingTickets ? (
                <p className="flex items-center gap-2 text-sm" style={{ color: ui.textMuted }}>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading tickets…
                </p>
              ) : tickets.length === 0 ? (
                <FlowAlert variant="info">Create a ticket type in Event settings before registering attendees.</FlowAlert>
              ) : (
                <TurnoutSelect
                  value={ticketId}
                  onChange={setTicketId}
                  placeholder="Select ticket"
                  ariaLabel="Ticket type"
                  tone="light"
                  style={fieldStyle}
                  buttonClassName={cn(fieldClass, 'w-full')}
                  options={tickets.map((t) => ({
                    value: t.id,
                    label: `${t.name} · ${formatLKRWhole(ticketEffectivePrice(t))} · ${Math.max(0, t.quantity - t.sold)} left`,
                  }))}
                />
              )}
              {selectedTicket ? (
                <p className="text-xs" style={{ color: remaining > 0 ? ui.textMuted : '#dc2626' }}>
                  {remaining} of {selectedTicket.quantity} remaining · ticket price{' '}
                  {formatLKRWhole(ticketEffectivePrice(selectedTicket))}
                </p>
              ) : null}
            </div>

            <section className="rounded-xl border p-4" style={cardMutedStyle}>
              <p className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                Payment
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    {
                      id: 'complimentary' as const,
                      title: 'Complimentary',
                      detail: 'No payment · guest / comp ticket',
                    },
                    {
                      id: 'paid' as const,
                      title: 'Paid (manual)',
                      detail: 'Cash, bank, card, or other collected offline',
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentMode(opt.id)}
                    className="rounded-xl border p-3 text-left transition"
                    style={{
                      ...cardStyle,
                      borderColor: paymentMode === opt.id ? ui.accent : ui.borderColor,
                      boxShadow: paymentMode === opt.id ? `0 0 0 1px ${ui.accent}` : undefined,
                    }}
                  >
                    <p className="text-sm font-semibold" style={{ color: ui.text }}>
                      {opt.title}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: ui.textMuted }}>
                      {opt.detail}
                    </p>
                  </button>
                ))}
              </div>

              {paymentMode === 'paid' ? (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <FlowLabel>How was payment collected?</FlowLabel>
                    <TurnoutSelect
                      value={manualPaymentMethod}
                      onChange={(next) => setManualPaymentMethod(next as ManualPaymentMethod)}
                      ariaLabel="Manual payment method"
                      tone="light"
                      style={fieldStyle}
                      buttonClassName={cn(fieldClass, 'w-full')}
                      options={MANUAL_PAYMENT_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
                    />
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <FlowLabel>Amount collected (LKR)</FlowLabel>
                    <FlowInput
                      type="number"
                      min={0}
                      step="1"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={selectedTicket ? String(ticketEffectivePrice(selectedTicket)) : '0'}
                      className={fieldClass}
                      style={fieldStyle}
                    />
                    <p className="text-xs" style={{ color: ui.textMuted }}>
                      Defaults to ticket price. Adjust if you collected a different amount.
                    </p>
                  </label>
                </div>
              ) : (
                <p className="mt-3 text-xs" style={{ color: ui.textMuted }}>
                  Recorded as complimentary (LKR 0). Still uses one ticket from inventory.
                </p>
              )}
            </section>

            <label className="flex flex-col gap-1.5">
              <FlowLabel>Full name</FlowLabel>
              <FlowInput
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Attendee name"
                className={fieldClass}
                style={fieldStyle}
                autoComplete="name"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <FlowLabel>Email</FlowLabel>
              <FlowInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className={fieldClass}
                style={fieldStyle}
                autoComplete="email"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <FlowLabel>Phone (optional)</FlowLabel>
              <FlowInput
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+94…"
                className={fieldClass}
                style={fieldStyle}
                autoComplete="tel"
              />
            </label>
          </div>

          {checkoutFields.length > 0 ? (
            <section className="rounded-xl border p-4" style={cardMutedStyle}>
              <p className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                Checkout questions
              </p>
              <div className="space-y-3">
                {checkoutFields.map((field) => {
                  const type = resolveCheckoutFieldType(field.type);
                  const value = customFields[field.key] ?? '';
                  const label = (
                    <span className="text-xs font-semibold" style={{ color: ui.textMuted }}>
                      {field.label}
                      {field.required ? ' *' : ''}
                    </span>
                  );

                  if (type === 'textarea') {
                    return (
                      <label key={field.id} className="flex flex-col gap-1.5">
                        {label}
                        <textarea
                          rows={3}
                          value={value}
                          onChange={(e) => setCustomValue(field.key, e.target.value)}
                          placeholder={field.placeholder || field.label}
                          className={cn(fieldClass, 'resize-y')}
                          style={fieldStyle}
                        />
                      </label>
                    );
                  }

                  if (type === 'select') {
                    return (
                      <div key={field.id} className="flex flex-col gap-1.5">
                        {label}
                        <TurnoutSelect
                          value={value}
                          onChange={(next) => setCustomValue(field.key, next)}
                          placeholder={field.placeholder || 'Select an option'}
                          ariaLabel={field.label}
                          tone="light"
                          style={fieldStyle}
                          buttonClassName={cn(fieldClass, 'w-full')}
                          options={(field.options || []).map((opt) => ({
                            value: opt.value,
                            label: opt.label,
                          }))}
                        />
                      </div>
                    );
                  }

                  if (type === 'radio') {
                    return (
                      <fieldset key={field.id} className="space-y-2">
                        <legend>{label}</legend>
                        {(field.options || []).map((opt) => (
                          <label
                            key={opt.id}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                            style={{
                              borderColor: value === opt.value ? ui.accent : ui.borderColor,
                              color: ui.text,
                            }}
                          >
                            <input
                              type="radio"
                              name={`manual-cf-${field.key}`}
                              checked={value === opt.value}
                              onChange={() => setCustomValue(field.key, opt.value)}
                            />
                            {opt.label}
                          </label>
                        ))}
                      </fieldset>
                    );
                  }

                  return (
                    <label key={field.id} className="flex flex-col gap-1.5">
                      {label}
                      <FlowInput
                        type={type === 'number' ? 'number' : 'text'}
                        value={value}
                        onChange={(e) => setCustomValue(field.key, e.target.value)}
                        placeholder={field.placeholder || field.label}
                        className={fieldClass}
                        style={fieldStyle}
                      />
                    </label>
                  );
                })}
              </div>
            </section>
          ) : null}

          <label className="flex items-start gap-3 rounded-xl border px-3 py-3 text-sm" style={cardMutedStyle}>
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            <span style={{ color: ui.text }}>
              Send confirmation email with ticket QR
              <span className="mt-0.5 block text-xs" style={{ color: ui.textMuted }}>
                Recommended so the attendee has their pass.
              </span>
            </span>
          </label>
        </div>

        <div
          className="flex flex-wrap gap-2 border-t px-4 py-3 sm:px-5"
          style={{ borderColor: ui.borderColor }}
        >
          <button
            type="button"
            disabled={saving || tickets.length === 0 || remaining < 1}
            onClick={() => void submit()}
            className="turnout-btn-accent inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 sm:flex-none"
            style={accentButtonStyleFor(ui)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {saving ? 'Registering…' : 'Register attendee'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold sm:flex-none"
            style={{ ...cardStyle, color: ui.text }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
