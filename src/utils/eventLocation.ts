export type EventLocationMode = 'physical' | 'online';

export type OnlineEventPlatform = 'google_meet' | 'zoom' | 'youtube' | 'other';

export const ONLINE_EVENT_PLATFORMS: { id: OnlineEventPlatform; label: string; placeholder: string }[] = [
  { id: 'google_meet', label: 'Google Meet', placeholder: 'https://meet.google.com/...' },
  { id: 'zoom', label: 'Zoom', placeholder: 'https://zoom.us/j/...' },
  { id: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/live/...' },
  { id: 'other', label: 'Other', placeholder: 'https://...' },
];

export function onlinePlatformLabel(platform: OnlineEventPlatform | string | null | undefined): string {
  const found = ONLINE_EVENT_PLATFORMS.find((p) => p.id === platform);
  return found?.label || 'Online';
}

export function formatEventLocationDisplay(input: {
  mode: EventLocationMode;
  physicalLocation?: string;
  platform?: OnlineEventPlatform | null;
}): string {
  if (input.mode === 'online') {
    return `Online · ${onlinePlatformLabel(input.platform)}`;
  }
  return (input.physicalLocation || '').trim();
}

export function resolveEventLocationMode(customization: { locationMode?: string } | null | undefined): EventLocationMode {
  return customization?.locationMode === 'online' ? 'online' : 'physical';
}

export function resolveOnlinePlatform(
  customization: { onlinePlatform?: string } | null | undefined
): OnlineEventPlatform {
  const raw = customization?.onlinePlatform;
  if (raw === 'google_meet' || raw === 'zoom' || raw === 'youtube' || raw === 'other') return raw;
  return 'google_meet';
}

export function isOnlineEvent(customization: { locationMode?: string } | null | undefined, location?: string | null): boolean {
  if (customization?.locationMode === 'online') return true;
  if (customization?.locationMode === 'physical') return false;
  const v = (location || '').toLowerCase();
  return /online\s*·|meet\.google|zoom\.us|youtube\.com|online|virtual|stream|webinar/.test(v);
}

export function isValidMeetingUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  try {
    const url = new URL(v);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function resolveOnlineJoinUrl(
  customization: { locationMode?: string; onlineUrl?: string } | null | undefined
): string | null {
  if (!isOnlineEvent(customization)) return null;
  const url = (customization?.onlineUrl || '').trim();
  return isValidMeetingUrl(url) ? url : null;
}
