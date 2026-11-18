/**
 * Injects organizer-owned Meta Pixel, GA4, TikTok Pixel, and Google Ads tags on
 * public event pages, and fires standard funnel conversion events with traffic sources.
 */

export type OrganizerMarketingIds = {
  metaPixelId?: string | null;
  gaMeasurementId?: string | null;
  tiktokPixelId?: string | null;
  googleAdsId?: string | null;
  googleAdsConversionLabel?: string | null;
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

type TikTokQueue = Array<unknown> & {
  methods?: string[];
  setAndDefer?: (t: TikTokQueue, method: string) => void;
  instance?: (id: string) => TikTokQueue;
  load?: (id: string) => void;
  page?: (...args: unknown[]) => void;
  track?: (...args: unknown[]) => void;
  _i?: Record<string, unknown>;
  _t?: Record<string, number>;
  _o?: Record<string, unknown>;
};

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[] };
    _fbq?: Window['fbq'];
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    ttq?: TikTokQueue;
    TiktokAnalyticsObject?: string;
  }
}

const META_SCRIPT_ATTR = 'data-turnout-meta-pixel';
const GA_SCRIPT_ATTR = 'data-turnout-ga-measurement';
const ADS_SCRIPT_ATTR = 'data-turnout-google-ads';
const TIKTOK_SCRIPT_ATTR = 'data-turnout-tiktok-pixel';
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

export function normalizeTiktokPixelId(raw: string | null | undefined): string | null {
  const id = String(raw || '').trim();
  if (!id) return null;
  return /^[A-Za-z0-9]{6,64}$/.test(id) ? id : null;
}

export function normalizeGoogleAdsId(raw: string | null | undefined): string | null {
  const id = String(raw || '')
    .trim()
    .toUpperCase();
  if (!id) return null;
  return /^AW-\d{5,20}$/.test(id) ? id : null;
}

export function normalizeGoogleAdsConversionLabel(raw: string | null | undefined): string | null {
  const id = String(raw || '').trim();
  if (!id) return null;
  return /^[A-Za-z0-9_-]{4,64}$/.test(id) ? id : null;
}

function ensureGtagStub(): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
    };
  }
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
  ensureGtagStub();

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
  window.gtag?.('js', new Date());

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

  window.gtag?.('config', measurementId, config);
}

function ensureGoogleAds(adsId: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  ensureGtagStub();

  if (!document.querySelector(`script[${ADS_SCRIPT_ATTR}="${adsId}"]`)) {
    // Reuse an already-loaded gtag.js if GA loaded first; otherwise load for AW-.
    if (!document.querySelector(`script[${GA_SCRIPT_ATTR}]`)) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(adsId)}`;
      script.setAttribute(ADS_SCRIPT_ATTR, adsId);
      document.head.appendChild(script);
    } else {
      const marker = document.createElement('script');
      marker.setAttribute(ADS_SCRIPT_ATTR, adsId);
      marker.type = 'application/json';
      marker.text = '{}';
      document.head.appendChild(marker);
    }
  }

  const marked = document.documentElement.getAttribute('data-turnout-ads-init');
  if (marked === adsId) return;
  document.documentElement.setAttribute('data-turnout-ads-init', adsId);
  window.gtag?.('js', new Date());
  window.gtag?.('config', adsId);
}

function ensureTiktokPixel(pixelId: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (!window.ttq) {
    const w = window;
    w.TiktokAnalyticsObject = 'ttq';
    // Official TikTok stub is an array queue with deferred method helpers.
    const ttq = [] as unknown as TikTokQueue;
    w.ttq = ttq;
    ttq.methods = [
      'page',
      'track',
      'identify',
      'instances',
      'debug',
      'on',
      'off',
      'once',
      'ready',
      'alias',
      'group',
      'enableCookie',
      'disableCookie',
      'holdConsent',
      'revokeConsent',
      'grantConsent',
    ];
    ttq.setAndDefer = function (target, method) {
      (target as unknown as Record<string, (...args: unknown[]) => void>)[method] = function (...args: unknown[]) {
        target.push([method, ...args]);
      };
    };
    for (const method of ttq.methods) {
      ttq.setAndDefer?.(ttq, method);
    }
    ttq.instance = function (id: string) {
      const store = (ttq._i = ttq._i || {});
      const inst = (store[id] = (store[id] as unknown[]) || []) as unknown as TikTokQueue;
      for (const method of ttq.methods || []) ttq.setAndDefer?.(inst, method);
      return inst;
    };
    ttq.load = function (id: string) {
      const url = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._i = ttq._i || {};
      ttq._i[id] = [];
      ttq._t = ttq._t || {};
      ttq._t[id] = Date.now();
      ttq._o = ttq._o || {};
      if (!document.querySelector(`script[${TIKTOK_SCRIPT_ATTR}]`)) {
        const script = document.createElement('script');
        script.async = true;
        script.src = `${url}?sdkid=${encodeURIComponent(id)}&lib=ttq`;
        script.setAttribute(TIKTOK_SCRIPT_ATTR, '1');
        const first = document.getElementsByTagName('script')[0];
        first?.parentNode?.insertBefore(script, first);
      }
    };
  }

  const marked = document.documentElement.getAttribute('data-turnout-tiktok-init');
  if (marked === pixelId) return;
  document.documentElement.setAttribute('data-turnout-tiktok-init', pixelId);
  window.ttq?.load?.(pixelId);
  window.ttq?.page?.();
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

/** Load/init organizer tags when IDs are present. No-op when all empty. */
export function ensureOrganizerMarketingTags(ids: OrganizerMarketingIds): OrganizerMarketingIds {
  captureTrafficSource();
  const metaPixelId = normalizeMetaPixelId(ids.metaPixelId);
  const gaMeasurementId = normalizeGaMeasurementId(ids.gaMeasurementId);
  const tiktokPixelId = normalizeTiktokPixelId(ids.tiktokPixelId);
  const googleAdsId = normalizeGoogleAdsId(ids.googleAdsId);
  const googleAdsConversionLabel = normalizeGoogleAdsConversionLabel(ids.googleAdsConversionLabel);
  if (metaPixelId) ensureMetaPixel(metaPixelId);
  if (gaMeasurementId) ensureGaMeasurement(gaMeasurementId);
  if (googleAdsId) ensureGoogleAds(googleAdsId);
  if (tiktokPixelId) ensureTiktokPixel(tiktokPixelId);
  return { metaPixelId, gaMeasurementId, tiktokPixelId, googleAdsId, googleAdsConversionLabel };
}

function tiktokContents(ctx: OrganizerMarketingEventContext) {
  if ((ctx.contents || []).length > 0) {
    return (ctx.contents || []).map((c) => ({
      content_id: c.id,
      content_type: 'product',
      content_name: c.name || ctx.eventTitle,
      quantity: c.quantity,
      price: c.item_price,
    }));
  }
  return [
    {
      content_id: ctx.eventId,
      content_type: 'product',
      content_name: ctx.eventTitle,
      quantity: ctx.numItems ?? 1,
    },
  ];
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

function googleAdsSendTo(adsId: string, label?: string | null): string | null {
  if (!adsId) return null;
  if (!label) return null;
  return `${adsId}/${label}`;
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
  if (resolved.tiktokPixelId) {
    window.ttq?.track?.('ViewContent', {
      contents: tiktokContents(ctx),
      content_type: 'product',
      value: ctx.value ?? 0,
      currency: ctx.currency || 'LKR',
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
  if (resolved.tiktokPixelId) {
    window.ttq?.track?.('InitiateCheckout', {
      contents: tiktokContents(ctx),
      content_type: 'product',
      value: ctx.value ?? 0,
      currency: ctx.currency || 'LKR',
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
  if (resolved.tiktokPixelId) {
    window.ttq?.track?.('CompletePayment', {
      contents: tiktokContents(ctx),
      content_type: 'product',
      value: Number(ctx.value ?? 0),
      currency: ctx.currency || 'LKR',
    });
  }
  // Google Ads purchase conversion — requires AW- ID + conversion label from Ads → Conversions.
  const adsSendTo =
    resolved.googleAdsId && resolved.googleAdsConversionLabel
      ? googleAdsSendTo(resolved.googleAdsId, resolved.googleAdsConversionLabel)
      : null;
  if (adsSendTo) {
    window.gtag?.('event', 'conversion', {
      send_to: adsSendTo,
      value: Number(ctx.value ?? 0),
      currency: ctx.currency || 'LKR',
      transaction_id: ctx.orderId,
    });
  }
}
