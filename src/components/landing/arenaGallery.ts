import type { Event } from '../../types';

/** Banner first, then extra Arena gallery images (deduped). */
export function resolveArenaCarouselSlides(event: Pick<Event, 'bannerUrl' | 'customization'>): string[] {
  const slides: string[] = [];
  const banner = event.bannerUrl?.trim();
  if (banner) slides.push(banner);

  const extras = event.customization?.arenaGalleryImages;
  if (!Array.isArray(extras)) return slides;

  for (const raw of extras) {
    const url = typeof raw === 'string' ? raw.trim() : '';
    if (url && !slides.includes(url)) slides.push(url);
  }
  return slides;
}

export function normalizeArenaGalleryImages(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  const out: string[] = [];
  for (const raw of urls) {
    const url = typeof raw === 'string' ? raw.trim() : '';
    if (url && !out.includes(url) && out.length < 8) out.push(url);
  }
  return out;
}
