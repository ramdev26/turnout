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
  const applyBulk = (qty: number, unitPrice: number): number => {
    const offers = (ticket.bulkOffers || [])
      .filter((o) => o.qty >= 2 && o.price > 0)
      .map((o) => ({ qty: o.qty, price: o.price }));
    if (offers.length === 0) return qty * unitPrice;
    const dp = Array.from({ length: qty + 1 }, () => Number.POSITIVE_INFINITY);
    dp[0] = 0;
    for (let i = 1; i <= qty; i += 1) {
      dp[i] = Math.min(dp[i], dp[i - 1] + unitPrice);
      for (const offer of offers) {
        if (offer.qty <= i) {
          dp[i] = Math.min(dp[i], dp[i - offer.qty] + offer.price);
        }
      }
    }
    return dp[qty];
  };
  const earlyBird = ticket.earlyBird;
  if (earlyBird?.active && earlyBird.remaining > 0) {
    const earlyQty = Math.min(quantity, earlyBird.remaining);
    const regularQty = quantity - earlyQty;
    return applyBulk(earlyQty, earlyBird.price) + applyBulk(regularQty, ticket.price);
  }
  return applyBulk(quantity, ticketEffectivePrice(ticket));
}

export function ticketHasEarlyBirdOffer(ticket: Ticket): boolean {
  return Boolean(ticket.earlyBird && ticket.earlyBird.price < ticket.price);
}

/** Valid bulk packs for buyer-facing display (qty ≥ 2, positive pack price). */
export function activeBulkOffers(ticket: Ticket): Array<{ qty: number; price: number }> {
  return (ticket.bulkOffers || [])
    .filter((o) => o.qty >= 2 && o.price > 0)
    .map((o) => ({ qty: o.qty, price: o.price }))
    .sort((a, b) => a.qty - b.qty);
}

export function ticketHasBulkOffers(ticket: Ticket): boolean {
  return activeBulkOffers(ticket).length > 0;
}

/** Savings vs buying the same qty at the current unit price (early bird when active). */
export function bulkOfferSavings(ticket: Ticket, offer: { qty: number; price: number }): number {
  const unit = ticketEffectivePrice(ticket);
  const full = unit * offer.qty;
  return Math.max(0, full - offer.price);
}

/** Line total as if no bulk packs applied (still respects early-bird inventory split). */
export function ticketLineTotalWithoutBulk(ticket: Ticket, quantity: number): number {
  if (quantity <= 0) return 0;
  const earlyBird = ticket.earlyBird;
  if (earlyBird?.active && earlyBird.remaining > 0) {
    const earlyQty = Math.min(quantity, earlyBird.remaining);
    const regularQty = quantity - earlyQty;
    return earlyQty * earlyBird.price + regularQty * ticket.price;
  }
  return quantity * ticketEffectivePrice(ticket);
}

/** True when the selected quantity is cheaper than unit price × qty thanks to bulk packs. */
export function ticketBulkSavingsForQty(ticket: Ticket, quantity: number): number {
  if (quantity <= 0 || activeBulkOffers(ticket).length === 0) return 0;
  return Math.max(0, ticketLineTotalWithoutBulk(ticket, quantity) - ticketLineTotal(ticket, quantity));
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

export type TicketBulkOfferForm = {
  qty: number;
  price: number;
};

export const defaultTicketEarlyBirdForm = (): TicketEarlyBirdForm => ({
  earlyBirdEnabled: false,
  earlyBirdPrice: 0,
  earlyBirdEndAt: '',
  earlyBirdLimit: 25,
});

export const defaultTicketBulkOffersForm = (): TicketBulkOfferForm[] => [];

export function earlyBirdFromTicket(ticket: Ticket): TicketEarlyBirdForm {
  const eb = ticket.earlyBird;
  return {
    earlyBirdEnabled: Boolean(eb),
    earlyBirdPrice: eb?.price ?? 0,
    earlyBirdEndAt: toDatetimeLocalValue(eb?.endAt),
    earlyBirdLimit: eb?.limit ?? 25,
  };
}

export function bulkOffersFromTicket(ticket: Ticket): TicketBulkOfferForm[] {
  return (ticket.bulkOffers || []).map((o) => ({ qty: o.qty, price: o.price }));
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

export function bulkOffersPayloadFromForm(offers: TicketBulkOfferForm[]): { bulkOffers: TicketBulkOfferForm[] } {
  const normalized = offers
    .map((o) => ({ qty: Number(o.qty) || 0, price: Number(o.price) || 0 }))
    .filter((o) => o.qty > 0 && o.price > 0);
  return { bulkOffers: normalized };
}
