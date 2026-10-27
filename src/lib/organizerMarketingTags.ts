/**
 * Injects organizer-owned Meta Pixel + Google Analytics (GA4) tags on public
 * event pages, and fires standard funnel conversion events.
 */

export type OrganizerMarketingIds = {
  metaPixelId?: string | null;
  gaMeasurementId?: string | null;
};

export type OrganizerMarketingEventContext = {
  eventId: string;
  eventTitle: string;
  eventSlug?: string | null;
  value?: number;
  currency?: string;
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  numItems?: number;
  orderId?: string;
};

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[] };
    _fbq?: Window['fbq'];
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const META_SCRIPT_ATTR = 'data-turnout-meta-pixel';
const GA_SCRIPT_ATTR = 'data-turnout-ga-measurement';
const PURCHASE_DEDUP_PREFIX = 'turnout_mkt_purchase:';

export function normalizeMetaPixelId(raw: string | null | undefined): string | null {
  const id = String(raw || '').trim();
  if (!id) return null;
  return /^\d{5,20}$/.test(id) ? id : null;
}

export function normalizeGaMeasurementId(raw: string | null | undefined): string | null {
  const id = String(raw || '')
    .trim()
    .toUpperCase();
  if (!id) return null;
  return /^G-[A-Z0-9]{4,20}$/.test(id) ? id : null;
}

function ensureMetaPixel(pixelId: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (!window.fbq) {
    const n = function (...args: unknown[]) {
      const self = n as NonNullable<Window['fbq']>;
      if (self.callMethod) {
        self.callMethod(...args);
      } else {
        (self.queue = self.queue || []).push(args);
      }
    } as NonNullable<Window['fbq']>;
    n.queue = [];
    window.fbq = n;
    if (!window._fbq) window._fbq = n;

    if (!document.querySelector(`script[${META_SCRIPT_ATTR}]`)) {
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      script.setAttribute(META_SCRIPT_ATTR, '1');
      const first = document.getElementsByTagName('script')[0];
      first?.parentNode?.insertBefore(script, first);
    }
  }

  const marked = document.documentElement.getAttribute('data-turnout-meta-init');
  if (marked === pixelId) return;
  document.documentElement.setAttribute('data-turnout-meta-init', pixelId);
  window.fbq?.('init', pixelId);
  window.fbq?.('track', 'PageView');
}

function ensureGaMeasurement(measurementId: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  }

  if (!document.querySelector(`script[${GA_SCRIPT_ATTR}="${measurementId}"]`)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.setAttribute(GA_SCRIPT_ATTR, measurementId);
    document.head.appendChild(script);
  }

  const marked = document.documentElement.getAttribute('data-turnout-ga-init');
  if (marked === measurementId) return;
  document.documentElement.setAttribute('data-turnout-ga-init', measurementId);
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: true });
}

/** Load/init organizer tags when IDs are present. No-op when both empty. */
export function ensureOrganizerMarketingTags(ids: OrganizerMarketingIds): OrganizerMarketingIds {
  const metaPixelId = normalizeMetaPixelId(ids.metaPixelId);
  const gaMeasurementId = normalizeGaMeasurementId(ids.gaMeasurementId);
  if (metaPixelId) ensureMetaPixel(metaPixelId);
  if (gaMeasurementId) ensureGaMeasurement(gaMeasurementId);
  return { metaPixelId, gaMeasurementId };
}

function contentIds(ctx: OrganizerMarketingEventContext): string[] {
  return (ctx.contents || []).map((c) => c.id).filter(Boolean);
}

function gaItems(ctx: OrganizerMarketingEventContext) {
  return (ctx.contents || []).map((c) => ({
    item_id: c.id,
    item_name: ctx.eventTitle,
    quantity: c.quantity,
    price: c.item_price,
  }));
}

export function trackOrganizerViewContent(
  ids: OrganizerMarketingIds,
  ctx: OrganizerMarketingEventContext
): void {
  const resolved = ensureOrganizerMarketingTags(ids);
  if (resolved.metaPixelId) {
    window.fbq?.('track', 'ViewContent', {
      content_name: ctx.eventTitle,
      content_ids: [ctx.eventId],
      content_type: 'product',
      content_category: 'event',
      value: ctx.value,
      currency: ctx.currency || 'LKR',
    });
  }
  if (resolved.gaMeasurementId) {
    window.gtag?.('event', 'view_item', {
      currency: ctx.currency || 'LKR',
      value: ctx.value ?? 0,
      items: [
        {
          item_id: ctx.eventId,
          item_name: ctx.eventTitle,
          item_category: 'event',
        },
      ],
    });
  }
}

export function trackOrganizerInitiateCheckout(
  ids: OrganizerMarketingIds,
  ctx: OrganizerMarketingEventContext
): void {
  const resolved = ensureOrganizerMarketingTags(ids);
  const idsList = contentIds(ctx);
  if (resolved.metaPixelId) {
    window.fbq?.('track', 'InitiateCheckout', {
      content_name: ctx.eventTitle,
      content_ids: idsList.length ? idsList : [ctx.eventId],
      content_type: 'product',
      num_items: ctx.numItems ?? (idsList.length || 1),
      value: ctx.value ?? 0,
      currency: ctx.currency || 'LKR',
    });
  }
  if (resolved.gaMeasurementId) {
    window.gtag?.('event', 'begin_checkout', {
      currency: ctx.currency || 'LKR',
      value: ctx.value ?? 0,
      items: gaItems(ctx).length
        ? gaItems(ctx)
        : [{ item_id: ctx.eventId, item_name: ctx.eventTitle, item_category: 'event' }],
    });
  }
}

export function trackOrganizerPurchase(
  ids: OrganizerMarketingIds,
  ctx: OrganizerMarketingEventContext
): void {
  if (!ctx.orderId) return;
  try {
    const key = `${PURCHASE_DEDUP_PREFIX}${ctx.orderId}`;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) return;
    sessionStorage?.setItem(key, '1');
  } catch {
    // Ignore storage failures (private mode) and still attempt to fire once.
  }

  const resolved = ensureOrganizerMarketingTags(ids);
  const idsList = contentIds(ctx);
  if (resolved.metaPixelId) {
    window.fbq?.('track', 'Purchase', {
      content_name: ctx.eventTitle,
      content_ids: idsList.length ? idsList : [ctx.eventId],
      content_type: 'product',
      num_items: ctx.numItems ?? (idsList.length || 1),
      value: ctx.value ?? 0,
      currency: ctx.currency || 'LKR',
    });
  }
  if (resolved.gaMeasurementId) {
    window.gtag?.('event', 'purchase', {
      transaction_id: ctx.orderId,
      currency: ctx.currency || 'LKR',
      value: ctx.value ?? 0,
      items: gaItems(ctx).length
        ? gaItems(ctx)
        : [{ item_id: ctx.eventId, item_name: ctx.eventTitle, item_category: 'event' }],
    });
  }
}
