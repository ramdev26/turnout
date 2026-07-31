import React from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import type { CheckoutFieldDefinition, CheckoutFieldOption, CheckoutFieldType } from '../../types';
import { CHECKOUT_FIELD_TYPES, CHECKOUT_FIELD_LABEL_MAX, slugifyCheckoutFieldKey } from '../../utils/checkoutFields';
import type { CreateThemeUI } from '../../themes/eventThemes';
import { TurnoutSelect } from '../ui/TurnoutSelect';

type Props = {
  fields: CheckoutFieldDefinition[];
  onChange: (fields: CheckoutFieldDefinition[]) => void;
  ui: CreateThemeUI;
  fieldClass: string;
  fieldStyle: React.CSSProperties;
  cardMutedStyle: React.CSSProperties;
};

function newOption(): CheckoutFieldOption {
  const id = `opt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  return { id, label: '', value: '' };
}

function newField(): CheckoutFieldDefinition {
  const key = `field_${Date.now().toString(36)}`;
  return { id: key, label: '', key, required: false, type: 'text' };
}

function needsOptions(type: CheckoutFieldType | undefined): boolean {
  return type === 'select' || type === 'radio';
}

function supportsPlaceholder(type: CheckoutFieldType | undefined): boolean {
  return type === 'text' || type === 'textarea' || type === 'number' || !type;
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
        if (patch.type !== undefined) {
          if (needsOptions(patch.type)) {
            next.options = f.options && f.options.length > 0 ? f.options : [newOption(), newOption()];
            next.placeholder = undefined;
          } else {
            next.options = undefined;
          }
        }
        return next;
      })
    );
  };

  const updateOption = (fieldId: string, optionId: string, patch: Partial<CheckoutFieldOption>) => {
    onChange(
      fields.map((f) => {
        if (f.id !== fieldId) return f;
        const options = (f.options || []).map((o) => {
          if (o.id !== optionId) return o;
          const next = { ...o, ...patch };
          if (patch.label !== undefined && (!o.value || o.value.startsWith('opt_'))) {
            const slug = slugifyCheckoutFieldKey(patch.label);
            if (slug) next.value = slug;
          }
          return next;
        });
        return { ...f, options };
      })
    );
  };

  const addOption = (fieldId: string) => {
    onChange(
      fields.map((f) => {
        if (f.id !== fieldId) return f;
        const options = [...(f.options || []), newOption()];
        return { ...f, options: options.slice(0, 24) };
      })
    );
  };

  const removeOption = (fieldId: string, optionId: string) => {
    onChange(
      fields.map((f) => {
        if (f.id !== fieldId) return f;
        return { ...f, options: (f.options || []).filter((o) => o.id !== optionId) };
      })
    );
  };

  return (
    <div className="space-y-3">
      {fields.length === 0 ? (
        <p className="text-sm" style={{ color: ui.textMuted }}>
          No extra questions yet. Add short text, numbers, dropdowns, radio buttons, or long text — each ticket holder
          will answer them at checkout.
        </p>
      ) : null}

      {fields.map((field, index) => {
        const type = field.type || 'text';
        return (
          <div key={field.id} className="rounded-xl border p-4" style={cardMutedStyle}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
                style={{ color: ui.textSubtle }}
              >
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
                <textarea
                  value={field.label}
                  onChange={(e) => update(field.id, { label: e.target.value.slice(0, CHECKOUT_FIELD_LABEL_MAX) })}
                  placeholder="e.g. Do you agree to the event terms?"
                  rows={2}
                  maxLength={CHECKOUT_FIELD_LABEL_MAX}
                  className={fieldClass}
                  style={fieldStyle}
                />
                <span className="text-[11px]" style={{ color: ui.textSubtle }}>
                  {field.label.length}/{CHECKOUT_FIELD_LABEL_MAX} characters
                </span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold" style={{ color: ui.textSubtle }}>
                  Field type
                </span>
                <TurnoutSelect
                  value={type}
                  onChange={(next) => update(field.id, { type: next as CheckoutFieldType })}
                  options={CHECKOUT_FIELD_TYPES.map((t) => ({
                    value: t.id,
                    label: t.label,
                    hint: t.hint,
                  }))}
                  ariaLabel="Field type"
                  tone={ui.isDark ? 'dark' : 'light'}
                  style={fieldStyle}
                  buttonClassName={fieldClass}
                />
                <span className="text-[11px]" style={{ color: ui.textMuted }}>
                  {CHECKOUT_FIELD_TYPES.find((t) => t.id === type)?.hint}
                </span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold" style={{ color: ui.textSubtle }}>
                  Field key
                </span>
                <input
                  value={field.key}
                  onChange={(e) =>
                    update(field.id, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })
                  }
                  placeholder="meal"
                  className={`${fieldClass} font-mono text-sm`}
                  style={fieldStyle}
                />
              </label>
              {supportsPlaceholder(type) ? (
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-xs font-semibold" style={{ color: ui.textSubtle }}>
                    Placeholder (optional)
                  </span>
                  <input
                    value={field.placeholder ?? ''}
                    onChange={(e) => update(field.id, { placeholder: e.target.value })}
                    placeholder={type === 'number' ? 'e.g. 2' : 'e.g. Enter your answer'}
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </label>
              ) : null}
            </div>

            {needsOptions(type) ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                  Options
                </p>
                {(field.options || []).map((opt, optIndex) => (
                  <div key={opt.id} className="flex items-start gap-2">
                    <span className="mt-2.5 w-5 shrink-0 text-center text-xs font-semibold" style={{ color: ui.textMuted }}>
                      {optIndex + 1}
                    </span>
                    <input
                      value={opt.label}
                      onChange={(e) => updateOption(field.id, opt.id, { label: e.target.value })}
                      placeholder="Option label"
                      className={`${fieldClass} flex-1`}
                      style={fieldStyle}
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(field.id, opt.id)}
                      disabled={(field.options || []).length <= 1}
                      className="mt-1 rounded-lg border border-rose-200 p-1.5 text-rose-600 disabled:opacity-40"
                      aria-label="Remove option"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={(field.options || []).length >= 24}
                  onClick={() => addOption(field.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-45"
                  style={{ ...cardMutedStyle, color: ui.text }}
                >
                  <Plus className="h-3.5 w-3.5" style={{ color: ui.accent }} />
                  Add option
                </button>
              </div>
            ) : null}

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
        );
      })}

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
