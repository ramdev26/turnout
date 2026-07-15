import type { LucideIcon } from 'lucide-react';
import {
  Sparkles,
  Music,
  Trophy,
  Briefcase,
  Palette,
  Leaf,
  Moon,
  Cpu,
} from 'lucide-react';

export type EventCategoryId =
  | 'default'
  | 'music'
  | 'sports'
  | 'business'
  | 'arts'
  | 'wellness'
  | 'nightlife'
  | 'tech';

export type EventCategory = {
  id: EventCategoryId;
  name: string;
  icon: LucideIcon;
  /** Decorative picker swatch only — never applied to landing design */
  swatchPrimary: string;
  swatchSecondary: string;
};

/**
 * Categories label the event type on the public page (breadcrumb, chips).
 * They do not change colours, fonts, or style — those come from the template
 * defaults and the Customize design widget.
 */
export const EVENT_CATEGORIES: EventCategory[] = [
  { id: 'default', name: 'General', icon: Sparkles, swatchPrimary: '#C0FF72', swatchSecondary: '#0D585B' },
  { id: 'music', name: 'Music', icon: Music, swatchPrimary: '#7c3aed', swatchSecondary: '#c084fc' },
  { id: 'sports', name: 'Sports', icon: Trophy, swatchPrimary: '#2563eb', swatchSecondary: '#38bdf8' },
  { id: 'business', name: 'Business', icon: Briefcase, swatchPrimary: '#0f766e', swatchSecondary: '#64748b' },
  { id: 'arts', name: 'Arts', icon: Palette, swatchPrimary: '#e11d48', swatchSecondary: '#fb7185' },
  { id: 'wellness', name: 'Wellness', icon: Leaf, swatchPrimary: '#0d9488', swatchSecondary: '#2dd4bf' },
  { id: 'nightlife', name: 'Nightlife', icon: Moon, swatchPrimary: '#a78bfa', swatchSecondary: '#7c3aed' },
  { id: 'tech', name: 'Tech', icon: Cpu, swatchPrimary: '#2563eb', swatchSecondary: '#6366f1' },
];

export const EVENT_CATEGORY_IDS = EVENT_CATEGORIES.map((c) => c.id);

export const DEFAULT_EVENT_CATEGORY: EventCategoryId = 'default';

export function isEventCategoryId(value: string | undefined | null): value is EventCategoryId {
  return !!value && EVENT_CATEGORY_IDS.includes(value as EventCategoryId);
}

export function resolveEventCategory(id: string | undefined | null): EventCategory {
  return EVENT_CATEGORIES.find((c) => c.id === id) || EVENT_CATEGORIES[0];
}
