import React, { useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { CircleDot, Grid3X3, Rows3, Square, Tag } from 'lucide-react';
import { SeatingChartDesign, SeatingChartElement, SeatingChartElementType } from '../../types';
import { cn } from '../../utils/cn';

type SeatingChartBuilderProps = {
  value: SeatingChartDesign;
  onChange: (next: SeatingChartDesign) => void;
  ui: {
    text: string;
    textMuted: string;
    textSubtle: string;
    borderColor: string;
    cardBg: string;
    fieldBg: string;
    accent: string;
  };
};

type PaletteItem = {
  type: SeatingChartElementType;
  label: string;
  icon: React.ReactNode;
  defaultW: number;
  defaultH: number;
  defaultProps: Record<string, any>;
};

const palette: PaletteItem[] = [
  { type: 'stage', label: 'Stage', icon: <Rows3 className="h-4 w-4" />, defaultW: 260, defaultH: 56, defaultProps: { name: 'Main stage' } },
  { type: 'seat', label: 'Seat block', icon: <Grid3X3 className="h-4 w-4" />, defaultW: 170, defaultH: 120, defaultProps: { rows: 5, cols: 8, prefix: 'A', priceTier: 'Top tier' } },
  { type: 'table', label: 'Table / POD', icon: <CircleDot className="h-4 w-4" />, defaultW: 120, defaultH: 120, defaultProps: { seats: 8, name: 'Table 1', priceTier: 'VIP' } },
  { type: 'group', label: 'Hold / Group', icon: <Square className="h-4 w-4" />, defaultW: 210, defaultH: 64, defaultProps: { name: 'Honorary guests', seats: 12, code: 'VIPHOLD' } },
  { type: 'pricing', label: 'Pricing tier', icon: <Tag className="h-4 w-4" />, defaultW: 180, defaultH: 56, defaultProps: { tier: 'Mid tier', price: 2500, color: '#3b82f6' } },
];

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function createDefaultSeatingChart(): SeatingChartDesign {
  return {
    version: 1,
    canvas: {
      width: 980,
      height: 620,
      background: '#07141d',
    },
    elements: [],
  };
}

export const SeatingChartBuilder: React.FC<SeatingChartBuilderProps> = ({ value, onChange, ui }) => {
  const [selectedId, setSelectedId] = useState<string | null>(value.elements[0]?.id || null);
  const [paletteDragType, setPaletteDragType] = useState<SeatingChartElementType | null>(null);
  const [dropPoint, setDropPoint] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const selected = useMemo(() => value.elements.find((el) => el.id === selectedId) || null, [value.elements, selectedId]);

  const updateElement = (id: string, patch: Partial<SeatingChartElement>) => {
    onChange({
      ...value,
      elements: value.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
    });
  };

  const updateElementProps = (id: string, patch: Record<string, any>) => {
    onChange({
      ...value,
      elements: value.elements.map((el) => (el.id === id ? { ...el, props: { ...el.props, ...patch } } : el)),
    });
  };

  const addElementAt = (item: PaletteItem, x: number, y: number) => {
    const maxX = Math.max(0, value.canvas.width - item.defaultW);
    const maxY = Math.max(0, value.canvas.height - item.defaultH);
    const next: SeatingChartElement = {
      id: uid(),
      type: item.type,
      x: Math.max(0, Math.min(maxX, Math.round(x))),
      y: Math.max(0, Math.min(maxY, Math.round(y))),
      w: item.defaultW,
      h: item.defaultH,
      props: { ...item.defaultProps },
    };
    onChange({ ...value, elements: [...value.elements, next] });
    setSelectedId(next.id);
  };

  const addElement = (item: PaletteItem) => {
    addElementAt(item, 24, 24);
  };

  const removeSelected = () => {
    if (!selected) return;
    const next = value.elements.filter((el) => el.id !== selected.id);
    onChange({ ...value, elements: next });
    setSelectedId(next[0]?.id || null);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy: SeatingChartElement = {
      ...selected,
      id: uid(),
      x: selected.x + 18,
      y: selected.y + 18,
      props: { ...selected.props },
    };
    onChange({ ...value, elements: [...value.elements, copy] });
    setSelectedId(copy.id);
  };

  const renderElement = (el: SeatingChartElement) => {
    const isSelected = el.id === selectedId;
    const shellStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      borderRadius: 12,
      border: isSelected ? `2px solid ${ui.accent}` : '1px solid rgba(255,255,255,0.28)',
      background: 'rgba(13, 25, 36, 0.72)',
      color: '#f5fbff',
      overflow: 'hidden',
      boxShadow: isSelected ? '0 10px 24px rgba(0,0,0,0.35)' : '0 6px 14px rgba(0,0,0,0.25)',
    };

    const dragHandle = (
      <div
        className="seating-drag-handle flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
        style={{ background: 'rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.18)', cursor: 'grab' }}
      >
        <span>{el.type}</span>
        <span style={{ color: 'rgba(255,255,255,0.75)' }}>Drag</span>
      </div>
    );

    if (el.type === 'stage') {
      return (
        <div style={{ ...shellStyle, borderRadius: 18, background: 'rgba(15, 56, 74, 0.88)' }}>
          {dragHandle}
          <div className="grid h-[calc(100%-28px)] place-items-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em]">{el.props.name || 'Stage'}</p>
          </div>
        </div>
      );
    }
    if (el.type === 'seat') {
      const rows = Math.max(1, Number(el.props.rows) || 1);
      const cols = Math.max(1, Number(el.props.cols) || 1);
      const rowPrefix = String(el.props.prefix || 'A').charAt(0).toUpperCase();
      return (
        <div style={{ ...shellStyle, padding: 0 }}>
          {dragHandle}
          <div className="p-1.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
            {el.props.priceTier || 'Tier'} · {rowPrefix}-{String.fromCharCode(rowPrefix.charCodeAt(0) + rows - 1)}
          </p>
          <div className="grid h-[calc(100%-20px)] gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
            {Array.from({ length: rows * cols }).map((_, i) => (
              <span key={i} className="rounded-full border border-cyan-200/60 bg-cyan-300/20" />
            ))}
          </div>
          </div>
        </div>
      );
    }
    if (el.type === 'table') {
      const seats = Math.max(2, Number(el.props.seats) || 8);
      return (
        <div style={{ ...shellStyle, display: 'grid', placeItems: 'stretch' }}>
          {dragHandle}
          <div className="relative grid h-[calc(100%-30px)] place-items-center">
          <div className="relative grid h-14 w-14 place-items-center rounded-full border-2 border-emerald-200/80 bg-emerald-300/20 text-xs font-bold">
            {el.props.name || 'Table'}
            {Array.from({ length: Math.min(seats, 12) }).map((_, i) => (
              <span
                key={i}
                className="absolute h-2.5 w-2.5 rounded-full border border-emerald-100/90 bg-emerald-200/90"
                style={{
                  transform: `translate(${Math.cos((i / Math.min(seats, 12)) * Math.PI * 2) * 38}px, ${Math.sin((i / Math.min(seats, 12)) * Math.PI * 2) * 38}px)`,
                }}
              />
            ))}
          </div>
          </div>
        </div>
      );
    }
    if (el.type === 'group') {
      return (
        <div style={{ ...shellStyle, padding: 0 }}>
          {dragHandle}
          <div className="p-2.5">
          <p className="text-xs font-bold text-amber-200">{el.props.name || 'Group hold'}</p>
          <p className="mt-1 text-[11px] text-amber-100/80">Seats: {Number(el.props.seats) || 0}</p>
          <p className="text-[10px] uppercase tracking-wide text-amber-100/70">Code: {el.props.code || 'HOLD'}</p>
          </div>
        </div>
      );
    }
    return (
      <div style={{ ...shellStyle, padding: 0 }}>
        {dragHandle}
        <div className="p-2.5">
        <p className="text-xs font-bold" style={{ color: el.props.color || '#7dd3fc' }}>
          {el.props.tier || 'Pricing tier'}
        </p>
        <p className="mt-1 text-sm font-extrabold">LKR {Number(el.props.price || 0).toLocaleString()}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_280px]">
      <div className="rounded-xl border p-3" style={{ borderColor: ui.borderColor, background: ui.cardBg }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
          Builder tools
        </p>
        <div className="mt-3 space-y-2">
          {palette.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => addElement(item)}
              draggable
              onDragStart={(e) => {
                setPaletteDragType(item.type);
                e.dataTransfer.setData('application/x-seating-tool', item.type);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onDragEnd={() => {
                setPaletteDragType(null);
                setDropPoint(null);
              }}
              className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold transition hover:opacity-90"
              style={{ borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text }}
            >
              <span className="inline-flex items-center gap-2">{item.icon}{item.label}</span>
              <span className="text-xs" style={{ color: ui.textMuted }}>Add</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-auto rounded-xl border p-3" style={{ borderColor: ui.borderColor, background: ui.cardBg }}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>Seating canvas</p>
          <p className="text-[11px]" style={{ color: ui.textMuted }}>
            {value.canvas.width} × {value.canvas.height}
          </p>
        </div>
        <div
          className="relative mx-auto rounded-xl border"
          ref={canvasRef}
          style={{
            width: value.canvas.width,
            height: value.canvas.height,
            borderColor: 'rgba(255,255,255,0.22)',
            background: value.canvas.background || '#07141d',
            backgroundImage:
              'radial-gradient(circle at 50% 0%, rgba(20,184,166,0.18), transparent 48%), repeating-linear-gradient(0deg, rgba(255,255,255,0.04), rgba(255,255,255,0.04) 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.04) 1px, transparent 1px, transparent 20px)',
          }}
          onDragOver={(e) => {
            const toolType = e.dataTransfer.getData('application/x-seating-tool') as SeatingChartElementType;
            if (!toolType && !paletteDragType) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            setDropPoint({ x, y });
          }}
          onDragLeave={() => setDropPoint(null)}
          onDrop={(e) => {
            const raw = e.dataTransfer.getData('application/x-seating-tool') as SeatingChartElementType;
            const type = raw || paletteDragType;
            if (!type) return;
            e.preventDefault();
            const item = palette.find((p) => p.type === type);
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!item || !rect) return;
            const x = e.clientX - rect.left - item.defaultW / 2;
            const y = e.clientY - rect.top - item.defaultH / 2;
            addElementAt(item, x, y);
            setPaletteDragType(null);
            setDropPoint(null);
          }}
        >
          {dropPoint ? (
            <div
              className="pointer-events-none absolute z-10 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-cyan-300/90 bg-cyan-300/20"
              style={{ left: dropPoint.x, top: dropPoint.y }}
            />
          ) : null}
          {value.elements.map((el) => (
            <Rnd
              key={el.id}
              size={{ width: el.w, height: el.h }}
              position={{ x: el.x, y: el.y }}
              bounds="parent"
              enableUserSelectHack
              style={{ touchAction: 'none' }}
              dragAxis="both"
              onDragStart={() => setSelectedId(el.id)}
              onDragStop={(_, d) => updateElement(el.id, { x: d.x, y: d.y })}
              onResizeStart={() => setSelectedId(el.id)}
              onResizeStop={(_, __, ref, ___, pos) => updateElement(el.id, { w: ref.offsetWidth, h: ref.offsetHeight, x: pos.x, y: pos.y })}
            >
              <div
                className="h-full w-full cursor-move"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setSelectedId(el.id);
                }}
              >
                {renderElement(el)}
              </div>
            </Rnd>
          ))}
        </div>
      </div>

      <div className="rounded-xl border p-3" style={{ borderColor: ui.borderColor, background: ui.cardBg }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
          Properties
        </p>
        <p className="mt-1 text-[11px]" style={{ color: ui.textMuted }}>
          Tip: drag tools from the left panel and drop anywhere on the canvas.
        </p>
        {!selected ? (
          <p className="mt-3 text-sm" style={{ color: ui.textMuted }}>
            Select a shape to edit labels, sizes, and pricing.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="rounded-lg border p-2.5" style={{ borderColor: ui.borderColor, background: ui.fieldBg }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                {selected.type}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={duplicateSelected}
                  className="rounded-md border px-2.5 py-1.5 text-xs font-semibold"
                  style={{ borderColor: ui.borderColor, color: ui.text }}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={removeSelected}
                  className="rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600"
                >
                  Delete
                </button>
              </div>
            </div>

            {(selected.type === 'stage' || selected.type === 'group' || selected.type === 'table' || selected.type === 'pricing') && (
              <input
                value={selected.props.name || selected.props.tier || ''}
                onChange={(e) => {
                  const key = selected.type === 'pricing' ? 'tier' : 'name';
                  updateElementProps(selected.id, { [key]: e.target.value });
                }}
                placeholder={selected.type === 'pricing' ? 'Tier name' : 'Label'}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text }}
              />
            )}

            {selected.type === 'seat' && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={1}
                  value={selected.props.rows ?? 5}
                  onChange={(e) => updateElementProps(selected.id, { rows: Number(e.target.value) })}
                  placeholder="Rows"
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text }}
                />
                <input
                  type="number"
                  min={1}
                  value={selected.props.cols ?? 8}
                  onChange={(e) => updateElementProps(selected.id, { cols: Number(e.target.value) })}
                  placeholder="Columns"
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text }}
                />
                <input
                  value={selected.props.prefix ?? 'A'}
                  onChange={(e) => updateElementProps(selected.id, { prefix: e.target.value.toUpperCase().slice(0, 1) })}
                  placeholder="Row prefix"
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text }}
                />
                <input
                  value={selected.props.priceTier ?? ''}
                  onChange={(e) => updateElementProps(selected.id, { priceTier: e.target.value })}
                  placeholder="Price tier"
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text }}
                />
              </div>
            )}

            {selected.type === 'table' && (
              <input
                type="number"
                min={2}
                value={selected.props.seats ?? 8}
                onChange={(e) => updateElementProps(selected.id, { seats: Number(e.target.value) })}
                placeholder="Seats per table"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text }}
              />
            )}

            {selected.type === 'group' && (
              <div className="grid gap-2">
                <input
                  type="number"
                  min={1}
                  value={selected.props.seats ?? 12}
                  onChange={(e) => updateElementProps(selected.id, { seats: Number(e.target.value) })}
                  placeholder="Held seats"
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text }}
                />
                <input
                  value={selected.props.code ?? ''}
                  onChange={(e) => updateElementProps(selected.id, { code: e.target.value.toUpperCase() })}
                  placeholder="Hold code"
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text }}
                />
              </div>
            )}

            {selected.type === 'pricing' && (
              <input
                type="number"
                min={0}
                value={selected.props.price ?? 0}
                onChange={(e) => updateElementProps(selected.id, { price: Number(e.target.value) })}
                placeholder="Price"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
