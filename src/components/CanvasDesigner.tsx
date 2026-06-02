import React, { useMemo, useState } from 'react';
import { Rnd } from 'react-rnd';
import { CanvasDesign, CanvasElement, CanvasElementType, Event, Ticket } from '../types';
import { formatLKR } from '../utils/money';
import { Calendar, Image as ImageIcon, Ticket as TicketIcon, Timer, Type, Square, BadgeCheck } from 'lucide-react';

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function defaultCanvasDesign(event: Pick<Event, 'title'>): CanvasDesign {
  return {
    version: 1,
    canvas: { width: 1100, height: 900, background: '#111714' },
    elements: [
      {
        id: uid(),
        type: 'badge',
        x: 60,
        y: 60,
        w: 180,
        h: 44,
        props: { text: 'LIVE EVENT' },
      },
      {
        id: uid(),
        type: 'text',
        x: 60,
        y: 120,
        w: 680,
        h: 90,
        props: { text: event.title || 'Your Event Title', size: 48, weight: 800, color: '#0a0a0a' },
      },
      {
        id: uid(),
        type: 'text',
        x: 60,
        y: 220,
        w: 680,
        h: 80,
        props: { text: 'Add a short description here.', size: 18, weight: 500, color: '#525252' },
      },
      {
        id: uid(),
        type: 'image',
        x: 60,
        y: 330,
        w: 680,
        h: 360,
        props: { url: 'https://picsum.photos/seed/turnout-canvas/1200/700', radius: 24 },
      },
      {
        id: uid(),
        type: 'ticketsEmbed',
        x: 780,
        y: 120,
        w: 280,
        h: 520,
        props: { title: 'Tickets' },
      },
      {
        id: uid(),
        type: 'button',
        x: 780,
        y: 660,
        w: 280,
        h: 56,
        props: { text: 'Get Tickets', bg: '#4f46e5', color: '#ffffff', radius: 16 },
      },
    ],
  };
}

type Props = {
  value: CanvasDesign;
  onChange: (next: CanvasDesign) => void;
  eventPreview: Pick<Event, 'title' | 'date' | 'location' | 'bannerUrl' | 'customization'>;
  ticketsPreview: Ticket[];
};

const palette: { type: CanvasElementType; label: string; icon: React.ReactNode; defaultW: number; defaultH: number }[] =
  [
    { type: 'text', label: 'Text', icon: <Type className="h-4 w-4" />, defaultW: 420, defaultH: 70 },
    { type: 'button', label: 'Button', icon: <Square className="h-4 w-4" />, defaultW: 220, defaultH: 56 },
    { type: 'image', label: 'Image', icon: <ImageIcon className="h-4 w-4" />, defaultW: 520, defaultH: 280 },
    { type: 'badge', label: 'Badge', icon: <BadgeCheck className="h-4 w-4" />, defaultW: 160, defaultH: 44 },
    { type: 'divider', label: 'Divider', icon: <Square className="h-4 w-4 rotate-90" />, defaultW: 420, defaultH: 12 },
    { type: 'countdown', label: 'Countdown', icon: <Timer className="h-4 w-4" />, defaultW: 360, defaultH: 90 },
    { type: 'ticketsEmbed', label: 'Tickets', icon: <TicketIcon className="h-4 w-4" />, defaultW: 320, defaultH: 420 },
  ];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export const CanvasDesigner: React.FC<Props> = ({ value, onChange, eventPreview, ticketsPreview }) => {
  const [selectedId, setSelectedId] = useState<string | null>(value.elements[0]?.id || null);

  const selected = useMemo(
    () => value.elements.find((e) => e.id === selectedId) || null,
    [selectedId, value.elements]
  );

  const updateEl = (id: string, patch: Partial<CanvasElement>) => {
    onChange({
      ...value,
      elements: value.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  };

  const updateElProps = (id: string, patch: Record<string, any>) => {
    onChange({
      ...value,
      elements: value.elements.map((e) => (e.id === id ? { ...e, props: { ...e.props, ...patch } } : e)),
    });
  };

  const addElement = (type: CanvasElementType) => {
    const meta = palette.find((p) => p.type === type)!;
    const el: CanvasElement = {
      id: uid(),
      type,
      x: 40,
      y: 40,
      w: meta.defaultW,
      h: meta.defaultH,
      props:
        type === 'text'
          ? { text: 'New text', size: 20, weight: 700, color: '#0a0a0a' }
          : type === 'button'
            ? { text: 'Button', bg: eventPreview.customization?.primaryColor || '#4f46e5', color: '#ffffff', radius: 16 }
            : type === 'image'
              ? { url: eventPreview.bannerUrl || 'https://picsum.photos/seed/turnout-new/1200/700', radius: 24 }
              : type === 'badge'
                ? { text: 'NEW' }
                : type === 'divider'
                  ? { color: '#e5e5e5' }
                  : type === 'countdown'
                    ? { title: 'Starts in', color: '#0a0a0a' }
                    : { title: 'Tickets' },
    };
    onChange({ ...value, elements: [...value.elements, el] });
    setSelectedId(el.id);
  };

  const removeSelected = () => {
    if (!selected) return;
    const next = value.elements.filter((e) => e.id !== selected.id);
    onChange({ ...value, elements: next });
    setSelectedId(next[0]?.id || null);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy: CanvasElement = { ...selected, id: uid(), x: selected.x + 20, y: selected.y + 20, props: { ...selected.props } };
    onChange({ ...value, elements: [...value.elements, copy] });
    setSelectedId(copy.id);
  };

  const canvasStyle: React.CSSProperties = {
    width: value.canvas.width,
    height: value.canvas.height,
    background: value.canvas.background || '#fff',
  };

  const renderElement = (el: CanvasElement) => {
    const isSelected = el.id === selectedId;
    const border = isSelected ? '2px solid #4f46e5' : '1px solid rgba(0,0,0,0.08)';
    const boxShadow = isSelected ? '0 12px 28px rgba(0,0,0,0.18)' : '0 8px 18px rgba(0,0,0,0.08)';

    const wrapperStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      border,
      boxShadow,
      borderRadius: 16,
      background: 'rgba(255,255,255,0.96)',
      overflow: 'hidden',
      cursor: 'move',
    };

    if (el.type === 'divider') {
      return (
        <div style={{ ...wrapperStyle, borderRadius: 9999, background: 'transparent', boxShadow: 'none', border: 'none' }}>
          <div style={{ height: 2, width: '100%', background: el.props.color || '#e5e5e5' }} />
        </div>
      );
    }

    if (el.type === 'image') {
      return (
        <div style={{ ...wrapperStyle, background: 'transparent', border: isSelected ? border : '1px solid rgba(0,0,0,0.12)' }}>
          <img
            src={el.props.url}
            alt=""
            referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', borderRadius: el.props.radius ?? 24 }}
          />
        </div>
      );
    }

    if (el.type === 'badge') {
      return (
        <div style={{ ...wrapperStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              borderRadius: 9999,
              padding: '10px 14px',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              background: 'rgba(79,70,229,0.12)',
              color: '#4f46e5',
            }}
          >
            {el.props.text || 'BADGE'}
          </div>
        </div>
      );
    }

    if (el.type === 'button') {
      return (
        <div style={{ ...wrapperStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
          <button
            type="button"
            className="w-full h-full"
            style={{
              width: '100%',
              height: '100%',
              borderRadius: el.props.radius ?? 16,
              background: el.props.bg || '#4f46e5',
              color: el.props.color || '#fff',
              fontWeight: 800,
              fontSize: 16,
              border: 'none',
            }}
          >
            {el.props.text || 'Button'}
          </button>
        </div>
      );
    }

    if (el.type === 'countdown') {
      const now = Date.now();
      const target = new Date(eventPreview.date).getTime();
      const diff = Math.max(0, target - now);
      const hours = Math.floor(diff / 3_600_000);
      const mins = Math.floor((diff % 3_600_000) / 60_000);
      const secs = Math.floor((diff % 60_000) / 1000);
      return (
        <div style={{ ...wrapperStyle, padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#737373' }}>
            {el.props.title || 'Starts in'}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: el.props.color || '#0a0a0a' }}>
              {hours.toString().padStart(2, '0')}:{mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
            </div>
            <Timer className="h-5 w-5 text-neutral-500" />
          </div>
        </div>
      );
    }

    if (el.type === 'ticketsEmbed') {
      const primary = eventPreview.customization?.primaryColor || '#4f46e5';
      return (
        <div style={{ ...wrapperStyle, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 900 }}>{el.props.title || 'Tickets'}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#737373' }}>LKR</div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ticketsPreview.slice(0, 3).map((t) => (
              <div key={t.id} style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{t.name}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#737373' }}>{formatLKR(t.price)}</div>
              </div>
            ))}
            <button
              type="button"
              style={{
                marginTop: 6,
                width: '100%',
                borderRadius: 14,
                padding: '12px 14px',
                background: primary,
                color: '#fff',
                border: 'none',
                fontWeight: 900,
              }}
            >
              Buy tickets
            </button>
          </div>
        </div>
      );
    }

    // text
    return (
      <div style={{ ...wrapperStyle, padding: 14 }}>
        <div
          style={{
            fontSize: clamp(el.props.size ?? 20, 10, 96),
            fontWeight: clamp(el.props.weight ?? 800, 100, 900),
            color: el.props.color || '#0a0a0a',
            lineHeight: 1.1,
            whiteSpace: 'pre-wrap',
          }}
        >
          {el.props.text || 'Text'}
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr_320px]">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-neutral-500">Elements</h3>
        <div className="mt-4 grid gap-2">
          {palette.map((p) => (
            <button
              key={p.type}
              type="button"
              onClick={() => addElement(p.type)}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              <span className="flex items-center gap-2">
                {p.icon}
                {p.label}
              </span>
              <span className="text-xs text-neutral-400">Add</span>
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          <div className="flex items-center gap-2 font-bold">
            <Calendar className="h-4 w-4" /> Preview data
          </div>
          <div className="mt-2 text-xs text-neutral-600">Your canvas uses your event/ticket data at publish time.</div>
        </div>
      </div>

      <div className="overflow-auto rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-bold text-neutral-700">Canvas</div>
          <div className="text-xs text-neutral-500">
            {value.canvas.width}×{value.canvas.height}
          </div>
        </div>
        <div
          className="relative mx-auto rounded-2xl border border-neutral-200"
          style={canvasStyle}
          onMouseDown={() => setSelectedId(selectedId)}
        >
          {value.elements.map((el) => (
            <Rnd
              key={el.id}
              size={{ width: el.w, height: el.h }}
              position={{ x: el.x, y: el.y }}
              bounds="parent"
              onDragStart={() => setSelectedId(el.id)}
              onDragStop={(_, d) => updateEl(el.id, { x: d.x, y: d.y })}
              onResizeStart={() => setSelectedId(el.id)}
              onResizeStop={(_, __, ref, ___, pos) => {
                updateEl(el.id, { w: ref.offsetWidth, h: ref.offsetHeight, x: pos.x, y: pos.y });
              }}
              enableResizing={{
                top: true,
                right: true,
                bottom: true,
                left: true,
                topRight: true,
                bottomRight: true,
                bottomLeft: true,
                topLeft: true,
              }}
            >
              <div
                className="h-full w-full"
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

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-neutral-500">Properties</h3>
        {!selected ? (
          <div className="mt-4 text-sm text-neutral-500">Select an element to edit.</div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-sm font-bold text-neutral-800">Selected</div>
              <div className="mt-1 text-xs text-neutral-600">{selected.type}</div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={duplicateSelected}
                  className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={removeSelected}
                  className="flex-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>

            {selected.type === 'text' && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Text</label>
                  <textarea
                    value={selected.props.text || ''}
                    onChange={(e) => updateElProps(selected.id, { text: e.target.value })}
                    rows={4}
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold">Size</label>
                    <input
                      type="number"
                      value={selected.props.size ?? 20}
                      onChange={(e) => updateElProps(selected.id, { size: Number(e.target.value) })}
                      className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold">Weight</label>
                    <input
                      type="number"
                      value={selected.props.weight ?? 800}
                      onChange={(e) => updateElProps(selected.id, { weight: Number(e.target.value) })}
                      className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Color</label>
                  <input
                    type="color"
                    value={selected.props.color || '#0a0a0a'}
                    onChange={(e) => updateElProps(selected.id, { color: e.target.value })}
                    className="h-10 w-full rounded-lg border border-neutral-200 bg-white p-1"
                  />
                </div>
              </>
            )}

            {selected.type === 'image' && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Image URL</label>
                  <input
                    value={selected.props.url || ''}
                    onChange={(e) => updateElProps(selected.id, { url: e.target.value })}
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Corner radius</label>
                  <input
                    type="number"
                    value={selected.props.radius ?? 24}
                    onChange={(e) => updateElProps(selected.id, { radius: Number(e.target.value) })}
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </>
            )}

            {selected.type === 'button' && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Label</label>
                  <input
                    value={selected.props.text || ''}
                    onChange={(e) => updateElProps(selected.id, { text: e.target.value })}
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold">Background</label>
                    <input
                      type="color"
                      value={selected.props.bg || '#4f46e5'}
                      onChange={(e) => updateElProps(selected.id, { bg: e.target.value })}
                      className="h-10 w-full rounded-lg border border-neutral-200 bg-white p-1"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold">Text color</label>
                    <input
                      type="color"
                      value={selected.props.color || '#ffffff'}
                      onChange={(e) => updateElProps(selected.id, { color: e.target.value })}
                      className="h-10 w-full rounded-lg border border-neutral-200 bg-white p-1"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Corner radius</label>
                  <input
                    type="number"
                    value={selected.props.radius ?? 16}
                    onChange={(e) => updateElProps(selected.id, { radius: Number(e.target.value) })}
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </>
            )}

            {selected.type === 'badge' && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Text</label>
                <input
                  value={selected.props.text || ''}
                  onChange={(e) => updateElProps(selected.id, { text: e.target.value })}
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}

            {selected.type === 'divider' && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Color</label>
                <input
                  type="color"
                  value={selected.props.color || '#e5e5e5'}
                  onChange={(e) => updateElProps(selected.id, { color: e.target.value })}
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-white p-1"
                />
              </div>
            )}

            {selected.type === 'countdown' && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Title</label>
                  <input
                    value={selected.props.title || ''}
                    onChange={(e) => updateElProps(selected.id, { title: e.target.value })}
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Number color</label>
                  <input
                    type="color"
                    value={selected.props.color || '#0a0a0a'}
                    onChange={(e) => updateElProps(selected.id, { color: e.target.value })}
                    className="h-10 w-full rounded-lg border border-neutral-200 bg-white p-1"
                  />
                </div>
              </>
            )}

            {selected.type === 'ticketsEmbed' && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Title</label>
                <input
                  value={selected.props.title || ''}
                  onChange={(e) => updateElProps(selected.id, { title: e.target.value })}
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

