/** Shared rules for event cover image uploads (incl. animated GIF). */

export const EVENT_IMAGE_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp,image/gif,.gif,.png,.jpg,.jpeg,.webp';

export const EVENT_IMAGE_MAX_BYTES = 50 * 1024 * 1024;

export const EVENT_IMAGE_HELPER_TEXT = 'PNG, JPG, WEBP, or GIF · max 50MB';

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/x-gif',
]);

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

export type EventImageLayoutHint = {
  label: string;
  detail: string;
};

/** Recommended cover dimensions by landing layout / presentation. */
export function eventImageSizeHint(templateId?: string | null): EventImageLayoutHint {
  const id = String(templateId || 'template-2');

  // Showcase / editorial poster frame
  if (id === 'template-2' || id === 'template-1' || id === 'template-4') {
    return {
      label: 'Showcase · 1080×1350 (4:5) or 1200×1500',
      detail: 'Tall poster fills the frame best. Landscape 1920×1080 also works. GIF supported · max 50MB.',
    };
  }

  // Gather — soft hosted event
  if (id === 'template-8') {
    return {
      label: 'Gather · 1600×900 (16:9) or 1200×1200',
      detail: 'Wide cover or square both work. GIF supported · max 50MB.',
    };
  }

  // Spotlight — featured banner
  if (id === 'template-7') {
    return {
      label: 'Spotlight · 1920×1080 (16:9)',
      detail: 'Full-bleed landscape hero. Keep faces centered. GIF supported · max 50MB.',
    };
  }

  // Arena / Arena Nova — gallery + poster
  if (id === 'template-6' || id === 'template-10') {
    return {
      label: 'Arena · 1080×1350 (4:5) cover',
      detail: 'Portrait cover for the main poster; gallery images 1600×900. GIF supported · max 50MB.',
    };
  }

  // Pulse — full poster card in the left column
  if (id === 'template-11') {
    return {
      label: 'Pulse · 1080×1350 (4:5) poster',
      detail: 'Shown as a full poster card above the headline. Landscape also works. GIF supported · max 50MB.',
    };
  }

  // Minimal / other
  if (id === 'template-5' || id === 'template-3') {
    return {
      label: 'Minimal · 1600×900 (16:9)',
      detail: 'Landscape banner. Square also works. GIF supported · max 50MB.',
    };
  }

  return {
    label: 'Cover · 1920×1080 (16:9) or 1080×1350 (4:5)',
    detail: 'Match your layout. Animated GIFs work — keep under 50MB.',
  };
}

export function validateEventImageFile(file: File): string | null {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const ext = name.includes('.') ? `.${name.split('.').pop()}` : '';
  const typeOk = type ? ALLOWED_TYPES.has(type) : ALLOWED_EXTENSIONS.has(ext);
  const extOk = !ext || ALLOWED_EXTENSIONS.has(ext);
  if (!typeOk || !extOk) {
    return 'Use a PNG, JPG, WEBP, or GIF image.';
  }
  if (file.size <= 0 || file.size > EVENT_IMAGE_MAX_BYTES) {
    return 'Image must be 50MB or smaller. Compress animated GIFs if needed.';
  }
  return null;
}
