import type { Event, EventCustomization } from '../types';

export type PurchaseLimits = {
  maxTicketsPerOrder: number | null;
  maxTicketsPerCustomer: number | null;
  enabled: boolean;
};

export function purchaseLimitsFromCustomization(
  customization?: EventCustomization | null
): PurchaseLimits {
  const perOrder =
    customization?.maxTicketsPerOrder != null && customization.maxTicketsPerOrder >= 1
      ? Math.min(100, Math.floor(customization.maxTicketsPerOrder))
      : null;
  const perCustomer =
    customization?.maxTicketsPerCustomer != null && customization.maxTicketsPerCustomer >= 1
      ? Math.min(100, Math.floor(customization.maxTicketsPerCustomer))
      : null;
  return {
    maxTicketsPerOrder: perOrder,
    maxTicketsPerCustomer: perCustomer,
    enabled: perOrder != null || perCustomer != null,
  };
}

export function purchaseLimitsFromEvent(event: Event | null | undefined): PurchaseLimits {
  return purchaseLimitsFromCustomization(event?.customization);
}

/** Max tickets selectable in the current cart (order-level cap). */
export function maxSelectableTickets(event: Event | null | undefined, inventoryCap: number): number {
  const limits = purchaseLimitsFromEvent(event);
  let max = Math.max(0, inventoryCap);
  if (limits.maxTicketsPerOrder != null) {
    max = Math.min(max, limits.maxTicketsPerOrder);
  }
  if (limits.maxTicketsPerCustomer != null) {
    max = Math.min(max, limits.maxTicketsPerCustomer);
  }
  return max;
}

export function purchaseLimitsSummary(limits: PurchaseLimits): string | null {
  if (!limits.enabled) return null;
  const parts: string[] = [];
  if (limits.maxTicketsPerOrder === 1) parts.push('1 ticket per order');
  else if (limits.maxTicketsPerOrder != null) parts.push(`${limits.maxTicketsPerOrder} tickets per order`);
  if (limits.maxTicketsPerCustomer === 1) parts.push('1 ticket per customer');
  else if (limits.maxTicketsPerCustomer != null) {
    parts.push(`${limits.maxTicketsPerCustomer} tickets per customer`);
  }
  return parts.length ? parts.join(' · ') : null;
}
