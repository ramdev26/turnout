import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Check, Contrast, Palette } from 'lucide-react';
import { EVENT_CATEGORIES, resolveEventCategory } from '../../themes/eventCategories';
import { LANDING_FONTS, LANDING_FONT_KEYS, loadLandingFont, resolveLandingFontKey } from '../../themes/landingFonts';
import { companionSecondaryColor } from '../../themes/organizerLiveDesign';
import {
  COLOR_PRESETS,
  STYLE_OPTIONS,
  DISPLAY_OPTIONS,
  type LandingDesignValue,
} from './LandingCustomizer';
import { cn } from '../../utils/cn';

type DockControl = 'colour' | 'style' | 'font' | 'display' | null;

const DOCK_BG = 'rgba(28, 25, 23, 0.94)';
const DOCK_BORDER = 'rgba(255, 255, 255, 0.10)';
const SEG_BG = 'rgba(255, 255, 255, 0.06)';
const SEG_BORDER = 'rgba(255, 255, 255, 0.10)';
const TEXT = '#f5f5f4';
const TEXT_MUTED = 'rgba(245, 245, 244, 0.55)';

const CategoryThumb: React.FC<{
  category: (typeof EVENT_CATEGORIES)[number];
  active: boolean;
  onClick: () => void;
}> = ({ category, active, onClick }) => {
  const Icon = category.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex shrink-0 flex-col items-center gap-1.5"
      title={category.name}
    >
      <span
        className={cn(
          'relative grid h-12 w-16 place-items-center overflow-hidden rounded-xl transition',
          active ? 'ring-2 ring-offset-2' : 'opacity-80 hover:opacity-100'
        )}
        style={{
          background: `linear-gradient(135deg, ${category.primaryColor}, ${category.secondaryColor})`,
          ['--tw-ring-color' as string]: category.primaryColor,
          ['--tw-ring-offset-color' as string]: DOCK_BG,
        }}
      >
        <Icon className="h-5 w-5 text-white drop-shadow" />
        {active && (
          <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-black/40">
            <Check className="h-2.5 w-2.5 text-white" />
          </span>
        )}
      </span>
      <span className="max-w-[4.5rem] truncate text-[11px] font-medium" style={{ color: active ? TEXT : TEXT_MUTED }}>
        {category.name}
      </span>
    </button>
  );
};

function Segment({
  icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition"
      style={{
        background: active ? 'rgba(255,255,255,0.12)' : SEG_BG,
        border: `1px solid ${SEG_BORDER}`,
      }}
    >
      <span className="shrink-0">{icon}</span>
      <span className="text-sm font-medium" style={{ color: TEXT }}>
        {label}
      </span>
      <span className="ml-auto flex min-w-0 items-center gap-1">
        <span className="truncate text-sm" style={{ color: TEXT_MUTED }}>
          {value}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: TEXT_MUTED }} />
      </span>
    </button>
  );
}

function Popover({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'center' }) {
  return (
    <div
      className={cn(
        'absolute bottom-[calc(100%+10px)] z-50 max-h-[min(52vh,320px)] w-[min(92vw,360px)] overflow-y-auto rounded-2xl p-3 shadow-2xl',
        align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'
      )}
      style={{ background: DOCK_BG, border: `1px solid ${DOCK_BORDER}`, backdropFilter: 'blur(20px)' }}
    >
      {children}
    </div>
  );
}

export function LandingDesignDock({
  design,
  onDesignChange,
}: {
  design: LandingDesignValue;
  onDesignChange: (next: LandingDesignValue) => void;
}) {
  const [open, setOpen] = useState<DockControl>(null);
  const [expanded, setExpanded] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 768 : false));
  const rootRef = useRef<HTMLDivElement>(null);

  const update = (patch: Partial<LandingDesignValue>) => onDesignChange({ ...design, ...patch });
  const toggle = (control: DockControl) => setOpen((cur) => (cur === control ? null : control));

  const applyCategory = (id: string) => {
    const cat = resolveEventCategory(id);
    loadLandingFont(cat.fontFamily);
    onDesignChange({
      ...design,
      eventCategory: cat.id,
      fontFamily: cat.fontFamily,
      primaryColor: cat.primaryColor,
      secondaryColor: cat.secondaryColor,
      accentColor: cat.primaryColor,
      landingStyle: cat.landingStyle,
    });
  };

  const previewFont = (key: (typeof LANDING_FONT_KEYS)[number]) => {
    loadLandingFont(key);
    onDesignChange({ ...design, fontFamily: key });
  };

  const activeCategory = design.eventCategory || 'default';

  useEffect(() => {
    loadLandingFont(design.fontFamily);
  }, [design.fontFamily]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setExpanded(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activePreset = COLOR_PRESETS.find(
    (p) =>
      p.primary.toLowerCase() === design.primaryColor.toLowerCase() &&
      p.secondary.toLowerCase() === design.secondaryColor.toLowerCase()
  );
  const colourValue = activePreset ? activePreset.name : 'Custom';
  const styleValue = STYLE_OPTIONS.find((s) => s.id === design.landingStyle)?.name ?? 'Glass';
  const fontKey = resolveLandingFontKey(design.fontFamily);
  const fontValue = LANDING_FONTS[fontKey].name;
  const displayValue = DISPLAY_OPTIONS.find((d) => d.id === design.displayMode)?.name ?? 'Auto';

  if (!expanded) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-2xl transition hover:brightness-110"
          style={{ background: DOCK_BG, border: `1px solid ${DOCK_BORDER}`, color: TEXT, backdropFilter: 'blur(20px)' }}
          aria-label="Open design bar"
        >
          <Palette className="h-4 w-4" style={{ color: design.primaryColor }} />
          Customize design
          <ChevronUp className="h-4 w-4" style={{ color: TEXT_MUTED }} />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
    >
      <div
        className="landing-fade-in pointer-events-auto w-full max-w-3xl rounded-2xl px-3 pb-3 pt-2 shadow-2xl sm:px-4 sm:pb-4"
        style={{ background: DOCK_BG, border: `1px solid ${DOCK_BORDER}`, backdropFilter: 'blur(20px)' }}
      >
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setOpen(null);
          }}
          className="group mx-auto mb-2 flex w-full min-h-[32px] flex-col items-center justify-center gap-1 py-1"
          aria-label="Hide design bar"
          title="Hide design bar"
        >
          <span className="h-1 w-9 rounded-full transition group-hover:w-12" style={{ background: 'rgba(255,255,255,0.25)' }} />
        </button>

        <p className="mb-2 text-center text-[11px] font-medium" style={{ color: TEXT_MUTED }}>
          Changes apply live on this page
        </p>

        <div className="flex items-start gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {EVENT_CATEGORIES.map((cat) => (
            <CategoryThumb
              key={cat.id}
              category={cat}
              active={activeCategory === cat.id}
              onClick={() => applyCategory(cat.id)}
            />
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="relative col-span-1">
            <Segment
              icon={
                <span
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-white/30"
                  style={{ background: design.primaryColor }}
                />
              }
              label="Colour"
              value={colourValue}
              active={open === 'colour'}
              onClick={() => toggle('colour')}
            />
            {open === 'colour' && (
              <Popover>
                <p className="mb-2 text-xs font-medium" style={{ color: TEXT_MUTED }}>
                  Presets
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_PRESETS.map((preset) => {
                    const isActive = activePreset?.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        title={preset.name}
                        onClick={() =>
                          update({
                            primaryColor: preset.primary,
                            secondaryColor: preset.secondary,
                            accentColor: preset.primary,
                          })
                        }
                        className={cn(
                          'grid h-9 w-9 place-items-center rounded-full transition hover:scale-105',
                          isActive ? 'ring-2 ring-offset-2' : ''
                        )}
                        style={{
                          background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})`,
                          ['--tw-ring-color' as string]: preset.primary,
                          ['--tw-ring-offset-color' as string]: DOCK_BG,
                        }}
                      >
                        {isActive && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
                      </button>
                    );
                  })}
                  <label
                    className="relative grid h-9 w-9 cursor-pointer place-items-center overflow-hidden rounded-full ring-1 ring-white/20"
                    title="Custom colour"
                    style={{ background: 'conic-gradient(from 180deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ef4444)' }}
                  >
                    <input
                      type="color"
                      value={/^#([0-9a-f]{6})$/i.test(design.primaryColor) ? design.primaryColor : '#059669'}
                      onChange={(e) => {
                        const primary = e.target.value;
                        update({ primaryColor: primary, secondaryColor: companionSecondaryColor(primary) });
                      }}
                      className="absolute inset-0 cursor-pointer opacity-0"
                      aria-label="Pick a custom colour"
                    />
                    {!activePreset && <Check className="pointer-events-none h-3.5 w-3.5 text-white drop-shadow" />}
                  </label>
                </div>
                <div className="mt-3 border-t pt-3" style={{ borderColor: DOCK_BORDER }}>
                  <p className="mb-1 text-xs font-medium" style={{ color: TEXT_MUTED }}>
                    Highlight colour
                  </p>
                  <p className="mb-2 text-[11px] leading-snug" style={{ color: TEXT_MUTED }}>
                    Titles, prices, and buttons (e.g. when background is white).
                  </p>
                  <div className="flex items-center gap-2">
                    <label
                      className="relative grid h-9 w-9 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full ring-1 ring-white/25"
                      title="Highlight colour"
                      style={{ background: design.accentColor }}
                    >
                      <input
                        type="color"
                        value={/^#([0-9a-f]{6})$/i.test(design.accentColor) ? design.accentColor : '#0d585b'}
                        onChange={(e) => update({ accentColor: e.target.value })}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        aria-label="Pick highlight colour"
                      />
                    </label>
                    <span className="font-mono text-[11px] tabular-nums" style={{ color: TEXT_MUTED }}>
                      {design.accentColor}
                    </span>
                  </div>
                </div>
              </Popover>
            )}
          </div>

          <div className="relative col-span-1">
            <Segment
              icon={<span className="text-sm" style={{ color: TEXT_MUTED }}>✦</span>}
              label="Style"
              value={styleValue}
              active={open === 'style'}
              onClick={() => toggle('style')}
            />
            {open === 'style' && (
              <Popover align="center">
                <div className="flex flex-col gap-1">
                  {STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        update({ landingStyle: opt.id });
                        setOpen(null);
                      }}
                      className="flex min-h-[44px] items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-white/10"
                    >
                      <span>
                        <span className="block text-sm font-medium" style={{ color: TEXT }}>
                          {opt.name}
                        </span>
                        <span className="block text-xs" style={{ color: TEXT_MUTED }}>
                          {opt.hint}
                        </span>
                      </span>
                      {design.landingStyle === opt.id && <Check className="h-4 w-4" style={{ color: design.primaryColor }} />}
                    </button>
                  ))}
                </div>
              </Popover>
            )}
          </div>

          <div className="relative col-span-1">
            <Segment
              icon={
                <span className="text-sm font-semibold" style={{ color: TEXT, fontFamily: LANDING_FONTS[fontKey].display }}>
                  Ag
                </span>
              }
              label="Font"
              value={fontValue}
              active={open === 'font'}
              onClick={() => toggle('font')}
            />
            {open === 'font' && (
              <Popover align="center">
                <div className="flex flex-col gap-1">
                  {LANDING_FONT_KEYS.map((key) => {
                    const font = LANDING_FONTS[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onMouseEnter={() => previewFont(key)}
                        onFocus={() => previewFont(key)}
                        onClick={() => {
                          previewFont(key);
                          setOpen(null);
                        }}
                        className="flex min-h-[44px] items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-white/10"
                      >
                        <span>
                          <span className="block text-base leading-tight" style={{ color: TEXT, fontFamily: font.display }}>
                            {font.name}
                          </span>
                          <span className="block text-[11px]" style={{ color: TEXT_MUTED }}>
                            {font.vibe}
                          </span>
                        </span>
                        {fontKey === key && <Check className="h-4 w-4" style={{ color: design.primaryColor }} />}
                      </button>
                    );
                  })}
                </div>
              </Popover>
            )}
          </div>

          <div className="relative col-span-1">
            <Segment
              icon={<Contrast className="h-3.5 w-3.5" style={{ color: TEXT_MUTED }} />}
              label="Display"
              value={displayValue}
              active={open === 'display'}
              onClick={() => toggle('display')}
            />
            {open === 'display' && (
              <Popover>
                <div className="grid grid-cols-3 gap-1">
                  {DISPLAY_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => update({ displayMode: opt.id })}
                      className="min-h-[40px] rounded-lg px-2 py-2 text-sm font-semibold transition hover:bg-white/10"
                      style={{
                        color: design.displayMode === opt.id ? '#fff' : TEXT_MUTED,
                        background: design.displayMode === opt.id ? design.primaryColor : 'transparent',
                      }}
                    >
                      {opt.name}
                    </button>
                  ))}
                </div>
              </Popover>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
