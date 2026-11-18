import type { LandingDesignValue } from '../components/organizer/LandingCustomizer';

const DRAFT_KEY = 'turnout_create_event_draft_v1';

export type CreateEventDraftSnapshot = {
  version: 1;
  savedAt: string;
  ticketMode: 'free' | 'paid';
  freeUnlimited: boolean;
  showAdvanced: boolean;
  visibility: 'public' | 'private';
  hasSchedule: boolean;
  hasEnd: boolean;
  design: LandingDesignValue;
  /** Full react-hook-form values blob (best-effort). */
  form: Record<string, unknown>;
};

export function loadCreateEventDraft(): CreateEventDraftSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CreateEventDraftSnapshot;
    if (!parsed || parsed.version !== 1 || !parsed.form || !parsed.design) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCreateEventDraft(snapshot: CreateEventDraftSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...snapshot, savedAt: new Date().toISOString() }));
  } catch {
    // Ignore quota / private mode failures.
  }
}

export function clearCreateEventDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
