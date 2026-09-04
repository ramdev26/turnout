import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Mail, Phone, Ticket, X } from 'lucide-react';
import type { Attendee, CheckoutFieldDefinition } from '../../types';
import type { CreateThemeUI } from '../../themes/eventThemes';
import { accentButtonStyleFor, cardMutedStyleFor, cardStyleFor } from '../../themes/flowUi';
import {
  formatCustomFieldDisplayValue,
  humanizeCustomFieldKey,
} from '../../utils/checkoutFields';

type Props = {
  attendee: Attendee;
  checkoutFields: CheckoutFieldDefinition[];
  ui: CreateThemeUI;
  onClose: () => void;
  onCheckIn?: (attendee: Attendee) => void;
  onUndoCheckIn?: (attendee: Attendee) => void;
  checkingIn?: boolean;
};

function DetailRow({
  label,
  value,
  ui,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  ui: CreateThemeUI;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-sm" style={{ color: ui.textMuted }}>
        {label}
      </dt>
      <dd
        className={`text-sm font-semibold sm:text-right ${mono ? 'font-mono' : ''} break-words`}
        style={{ color: ui.text }}
      >
        {value}
      </dd>
    </div>
  );
}

export function AttendeeDetailDrawer({
  attendee,
  checkoutFields,
  ui,
  onClose,
  onCheckIn,
  onUndoCheckIn,
  checkingIn,
}: Props) {
  const cardStyle = cardStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const fieldByKey = new Map(checkoutFields.map((f) => [f.key, f]));
  const customEntries: { key: string; label: string; value: string }[] = [];

  for (const field of checkoutFields) {
    customEntries.push({
      key: field.key,
      label: field.label,
      value: formatCustomFieldDisplayValue(field, attendee.customFields?.[field.key]),
    });
  }

  if (attendee.customFields) {
    for (const [key, raw] of Object.entries(attendee.customFields)) {
      if (fieldByKey.has(key)) continue;
      customEntries.push({
        key,
        label: humanizeCustomFieldKey(key),
        value: formatCustomFieldDisplayValue(undefined, raw),
      });
    }
  }

  const registeredAt = attendee.createdAt
    ? new Date(attendee.createdAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';
  const checkedInAt = attendee.checkedInAt
    ? new Date(attendee.checkedInAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close attendee details"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendee-detail-title"
        className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:rounded-2xl"
        style={{ ...cardStyle, color: ui.text }}
      >
        <div
          className="flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-5"
          style={{ borderColor: ui.borderColor, background: ui.cardMutedBg }}
        >
          <div className="min-w-0">
            <h2 id="attendee-detail-title" className="truncate text-base font-semibold sm:text-lg">
              {attendee.fullName}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {attendee.checkedInAt ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
                  style={{ background: ui.accentSoft, color: ui.accentOn }}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Checked in
                </span>
              ) : (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
                  style={{ background: 'rgba(245,158,11,0.20)', color: '#d97706' }}
                >
                  Not checked in
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs" style={{ color: ui.textMuted }}>
                <Ticket className="h-3.5 w-3.5" />
                {attendee.ticketName || 'Ticket'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
            style={{ color: ui.textMuted }}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <section className="rounded-xl border p-4" style={cardMutedStyle}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
              Contact
            </p>
            <dl className="mt-3 space-y-2.5">
              <DetailRow
                label="Email"
                ui={ui}
                value={
                  attendee.email ? (
                    <a
                      href={`mailto:${attendee.email}`}
                      className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
                      style={{ color: ui.accent }}
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      {attendee.email}
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
              <DetailRow
                label="Phone"
                ui={ui}
                value={
                  attendee.phone ? (
                    <a
                      href={`tel:${attendee.phone}`}
                      className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
                      style={{ color: ui.accent }}
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {attendee.phone}
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
            </dl>
          </section>

          <section className="rounded-xl border p-4" style={cardMutedStyle}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
              Ticket
            </p>
            <dl className="mt-3 space-y-2.5">
              <DetailRow label="Type" value={attendee.ticketName || '—'} ui={ui} />
              <DetailRow label="Registered" value={registeredAt} ui={ui} />
              <DetailRow label="Checked in" value={checkedInAt || '—'} ui={ui} />
              <DetailRow label="QR token" value={`…${attendee.qrToken.slice(-10)}`} ui={ui} mono />
            </dl>
          </section>

          <section className="rounded-xl border p-4" style={cardMutedStyle}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
              Checkout answers
            </p>
            {customEntries.length === 0 ? (
              <p className="mt-3 text-sm" style={{ color: ui.textMuted }}>
                No custom questions were collected for this attendee.
              </p>
            ) : (
              <dl className="mt-3 space-y-2.5">
                {customEntries.map((entry) => (
                  <DetailRow key={entry.key} label={entry.label} value={entry.value} ui={ui} />
                ))}
              </dl>
            )}
          </section>
        </div>

        <div
          className="flex flex-wrap gap-2 border-t px-4 py-3 sm:px-5"
          style={{ borderColor: ui.borderColor }}
        >
          {!attendee.checkedInAt && onCheckIn ? (
            <button
              type="button"
              disabled={checkingIn}
              onClick={() => onCheckIn(attendee)}
              className="turnout-btn-accent flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 sm:flex-none"
              style={accentButtonStyleFor(ui)}
            >
              {checkingIn ? 'Checking in…' : 'Check in'}
            </button>
          ) : null}
          {attendee.checkedInAt && onUndoCheckIn ? (
            <button
              type="button"
              onClick={() => onUndoCheckIn(attendee)}
              className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold sm:flex-none"
              style={{ ...cardStyle, color: ui.textMuted }}
            >
              Undo check-in
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold sm:flex-none"
            style={{ ...cardStyle, color: ui.text }}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
