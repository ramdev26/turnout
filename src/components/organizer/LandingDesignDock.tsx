import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Check, Contrast, Palette } from 'lucide-react';
import { EVENT_CATEGORIES, resolveEventCategory } from '../../themes/eventCategories';
import { LANDING_FONTS, LANDING_FONT_KEYS, loadLandingFont, resolveLandingFontKey } from '../../themes/landingFonts';
import {
  COLOR_PRESETS,
  STYLE_OPTIONS,
  DISPLAY_OPTIONS,
  type LandingDesignValue,
} from './LandingCustomizer';
import { cn } from '../../utils/cn';

type DockControl = 'colour' | 'style' | 'font' | 'display' | null;

// Dock chrome uses a fixed warm-dark palette (independent of page theme) so it
// always reads like the floating customization tray in the reference design.
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
      <span className="text-[11px] font-medium" style={{ color: active ? TEXT : TEXT_MUTED }}>
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
      className="flex min-w-[120px] flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition sm:min-w-[150px]"
      style={{
        background: active ? 'rgba(255,255,255,0.12)' : SEG_BG,
        border: `1px solid ${SEG_BORDER}`,
      }}
    >
      <span className="shrink-0">{icon}</span>
      <span className="text-sm font-medium" style={{ color: TEXT }}>
        {label}
      </span>
      <span className="ml-auto flex items-center gap-1">
        <span className="text-sm" style={{ color: TEXT_MUTED }}>
          {value}
        </span>
        <ChevronDown className="h-3.5 w-3.5" style={{ color: TEXT_MUTED }} />
      </span>
    </button>
  );
}

function Popover({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute bottom-[calc(100%+10px)] left-0 z-50 w-[min(92vw,340px)] rounded-2xl p-3 shadow-2xl"
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
    onDesignChange({
      ...design,
      eventCategory: cat.id,
      fontFamily: cat.fontFamily,
      primaryColor: cat.primaryColor,
      secondaryColor: cat.secondaryColor,
      landingStyle: cat.landingStyle,
    });
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

  const activePreset = COLOR_PRESETS.find((p) => p.primary.toLowerCase() === design.primaryColor.toLowerCase());
  const colourValue = activePreset ? activePreset.name : 'Custom';
  const styleValue = STYLE_OPTIONS.find((s) => s.id === design.landingStyle)?.name ?? 'Glass';
  const fontKey = resolveLandingFontKey(design.fontFamily);
  const fontValue = LANDING_FONTS[fontKey].name;
  const displayValue = DISPLAY_OPTIONS.find((d) => d.id === design.displayMode)?.name ?? 'Auto';

  // Collapsed by default: show a compact launcher pill that opens the dock.
  if (!expanded) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-4 sm:px-4 sm:pb-5">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-2xl transition hover:brightness-110"
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
    <div ref={rootRef} className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 sm:px-4 sm:pb-4">
      <div
        className="landing-fade-in pointer-events-auto w-full max-w-3xl rounded-2xl px-4 pb-4 pt-2 shadow-2xl"
        style={{ background: DOCK_BG, border: `1px solid ${DOCK_BORDER}`, backdropFilter: 'blur(20px)' }}
      >
        {/* grabber / close handle */}
        <button
          type="button"
          onClick={() => { setExpanded(false); setOpen(null); }}
          className="group mx-auto mb-2 flex w-full flex-col items-center gap-1 py-1"
          aria-label="Hide design bar"
          title="Hide design bar"
        >
          <span className="h-1 w-9 rounded-full transition group-hover:w-12" style={{ background: 'rgba(255,255,255,0.25)' }} />
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-0 transition group-hover:opacity-60" style={{ color: TEXT_MUTED }}>
            <ChevronDown className="h-3 w-3" /> Hide
          </span>
        </button>

        {/* Event category thumbnails */}
        <div className="flex items-start justify-center gap-3 overflow-x-auto pb-1">
          {EVENT_CATEGORIES.map((cat) => (
            <CategoryThumb
              key={cat.id}
              category={cat}
              active={activeCategory === cat.id}
              onClick={() => applyCategory(cat.id)}
            />
          ))}
        </div>

        {/* Controls toolbar */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {/* Colour */}
          <div className="relative flex-1">
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
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_PRESETS.map((preset) => {
                    const isActive = activePreset?.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        title={preset.name}
                        onClick={() => update({ primaryColor: preset.primary, secondaryColor: preset.secondary })}
                        className={cn(
                          'grid h-8 w-8 place-items-center rounded-full transition hover:scale-105',
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
                    className="relative grid h-8 w-8 cursor-pointer place-items-center overflow-hidden rounded-full ring-1 ring-white/20"
                    title="Custom colour"
                    style={{ background: 'conic-gradient(from 180deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ef4444)' }}
                  >
                    <input
                      type="color"
                      value={/^#([0-9a-f]{6})$/i.test(design.primaryColor) ? design.primaryColor : '#059669'}
                      onChange={(e) => update({ primaryColor: e.target.value, secondaryColor: e.target.value })}
                      className="absolute inset-0 cursor-pointer opacity-0"
                      aria-label="Pick a custom colour"
                    />
                    {!activePreset && <Check className="pointer-events-none h-3.5 w-3.5 text-white drop-shadow" />}
                  </label>
                </div>
              </Popover>
            )}
          </div>

          {/* Style */}
          <div className="relative flex-1">
            <Segment
              icon={<span className="text-sm" style={{ color: TEXT_MUTED }}>✦</span>}
              label="Style"
              value={styleValue}
              active={open === 'style'}
              onClick={() => toggle('style')}
            />
            {open === 'style' && (
              <Popover>
                <div className="flex flex-col gap-1">
                  {STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => { update({ landingStyle: opt.id }); setOpen(null); }}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-white/10"
                    >
                      <span>
                        <span className="block text-sm font-medium" style={{ color: TEXT }}>{opt.name}</span>
                        <span className="block text-xs" style={{ color: TEXT_MUTED }}>{opt.hint}</span>
                      </span>
                      {design.landingStyle === opt.id && <Check className="h-4 w-4" style={{ color: design.primaryColor }} />}
                    </button>
                  ))}
                </div>
              </Popover>
            )}
          </div>

          {/* Font */}
          <div className="relative flex-1">
            <Segment
              icon={<span className="text-sm font-semibold" style={{ color: TEXT, fontFamily: LANDING_FONTS[fontKey].display }}>Ag</span>}
              label="Font"
              value={fontValue}
              active={open === 'font'}
              onClick={() => toggle('font')}
            />
            {open === 'font' && (
              <Popover>
                <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                  {LANDING_FONT_KEYS.map((key) => {
                    const font = LANDING_FONTS[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onMouseEnter={() => loadLandingFont(key)}
                        onClick={() => { update({ fontFamily: key }); setOpen(null); }}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-white/10"
                      >
                        <span>
                          <span className="block text-base leading-tight" style={{ color: TEXT, fontFamily: font.display }}>
                            {font.name}
                          </span>
                          <span className="block text-[11px]" style={{ color: TEXT_MUTED }}>{font.vibe}</span>
                        </span>
                        {fontKey === key && <Check className="h-4 w-4" style={{ color: design.primaryColor }} />}
                      </button>
                    );
                  })}
                </div>
              </Popover>
            )}
          </div>

          {/* Display */}
          <div className="relative flex-1">
            <Segment
              icon={<Contrast className="h-3.5 w-3.5" style={{ color: TEXT_MUTED }} />}
              label="Display"
              value={displayValue}
              active={open === 'display'}
              onClick={() => toggle('display')}
            />
            {open === 'display' && (
              <Popover>
                <div className="flex flex-col gap-1">
                  {DISPLAY_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => { update({ displayMode: opt.id }); setOpen(null); }}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-white/10"
                    >
                      <span className="text-sm font-medium" style={{ color: TEXT }}>{opt.name}</span>
                      {design.displayMode === opt.id && <Check className="h-4 w-4" style={{ color: design.primaryColor }} />}
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
