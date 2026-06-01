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
import type { LandingFontKey } from './landingFonts';
import type { LandingStyle } from '../types';

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
  /** Curated landing font for this category */
  fontFamily: LandingFontKey;
  primaryColor: string;
  secondaryColor: string;
  landingStyle: LandingStyle;
};

/**
 * All categories live under the single Minimal theme. Picking one swaps the
 * landing typography (and a matching accent/style) so the page feels tuned to
 * the event type, while "Default" keeps the clean editorial baseline.
 */
export const EVENT_CATEGORIES: EventCategory[] = [
  { id: 'default', name: 'Default', icon: Sparkles, fontFamily: 'fraunces', primaryColor: '#059669', secondaryColor: '#10b981', landingStyle: 'glass' },
  { id: 'music', name: 'Music', icon: Music, fontFamily: 'space-grotesk', primaryColor: '#7c3aed', secondaryColor: '#c084fc', landingStyle: 'bold' },
  { id: 'sports', name: 'Sports', icon: Trophy, fontFamily: 'sora', primaryColor: '#2563eb', secondaryColor: '#38bdf8', landingStyle: 'bold' },
  { id: 'business', name: 'Business', icon: Briefcase, fontFamily: 'manrope', primaryColor: '#0f766e', secondaryColor: '#64748b', landingStyle: 'minimal' },
  { id: 'arts', name: 'Arts', icon: Palette, fontFamily: 'playfair', primaryColor: '#e11d48', secondaryColor: '#fb7185', landingStyle: 'glass' },
  { id: 'wellness', name: 'Wellness', icon: Leaf, fontFamily: 'dm-serif', primaryColor: '#0d9488', secondaryColor: '#2dd4bf', landingStyle: 'glass' },
  { id: 'nightlife', name: 'Nightlife', icon: Moon, fontFamily: 'sora', primaryColor: '#a78bfa', secondaryColor: '#7c3aed', landingStyle: 'bold' },
  { id: 'tech', name: 'Tech', icon: Cpu, fontFamily: 'space-grotesk', primaryColor: '#2563eb', secondaryColor: '#6366f1', landingStyle: 'minimal' },
];

export const EVENT_CATEGORY_IDS = EVENT_CATEGORIES.map((c) => c.id);

export const DEFAULT_EVENT_CATEGORY: EventCategoryId = 'default';

export function isEventCategoryId(value: string | undefined | null): value is EventCategoryId {
  return !!value && EVENT_CATEGORY_IDS.includes(value as EventCategoryId);
}

export function resolveEventCategory(id: string | undefined | null): EventCategory {
  return EVENT_CATEGORIES.find((c) => c.id === id) || EVENT_CATEGORIES[0];
}
