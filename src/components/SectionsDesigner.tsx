import React, { useMemo, useState } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Event, SectionBlock, SectionDesign, SectionType, Ticket } from '../types';
import { formatLKR } from '../utils/money';

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function defaultSectionDesign(event: Pick<Event, 'title' | 'description' | 'bannerUrl'>): SectionDesign {
  return {
    version: 1,
    theme: {
      contentBackground: '#111714',
      border: 'rgba(57, 255, 20, 0.2)',
    },
    blocks: [
      {
        id: uid(),
        type: 'hero',
        props: {
          eyebrow: 'INTRODUCING',
          title: event.title || 'Your Event Title',
          subtitle: (event.description || 'Describe your event in one short paragraph.').slice(0, 160),
          imageUrl: event.bannerUrl || 'https://picsum.photos/seed/turnout-hero/1400/700',
          align: 'left',
        },
      },
      { id: uid(), type: 'divider', props: {} },
      {
        id: uid(),
        type: 'tickets',
        props: { title: 'Tickets' },
      },
      {
        id: uid(),
        type: 'richText',
        props: {
          title: 'About',
          text: event.description || 'Add the full description here. You can change this text anytime.',
        },
      },
    ],
  };
}

const blockLibrary: { type: SectionType; name: string; description: string }[] = [
  { type: 'hero', name: 'Hero', description: 'Banner + title + subtitle' },
  { type: 'richText', name: 'Rich text', description: 'Heading + paragraph' },
  { type: 'image', name: 'Image', description: 'Full-width image section' },
  { type: 'countdown', name: 'Countdown', description: 'Countdown timer to event date' },
  { type: 'tickets', name: 'Tickets', description: 'Ticket selector + total' },
  { type: 'speakers', name: 'Speakers', description: 'Speaker grid (from organizer data)' },
  { type: 'agenda', name: 'Agenda', description: 'Sessions agenda timeline (from organizer data)' },
  { type: 'sponsors', name: 'Sponsors', description: 'Sponsor logo grid (manual list)' },
  { type: 'button', name: 'Button', description: 'Call-to-action button' },
  { type: 'divider', name: 'Divider', description: 'Section separator line' },
];

function createBlock(type: SectionType, event: Pick<Event, 'title' | 'description' | 'bannerUrl'>): SectionBlock {
  const id = uid();
  switch (type) {
    case 'hero':
      return {
        id,
        type,
        props: {
          eyebrow: 'INTRODUCING',
          title: event.title || 'Your Event Title',
          subtitle: (event.description || 'Describe your event in one short paragraph.').slice(0, 160),
          imageUrl: event.bannerUrl || 'https://picsum.photos/seed/turnout-hero/1400/700',
          align: 'left',
        },
      };
    case 'richText':
      return { id, type, props: { title: 'Section title', text: 'Write something here…' } };
    case 'image':
      return { id, type, props: { imageUrl: event.bannerUrl || 'https://picsum.photos/seed/turnout-image/1400/800' } };
    case 'countdown':
      return { id, type, props: { title: 'Starts in' } };
    case 'tickets':
      return { id, type, props: { title: 'Tickets' } };
    case 'speakers':
      return { id, type, props: { title: 'Speakers', subtitle: 'Meet our speakers' } };
    case 'agenda':
      return { id, type, props: { title: 'Agenda', subtitle: 'Schedule' } };
    case 'sponsors':
      return {
        id,
        type,
        props: {
          title: 'Sponsors',
          subtitle: 'Thanks to our partners',
          // Lines: Name|LogoURL|LinkURL
          itemsText:
            'Sponsor One|https://picsum.photos/seed/sponsor1/300/180|https://example.com\nSponsor Two|https://picsum.photos/seed/sponsor2/300/180|https://example.com',
        },
      };
    case 'button':
      return { id, type, props: { text: 'Get Tickets', variant: 'primary' } };
    case 'divider':
      return { id, type, props: {} };
  }
}

type SortableRowProps = {
  id: string;
  selected: boolean;
  label: string;
  onSelect: () => void;
  onDelete: () => void;
  // React special prop; included to satisfy TS in some setups
  key?: React.Key;
};

function SortableRow({ id, selected, label, onSelect, onDelete }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button
        type="button"
        onClick={onSelect}
        className={`flex-1 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-all ${
          selected ? 'border-indigo-600 bg-indigo-50' : 'border-neutral-200 bg-white hover:bg-neutral-50'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="truncate">{label}</span>
          <span className="text-xs text-neutral-400">Drag</span>
        </div>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-xs font-bold text-neutral-600 hover:bg-neutral-50"
        title="Delete block"
      >
        Delete
      </button>
      <div
        className="cursor-grab rounded-xl border border-neutral-200 bg-white px-3 py-3 text-xs font-bold text-neutral-600 active:cursor-grabbing"
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ::
      </div>
    </div>
  );
}

type Props = {
  value: SectionDesign;
  onChange: (next: SectionDesign) => void;
  eventPreview: Pick<Event, 'title' | 'description' | 'date' | 'location' | 'bannerUrl' | 'customization'>;
  ticketsPreview: Ticket[];
};

export const SectionsDesigner: React.FC<Props> = ({ value, onChange, eventPreview, ticketsPreview }) => {
  const [selectedId, setSelectedId] = useState<string | null>(value.blocks[0]?.id || null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const selected = useMemo(() => value.blocks.find((b) => b.id === selectedId) || null, [selectedId, value.blocks]);

  const setTheme = (patch: Partial<SectionDesign['theme']>) => {
    onChange({ ...value, theme: { ...value.theme, ...patch } });
  };

  const addBlock = (type: SectionType) => {
    const b = createBlock(type, eventPreview);
    onChange({ ...value, blocks: [...value.blocks, b] });
    setSelectedId(b.id);
  };

  const deleteBlock = (id: string) => {
    const next = value.blocks.filter((b) => b.id !== id);
    onChange({ ...value, blocks: next });
    setSelectedId(next[0]?.id || null);
  };

  const updateSelectedProps = (patch: Record<string, any>) => {
    if (!selected) return;
    onChange({
      ...value,
      blocks: value.blocks.map((b) => (b.id === selected.id ? { ...b, props: { ...b.props, ...patch } } : b)),
    });
  };

  const onDragEnd = (evt: DragEndEvent) => {
    const { active, over } = evt;
    if (!over || active.id === over.id) return;
    const oldIndex = value.blocks.findIndex((b) => b.id === active.id);
    const newIndex = value.blocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange({ ...value, blocks: arrayMove(value.blocks, oldIndex, newIndex) });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr_320px]">
      {/* Left panel */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-extrabold uppercase tracking-wider text-neutral-500">Template colors</div>
        <div className="mt-4 grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-neutral-800">Content background</div>
            <input
              type="color"
              value={value.theme.contentBackground}
              onChange={(e) => setTheme({ contentBackground: e.target.value })}
              className="h-10 w-12 rounded-lg border border-neutral-200 bg-white p-1"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-neutral-800">Border</div>
            <input
              type="color"
              value={value.theme.border}
              onChange={(e) => setTheme({ border: e.target.value })}
              className="h-10 w-12 rounded-lg border border-neutral-200 bg-white p-1"
            />
          </div>
        </div>

        <div className="mt-8 text-sm font-extrabold uppercase tracking-wider text-neutral-500">Add section</div>
        <div className="mt-4 grid gap-2">
          {blockLibrary.map((b) => (
            <button
              key={b.type}
              type="button"
              onClick={() => addBlock(b.type)}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              <div className="flex items-center justify-between gap-3">
                <span>{b.name}</span>
                <span className="text-xs text-neutral-400">Add</span>
              </div>
              <div className="mt-1 text-xs text-neutral-500">{b.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Middle preview */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-bold text-neutral-700">Preview</div>
          <div className="text-xs text-neutral-500">English • LKR</div>
        </div>
        <div className="mx-auto max-w-[520px]">
          <div
            className="overflow-hidden rounded-3xl border shadow-sm"
            style={{ background: value.theme.contentBackground, borderColor: value.theme.border }}
          >
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={value.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col">
                  {value.blocks.map((b) => (
                    <div
                      key={b.id}
                      className={`relative border-b p-6 transition-all ${selectedId === b.id ? 'bg-indigo-50/30' : ''}`}
                      style={{ borderColor: value.theme.border }}
                      onClick={() => setSelectedId(b.id)}
                    >
                      <div className="absolute right-3 top-3 rounded-full border border-neutral-200 bg-white px-2 py-1 text-[10px] font-bold text-neutral-500">
                        {b.type}
                      </div>
                      {renderBlockPreview(b, eventPreview, ticketsPreview)}
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-sm font-bold text-neutral-800">Reorder sections</div>
          <div className="mt-3 flex flex-col gap-2">
            {value.blocks.map((b) => (
              <SortableRow
                key={b.id}
                id={b.id}
                selected={b.id === selectedId}
                label={String(blockLibrary.find((x) => x.type === b.type)?.name || b.type)}
                onSelect={() => setSelectedId(b.id)}
                onDelete={() => deleteBlock(b.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right properties */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-extrabold uppercase tracking-wider text-neutral-500">Section settings</div>
        {!selected ? (
          <div className="mt-4 text-sm text-neutral-500">Select a section to edit.</div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {selected.type === 'hero' && (
              <>
                <Field label="Eyebrow">
                  <input
                    value={selected.props.eyebrow || ''}
                    onChange={(e) => updateSelectedProps({ eyebrow: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Title">
                  <input
                    value={selected.props.title || ''}
                    onChange={(e) => updateSelectedProps({ title: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Subtitle">
                  <textarea
                    rows={4}
                    value={selected.props.subtitle || ''}
                    onChange={(e) => updateSelectedProps({ subtitle: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Image URL">
                  <input
                    value={selected.props.imageUrl || ''}
                    onChange={(e) => updateSelectedProps({ imageUrl: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Alignment">
                  <select
                    value={selected.props.align || 'left'}
                    onChange={(e) => updateSelectedProps({ align: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                  </select>
                </Field>
              </>
            )}

            {selected.type === 'richText' && (
              <>
                <Field label="Title">
                  <input
                    value={selected.props.title || ''}
                    onChange={(e) => updateSelectedProps({ title: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Text">
                  <textarea
                    rows={8}
                    value={selected.props.text || ''}
                    onChange={(e) => updateSelectedProps({ text: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Field>
              </>
            )}

            {selected.type === 'image' && (
              <Field label="Image URL">
                <input
                  value={selected.props.imageUrl || ''}
                  onChange={(e) => updateSelectedProps({ imageUrl: e.target.value })}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              </Field>
            )}

            {selected.type === 'countdown' && (
              <Field label="Title">
                <input
                  value={selected.props.title || ''}
                  onChange={(e) => updateSelectedProps({ title: e.target.value })}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              </Field>
            )}

            {selected.type === 'tickets' && (
              <Field label="Title">
                <input
                  value={selected.props.title || ''}
                  onChange={(e) => updateSelectedProps({ title: e.target.value })}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              </Field>
            )}

            {selected.type === 'speakers' && (
              <>
                <Field label="Title">
                  <input
                    value={selected.props.title || ''}
                    onChange={(e) => updateSelectedProps({ title: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Subtitle">
                  <input
                    value={selected.props.subtitle || ''}
                    onChange={(e) => updateSelectedProps({ subtitle: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Field>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                  This block shows speakers you add in <span className="font-bold">Agenda & Speakers</span>.
                </div>
              </>
            )}

            {selected.type === 'agenda' && (
              <>
                <Field label="Title">
                  <input
                    value={selected.props.title || ''}
                    onChange={(e) => updateSelectedProps({ title: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Subtitle">
                  <input
                    value={selected.props.subtitle || ''}
                    onChange={(e) => updateSelectedProps({ subtitle: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Field>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                  This block shows sessions you add in <span className="font-bold">Agenda & Speakers</span>.
                </div>
              </>
            )}

            {selected.type === 'sponsors' && (
              <>
                <Field label="Title">
                  <input
                    value={selected.props.title || ''}
                    onChange={(e) => updateSelectedProps({ title: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Subtitle">
                  <input
                    value={selected.props.subtitle || ''}
                    onChange={(e) => updateSelectedProps({ subtitle: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Sponsors list (one per line)">
                  <textarea
                    rows={8}
                    value={selected.props.itemsText || ''}
                    onChange={(e) => updateSelectedProps({ itemsText: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    placeholder="Name|LogoURL|LinkURL"
                  />
                </Field>
                <div className="text-xs text-neutral-500">Format: `Name|LogoURL|LinkURL` (LinkURL optional)</div>
              </>
            )}

            {selected.type === 'button' && (
              <>
                <Field label="Text">
                  <input
                    value={selected.props.text || ''}
                    onChange={(e) => updateSelectedProps({ text: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Variant">
                  <select
                    value={selected.props.variant || 'primary'}
                    onChange={(e) => updateSelectedProps({ variant: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  >
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="outline">Outline</option>
                  </select>
                </Field>
              </>
            )}

            {selected.type === 'divider' && (
              <div className="text-sm text-neutral-500">Divider has no settings.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-2">
    <label className="text-sm font-semibold text-neutral-800">{label}</label>
    {children}
  </div>
);

function renderBlockPreview(block: SectionBlock, event: any, tickets: Ticket[]) {
  if (block.type === 'hero') {
    const align = block.props.align === 'center' ? 'text-center items-center' : 'text-left items-start';
    return (
      <div className={`flex flex-col gap-4 ${align}`}>
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">{block.props.eyebrow || 'INTRODUCING'}</div>
        <div className="text-3xl font-black tracking-tight text-neutral-900">{block.props.title || event.title}</div>
        <div className="text-sm leading-relaxed text-neutral-600">{block.props.subtitle || event.description}</div>
        <div className="overflow-hidden rounded-2xl border border-neutral-200">
          <img
            src={block.props.imageUrl || event.bannerUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-44 w-full object-contain object-center bg-neutral-50"
          />
        </div>
      </div>
    );
  }

  if (block.type === 'richText') {
    return (
      <div>
        <div className="text-xl font-extrabold tracking-tight text-neutral-900">{block.props.title || 'Section title'}</div>
        <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-600">{block.props.text || ''}</div>
      </div>
    );
  }

  if (block.type === 'image') {
    return (
      <div className="overflow-hidden rounded-2xl border border-neutral-200">
        <img src={block.props.imageUrl} alt="" referrerPolicy="no-referrer" className="h-56 w-full object-contain object-center bg-neutral-50" />
      </div>
    );
  }

  if (block.type === 'countdown') {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="text-xs font-extrabold uppercase tracking-widest text-neutral-500">{block.props.title || 'Starts in'}</div>
        <div className="mt-2 text-2xl font-black text-neutral-900">12:34:56</div>
      </div>
    );
  }

  if (block.type === 'tickets') {
    return (
      <div>
        <div className="text-xl font-extrabold tracking-tight text-neutral-900">{block.props.title || 'Tickets'}</div>
        <div className="mt-4 flex flex-col gap-3">
          {tickets.slice(0, 2).map((t) => (
            <div key={t.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-neutral-900">{t.name}</div>
                  <div className="mt-1 text-xs text-neutral-500">{formatLKR(t.price)}</div>
                </div>
                <div className="text-xs font-bold text-neutral-400">qty</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === 'speakers') {
    return (
      <div>
        <div className="text-xl font-extrabold tracking-tight text-neutral-900">{block.props.title || 'Speakers'}</div>
        <div className="mt-2 text-sm text-neutral-600">{block.props.subtitle || 'Meet our speakers'}</div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-3">
              <div className="h-10 w-10 rounded-full bg-neutral-100" />
              <div className="mt-3 h-3 w-24 rounded bg-neutral-100" />
              <div className="mt-2 h-3 w-16 rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === 'agenda') {
    return (
      <div>
        <div className="text-xl font-extrabold tracking-tight text-neutral-900">{block.props.title || 'Agenda'}</div>
        <div className="mt-2 text-sm text-neutral-600">{block.props.subtitle || 'Schedule'}</div>
        <div className="mt-4 flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-xs font-extrabold text-neutral-500">10:00 → 10:45</div>
              <div className="mt-2 h-3 w-56 rounded bg-neutral-100" />
              <div className="mt-2 h-3 w-28 rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === 'sponsors') {
    return (
      <div>
        <div className="text-xl font-extrabold tracking-tight text-neutral-900">{block.props.title || 'Sponsors'}</div>
        <div className="mt-2 text-sm text-neutral-600">{block.props.subtitle || ''}</div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex h-16 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-xs font-bold text-neutral-400">
              LOGO
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === 'button') {
    const variant = block.props.variant || 'primary';
    const className =
      variant === 'outline'
        ? 'border border-neutral-300 bg-white text-neutral-900'
        : variant === 'secondary'
          ? 'bg-neutral-900 text-white'
          : 'bg-indigo-600 text-white';
    return (
      <button type="button" className={`w-full rounded-2xl px-5 py-4 text-sm font-extrabold ${className}`}>
        {block.props.text || 'Get Tickets'}
      </button>
    );
  }

  // divider
  return <div className="h-px w-full bg-neutral-200" />;
}

