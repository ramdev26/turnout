import React, { useEffect } from 'react';
import { Palette, Type as TypeIcon, Bold, Italic, Underline } from 'lucide-react';
import type { CreateThemeUI } from '../../themes/eventThemes';
import { landingCssVars } from '../../themes/eventThemes';
import {
  LANDING_FONTS,
  LANDING_FONT_KEYS,
  loadLandingFont,
  resolveLandingFontKey,
  type LandingFontKey,
} from '../../themes/landingFonts';
import type { LandingButtonShadow, LandingDisplayMode, LandingStyle } from '../../types';
import type { LayoutTemplateId } from '../../templates/templates';
import { TurnoutColorPicker } from '../ui/TurnoutColorPicker';

export type { LandingButtonShadow };

export type LandingDesignValue = {
  templateId: LayoutTemplateId;
  eventCategory: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: LandingFontKey;
  displayMode: LandingDisplayMode;
  landingStyle: LandingStyle;
  /** Deep colour overrides (optional hex). Empty/undefined uses template-derived tones. */
  buttonColor?: string;
  headingColor?: string;
  bodyTextColor?: string;
  mutedTextColor?: string;
  pageBackgroundColor?: string;
  surfaceColor?: string;
  surfaceMutedColor?: string;
  borderColor?: string;
  headerBgColor?: string;
  footerBgColor?: string;
  /** Typography role colours (H1 = headingColor; P = bodyTextColor). */
  h2Color?: string;
  h3Color?: string;
  buttonTextColor?: string;
  iconColor?: string;
  linkColor?: string;
  /** Main image / event banner outline. */
  bannerOutlineColor?: string;
  bannerOutlineWidth?: number;
  /** Per-role fonts (undefined = same as page fontFamily). */
  h1FontFamily?: LandingFontKey;
  h2FontFamily?: LandingFontKey;
  h3FontFamily?: LandingFontKey;
  bodyFontFamily?: LandingFontKey;
  buttonFontFamily?: LandingFontKey;
  /** Type scale overrides in px. Existing h1/h2/body/small = DESKTOP. */
  h1FontSize?: number;
  h2FontSize?: number;
  bodyFontSize?: number;
  smallFontSize?: number;
  h1FontSizeMobile?: number;
  h2FontSizeMobile?: number;
  h3FontSize?: number;
  h3FontSizeMobile?: number;
  bodyFontSizeMobile?: number;
  buttonFontSize?: number;
  buttonFontSizeMobile?: number;
  /** Per-element type emphasis. */
  h1Bold?: boolean;
  h1Italic?: boolean;
  h1Underline?: boolean;
  h2Bold?: boolean;
  h2Italic?: boolean;
  h2Underline?: boolean;
  bodyBold?: boolean;
  bodyItalic?: boolean;
  bodyUnderline?: boolean;
  smallBold?: boolean;
  smallItalic?: boolean;
  smallUnderline?: boolean;
  h3Bold?: boolean;
  h3Italic?: boolean;
  h3Underline?: boolean;
  buttonTextBold?: boolean;
  buttonTextItalic?: boolean;
  buttonTextUnderline?: boolean;
  /** Button chrome */
  buttonRadius?: number;
  buttonOutlineWidth?: number;
  buttonOutlineColor?: string;
  buttonShadow?: LandingButtonShadow;
};

/** Clears deep customize overrides when resetting to a template. */
export const LANDING_DESIGN_OVERRIDE_RESET: Partial<LandingDesignValue> = {
  buttonColor: undefined,
  headingColor: undefined,
  bodyTextColor: undefined,
  mutedTextColor: undefined,
  pageBackgroundColor: undefined,
  surfaceColor: undefined,
  surfaceMutedColor: undefined,
  borderColor: undefined,
  headerBgColor: undefined,
  footerBgColor: undefined,
  h2Color: undefined,
  h3Color: undefined,
  buttonTextColor: undefined,
  iconColor: undefined,
  linkColor: undefined,
  bannerOutlineColor: undefined,
  bannerOutlineWidth: undefined,
  h1FontFamily: undefined,
  h2FontFamily: undefined,
  h3FontFamily: undefined,
  bodyFontFamily: undefined,
  buttonFontFamily: undefined,
  h1FontSize: undefined,
  h2FontSize: undefined,
  bodyFontSize: undefined,
  smallFontSize: undefined,
  h1FontSizeMobile: undefined,
  h2FontSizeMobile: undefined,
  h3FontSize: undefined,
  h3FontSizeMobile: undefined,
  bodyFontSizeMobile: undefined,
  buttonFontSize: undefined,
  buttonFontSizeMobile: undefined,
  h1Bold: undefined,
  h1Italic: undefined,
  h1Underline: undefined,
  h2Bold: undefined,
  h2Italic: undefined,
  h2Underline: undefined,
  bodyBold: undefined,
  bodyItalic: undefined,
  bodyUnderline: undefined,
  smallBold: undefined,
  smallItalic: undefined,
  smallUnderline: undefined,
  h3Bold: undefined,
  h3Italic: undefined,
  h3Underline: undefined,
  buttonTextBold: undefined,
  buttonTextItalic: undefined,
  buttonTextUnderline: undefined,
  buttonRadius: undefined,
  buttonOutlineWidth: undefined,
  buttonOutlineColor: undefined,
  buttonShadow: undefined,
};

export { LANDING_LAYOUT_TEMPLATES } from '../../templates/templates';

type ColorPreset = {
  id: string;
  name: string;
  primary: string;
  secondary: string;
};

export const COLOR_PRESETS: ColorPreset[] = [
  { id: 'emerald', name: 'Emerald', primary: '#059669', secondary: '#10b981' },
  { id: 'teal', name: 'Teal', primary: '#0d9488', secondary: '#2dd4bf' },
  { id: 'ocean', name: 'Ocean', primary: '#2563eb', secondary: '#38bdf8' },
  { id: 'indigo', name: 'Indigo', primary: '#6366f1', secondary: '#a78bfa' },
  { id: 'violet', name: 'Violet', primary: '#7c3aed', secondary: '#c084fc' },
  { id: 'rose', name: 'Rose', primary: '#e11d48', secondary: '#fb7185' },
  { id: 'sunset', name: 'Sunset', primary: '#ea580c', secondary: '#f59e0b' },
  { id: 'slate', name: 'Slate', primary: '#475569', secondary: '#94a3b8' },
];

export const STYLE_OPTIONS: { id: LandingStyle; name: string; hint: string }[] = [
  { id: 'glass', name: 'Glass', hint: 'Frosted & layered' },
  { id: 'minimal', name: 'Minimal', hint: 'Flat & clean' },
  { id: 'bold', name: 'Bold', hint: 'Solid & punchy' },
];

export const DISPLAY_OPTIONS: { id: LandingDisplayMode; name: string }[] = [
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

  const fontKey = resolveLandingFontKey(value.fontFamily);

  const asHex = (v: string | undefined, fallback: string) =>
    /^#([0-9a-f]{6})$/i.test(v || '') ? (v as string) : fallback;

  return (
    <div className="space-y-6">
      {/* Colour */}
      <div className="space-y-3">
        <SectionLabel icon={<Palette className="h-3.5 w-3.5" />}>Colours</SectionLabel>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ['primaryColor', 'Brand primary', value.primaryColor, '#059669', false],
              ['secondaryColor', 'Brand secondary', value.secondaryColor, '#10b981', false],
              ['headerBgColor', 'Header bar', value.headerBgColor, '#ffffff', true],
              ['borderColor', 'Outlines / accents', value.borderColor, '#d8e0ec', true],
              ['bannerOutlineColor', 'Banner outline', value.bannerOutlineColor, value.borderColor || '#d8e0ec', true],
              ['pageBackgroundColor', 'Page background', value.pageBackgroundColor, '#ffffff', true],
              ['surfaceColor', 'Section backgrounds', value.surfaceColor, '#ffffff', true],
              ['surfaceMutedColor', 'Muted sections', value.surfaceMutedColor, '#f4f6fa', true],
              ['buttonColor', 'Button', value.buttonColor, value.primaryColor, true],
              ['iconColor', 'Icons', value.iconColor, value.primaryColor, true],
              ['linkColor', 'Links', value.linkColor, value.primaryColor, true],
              ['headingColor', 'H1 (event title)', value.headingColor, value.bodyTextColor || '#0f172a', true],
              ['h2Color', 'H2 (subheadings)', value.h2Color, value.mutedTextColor || value.headingColor || '#0f172a', true],
              ['h3Color', 'H3 (date / location / price)', value.h3Color, value.mutedTextColor || '#64748b', true],
              ['bodyTextColor', 'P (body)', value.bodyTextColor, '#0f172a', true],
              ['buttonTextColor', 'Button text', value.buttonTextColor, '#ffffff', true],
              ['mutedTextColor', 'Muted text', value.mutedTextColor, '#64748b', true],
              ['footerBgColor', 'Footer', value.footerBgColor, '#ffffff', true],
            ] as const
          ).map(([key, label, current, fallback, clearable]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: ui.borderColor, background: ui.cardBg, color: ui.text }}
            >
              <span className="font-medium">{label}</span>
              <span className="flex items-center gap-2">
                <TurnoutColorPicker
                  value={asHex(current, fallback)}
                  onChange={(hex) => update({ [key]: hex })}
                  ariaLabel={label}
                  tone={ui.isDark ? 'dark' : 'light'}
                />
                {clearable && current ? (
                  <button
                    type="button"
                    className="text-[11px] font-semibold underline-offset-2 hover:underline"
                    style={{ color: ui.textMuted }}
                    onClick={() => update({ [key]: undefined })}
                  >
                    Reset
                  </button>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Size */}
      <div className="space-y-3">
        <SectionLabel icon={<TypeIcon className="h-3.5 w-3.5" />}>Size</SectionLabel>
        <div className="space-y-3">
          {(
            [
              ['h1FontSizeMobile', 'H1 · Mobile', value.h1FontSizeMobile, 28, 18, 56],
              ['h1FontSize', 'H1 · Desktop', value.h1FontSize, 40, 22, 72],
              ['h2FontSizeMobile', 'H2 · Mobile', value.h2FontSizeMobile, 18, 14, 40],
              ['h2FontSize', 'H2 · Desktop', value.h2FontSize, 24, 16, 48],
              ['h3FontSizeMobile', 'H3 · Mobile', value.h3FontSizeMobile, 13, 10, 28],
              ['h3FontSize', 'H3 · Desktop', value.h3FontSize, value.smallFontSize || 16, 12, 32],
              ['bodyFontSizeMobile', 'P · Mobile', value.bodyFontSizeMobile, 14, 11, 22],
              ['bodyFontSize', 'P · Desktop', value.bodyFontSize, 16, 12, 24],
              ['buttonFontSizeMobile', 'Button · Mobile', value.buttonFontSizeMobile, 12, 10, 22],
              ['buttonFontSize', 'Button · Desktop', value.buttonFontSize, 14, 10, 24],
            ] as const
          ).map(([key, label, current, fallback, min, max]) => (
            <div key={key} className="rounded-xl border px-3 py-2" style={{ borderColor: ui.borderColor, background: ui.cardBg }}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-medium" style={{ color: ui.text }}>
                  {label}
                </span>
                <span className="flex items-center gap-2 text-[11px]" style={{ color: ui.textMuted }}>
                  {current ? `${current}px` : `Auto · ${fallback}px`}
                  {current ? (
                    <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => update({ [key]: undefined })}>
                      Reset
                    </button>
                  ) : null}
                </span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={1}
                value={typeof current === 'number' ? current : fallback}
                onChange={(e) => update({ [key]: Number(e.target.value) })}
                className="w-full"
                aria-label={label}
              />
            </div>
          ))}
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

      {/* Style */}
      <div className="space-y-3">
        <SectionLabel icon={<Bold className="h-3.5 w-3.5" />}>Style</SectionLabel>
        <div className="space-y-2">
          {(
            [
              ['H1 (event title)', 'h1Bold', 'h1Italic', 'h1Underline', value.h1Bold, value.h1Italic, value.h1Underline],
              ['H2 (subheadings)', 'h2Bold', 'h2Italic', 'h2Underline', value.h2Bold, value.h2Italic, value.h2Underline],
              ['H3 (date / location / price)', 'h3Bold', 'h3Italic', 'h3Underline', value.h3Bold, value.h3Italic, value.h3Underline],
              ['P (body)', 'bodyBold', 'bodyItalic', 'bodyUnderline', value.bodyBold, value.bodyItalic, value.bodyUnderline],
              ['Button text', 'buttonTextBold', 'buttonTextItalic', 'buttonTextUnderline', value.buttonTextBold, value.buttonTextItalic, value.buttonTextUnderline],
            ] as const
          ).map(([label, boldKey, italicKey, underlineKey, bold, italic, underline]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
              style={{ borderColor: ui.borderColor, background: ui.cardBg }}
            >
              <span className="text-sm font-medium" style={{ color: ui.text }}>
                {label}
              </span>
              <div className="flex items-center gap-1.5">
                {(
                  [
                    [boldKey, bold, Bold, 'Bold'],
                    [italicKey, italic, Italic, 'Italic'],
                    [underlineKey, underline, Underline, 'Underline'],
                  ] as const
                ).map(([key, active, Icon, title]) => (
                  <button
                    key={key}
                    type="button"
                    title={title}
                    aria-pressed={!!active}
                    onClick={() => update({ [key]: !active || undefined })}
                    className="grid h-8 w-8 place-items-center rounded-lg border transition"
                    style={
                      active
                        ? { borderColor: ui.accent, background: ui.accentSoft, color: ui.accent }
                        : { borderColor: ui.borderColor, background: ui.cardMutedBg, color: ui.textMuted }
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>
          ))}
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
          className="landing-btn-primary w-full rounded-xl py-2.5 text-sm font-bold"
        >
          Reserve your spot
        </button>
      </div>
    </div>
  );
}
