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

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return next();

  const host = normalizeHost(request.headers.get('host') || '');
  if (isPlatformHost(host)) return next();

  try {
    const lookup = new URL(`/api/events/by-host/${encodeURIComponent(host)}`, url.origin);
    const res = await fetch(lookup, { headers: { Accept: 'application/json' } });
    if (!res.ok) return next();
    const data = (await res.json()) as { slug?: string };
    const slug = data?.slug;
    if (!slug) return next();

    if (url.pathname === '/' || url.pathname === '') {
      return rewrite(new URL(`/e/${slug}${url.search}`, url.origin));
    }
  } catch {
    return next();
  }

  return next();
}
