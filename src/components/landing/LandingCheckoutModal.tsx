import React, { useEffect, useMemo } from 'react';
import type { UseFormRegister } from 'react-hook-form';
import {
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  Ticket,
  User,
  Users,
  X,
} from 'lucide-react';
import type { CheckoutFieldDefinition, Event, OrderItem } from '../../types';
import { formatLKRWhole } from '../../utils/money';
import { CheckoutCustomFields } from './CheckoutCustomFields';

export type CheckoutOrderLine = { name: string; qty: number; total: number };

export type TicketHolderInput = {
  key: string;
  ticketId: string;
  ticketName: string;
  label: string;
  fullName: string;
  email: string;
  phone: string;
  customFields: Record<string, string>;
};

export function buildTicketHoldersFromItems(items: OrderItem[]): TicketHolderInput[] {
  return items.flatMap((it) =>
    Array.from({ length: it.quantity }, (_, i) => ({
      key: `${it.ticketId}-${i}`,
      ticketId: it.ticketId,
      ticketName: it.name,
      label: it.quantity > 1 ? `${it.name} · Pass ${i + 1} of ${it.quantity}` : it.name,
      fullName: '',
      email: '',
      phone: '',
      customFields: {},
    }))
  );
}

type BuyerFormValues = {
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string;
};

type AssignmentMode = 'self' | 'someone-else' | 'each';

export type LandingCheckoutModalProps = {
  event: Event;
  onClose: () => void;
  orderLines: CheckoutOrderLine[];
  orderItems: OrderItem[];
  totalAmount: number;
  totalTicketQuantity: number;
  canAssignEachTicket: boolean;
  assignEachTicket: boolean;
  setAssignEachTicket: (value: boolean) => void;
  buyingForSomeoneElse: boolean;
  setBuyingForSomeoneElse: (value: boolean) => void;
  isAttendeePrefill: boolean;
  prefillReady: boolean;
  isPurchasing: boolean;
  payError: string | null;
  checkoutFields: CheckoutFieldDefinition[];
  ticketHolders: TicketHolderInput[];
  setTicketHolders: React.Dispatch<React.SetStateAction<TicketHolderInput[]>>;
  perAttendeeCustomFields: Record<string, string>[];
  setPerAttendeeCustomFields: React.Dispatch<React.SetStateAction<Record<string, string>[]>>;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  register: UseFormRegister<BuyerFormValues>;
  buildTicketHolders: (items: OrderItem[]) => TicketHolderInput[];
  onSubmit: React.FormEventHandler<HTMLFormElement>;
};

function assignmentMode(
  canAssignEach: boolean,
  assignEach: boolean,
  someoneElse: boolean
): AssignmentMode {
  if (canAssignEach && assignEach) return 'each';
  if (someoneElse) return 'someone-else';
  return 'self';
}

function CheckoutField({
  label,
  required,
  icon,
  children,
}: {
  label: string;
  required?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold" style={{ color: 'var(--landing-text-muted)' }}>
        {label}
        {required ? <span style={{ color: 'var(--landing-accent-readable, var(--primary))' }}> *</span> : null}
      </span>
      <div className="landing-checkout-field">
        {icon}
        {children}
      </div>
    </label>
  );
}

function ModeOption({
  active,
  title,
  description,
  onSelect,
}: {
  active: boolean;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={`landing-checkout-mode${active ? ' is-active' : ''}`}
    >
      <span
        className="landing-checkout-mode-radio mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2"
        style={{
          borderColor: active ? 'var(--landing-accent-readable, var(--primary))' : 'var(--landing-border)',
          background: active ? 'var(--landing-accent-readable, var(--primary))' : 'transparent',
        }}
        aria-hidden
      >
        {active ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--landing-on-primary,#fff)]" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold" style={{ color: 'var(--landing-text)' }}>
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: 'var(--landing-text-muted)' }}>
          {description}
        </span>
      </span>
    </button>
  );
}

export function LandingCheckoutModal({
  event,
  onClose,
  orderLines,
  orderItems,
  totalAmount,
  totalTicketQuantity,
  canAssignEachTicket,
  assignEachTicket,
  setAssignEachTicket,
  buyingForSomeoneElse,
  setBuyingForSomeoneElse,
  isAttendeePrefill,
  prefillReady,
  isPurchasing,
  payError,
  checkoutFields,
  ticketHolders,
  setTicketHolders,
  perAttendeeCustomFields,
  setPerAttendeeCustomFields,
  buyerName,
  buyerEmail,
  buyerPhone,
  register,
  buildTicketHolders,
  onSubmit,
}: LandingCheckoutModalProps) {
  const mode = assignmentMode(canAssignEachTicket, assignEachTicket, buyingForSomeoneElse);
  const passLabel = totalTicketQuantity === 1 ? '1 pass' : `${totalTicketQuantity} passes`;
  const submitLabel = useMemo(() => {
    if (isPurchasing) return 'Processing…';
    if (totalAmount <= 0) return 'Confirm registration';
    return `Pay ${formatLKRWhole(totalAmount)}`;
  }, [isPurchasing, totalAmount]);

  const setMode = (next: AssignmentMode) => {
    if (next === 'each') {
      setAssignEachTicket(true);
      setBuyingForSomeoneElse(false);
      return;
    }
    if (next === 'someone-else') {
      setAssignEachTicket(false);
      setBuyingForSomeoneElse(true);
      return;
    }
    setAssignEachTicket(false);
    setBuyingForSomeoneElse(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPurchasing) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPurchasing, onClose]);

  const copySelfTickets =
    mode === 'self'
      ? canAssignEachTicket
        ? `All ${totalTicketQuantity} passes will be emailed to you.`
        : 'Your pass and QR code will be emailed to you.'
      : null;

  return (
    <div
      className="landing-checkout-backdrop fixed inset-0 z-[70] flex flex-col justify-end bg-black/55 backdrop-blur-[6px] sm:items-center sm:justify-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isPurchasing) onClose();
      }}
    >
      <div
        className={`landing-checkout-sheet landing-page flex w-full max-h-[min(94dvh,100%)] flex-col overflow-hidden rounded-t-[1.35rem] border sm:max-h-[min(90vh,880px)] sm:rounded-3xl ${
          assignEachTicket ? 'sm:max-w-xl' : 'sm:max-w-lg'
        }`}
        style={{
          borderColor: 'var(--landing-border)',
          background: 'var(--landing-surface)',
          color: 'var(--landing-text)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="landing-checkout-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-col items-center pt-2 sm:hidden" aria-hidden>
          <span className="landing-checkout-handle" />
        </div>

        <header
          className="flex shrink-0 items-start justify-between gap-3 border-b px-4 pb-3 pt-1 sm:px-6 sm:py-4"
          style={{ borderColor: 'var(--landing-border)' }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="landing-checkout-badge">
                <Lock className="h-3 w-3" />
                Secure checkout
              </span>
              <span className="landing-checkout-badge">
                <Ticket className="h-3 w-3" />
                {passLabel}
              </span>
            </div>
            <h2 id="landing-checkout-title" className="landing-display mt-2 text-xl sm:text-2xl">
              Complete your order
            </h2>
            <p className="mt-0.5 truncate text-sm" style={{ color: 'var(--landing-text-muted)' }}>
              {event.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPurchasing}
            className="landing-checkout-close shrink-0 disabled:opacity-40"
            aria-label="Close checkout"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
            <section className="landing-checkout-summary px-4 py-3 sm:px-5 sm:py-4" aria-label="Order summary">
              <p className="landing-eyebrow" style={{ color: 'var(--landing-text-muted)' }}>
                Your selection
              </p>
              <div className="mt-2 space-y-0">
                {orderLines.map((line) => (
                  <div key={`${line.name}-${line.qty}`} className="landing-checkout-line">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="landing-checkout-line-qty">{line.qty}×</span>
                      <span className="text-sm font-medium leading-snug" style={{ color: 'var(--landing-text)' }}>
                        {line.name}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: 'var(--landing-text)' }}>
                      {formatLKRWhole(line.total)}
                    </span>
                  </div>
                ))}
              </div>
              <div
                className="mt-2 flex items-baseline justify-between border-t pt-3"
                style={{ borderColor: 'var(--landing-border)' }}
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--landing-text-muted)' }}>
                  Total due
                </span>
                <span className="landing-display text-2xl" style={{ color: 'var(--landing-accent-readable, var(--primary))' }}>
                  {totalAmount <= 0 ? 'Free' : formatLKRWhole(totalAmount)}
                </span>
              </div>
            </section>

            <div className="mt-5 space-y-5">
              <section className="landing-checkout-section" aria-labelledby="checkout-purchaser-heading">
                <div className="landing-checkout-section-head">
                  <span className="landing-checkout-section-num">1</span>
                  <div className="min-w-0">
                    <h3 id="checkout-purchaser-heading" className="text-sm font-bold" style={{ color: 'var(--landing-text)' }}>
                      Purchaser details
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--landing-text-muted)' }}>
                      Payment receipt and order confirmation
                    </p>
                  </div>
                </div>
                <div className="landing-checkout-section-body space-y-3.5">
                  {isAttendeePrefill ? (
                    <div className="landing-checkout-prefill">
                      <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--landing-accent-readable, var(--primary))' }} />
                      Filled from your attendee profile — you can edit before paying.
                    </div>
                  ) : null}

                  <CheckoutField label="Full name" required icon={<User className="landing-checkout-field-icon h-4 w-4" />}>
                    <input
                      {...register('buyerName', { required: true })}
                      autoComplete="name"
                      placeholder="As on your ID or card"
                      className="landing-checkout-input rounded-xl border px-4 py-3 outline-none"
                      style={{
                        borderColor: 'var(--landing-border)',
                        background: 'var(--landing-surface-muted)',
                        color: 'var(--landing-text)',
                      }}
                    />
                  </CheckoutField>

                  <CheckoutField label="Email" required icon={<Mail className="landing-checkout-field-icon h-4 w-4" />}>
                    <input
                      type="email"
                      {...register('buyerEmail', { required: true })}
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="landing-checkout-input rounded-xl border px-4 py-3 outline-none"
                      style={{
                        borderColor: 'var(--landing-border)',
                        background: 'var(--landing-surface-muted)',
                        color: 'var(--landing-text)',
                      }}
                    />
                  </CheckoutField>

                  <CheckoutField label="Phone (optional)" icon={<Phone className="landing-checkout-field-icon h-4 w-4" />}>
                    <input
                      {...register('buyerPhone')}
                      type="tel"
                      autoComplete="tel"
                      placeholder="+94 …"
                      className="landing-checkout-input rounded-xl border px-4 py-3 outline-none"
                      style={{
                        borderColor: 'var(--landing-border)',
                        background: 'var(--landing-surface-muted)',
                        color: 'var(--landing-text)',
                      }}
                    />
                  </CheckoutField>
                </div>
              </section>

              <section className="landing-checkout-section" aria-labelledby="checkout-passes-heading">
                <div className="landing-checkout-section-head">
                  <span className="landing-checkout-section-num">2</span>
                  <div className="min-w-0">
                    <h3 id="checkout-passes-heading" className="text-sm font-bold" style={{ color: 'var(--landing-text)' }}>
                      Who receives the passes?
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--landing-text-muted)' }}>
                      Each pass is sent by email with its own QR code
                    </p>
                  </div>
                </div>
                <div className="landing-checkout-section-body space-y-4">
                  {canAssignEachTicket ? (
                    <div className="landing-checkout-mode-grid" role="radiogroup" aria-label="Pass assignment">
                      <ModeOption
                        active={mode === 'self'}
                        title="All passes to me"
                        description="One confirmation email; every QR is under your name."
                        onSelect={() => setMode('self')}
                      />
                      <ModeOption
                        active={mode === 'someone-else'}
                        title="All passes to one person"
                        description="Ideal when you're buying for a friend or family member."
                        onSelect={() => setMode('someone-else')}
                      />
                      <ModeOption
                        active={mode === 'each'}
                        title="Different person per pass"
                        description={`Name and email for each of your ${totalTicketQuantity} passes.`}
                        onSelect={() => setMode('each')}
                      />
                    </div>
                  ) : (
                    <ModeOption
                      active={buyingForSomeoneElse}
                      title="This pass is for someone else"
                      description="Send the QR and confirmation to their email instead of yours."
                      onSelect={() => setBuyingForSomeoneElse(!buyingForSomeoneElse)}
                    />
                  )}

                  {mode === 'someone-else' && !assignEachTicket ? (
                    <div className="space-y-3 rounded-xl border p-3.5" style={{ borderColor: 'var(--landing-border)', background: 'var(--landing-surface-muted)' }}>
                      <p className="text-xs font-semibold" style={{ color: 'var(--landing-text-muted)' }}>
                        Ticket holder
                      </p>
                      <CheckoutField label="Full name" required icon={<User className="landing-checkout-field-icon h-4 w-4" />}>
                        <input
                          {...register('attendeeName', { required: buyingForSomeoneElse })}
                          autoComplete="name"
                          className="landing-checkout-input rounded-xl border px-4 py-3 outline-none"
                          style={{
                            borderColor: 'var(--landing-border)',
                            background: 'var(--landing-surface)',
                            color: 'var(--landing-text)',
                          }}
                        />
                      </CheckoutField>
                      <CheckoutField label="Email" required icon={<Mail className="landing-checkout-field-icon h-4 w-4" />}>
                        <input
                          type="email"
                          {...register('attendeeEmail', { required: buyingForSomeoneElse })}
                          autoComplete="email"
                          className="landing-checkout-input rounded-xl border px-4 py-3 outline-none"
                          style={{
                            borderColor: 'var(--landing-border)',
                            background: 'var(--landing-surface)',
                            color: 'var(--landing-text)',
                          }}
                        />
                      </CheckoutField>
                      <CheckoutField label="Phone (optional)" icon={<Phone className="landing-checkout-field-icon h-4 w-4" />}>
                        <input
                          {...register('attendeePhone')}
                          type="tel"
                          autoComplete="tel"
                          className="landing-checkout-input rounded-xl border px-4 py-3 outline-none"
                          style={{
                            borderColor: 'var(--landing-border)',
                            background: 'var(--landing-surface)',
                            color: 'var(--landing-text)',
                          }}
                        />
                      </CheckoutField>
                    </div>
                  ) : null}

                  {mode === 'each' && canAssignEachTicket ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 shrink-0" style={{ color: 'var(--landing-accent-readable, var(--primary))' }} />
                          <p className="text-xs font-semibold" style={{ color: 'var(--landing-text-muted)' }}>
                            {totalTicketQuantity} pass{totalTicketQuantity === 1 ? '' : 'es'} to assign
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-xs font-bold underline-offset-2 hover:underline"
                          style={{ color: 'var(--landing-accent-readable, var(--primary))' }}
                          onClick={() => {
                            const name = buyerName.trim();
                            const email = buyerEmail.trim();
                            const phone = buyerPhone.trim();
                            setTicketHolders((rows) =>
                              rows.map((row, index) => (index === 0 ? { ...row, fullName: name, email, phone } : row))
                            );
                          }}
                        >
                          Copy my details → first pass
                        </button>
                      </div>
                      {ticketHolders.map((row) => (
                        <div key={row.key} className="landing-checkout-holder space-y-3">
                          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--landing-accent-readable, var(--primary))' }}>
                            {row.label}
                          </p>
                          <CheckoutField label="Full name" required icon={<User className="landing-checkout-field-icon h-4 w-4" />}>
                            <input
                              required
                              value={row.fullName}
                              onChange={(e) =>
                                setTicketHolders((rows) =>
                                  rows.map((r) => (r.key === row.key ? { ...r, fullName: e.target.value } : r))
                                )
                              }
                              className="landing-checkout-input rounded-xl border px-4 py-3 outline-none"
                              style={{
                                borderColor: 'var(--landing-border)',
                                background: 'var(--landing-surface)',
                                color: 'var(--landing-text)',
                              }}
                            />
                          </CheckoutField>
                          <CheckoutField label="Email" required icon={<Mail className="landing-checkout-field-icon h-4 w-4" />}>
                            <input
                              type="email"
                              required
                              value={row.email}
                              onChange={(e) =>
                                setTicketHolders((rows) =>
                                  rows.map((r) => (r.key === row.key ? { ...r, email: e.target.value } : r))
                                )
                              }
                              className="landing-checkout-input rounded-xl border px-4 py-3 outline-none"
                              style={{
                                borderColor: 'var(--landing-border)',
                                background: 'var(--landing-surface)',
                                color: 'var(--landing-text)',
                              }}
                            />
                          </CheckoutField>
                          <CheckoutField label="Phone (optional)" icon={<Phone className="landing-checkout-field-icon h-4 w-4" />}>
                            <input
                              value={row.phone}
                              onChange={(e) =>
                                setTicketHolders((rows) =>
                                  rows.map((r) => (r.key === row.key ? { ...r, phone: e.target.value } : r))
                                )
                              }
                              className="landing-checkout-input rounded-xl border px-4 py-3 outline-none"
                              style={{
                                borderColor: 'var(--landing-border)',
                                background: 'var(--landing-surface)',
                                color: 'var(--landing-text)',
                              }}
                            />
                          </CheckoutField>
                          {checkoutFields.length > 0 ? (
                            <CheckoutCustomFields
                              fields={checkoutFields}
                              values={row.customFields}
                              onChange={(values) =>
                                setTicketHolders((rows) =>
                                  rows.map((r) => (r.key === row.key ? { ...r, customFields: values } : r))
                                )
                              }
                              idPrefix={`holder-${row.key}`}
                              variant="checkout"
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {copySelfTickets ? (
                    <p className="rounded-lg px-3 py-2 text-xs leading-relaxed" style={{ color: 'var(--landing-text-muted)', background: 'var(--landing-surface-muted)' }}>
                      {copySelfTickets}{' '}
                      <span className="font-medium" style={{ color: 'var(--landing-text)' }}>
                        {buyerName || 'You'} · {buyerEmail || 'your email'}
                      </span>
                      {buyerPhone ? ` · ${buyerPhone}` : ''}.
                    </p>
                  ) : null}

                  {checkoutFields.length > 0 && mode !== 'each' ? (
                    <div className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--landing-border)' }}>
                      <p className="text-xs font-bold" style={{ color: 'var(--landing-accent-readable, var(--primary))' }}>
                        {totalTicketQuantity > 1 ? 'Extra details per pass' : 'Additional information'}
                      </p>
                      {buildTicketHolders(orderItems).map((holder, index) => (
                        <div key={holder.key} className="landing-checkout-holder space-y-3">
                          {totalTicketQuantity > 1 ? (
                            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--landing-accent-readable, var(--primary))' }}>
                              {holder.label}
                            </p>
                          ) : null}
                          <CheckoutCustomFields
                            fields={checkoutFields}
                            values={perAttendeeCustomFields[index] ?? {}}
                            onChange={(values) =>
                              setPerAttendeeCustomFields((prev) => {
                                const next = [...prev];
                                next[index] = values;
                                return next;
                              })
                            }
                            idPrefix={`checkout-${holder.key}`}
                            variant="checkout"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          </div>

          <footer className="landing-checkout-footer">
            {payError ? (
              <div className="landing-checkout-error" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{payError}</span>
              </div>
            ) : null}
            <div className="landing-checkout-footer-total sm:hidden">
              <span className="text-sm font-semibold" style={{ color: 'var(--landing-text-muted)' }}>
                Total
              </span>
              <span className="landing-display text-xl" style={{ color: 'var(--landing-accent-readable, var(--primary))' }}>
                {totalAmount <= 0 ? 'Free' : formatLKRWhole(totalAmount)}
              </span>
            </div>
            <button
              type="submit"
              disabled={isPurchasing || !prefillReady}
              className="landing-btn-primary landing-checkout-submit flex w-full items-center justify-center gap-2 rounded-2xl font-bold disabled:opacity-50"
            >
              {isPurchasing ? <Loader2 className="spin h-5 w-5" aria-hidden /> : null}
              {submitLabel}
            </button>
            <div className="landing-checkout-trust">
              <span>
                <ShieldCheck className="h-3.5 w-3.5" />
                Secure checkout
              </span>
              <span>
                <Lock className="h-3.5 w-3.5" />
                PayHere · Instant confirmation
              </span>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
