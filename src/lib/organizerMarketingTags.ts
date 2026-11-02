/**
 * Injects organizer-owned Meta Pixel + Google Analytics (GA4) tags on public
 * event pages, and fires standard funnel conversion events with traffic sources.
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
  contents?: Array<{ id: string; quantity: number; item_price?: number; name?: string }>;
  numItems?: number;
  orderId?: string;
};

export type TrafficSource = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  referrer: string | null;
  landingPage: string | null;
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
const TRAFFIC_SOURCE_KEY = 'turnout_mkt_traffic_source';

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

function readQueryParam(params: URLSearchParams, keys: string[]): string | null {
  for (const key of keys) {
    const value = (params.get(key) || '').trim();
    if (value) return value.slice(0, 200);
  }
  return null;
}

/** Capture first-touch UTMs + referrer for the browser session (survives SPA checkout). */
export function captureTrafficSource(href?: string): TrafficSource {
  if (typeof window === 'undefined') {
    return {
      source: null,
      medium: null,
      campaign: null,
      content: null,
      term: null,
      referrer: null,
      landingPage: null,
    };
  }

  let existing: TrafficSource | null = null;
  try {
    const raw = sessionStorage.getItem(TRAFFIC_SOURCE_KEY);
    if (raw) existing = JSON.parse(raw) as TrafficSource;
  } catch {
    existing = null;
  }

  const url = new URL(href || window.location.href);
  const params = url.searchParams;
  const utmSource = readQueryParam(params, ['utm_source', 'source']);
  const utmMedium = readQueryParam(params, ['utm_medium', 'medium']);
  const utmCampaign = readQueryParam(params, ['utm_campaign', 'campaign']);
  const utmContent = readQueryParam(params, ['utm_content', 'content']);
  const utmTerm = readQueryParam(params, ['utm_term', 'term']);
  const referrer = (typeof document !== 'undefined' ? document.referrer : '') || null;
  const hasUtm = !!(utmSource || utmMedium || utmCampaign || utmContent || utmTerm);

  // First touch wins for the session unless a new UTM arrives.
  if (existing && !hasUtm) return existing;

  const next: TrafficSource = {
    source: utmSource || existing?.source || null,
    medium: utmMedium || existing?.medium || (utmSource ? 'campaign' : null),
    campaign: utmCampaign || existing?.campaign || null,
    content: utmContent || existing?.content || null,
    term: utmTerm || existing?.term || null,
    referrer: existing?.referrer || (referrer && !referrer.includes(window.location.hostname) ? referrer : null),
    landingPage: existing?.landingPage || `${url.pathname}${url.search}`,
  };

  // Infer source from referrer when no UTM was provided on first hit.
  if (!next.source && next.referrer) {
    try {
      const host = new URL(next.referrer).hostname.replace(/^www\./, '');
      next.source = host || 'referral';
      next.medium = next.medium || 'referral';
    } catch {
      next.source = 'referral';
      next.medium = next.medium || 'referral';
    }
  }
  if (!next.source && !next.referrer && !existing) {
    next.source = 'direct';
    next.medium = 'none';
  }

  try {
    sessionStorage.setItem(TRAFFIC_SOURCE_KEY, JSON.stringify(next));
  } catch {
    // Ignore private-mode quota errors.
  }
  return next;
}

export function getTrafficSource(): TrafficSource {
  return captureTrafficSource();
}

function trafficSourceEventParams(source: TrafficSource): Record<string, string> {
  const params: Record<string, string> = {};
  if (source.source) params.traffic_source = source.source;
  if (source.medium) params.traffic_medium = source.medium;
  if (source.campaign) params.traffic_campaign = source.campaign;
  if (source.content) params.traffic_content = source.content;
  if (source.term) params.traffic_term = source.term;
  if (source.referrer) params.traffic_referrer = source.referrer.slice(0, 250);
  if (source.landingPage) params.traffic_landing_page = source.landingPage.slice(0, 250);
  return params;
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

  const traffic = captureTrafficSource();

  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    // Google requires pushing the Arguments object (not a rest-args array),
    // otherwise gtag.js can load without ever sending collect hits.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
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

  const config: Record<string, unknown> = {
    send_page_view: true,
    page_location: window.location.href,
    page_title: document.title || undefined,
  };
  if (document.referrer) config.page_referrer = document.referrer;
  // First-touch campaign fields so Acquisition / Traffic acquisition can attribute the session.
  if (traffic.source) config.campaign_source = traffic.source;
  if (traffic.medium) config.campaign_medium = traffic.medium;
  if (traffic.campaign) config.campaign_name = traffic.campaign;
  if (traffic.content) config.campaign_content = traffic.content;
  if (traffic.term) config.campaign_term = traffic.term;

  window.gtag('config', measurementId, config);
}

function sendGaPageView(measurementId: string, pathHint?: string): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  const traffic = getTrafficSource();
  window.gtag('event', 'page_view', {
    send_to: measurementId,
    page_location: window.location.href,
    page_path: pathHint || `${window.location.pathname}${window.location.search}`,
    page_title: document.title || undefined,
    ...trafficSourceEventParams(traffic),
  });
}

/** Load/init organizer tags when IDs are present. No-op when both empty. */
export function ensureOrganizerMarketingTags(ids: OrganizerMarketingIds): OrganizerMarketingIds {
  captureTrafficSource();
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
    item_name: c.name || ctx.eventTitle,
    item_category: 'event',
    item_category2: ctx.eventTitle,
    quantity: c.quantity,
    price: c.item_price,
  }));
}

export function trackOrganizerViewContent(
  ids: OrganizerMarketingIds,
  ctx: OrganizerMarketingEventContext
): void {
  const resolved = ensureOrganizerMarketingTags(ids);
  const traffic = getTrafficSource();
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
    sendGaPageView(resolved.gaMeasurementId, ctx.eventSlug ? `/e/${ctx.eventSlug}` : undefined);
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
      ...trafficSourceEventParams(traffic),
    });
  }
}

export function trackOrganizerInitiateCheckout(
  ids: OrganizerMarketingIds,
  ctx: OrganizerMarketingEventContext
): void {
  const resolved = ensureOrganizerMarketingTags(ids);
  const traffic = getTrafficSource();
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
    sendGaPageView(resolved.gaMeasurementId, `/checkout/${ctx.eventId}`);
    window.gtag?.('event', 'begin_checkout', {
      currency: ctx.currency || 'LKR',
      value: ctx.value ?? 0,
      items: gaItems(ctx).length
        ? gaItems(ctx)
        : [{ item_id: ctx.eventId, item_name: ctx.eventTitle, item_category: 'event' }],
      ...trafficSourceEventParams(traffic),
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
  const traffic = getTrafficSource();
  const idsList = contentIds(ctx);
  if (resolved.metaPixelId) {
    const contents =
      (ctx.contents || []).length > 0
        ? (ctx.contents || []).map((c) => ({
            id: c.id,
            quantity: c.quantity,
            item_price: c.item_price,
          }))
        : [{ id: ctx.eventId, quantity: ctx.numItems ?? 1 }];
    // Standard Meta Purchase — value/currency required for purchase reporting.
    // eventID lets Events Manager / CAPI dedupe by order.
    window.fbq?.(
      'track',
      'Purchase',
      {
        content_name: ctx.eventTitle,
        content_ids: idsList.length ? idsList : [ctx.eventId],
        contents,
        content_type: 'product',
        num_items: ctx.numItems ?? (idsList.length || 1),
        value: Number(ctx.value ?? 0),
        currency: ctx.currency || 'LKR',
        order_id: ctx.orderId,
      },
      { eventID: `order_${ctx.orderId}` }
    );
  }
  if (resolved.gaMeasurementId) {
    sendGaPageView(resolved.gaMeasurementId, `/orders/${ctx.orderId}/success`);
    // GA4 purchase — shows under Monetization / Ecommerce purchases.
    window.gtag?.('event', 'purchase', {
      transaction_id: ctx.orderId,
      currency: ctx.currency || 'LKR',
      value: Number(ctx.value ?? 0),
      affiliation: 'Turnout',
      items: gaItems(ctx).length
        ? gaItems(ctx)
        : [{ item_id: ctx.eventId, item_name: ctx.eventTitle, item_category: 'event', quantity: 1 }],
      ...trafficSourceEventParams(traffic),
    });
  }
}
