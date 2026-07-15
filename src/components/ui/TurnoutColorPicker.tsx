import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';

type Hsv = { h: number; s: number; v: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (c: number) => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function normalizeHex(value: string | undefined, fallback: string): string {
  const raw = (value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toLowerCase()}`;
  return /^#[0-9a-f]{6}$/i.test(fallback) ? fallback.toLowerCase() : '#059669';
}

const SWATCHES = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#0f172a',
  '#64748b',
  '#f8fafc',
];

export function TurnoutColorPicker({
  value,
  onChange,
  ariaLabel = 'Pick colour',
  className,
  swatchClassName,
  tone = 'light',
  align = 'end',
}: {
  value: string;
  onChange: (hex: string) => void;
  ariaLabel?: string;
  className?: string;
  swatchClassName?: string;
  tone?: 'light' | 'dark';
  align?: 'start' | 'end';
}) {
  const hex = normalizeHex(value, '#059669');
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState(() => {
    const rgb = hexToRgb(hex) || { r: 5, g: 150, b: 105 };
    return rgbToHsv(rgb.r, rgb.g, rgb.b);
  });
  const [hexDraft, setHexDraft] = useState(hex);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const hsvRef = useRef(hsv);
  const dragging = useRef<'sv' | 'hue' | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  hsvRef.current = hsv;
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    const next = rgbToHsv(rgb.r, rgb.g, rgb.b);
    hsvRef.current = next;
    setHsv(next);
    setHexDraft(hex);
  }, [hex, open]);

  useEffect(() => {
    if (!open || !rootRef.current) return;
    const place = () => {
      const rect = rootRef.current!.getBoundingClientRect();
      const width = 248;
      const height = 300;
      const left =
        align === 'end'
          ? Math.min(window.innerWidth - width - 8, Math.max(8, rect.right - width))
          : Math.min(window.innerWidth - width - 8, Math.max(8, rect.left));
      const below = rect.bottom + 8;
      const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 8) : below;
      setPanelPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const commitHsv = (next: Hsv) => {
    hsvRef.current = next;
    setHsv(next);
    const rgb = hsvToRgb(next.h, next.s, next.v);
    const nextHex = rgbToHex(rgb.r, rgb.g, rgb.b);
    setHexDraft(nextHex);
    onChangeRef.current(nextHex);
  };

  const commitHex = (raw: string) => {
    const candidate = raw.startsWith('#') ? raw : `#${raw}`;
    if (!/^#[0-9a-f]{6}$/i.test(candidate)) {
      setHexDraft(hex);
      return;
    }
    const next = candidate.toLowerCase();
    const rgb = hexToRgb(next);
    if (!rgb) return;
    const nextHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    hsvRef.current = nextHsv;
    setHsv(nextHsv);
    setHexDraft(next);
    onChangeRef.current(next);
  };

  const updateSvFromPointer = (clientX: number, clientY: number) => {
    const el = panRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = clamp((clientX - rect.left) / rect.width, 0, 1);
    const v = 1 - clamp((clientY - rect.top) / rect.height, 0, 1);
    commitHsv({ ...hsvRef.current, s, v });
  };

  const updateHueFromPointer = (clientX: number) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const h = clamp(((clientX - rect.left) / rect.width) * 360, 0, 359.99);
    commitHsv({ ...hsvRef.current, h });
  };

  useEffect(() => {
    if (!open) return;
    const onMove = (e: PointerEvent) => {
      if (dragging.current === 'sv') updateSvFromPointer(e.clientX, e.clientY);
      if (dragging.current === 'hue') updateHueFromPointer(e.clientX);
    };
    const onUp = () => {
      dragging.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [open]);

  const hueColor = useMemo(() => {
    const rgb = hsvToRgb(hsv.h, 1, 1);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }, [hsv.h]);

  const isDark = tone === 'dark';
  const panel =
    open && panelPos
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-[12000] w-[248px] rounded-2xl border p-3 shadow-2xl"
            style={{
              top: panelPos.top,
              left: panelPos.left,
              background: isDark ? 'rgba(22, 23, 28, 0.98)' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.12)',
              color: isDark ? '#fff' : '#0f172a',
            }}
            role="dialog"
            aria-label={ariaLabel}
          >
            <div
              ref={panRef}
              className="relative h-36 w-full cursor-crosshair overflow-hidden rounded-xl"
              style={{
                background: `
                linear-gradient(to top, #000, transparent),
                linear-gradient(to right, #fff, ${hueColor})
              `,
              }}
              onPointerDown={(e) => {
                dragging.current = 'sv';
                updateSvFromPointer(e.clientX, e.clientY);
              }}
            >
              <span
                className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
              />
            </div>

            <div className="mt-3 space-y-2">
              <div
                ref={hueRef}
                className="relative h-3 cursor-pointer rounded-full"
                style={{
                  background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                }}
                onPointerDown={(e) => {
                  dragging.current = 'hue';
                  updateHueFromPointer(e.clientX);
                }}
              >
                <span
                  className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                  style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }}
                />
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="h-8 w-8 shrink-0 rounded-lg border"
                  style={{
                    background: hex,
                    borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.12)',
                  }}
                />
                <input
                  value={hexDraft}
                  onChange={(e) => setHexDraft(e.target.value)}
                  onBlur={() => commitHex(hexDraft)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitHex(hexDraft);
                  }}
                  className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 font-mono text-xs uppercase outline-none"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc',
                    borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.12)',
                    color: isDark ? '#fff' : '#0f172a',
                  }}
                  aria-label="Hex colour"
                />
              </div>

              <div className="grid grid-cols-6 gap-1.5 pt-1">
                {SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    title={swatch}
                    onClick={() => commitHex(swatch)}
                    className={cn('h-6 w-full rounded-md border transition hover:scale-105', hex === swatch ? 'ring-2 ring-offset-1' : '')}
                    style={{
                      background: swatch,
                      borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.1)',
                      ['--tw-ring-color' as string]: isDark ? '#c0ff72' : '#059669',
                      ['--tw-ring-offset-color' as string]: isDark ? 'rgba(22,23,28,0.98)' : '#fff',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'h-8 w-8 cursor-pointer overflow-hidden rounded-full ring-1 ring-black/10 transition hover:scale-105',
          swatchClassName
        )}
        style={{ background: hex, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)' }}
      />
      {panel}
    </div>
  );
}
