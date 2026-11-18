/** Hosts that belong to the Turnout platform app (not organizer custom domains). */
const STATIC_PLATFORM_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  'app.bigturnout.co',
  'bigturnout.co',
  'www.bigturnout.co',
  'domains.bigturnout.co',
]);

export function normalizeHostname(host: string): string {
  return host.split(':')[0].trim().toLowerCase().replace(/^www\./, '');
}

export function isPlatformHostname(hostname?: string): boolean {
  if (typeof window === 'undefined' && hostname === undefined) return true;
  const host = normalizeHostname(hostname ?? window.location.hostname);
  if (!host) return true;
  if (STATIC_PLATFORM_HOSTS.has(host)) return true;
  if (host.endsWith('.vercel.app')) return true;
  return false;
}

/** True when the visitor is on an organizer custom domain. */
export function isCustomEventHostname(hostname?: string): boolean {
  return !isPlatformHostname(hostname);
}
