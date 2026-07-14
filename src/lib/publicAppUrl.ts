const DEFAULT_APP_ORIGIN = 'https://app.bigturnout.co';

/** Canonical organizer app origin for shareable links (not the current browser tab). */
export function publicAppOrigin(): string {
  const fromEnv = (import.meta.env.VITE_APP_BASE_URL || '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') {
      return window.location.origin;
    }
  }

  return DEFAULT_APP_ORIGIN;
}

/** Build an absolute app URL from a path or pass through an already-absolute URL. */
export function absoluteAppUrl(pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const host = new URL(trimmed).hostname.toLowerCase();
      if (host.endsWith('.vercel.app')) {
        const path = new URL(trimmed).pathname + new URL(trimmed).search + new URL(trimmed).hash;
        return `${publicAppOrigin()}${path}`;
      }
    } catch {
      return trimmed;
    }
    return trimmed;
  }

  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${publicAppOrigin()}${path}`;
}
