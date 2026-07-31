import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export type TurnoutSelectOption = {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
};

type Tone = 'dark' | 'light';

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: TurnoutSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
  style?: React.CSSProperties;
  tone?: Tone;
  align?: 'start' | 'end';
};

const DARK = {
  panel: 'rgba(21, 22, 26, 0.98)',
  border: 'rgba(255,255,255,0.14)',
  text: '#ffffff',
  muted: 'rgba(255,255,255,0.62)',
  hover: 'rgba(255,255,255,0.08)',
  active: 'rgba(192,255,114,0.16)',
  activeText: '#c0ff72',
};

const LIGHT = {
  panel: '#ffffff',
  border: 'rgba(15, 23, 42, 0.12)',
  text: '#0f172a',
  muted: '#64748b',
  hover: 'rgba(15, 23, 42, 0.05)',
  active: 'rgba(5, 150, 105, 0.12)',
  activeText: '#047857',
};

export function TurnoutSelect({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  required = false,
  id,
  ariaLabel,
  className,
  buttonClassName,
  style,
  tone = 'dark',
  align = 'start',
}: Props) {
  const autoId = useId();
  const selectId = id || autoId;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(
    null
  );
  const theme = tone === 'dark' ? DARK : LIGHT;

  const selected = useMemo(() => options.find((o) => o.value === value) || null, [options, value]);
  const display = selected?.label || placeholder;

  const placePanel = () => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 180);
    const gap = 6;
    const viewportPad = 8;
    const measured = panelRef.current?.offsetHeight;
    const estimated =
      measured && measured > 0
        ? measured
        : Math.min(280, Math.max(44, options.length * 44 + 12));
    const spaceBelow = window.innerHeight - rect.bottom - viewportPad;
    const spaceAbove = rect.top - viewportPad;
    const openBelow = spaceBelow >= Math.min(estimated, 96) || spaceBelow >= spaceAbove;
    const maxHeight = Math.min(280, openBelow ? Math.max(96, spaceBelow) : Math.max(96, spaceAbove));
    const heightForPlace = Math.min(estimated, maxHeight);
    const top = openBelow
      ? rect.bottom + gap
      : Math.max(viewportPad, rect.top - heightForPlace - gap);
    const left =
      align === 'end'
        ? Math.min(window.innerWidth - width - viewportPad, Math.max(viewportPad, rect.right - width))
        : Math.min(window.innerWidth - width - viewportPad, Math.max(viewportPad, rect.left));
    setPanelPos({ top, left, width, maxHeight });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    placePanel();
    // Re-measure after the portal paints so tiny menus (Yes/No) sit under the field.
    const raf = window.requestAnimationFrame(() => placePanel());
    window.addEventListener('resize', placePanel);
    window.addEventListener('scroll', placePanel, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', placePanel);
      window.removeEventListener('scroll', placePanel, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, align, options.length]);

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

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      {/* Keep a hidden input for native form required validation when needed */}
      {required ? (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => undefined}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      ) : null}
      <button
        id={selectId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          'flex w-full min-h-[42px] items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left text-sm transition disabled:opacity-50',
          buttonClassName
        )}
        style={style}
      >
        <span className={cn('min-w-0 truncate', !selected && 'opacity-60')}>{display}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 opacity-70 transition', open && 'rotate-180')} />
      </button>

      {open && panelPos
        ? createPortal(
            <div
              ref={panelRef}
              data-turnout-picker="select"
              role="listbox"
              className="fixed z-[10050] overflow-y-auto rounded-xl p-1.5 shadow-2xl"
              style={{
                top: panelPos.top,
                left: panelPos.left,
                width: panelPos.width,
                maxHeight: panelPos.maxHeight,
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                color: theme.text,
                backdropFilter: 'blur(16px)',
              }}
            >
              {options.length === 0 ? (
                <p className="px-3 py-2 text-sm" style={{ color: theme.muted }}>
                  No options
                </p>
              ) : (
                options.map((opt) => {
                  const active = opt.value === value;
                  return (
                    <button
                      key={opt.value || opt.label}
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={opt.disabled}
                      onClick={() => {
                        if (opt.disabled) return;
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className="flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition disabled:opacity-40"
                      style={{
                        background: active ? theme.active : 'transparent',
                        color: active ? theme.activeText : theme.text,
                      }}
                      onMouseEnter={(e) => {
                        if (!active) e.currentTarget.style.background = theme.hover;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = active ? theme.active : 'transparent';
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{opt.label}</span>
                        {opt.hint ? (
                          <span className="mt-0.5 block text-xs" style={{ color: theme.muted }}>
                            {opt.hint}
                          </span>
                        ) : null}
                      </span>
                      {active ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                    </button>
                  );
                })
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
