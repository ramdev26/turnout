import type { Event } from '../../types';

function readRawGalleryExtras(event: Pick<Event, 'customization'>): unknown {
  return event.customization?.eventGalleryImages ?? event.customization?.arenaGalleryImages;
}

/** Banner first, then extra event gallery images (deduped). */
export function resolveArenaCarouselSlides(event: Pick<Event, 'bannerUrl' | 'customization'>): string[] {
  const slides: string[] = [];
  const banner = event.bannerUrl?.trim();
  if (banner) slides.push(banner);

  const extras = readRawGalleryExtras(event);
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

export const normalizeEventGalleryImages = normalizeArenaGalleryImages;
