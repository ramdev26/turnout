import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Check, Palette, Type as TypeIcon, RotateCcw, X, Bold, Italic, Underline } from 'lucide-react';
import { LANDING_FONTS, LANDING_FONT_KEYS, loadLandingFont, resolveLandingFontKey } from '../../themes/landingFonts';
import { withTemplateDesignDefaults } from '../../themes/templateDefaults';
import {
  LANDING_LAYOUT_TEMPLATES,
  type LandingDesignValue,
} from './LandingCustomizer';
import { cn } from '../../utils/cn';
import { TurnoutColorPicker } from '../ui/TurnoutColorPicker';

type DockControl = 'colour' | 'size' | 'font' | 'style' | null;

const DOCK_BG = 'rgba(21, 22, 26, 0.96)';
const DOCK_BORDER = 'rgba(255, 255, 255, 0.14)';
const SEG_BG = 'rgba(255, 255, 255, 0.07)';
const SEG_BORDER = 'rgba(255, 255, 255, 0.14)';
const TEXT = '#ffffff';
const TEXT_MUTED = 'rgba(255, 255, 255, 0.62)';
const TEXT_SUBTLE = 'rgba(255, 255, 255, 0.45)';
const GLOW = '0 0 0 1px rgba(16,185,129,0.35), 0 10px 28px rgba(16,185,129,0.18)';

function asHex(value: string | undefined, fallback: string): string {
  return /^#([0-9a-f]{6})$/i.test(value || '') ? (value as string) : fallback;
}

function ColorRow({
  label,
  value,
  fallback,
  onChange,
  onClear,
}: {
  label: string;
  value: string | undefined;
  fallback: string;
  onChange: (hex: string) => void;
  onClear?: () => void;
}) {
  const hex = asHex(value, fallback);
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-2.5 py-2" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
      <div className="min-w-0">
        <p className="text-xs font-semibold" style={{ color: TEXT }}>
          {label}
        </p>
        <p className="truncate font-mono text-[10px]" style={{ color: TEXT_SUBTLE }}>
          {value ? hex : `Auto · ${fallback}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {value && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded px-1.5 py-1 text-[10px] font-semibold"
            style={{ color: TEXT_MUTED }}
          >
            Auto
          </button>
        ) : null}
        <TurnoutColorPicker
          value={hex}
          onChange={onChange}
          ariaLabel={label}
          tone="dark"
          align="end"
          swatchClassName="ring-white/20"
        />
      </div>
    </div>
  );
}

function FontSizeRow({
  label,
  value,
  fallback,
  min,
  max,
  onChange,
  onClear,
}: {
  label: string;
  value: number | undefined;
  fallback: number;
  min: number;
  max: number;
  onChange: (px: number) => void;
  onClear: () => void;
}) {
  const current = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return (
    <div className="rounded-lg border px-2.5 py-2" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold" style={{ color: TEXT }}>
          {label}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px]" style={{ color: TEXT_SUBTLE }}>
            {value ? `${Math.round(value)}px` : `Auto · ${fallback}px`}
          </span>
          {value ? (
            <button type="button" onClick={onClear} className="rounded px-1.5 py-1 text-[10px] font-semibold" style={{ color: TEXT_MUTED }}>
              Auto
            </button>
          ) : null}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={Math.min(max, Math.max(min, Math.round(current)))}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-400"
        aria-label={label}
      />
    </div>
  );
}

function TypeStyleRow({
  label,
  bold,
  italic,
  underline,
  onChange,
}: {
  label: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  onChange: (patch: { bold?: boolean; italic?: boolean; underline?: boolean }) => void;
}) {
  const Toggle = ({
    active,
    title,
    onClick,
    children,
  }: {
    active?: boolean;
    title: string;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      aria-pressed={!!active}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg border text-xs font-bold transition"
      style={{
        borderColor: active ? 'rgba(16,185,129,0.55)' : 'rgba(255,255,255,0.14)',
        background: active ? 'rgba(16,185,129,0.22)' : 'rgba(255,255,255,0.06)',
        color: active ? '#6ee7b7' : TEXT_MUTED,
      }}
    >
      {children}
    </button>
  );

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-2.5 py-2" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
      <p className="text-xs font-semibold" style={{ color: TEXT }}>
        {label}
      </p>
      <div className="flex items-center gap-1.5">
        <Toggle
          active={bold}
          title="Bold"
          onClick={() => onChange({ bold: !bold, italic: !!italic, underline: !!underline })}
        >
          <Bold className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          active={italic}
          title="Italic"
          onClick={() => onChange({ bold: !!bold, italic: !italic, underline: !!underline })}
        >
          <Italic className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          active={underline}
          title="Underline"
          onClick={() => onChange({ bold: !!bold, italic: !!italic, underline: !underline })}
        >
          <Underline className="h-3.5 w-3.5" />
        </Toggle>
      </div>
    </div>
  );
}

/** Reset colours/fonts/sizes to the selected template defaults. */
const applyTemplate = (design: LandingDesignValue, templateId: LandingDesignValue['templateId']): LandingDesignValue => {
  const next = withTemplateDesignDefaults(design, templateId);
  return {
    ...design,
    templateId: next.templateId,
    primaryColor: next.primaryColor,
    secondaryColor: next.secondaryColor,
    fontFamily: next.fontFamily,
    landingStyle: next.landingStyle,
    displayMode: next.displayMode,
    eventCategory: design.eventCategory,
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
    h1FontSize: undefined,
    h2FontSize: undefined,
    bodyFontSize: undefined,
    smallFontSize: undefined,
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
  };
};

const TemplateThumb: React.FC<{
  id: LandingDesignValue['templateId'];
  name: string;
  active: boolean;
  onClick: () => void;
}> = ({ id, name, active, onClick }) => {
  const wireframe = {
    'template-2': (
      <div className="grid h-full grid-cols-[1fr_0.55fr] gap-1 p-1.5">
        <div className="flex flex-col gap-1">
          <div className="h-1.5 rounded-sm bg-white/20" />
          <div className="h-4 rounded-sm bg-white/35" />
          <div className="flex-1 rounded-sm bg-white/15" />
        </div>
        <div className="rounded-sm bg-white/28" />
      </div>
    ),
    'template-6': (
      <div className="grid h-full grid-cols-[1.15fr_0.85fr] gap-1 p-1.5">
        <div className="flex flex-col gap-1">
          <div className="flex-1 rounded-sm bg-white/80" />
          <div className="flex justify-center gap-0.5">
            <div className="h-2 w-2 rounded-[2px] bg-white/55" />
            <div className="h-2 w-2 rounded-[2px] bg-white/35" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="h-2 rounded-sm bg-white/45" />
          <div className="h-3 rounded-sm bg-white/70" />
          <div className="flex-1 rounded-sm border border-white/20 bg-white/25" />
        </div>
      </div>
    ),
    'template-7': (
      <div className="flex h-full flex-col gap-1 p-1.5">
        <div className="h-4 rounded-sm bg-white/80" />
        <div className="grid flex-1 grid-cols-[1.35fr_0.65fr] gap-1">
          <div className="flex flex-col gap-1">
            <div className="h-2 w-4/5 rounded-sm bg-white/50" />
            <div className="h-2 w-3/5 rounded-sm bg-white/30" />
            <div className="mt-auto h-3 rounded-sm border border-white/20 bg-white/20" />
          </div>
          <div className="rounded-sm bg-white/35 shadow-inner" />
        </div>
      </div>
    ),
    'template-8': (
      <div className="grid h-full grid-cols-[0.72fr_1.28fr] gap-1 p-1.5">
        <div className="flex flex-col gap-1">
          <div className="aspect-square rounded-sm bg-white/75" />
          <div className="h-1.5 w-3/4 rounded-sm bg-white/40" />
          <div className="h-1.5 w-1/2 rounded-sm bg-white/25" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="h-3 w-4/5 rounded-sm bg-white/55" />
          <div className="h-2 w-3/5 rounded-sm bg-white/30" />
          <div className="mt-auto flex-1 rounded-sm border border-white/20 bg-white/20" />
        </div>
      </div>
    ),
    'template-5': (
      <div className="flex h-full flex-col items-center gap-1 p-1.5">
        <div className="h-3 w-3/4 rounded-sm bg-white/35" />
        <div className="h-1.5 w-1/2 rounded-sm bg-white/20" />
        <div className="w-2/3 flex-1 rounded-sm bg-white/15" />
      </div>
    ),
  }[id];

  return (
    <button type="button" onClick={onClick} className="group flex shrink-0 flex-col items-center gap-1.5" title={name}>
      <span
        className={cn(
          'relative h-14 w-[4.5rem] overflow-hidden rounded-xl border transition',
          active ? 'ring-2 ring-offset-2' : 'opacity-85 hover:opacity-100',
        )}
        style={{
          background: 'linear-gradient(160deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%)',
          borderColor: active ? 'rgba(192,255,114,0.55)' : 'rgba(255,255,255,0.14)',
          ['--tw-ring-color' as string]: '#c0ff72',
          ['--tw-ring-offset-color' as string]: DOCK_BG,
        }}
      >
        {wireframe}
        {active ? (
          <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-black/40">
            <Check className="h-2.5 w-2.5 text-white" />
          </span>
        ) : null}
      </span>
      <span className="max-w-[4.5rem] truncate text-[11px] font-medium" style={{ color: active ? TEXT : TEXT_MUTED }}>
        {name}
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
      className="flex min-h-[46px] w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:brightness-110"
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

function Popover({
  children,
  title,
  align = 'left',
  onClose,
}: {
  children: React.ReactNode;
  title: string;
  align?: 'left' | 'center';
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        'absolute bottom-[calc(100%+10px)] z-50 max-h-[min(70vh,480px)] w-[min(92vw,380px)] overflow-y-auto rounded-2xl p-3 shadow-2xl',
        align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'
      )}
      style={{ background: DOCK_BG, border: `1px solid ${DOCK_BORDER}`, backdropFilter: 'blur(20px)' }}
    >
      <div className="mb-2 flex items-center justify-between border-b pb-2" style={{ borderColor: 'rgba(255,255,255,0.10)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
          {title}
        </p>
        <button type="button" onClick={onClose} className="rounded p-1" aria-label={`Close ${title}`}>
          <X className="h-3.5 w-3.5" style={{ color: TEXT_MUTED }} />
        </button>
      </div>
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
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const update = (patch: Partial<LandingDesignValue>) => onDesignChange({ ...design, ...patch });
  const toggle = (control: DockControl) => setOpen((cur) => (cur === control ? null : control));

  const selectTemplate = (templateId: LandingDesignValue['templateId']) => {
    // Keep organizer colour / font / size draft when switching layouts.
    onDesignChange({ ...design, templateId });
    setOpen(null);
  };

  const previewFont = (key: (typeof LANDING_FONT_KEYS)[number]) => {
    loadLandingFont(key);
    onDesignChange({ ...design, fontFamily: key });
  };

  const resetToDefault = () => {
    const next = applyTemplate(design, design.templateId);
    loadLandingFont(next.fontFamily);
    onDesignChange(next);
    setOpen(null);
  };

  useEffect(() => {
    loadLandingFont(design.fontFamily);
  }, [design.fontFamily]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      // Portaled colour / datetime pickers live outside the dock root.
      if (target instanceof Element && target.closest('[data-turnout-picker]')) return;
      setOpen(null);
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

  const colourValue = asHex(design.buttonColor || design.primaryColor, design.primaryColor);
  const sizeValue =
    design.h1FontSize || design.h2FontSize || design.bodyFontSize || design.smallFontSize
      ? 'Custom'
      : 'Auto';
  const styleValue =
    design.h1Bold ||
    design.h1Italic ||
    design.h1Underline ||
    design.h2Bold ||
    design.h2Italic ||
    design.h2Underline ||
    design.bodyBold ||
    design.bodyItalic ||
    design.bodyUnderline ||
    design.smallBold ||
    design.smallItalic ||
    design.smallUnderline
      ? 'Custom'
      : 'Default';
  const fontKey = resolveLandingFontKey(design.fontFamily);
  const fontValue = LANDING_FONTS[fontKey].name;
  const templateValue = LANDING_LAYOUT_TEMPLATES.find((t) => t.id === design.templateId)?.name ?? 'Showcase';
  const summary = useMemo(
    () => `${templateValue} · ${fontValue} · ${sizeValue} · ${styleValue}`,
    [templateValue, fontValue, sizeValue, styleValue]
  );

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
        className="landing-fade-in pointer-events-auto w-full max-w-4xl rounded-2xl px-3 pb-3 pt-2 shadow-2xl sm:px-4 sm:pb-4"
        style={{
          background: DOCK_BG,
          border: `1px solid ${DOCK_BORDER}`,
          backdropFilter: 'blur(20px)',
          boxShadow: GLOW,
        }}
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

        <div className="mb-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: TEXT_SUBTLE }}>
                System design console
              </p>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
                Customize design
              </p>
              <p className="text-[11px]" style={{ color: TEXT_SUBTLE }}>
                {summary}
              </p>
            </div>
          </div>

          <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, rgba(16,185,129,0) 0%, rgba(16,185,129,0.45) 50%, rgba(16,185,129,0) 100%)' }} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-medium" style={{ color: TEXT_MUTED }}>
              Changes apply live on this page
            </p>
            <button
              type="button"
              onClick={resetToDefault}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
              style={{ color: TEXT_MUTED, borderColor: 'rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.04)' }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        </div>

        <div className="mb-2 flex items-start gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LANDING_LAYOUT_TEMPLATES.map((tpl) => (
            <TemplateThumb
              key={tpl.id}
              id={tpl.id}
              name={tpl.name}
              active={design.templateId === tpl.id}
              onClick={() => selectTemplate(tpl.id)}
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
              label="Colours"
              value={colourValue}
              active={open === 'colour'}
              onClick={() => toggle('colour')}
            />
            {open === 'colour' && (
              <Popover title="Colours" onClose={() => setOpen(null)}>
                <div className="space-y-2">
                  <ColorRow
                    label="Accent"
                    value={design.primaryColor}
                    fallback="#059669"
                    onChange={(hex) => update({ primaryColor: hex })}
                  />
                  <ColorRow
                    label="Secondary"
                    value={design.secondaryColor}
                    fallback="#10b981"
                    onChange={(hex) => update({ secondaryColor: hex })}
                  />
                  <ColorRow
                    label="Button"
                    value={design.buttonColor}
                    fallback={design.primaryColor}
                    onChange={(hex) => update({ buttonColor: hex })}
                    onClear={() => update({ buttonColor: undefined })}
                  />
                  <ColorRow
                    label="Heading (H1)"
                    value={design.headingColor}
                    fallback={design.bodyTextColor || '#0f172a'}
                    onChange={(hex) => update({ headingColor: hex })}
                    onClear={() => update({ headingColor: undefined })}
                  />
                  <ColorRow
                    label="Body text"
                    value={design.bodyTextColor}
                    fallback="#0f172a"
                    onChange={(hex) => update({ bodyTextColor: hex })}
                    onClear={() => update({ bodyTextColor: undefined })}
                  />
                  <ColorRow
                    label="Muted text"
                    value={design.mutedTextColor}
                    fallback="#64748b"
                    onChange={(hex) => update({ mutedTextColor: hex })}
                    onClear={() => update({ mutedTextColor: undefined })}
                  />
                  <ColorRow
                    label="Page background"
                    value={design.pageBackgroundColor}
                    fallback="#ffffff"
                    onChange={(hex) => update({ pageBackgroundColor: hex })}
                    onClear={() => update({ pageBackgroundColor: undefined })}
                  />
                  <ColorRow
                    label="Cards / sections"
                    value={design.surfaceColor}
                    fallback="#ffffff"
                    onChange={(hex) => update({ surfaceColor: hex })}
                    onClear={() => update({ surfaceColor: undefined })}
                  />
                  <ColorRow
                    label="Muted surfaces"
                    value={design.surfaceMutedColor}
                    fallback="#f4f6fa"
                    onChange={(hex) => update({ surfaceMutedColor: hex })}
                    onClear={() => update({ surfaceMutedColor: undefined })}
                  />
                  <ColorRow
                    label="Borders"
                    value={design.borderColor}
                    fallback="#d8e0ec"
                    onChange={(hex) => update({ borderColor: hex })}
                    onClear={() => update({ borderColor: undefined })}
                  />
                  <ColorRow
                    label="Header"
                    value={design.headerBgColor}
                    fallback="#ffffff"
                    onChange={(hex) => update({ headerBgColor: hex })}
                    onClear={() => update({ headerBgColor: undefined })}
                  />
                  <ColorRow
                    label="Footer"
                    value={design.footerBgColor}
                    fallback="#ffffff"
                    onChange={(hex) => update({ footerBgColor: hex })}
                    onClear={() => update({ footerBgColor: undefined })}
                  />
                </div>
              </Popover>
            )}
          </div>

          <div className="relative col-span-1">
            <Segment
              icon={<TypeIcon className="h-3.5 w-3.5" style={{ color: TEXT_MUTED }} />}
              label="Size"
              value={sizeValue}
              active={open === 'size'}
              onClick={() => toggle('size')}
            />
            {open === 'size' && (
              <Popover title="Size" align="center" onClose={() => setOpen(null)}>
                <div className="space-y-2">
                  <FontSizeRow
                    label="Heading (H1)"
                    value={design.h1FontSize}
                    fallback={40}
                    min={22}
                    max={72}
                    onChange={(px) => update({ h1FontSize: px })}
                    onClear={() => update({ h1FontSize: undefined })}
                  />
                  <FontSizeRow
                    label="Subheading (H2)"
                    value={design.h2FontSize}
                    fallback={24}
                    min={16}
                    max={48}
                    onChange={(px) => update({ h2FontSize: px })}
                    onClear={() => update({ h2FontSize: undefined })}
                  />
                  <FontSizeRow
                    label="Paragraph"
                    value={design.bodyFontSize}
                    fallback={16}
                    min={12}
                    max={24}
                    onChange={(px) => update({ bodyFontSize: px })}
                    onClear={() => update({ bodyFontSize: undefined })}
                  />
                  <FontSizeRow
                    label="Small / caption"
                    value={design.smallFontSize}
                    fallback={13}
                    min={10}
                    max={18}
                    onChange={(px) => update({ smallFontSize: px })}
                    onClear={() => update({ smallFontSize: undefined })}
                  />
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
              <Popover title="Choose font" align="center" onClose={() => setOpen(null)}>
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
              icon={<Bold className="h-3.5 w-3.5" style={{ color: TEXT_MUTED }} />}
              label="Style"
              value={styleValue}
              active={open === 'style'}
              onClick={() => toggle('style')}
            />
            {open === 'style' && (
              <Popover title="Style" onClose={() => setOpen(null)}>
                <div className="space-y-2">
                  <TypeStyleRow
                    label="Heading (H1)"
                    bold={design.h1Bold}
                    italic={design.h1Italic}
                    underline={design.h1Underline}
                    onChange={(patch) =>
                      update({
                        h1Bold: patch.bold || undefined,
                        h1Italic: patch.italic || undefined,
                        h1Underline: patch.underline || undefined,
                      })
                    }
                  />
                  <TypeStyleRow
                    label="Subheading (H2)"
                    bold={design.h2Bold}
                    italic={design.h2Italic}
                    underline={design.h2Underline}
                    onChange={(patch) =>
                      update({
                        h2Bold: patch.bold || undefined,
                        h2Italic: patch.italic || undefined,
                        h2Underline: patch.underline || undefined,
                      })
                    }
                  />
                  <TypeStyleRow
                    label="Paragraph"
                    bold={design.bodyBold}
                    italic={design.bodyItalic}
                    underline={design.bodyUnderline}
                    onChange={(patch) =>
                      update({
                        bodyBold: patch.bold || undefined,
                        bodyItalic: patch.italic || undefined,
                        bodyUnderline: patch.underline || undefined,
                      })
                    }
                  />
                  <TypeStyleRow
                    label="Small / caption"
                    bold={design.smallBold}
                    italic={design.smallItalic}
                    underline={design.smallUnderline}
                    onChange={(patch) =>
                      update({
                        smallBold: patch.bold || undefined,
                        smallItalic: patch.italic || undefined,
                        smallUnderline: patch.underline || undefined,
                      })
                    }
                  />
                </div>
              </Popover>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
