import { next, rewrite } from '@vercel/functions';

const DEFAULT_PLATFORM_HOSTS = ['localhost', '127.0.0.1'];

function normalizeHost(host: string): string {
  return host.split(':')[0].trim().toLowerCase().replace(/^www\./, '');
}

function platformHosts(): Set<string> {
  const fromEnv = (process.env.PLATFORM_HOSTS || '')
    .split(',')
    .map((h) => normalizeHost(h))
    .filter(Boolean);
  const vercelUrl = (process.env.VERCEL_URL || '').trim();
  const hosts = [...DEFAULT_PLATFORM_HOSTS, ...fromEnv];
  if (vercelUrl) hosts.push(normalizeHost(vercelUrl));
  return new Set(hosts);
}

function isPlatformHost(host: string): boolean {
  if (!host) return true;
  if (platformHosts().has(host)) return true;
  if (host.endsWith('.vercel.app')) return true;
  return false;
}

export const config = {
  matcher: ['/((?!api/|assets/|.*\\..*).*)'],
};

function isSocialCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  if (!ua) return false;

  const looksLikeBrowser =
    ua.includes('mozilla') ||
    ua.includes('applewebkit') ||
    ua.includes('chrome') ||
    ua.includes('safari');

  const knownBots = [
    'facebookexternalhit',
    'facebot',
    'twitterbot',
    'linkedinbot',
    'slackbot',
    'discordbot',
    'telegrambot',
    'skypeuripreview',
    'googlebot',
    'bingbot',
    'embedly',
    'quora link preview',
    'pinterest',
    'redditbot',
    'applebot',
  ];
  if (knownBots.some((token) => ua.includes(token))) return true;

  // WhatsApp preview bots are non-browser UAs; WhatsApp in-app browsers are not.
  return ua.includes('whatsapp') && !looksLikeBrowser;
}

function sharePreviewRewrite(origin: string, slug: string, brandedRoot = false) {
  const target = new URL(`/api/index.php?share_slug=${encodeURIComponent(slug)}`, origin);
  if (brandedRoot) target.searchParams.set('share_branded', '1');
  return rewrite(target);
}

type HostMap = {
  slug?: string;
  paths?: Record<string, string>;
};

async function fetchHostMap(origin: string, host: string): Promise<HostMap | null> {
  const lookup = new URL(`/api/events/by-host/${encodeURIComponent(host)}`, origin);
  const res = await fetch(lookup, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  return (await res.json()) as HostMap;
}

function resolveSlugForPath(map: HostMap, pathname: string): { slug: string; alias: string | null; checkout: boolean } | null {
  const defaultSlug = (map.slug || '').trim();
  const paths = map.paths || {};
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return defaultSlug ? { slug: defaultSlug, alias: null, checkout: false } : null;
  }

  const first = segments[0].toLowerCase();
  if (first === 'checkout') {
    return defaultSlug ? { slug: defaultSlug, alias: null, checkout: true } : null;
  }

  const aliasSlug = (paths[first] || '').trim();
  if (aliasSlug) {
    const checkout = segments[1] === 'checkout';
    if (segments.length > 2) return null;
    if (segments.length === 2 && !checkout) return null;
    return { slug: aliasSlug, alias: first, checkout };
  }

  return null;
}

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return next();

  const userAgent = request.headers.get('user-agent') || '';
  const crawler = isSocialCrawler(userAgent);

  const shareSlugMatch = url.pathname.match(/^\/e\/([^/?#]+)$/);
  if (shareSlugMatch && crawler) {
    return sharePreviewRewrite(url.origin, shareSlugMatch[1]);
  }

  const host = normalizeHost(request.headers.get('host') || '');
  if (isPlatformHost(host)) return next();

  try {
    const map = await fetchHostMap(url.origin, host);
    if (!map) return next();

    const resolved = resolveSlugForPath(map, url.pathname);
    if (!resolved) return next();

    // WhatsApp / social previews need event OG tags, not the SPA shell.
    if (crawler && !resolved.checkout) {
      return sharePreviewRewrite(url.origin, resolved.slug, true);
    }

    // Keep branded URLs (/tmb, /cc, /) in the address bar — SPA resolves via by-host.
    if (resolved.alias || url.pathname === '/' || url.pathname === '' || url.pathname === '/checkout') {
      return next();
    }
  } catch {
    return next();
  }

  return next();
}
