import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { cn } from '../../utils/cn';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Parse `YYYY-MM-DDTHH:mm` (or longer) into local parts. */
export function parseDatetimeLocal(value: string | undefined | null): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
  };
}

export function toDatetimeLocalValue(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatScheduleDay(value: string): string {
  const parts = parseDatetimeLocal(value);
  if (!parts) return 'Select date';
  const d = new Date(parts.year, parts.month - 1, parts.day);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatScheduleTime(value: string): string {
  const parts = parseDatetimeLocal(value);
  if (!parts) return '--:--';
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

/** Monday-first weekday index 0–6 */
function mondayIndex(year: number, month: number, day: number) {
  const js = new Date(year, month - 1, day).getDay();
  return (js + 6) % 7;
}

function buildMonthGrid(year: number, month: number) {
  const total = daysInMonth(year, month);
  const start = mondayIndex(year, month, 1);
  const cells: Array<{ day: number; inMonth: boolean } | null> = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push({ day: d, inMonth: true });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

type Tone = 'light' | 'dark';

export function TurnoutDateTimePicker({
  value,
  onChange,
  min,
  label,
  className,
  fieldClassName,
  fieldStyle,
  tone = 'light',
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  min?: string;
  label?: string;
  className?: string;
  fieldClassName?: string;
  fieldStyle?: React.CSSProperties;
  tone?: Tone;
  id?: string;
}) {
  const parsed = parseDatetimeLocal(value);
  const minParsed = parseDatetimeLocal(min);
  const now = new Date();
  const initial = parsed || {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: Math.round(now.getMinutes() / 5) * 5 % 60,
  };

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const [draft, setDraft] = useState(initial);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const next = parsed || initial;
    setDraft(next);
    setViewYear(next.year);
    setViewMonth(next.month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  useEffect(() => {
    if (!open || !rootRef.current) return;
    const place = () => {
      const rect = rootRef.current!.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 16);
      const height = 420;
      const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.left));
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
  }, [open]);

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

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const isBeforeMin = (y: number, m: number, d: number, hour = 0, minute = 0) => {
    if (!minParsed) return false;
    const a = Date.UTC(y, m - 1, d, hour, minute);
    const b = Date.UTC(minParsed.year, minParsed.month - 1, minParsed.day, minParsed.hour, minParsed.minute);
    return a < b;
  };

  const apply = (next = draft) => {
    onChange(toDatetimeLocalValue(next));
    setOpen(false);
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
  };

  const isDark = tone === 'dark';
  const surface = isDark ? 'rgba(22, 23, 28, 0.98)' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.12)';
  const text = isDark ? '#ffffff' : '#0f172a';
  const muted = isDark ? 'rgba(255,255,255,0.62)' : '#64748b';
  const soft = isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9';
  const accent = '#059669';

  const panel = open && panelPos
    ? createPortal(
        <div
          ref={panelRef}
          className="fixed z-[12000] w-[min(340px,calc(100vw-16px))] rounded-2xl border p-3 shadow-2xl"
          style={{ top: panelPos.top, left: panelPos.left, background: surface, borderColor: border, color: text }}
          role="dialog"
          aria-label={label || 'Pick date and time'}
          data-turnout-picker="datetime"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="grid h-9 w-9 place-items-center rounded-xl transition hover:brightness-110"
              style={{ background: soft }}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold">
              {MONTHS[viewMonth - 1]} {viewYear}
            </p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="grid h-9 w-9 place-items-center rounded-xl transition hover:brightness-110"
              style={{ background: soft }}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-1 text-center text-[10px] font-bold uppercase tracking-wide" style={{ color: muted }}>
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((cell, idx) => {
              if (!cell) return <span key={`e-${idx}`} />;
              const selected =
                draft.year === viewYear && draft.month === viewMonth && draft.day === cell.day;
              const disabled = isBeforeMin(viewYear, viewMonth, cell.day, 23, 59);
              return (
                <button
                  key={`${viewYear}-${viewMonth}-${cell.day}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => setDraft((prev) => ({ ...prev, year: viewYear, month: viewMonth, day: cell.day }))}
                  className={cn(
                    'grid h-9 place-items-center rounded-xl text-sm font-semibold transition',
                    disabled ? 'opacity-30' : 'hover:brightness-110'
                  )}
                  style={{
                    background: selected ? accent : soft,
                    color: selected ? '#ffffff' : text,
                  }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3" style={{ borderColor: border }}>
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: muted }}>
                <Clock3 className="h-3 w-3" /> Hour
              </span>
              <div
                className="grid max-h-[7.5rem] grid-cols-4 gap-1 overflow-y-auto rounded-xl border p-1.5"
                style={{ borderColor: border, background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff' }}
              >
                {HOURS.map((h) => {
                  const active = draft.hour === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, hour: h }))}
                      className="min-h-[2rem] rounded-lg text-xs font-bold tabular-nums transition"
                      style={{
                        background: active ? accent : isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                        color: active ? '#ffffff' : isDark ? '#f8fafc' : '#0f172a',
                      }}
                    >
                      {pad(h)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: muted }}>
                Minute
              </span>
              <div
                className="grid max-h-[7.5rem] grid-cols-3 gap-1 overflow-y-auto rounded-xl border p-1.5"
                style={{ borderColor: border, background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff' }}
              >
                {MINUTES.map((m) => {
                  const active = Math.round(draft.minute / 5) * 5 % 60 === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, minute: m }))}
                      className="min-h-[2rem] rounded-lg text-xs font-bold tabular-nums transition"
                      style={{
                        background: active ? accent : isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                        color: active ? '#ffffff' : isDark ? '#f8fafc' : '#0f172a',
                      }}
                    >
                      {pad(m)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2 text-sm font-semibold"
              style={{ color: muted }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => apply()}
              className="rounded-xl px-4 py-2 text-sm font-bold text-white"
              style={{ background: accent }}
            >
              Apply
            </button>
          </div>
        </div>,
        document.body
      )
    : null;

  const displayDate = formatScheduleDay(value);
  const displayTime = formatScheduleTime(value);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {label ? (
        <span className="mb-1 inline-flex items-center gap-1 text-xs font-medium" style={{ color: muted }}>
          <CalendarDays className="h-3.5 w-3.5 opacity-70" />
          {label}
        </span>
      ) : null}
      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition hover:brightness-[1.02]',
          fieldClassName
        )}
        style={fieldStyle}
      >
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="h-4 w-4 opacity-60" />
          <span>{displayDate}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums">
          <Clock3 className="h-3.5 w-3.5 opacity-60" />
          {displayTime}
        </span>
      </button>
      {panel}
    </div>
  );
}
