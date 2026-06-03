import React from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import type { CheckoutFieldDefinition } from '../../types';
import { slugifyCheckoutFieldKey } from '../../utils/checkoutFields';
import type { CreateThemeUI } from '../../themes/eventThemes';

type Props = {
  fields: CheckoutFieldDefinition[];
  onChange: (fields: CheckoutFieldDefinition[]) => void;
  ui: CreateThemeUI;
  fieldClass: string;
  fieldStyle: React.CSSProperties;
  cardMutedStyle: React.CSSProperties;
};

function newField(): CheckoutFieldDefinition {
  const key = `field_${Date.now().toString(36)}`;
  return { id: key, label: '', key, required: false };
}

export function CheckoutFieldsEditor({ fields, onChange, ui, fieldClass, fieldStyle, cardMutedStyle }: Props) {
  const update = (id: string, patch: Partial<CheckoutFieldDefinition>) => {
    onChange(
      fields.map((f) => {
        if (f.id !== id) return f;
        const next = { ...f, ...patch };
        if (patch.label !== undefined && (!f.key || f.key.startsWith('field_'))) {
          const slug = slugifyCheckoutFieldKey(patch.label);
          if (slug) next.key = slug;
        }
        return next;
      })
    );
  };

  return (
    <div className="space-y-3">
      {fields.length === 0 ? (
        <p className="text-sm" style={{ color: ui.textMuted }}>
          No extra questions yet. Add fields like NIC, company, or dietary requirements — each ticket holder will answer them at checkout.
        </p>
      ) : null}

      {fields.map((field, index) => (
        <div key={field.id} className="rounded-xl border p-4" style={cardMutedStyle}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
              <GripVertical className="h-3.5 w-3.5 opacity-50" />
              Field {index + 1}
            </span>
            <button
              type="button"
              onClick={() => onChange(fields.filter((f) => f.id !== field.id))}
              className="rounded-lg border border-rose-200 p-1.5 text-rose-600"
              aria-label="Remove field"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs font-semibold" style={{ color: ui.textSubtle }}>
                Question label
              </span>
              <input
                value={field.label}
                onChange={(e) => update(field.id, { label: e.target.value })}
                placeholder="e.g. NIC number"
                className={fieldClass}
                style={fieldStyle}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold" style={{ color: ui.textSubtle }}>
                Field key
              </span>
              <input
                value={field.key}
                onChange={(e) => update(field.id, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                placeholder="nic"
                className={`${fieldClass} font-mono text-sm`}
                style={fieldStyle}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold" style={{ color: ui.textSubtle }}>
                Placeholder (optional)
              </span>
              <input
                value={field.placeholder ?? ''}
                onChange={(e) => update(field.id, { placeholder: e.target.value })}
                placeholder="e.g. 199012345678"
                className={fieldClass}
                style={fieldStyle}
              />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm" style={{ color: ui.text }}>
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => update(field.id, { required: e.target.checked })}
              className="h-4 w-4"
            />
            Required for each ticket holder
          </label>
        </div>
      ))}

      <button
        type="button"
        disabled={fields.length >= 12}
        onClick={() => onChange([...fields, newField()])}
        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-45"
        style={{ ...cardMutedStyle, color: ui.text }}
      >
        <Plus className="h-4 w-4" style={{ color: ui.accent }} />
        Add checkout field
      </button>
    </div>
  );
}
