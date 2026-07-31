/** Client-side event landing visit tracking (UTM + referrer). */

import { toApiUrl } from '../api/client';

const VISITOR_KEY_STORAGE = 'turnout_visitor_key';
const TRACKED_SESSION_PREFIX = 'turnout_visit_tracked:';

function randomVisitorKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

export function getOrCreateVisitorKey(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY_STORAGE);
    if (existing && existing.length >= 8) return existing;
    const next = randomVisitorKey();
    localStorage.setItem(VISITOR_KEY_STORAGE, next);
    return next;
  } catch {
    return randomVisitorKey();
  }
}

function readUtmParams(): {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
} {
  try {
    const params = new URLSearchParams(window.location.search);
    const pick = (key: string) => {
      const v = (params.get(key) || '').trim();
      return v || null;
    };
    return {
      utmSource: pick('utm_source'),
      utmMedium: pick('utm_medium'),
      utmCampaign: pick('utm_campaign'),
    };
  } catch {
    return { utmSource: null, utmMedium: null, utmCampaign: null };
  }
}

function referrerHost(referrer: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./i, '');
    return host || null;
  } catch {
    return null;
  }
}

/**
 * Fire-and-forget page view for a published event landing.
 * Dedupes within the browser tab session per event.
 */
export function trackEventPageVisit(eventId: string): void {
  if (!eventId || typeof window === 'undefined') return;

  const sessionKey = `${TRACKED_SESSION_PREFIX}${eventId}`;
  try {
    if (sessionStorage.getItem(sessionKey) === '1') return;
    sessionStorage.setItem(sessionKey, '1');
  } catch {
    // continue without session dedupe
  }

  const utm = readUtmParams();
  const referrer = document.referrer || '';
  const payload = {
    visitorKey: getOrCreateVisitorKey(),
    referrer: referrer || null,
    referrerHost: referrerHost(referrer),
    utmSource: utm.utmSource,
    utmMedium: utm.utmMedium,
    utmCampaign: utm.utmCampaign,
    path: `${window.location.pathname}${window.location.search}`.slice(0, 255),
    userAgent: navigator.userAgent.slice(0, 255),
  };

  const body = JSON.stringify(payload);
  const url = toApiUrl(`/api/events/${encodeURIComponent(eventId)}/analytics/visit`);

  try {
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch {
    // fall through to fetch
  }

  void fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body,
    credentials: 'include',
    keepalive: true,
  }).catch(() => {
    /* ignore tracking failures */
  });
}
