import type { Ticket } from '../types';

/** Current buyer-facing unit price (early bird when active, else standard). */
export function ticketEffectivePrice(ticket: Ticket): number {
  if (ticket.earlyBird?.active) {
    return ticket.earlyBird.price;
  }
  return ticket.effectivePrice ?? ticket.price;
}

/** Mirrors server checkout split when a cart spans early-bird and standard inventory. */
export function ticketLineTotal(ticket: Ticket, quantity: number): number {
  if (quantity <= 0) return 0;
  const earlyBird = ticket.earlyBird;
  if (earlyBird?.active && earlyBird.remaining > 0) {
    const earlyQty = Math.min(quantity, earlyBird.remaining);
    const regularQty = quantity - earlyQty;
    return earlyQty * earlyBird.price + regularQty * ticket.price;
  }
  return quantity * ticketEffectivePrice(ticket);
}

export function ticketHasEarlyBirdOffer(ticket: Ticket): boolean {
  return Boolean(ticket.earlyBird && ticket.earlyBird.price < ticket.price);
}

export function formatEarlyBirdEndsLabel(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function datetimeLocalToIso(value: string): string {
  if (!value.trim()) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

export type TicketEarlyBirdForm = {
  earlyBirdEnabled: boolean;
  earlyBirdPrice: number;
  earlyBirdEndAt: string;
  earlyBirdLimit: number;
};

export const defaultTicketEarlyBirdForm = (): TicketEarlyBirdForm => ({
  earlyBirdEnabled: false,
  earlyBirdPrice: 0,
  earlyBirdEndAt: '',
  earlyBirdLimit: 25,
});

export function earlyBirdFromTicket(ticket: Ticket): TicketEarlyBirdForm {
  const eb = ticket.earlyBird;
  return {
    earlyBirdEnabled: Boolean(eb),
    earlyBirdPrice: eb?.price ?? 0,
    earlyBirdEndAt: toDatetimeLocalValue(eb?.endAt),
    earlyBirdLimit: eb?.limit ?? 25,
  };
}

export function defaultEarlyBirdEndLocal(daysFromNow = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(23, 59, 0, 0);
  return toDatetimeLocalValue(d.toISOString());
}

export function earlyBirdPayloadFromForm(form: TicketEarlyBirdForm): Record<string, unknown> {
  if (!form.earlyBirdEnabled) {
    return { earlyBirdEnabled: false };
  }
  return {
    earlyBirdEnabled: true,
    earlyBirdPrice: form.earlyBirdPrice,
    earlyBirdEndAt: datetimeLocalToIso(form.earlyBirdEndAt),
    earlyBirdLimit: form.earlyBirdLimit,
  };
}
