import React, { useEffect } from 'react';
import { Check, Palette, Sparkles, Type as TypeIcon } from 'lucide-react';
import type { CreateThemeUI } from '../../themes/eventThemes';
import { landingCssVars } from '../../themes/eventThemes';
import {
  LANDING_FONTS,
  LANDING_FONT_KEYS,
  loadLandingFont,
  resolveLandingFontKey,
  type LandingFontKey,
} from '../../themes/landingFonts';
import type { LandingDisplayMode, LandingStyle } from '../../types';
import { cn } from '../../utils/cn';

export type LandingDesignValue = {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: LandingFontKey;
  displayMode: LandingDisplayMode;
  landingStyle: LandingStyle;
};

type ColorPreset = {
  id: string;
  name: string;
  primary: string;
  secondary: string;
};

const COLOR_PRESETS: ColorPreset[] = [
  { id: 'emerald', name: 'Emerald', primary: '#059669', secondary: '#10b981' },
  { id: 'teal', name: 'Teal', primary: '#0d9488', secondary: '#2dd4bf' },
  { id: 'ocean', name: 'Ocean', primary: '#2563eb', secondary: '#38bdf8' },
  { id: 'indigo', name: 'Indigo', primary: '#6366f1', secondary: '#a78bfa' },
  { id: 'violet', name: 'Violet', primary: '#7c3aed', secondary: '#c084fc' },
  { id: 'rose', name: 'Rose', primary: '#e11d48', secondary: '#fb7185' },
  { id: 'sunset', name: 'Sunset', primary: '#ea580c', secondary: '#f59e0b' },
  { id: 'slate', name: 'Slate', primary: '#475569', secondary: '#94a3b8' },
];

const STYLE_OPTIONS: { id: LandingStyle; name: string; hint: string }[] = [
  { id: 'glass', name: 'Glass', hint: 'Frosted & layered' },
  { id: 'minimal', name: 'Minimal', hint: 'Flat & clean' },
  { id: 'bold', name: 'Bold', hint: 'Solid & punchy' },
];

const DISPLAY_OPTIONS: { id: LandingDisplayMode; name: string }[] = [
  { id: 'auto', name: 'Auto' },
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
];

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode; }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-70">
      {icon}
      {children}
    </div>
  );
}

export function LandingCustomizer({
  value,
  onChange,
  ui,
}: {
  value: LandingDesignValue;
  onChange: (next: LandingDesignValue) => void;
  ui: CreateThemeUI;
}) {
  useEffect(() => {
    loadLandingFont(value.fontFamily);
  }, [value.fontFamily]);

  const update = (patch: Partial<LandingDesignValue>) => onChange({ ...value, ...patch });

  const activePresetId = COLOR_PRESETS.find(
    (p) => p.primary.toLowerCase() === value.primaryColor.toLowerCase()
  )?.id;
  const fontKey = resolveLandingFontKey(value.fontFamily);

  const segmentBase =
    'flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition focus:outline-none';

  return (
    <div className="space-y-6">
      {/* Colour */}
      <div className="space-y-3">
        <SectionLabel icon={<Palette className="h-3.5 w-3.5" />}>Colour</SectionLabel>
        <div className="flex flex-wrap items-center gap-2.5">
          {COLOR_PRESETS.map((preset) => {
            const active = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.name}
                aria-label={preset.name}
                onClick={() => update({ primaryColor: preset.primary, secondaryColor: preset.secondary })}
                className={cn(
                  'relative grid h-9 w-9 place-items-center rounded-full transition hover:scale-105',
                  active ? 'ring-2 ring-offset-2' : 'ring-0'
                )}
                style={{
                  background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})`,
                  ['--tw-ring-color' as string]: preset.primary,
                  ['--tw-ring-offset-color' as string]: ui.cardBg,
                }}
              >
                {active && <Check className="h-4 w-4 text-white drop-shadow" />}
              </button>
            );
          })}

          {/* Custom colour picker */}
          <label
            className="relative grid h-9 w-9 cursor-pointer place-items-center overflow-hidden rounded-full ring-1 ring-inset"
            title="Custom colour"
            style={{
              background: 'conic-gradient(from 180deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ef4444)',
              ['--tw-ring-color' as string]: ui.borderColor,
            }}
          >
            <input
              type="color"
              value={/^#([0-9a-f]{6})$/i.test(value.primaryColor) ? value.primaryColor : '#059669'}
              onChange={(e) => update({ primaryColor: e.target.value, secondaryColor: e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Pick a custom colour"
            />
            {!activePresetId && <Check className="pointer-events-none h-4 w-4 text-white drop-shadow" />}
          </label>
        </div>
      </div>

      {/* Style */}
      <div className="space-y-3">
        <SectionLabel icon={<Sparkles className="h-3.5 w-3.5" />}>Style</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {STYLE_OPTIONS.map((opt) => {
            const active = value.landingStyle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => update({ landingStyle: opt.id })}
                className="rounded-xl border p-3 text-left transition"
                style={
                  active
                    ? { borderColor: ui.accent, background: ui.accentSoft, color: ui.text }
                    : { borderColor: ui.borderColor, background: ui.cardBg, color: ui.text }
                }
              >
                <p className="text-sm font-semibold">{opt.name}</p>
                <p className="mt-0.5 text-xs" style={{ color: ui.textSubtle }}>
                  {opt.hint}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Font */}
      <div className="space-y-3">
        <SectionLabel icon={<TypeIcon className="h-3.5 w-3.5" />}>Font</SectionLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LANDING_FONT_KEYS.map((key) => {
            const font = LANDING_FONTS[key];
            const active = fontKey === key;
            return (
              <button
                key={key}
                type="button"
                onMouseEnter={() => loadLandingFont(key)}
                onFocus={() => loadLandingFont(key)}
                onClick={() => update({ fontFamily: key })}
                className="rounded-xl border p-3 text-left transition"
                style={
                  active
                    ? { borderColor: ui.accent, background: ui.accentSoft, color: ui.text }
                    : { borderColor: ui.borderColor, background: ui.cardBg, color: ui.text }
                }
              >
                <p className="text-base leading-tight" style={{ fontFamily: font.display }}>
                  {font.name}
                </p>
                <p className="mt-1 text-[11px]" style={{ color: ui.textSubtle }}>
                  {font.vibe}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Display */}
      <div className="space-y-3">
        <SectionLabel icon={<Sparkles className="h-3.5 w-3.5" />}>Display</SectionLabel>
        <div
          className="flex gap-1 rounded-xl border p-1"
          style={{ borderColor: ui.borderColor, background: ui.cardMutedBg }}
        >
          {DISPLAY_OPTIONS.map((opt) => {
            const active = value.displayMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => update({ displayMode: opt.id })}
                className={segmentBase}
                style={active ? { background: ui.accent, color: '#fff' } : { color: ui.textMuted }}
              >
                {opt.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact, live preview of how the chosen options render on the landing page.
 * Uses the real landing CSS variables so it always matches production output.
 */
export function LandingDesignPreview({
  value,
  title,
  bannerUrl,
}: {
  value: LandingDesignValue;
  title: string;
  bannerUrl?: string;
}) {
  useEffect(() => {
    loadLandingFont(value.fontFamily);
  }, [value.fontFamily]);

  const vars = landingCssVars(value);

  return (
    <div
      className="landing-page overflow-hidden rounded-2xl border"
      style={{ ...vars, background: 'var(--landing-page-bg)', borderColor: 'var(--landing-border)' }}
    >
      <div className="relative h-24 w-full overflow-hidden">
        {bannerUrl ? (
          <img src={bannerUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% 0%, var(--primary) 0%, transparent 60%), linear-gradient(160deg, var(--secondary), var(--landing-page-bg))',
            }}
          />
        )}
      </div>
      <div className="space-y-3 p-5">
        <span
          className="landing-eyebrow inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{ background: 'var(--landing-glass-bg)', color: 'var(--landing-text-muted)' }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--primary)' }} />
          Now booking
        </span>
        <h3 className="landing-display text-2xl" style={{ color: 'var(--landing-text)' }}>
          {title || 'Your event title'}
        </h3>
        <div className="landing-card-premium flex items-center justify-between p-3">
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--landing-text)' }}>
              General Admission
            </p>
            <p className="landing-display text-lg" style={{ color: 'var(--primary)' }}>
              LKR 2,500
            </p>
          </div>
          <span
            className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: 'var(--landing-surface-muted)', color: 'var(--landing-text-muted)' }}
          >
            12 left
          </span>
        </div>
        <button
          type="button"
          className="landing-btn-primary w-full rounded-xl py-2.5 text-sm font-bold text-white"
        >
          Reserve your spot
        </button>
      </div>
    </div>
  );
}
