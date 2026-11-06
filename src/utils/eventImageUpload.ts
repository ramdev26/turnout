/** Shared rules for event cover / gallery image uploads (incl. animated GIF). */

export const EVENT_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

export const EVENT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const EVENT_IMAGE_HELPER_TEXT = 'PNG, JPG, WEBP, or GIF · max 10MB';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/x-gif']);

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

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
    return 'Image must be 10MB or smaller. Try compressing animated GIFs.';
  }
  return null;
}
