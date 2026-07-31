import type { CheckoutFieldDefinition, CheckoutFieldOption, CheckoutFieldType } from '../types';

export const CHECKOUT_FIELD_TYPES: { id: CheckoutFieldType; label: string; hint: string }[] = [
  { id: 'text', label: 'Short text', hint: 'Single-line answer' },
  { id: 'textarea', label: 'Long text', hint: 'Multi-line answer' },
  { id: 'number', label: 'Number', hint: 'Numeric value' },
  { id: 'select', label: 'Dropdown', hint: 'Pick one from a list' },
  { id: 'radio', label: 'Radio buttons', hint: 'Pick one option' },
];

/** Full consent / policy questions need more than a short field title. */
export const CHECKOUT_FIELD_LABEL_MAX = 240;
export const CHECKOUT_FIELD_OPTION_LABEL_MAX = 120;

const ALLOWED_TYPES = new Set<CheckoutFieldType>(['text', 'textarea', 'number', 'select', 'radio']);

export function slugifyCheckoutFieldKey(label: string): string {
  const base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  if (!base) return 'field';
  return /^[a-z]/.test(base) ? base : `f_${base}`;
}

export function resolveCheckoutFieldType(raw: unknown): CheckoutFieldType {
  const t = String(raw ?? 'text').trim().toLowerCase();
  return ALLOWED_TYPES.has(t as CheckoutFieldType) ? (t as CheckoutFieldType) : 'text';
}

function normalizeCheckoutFieldOptions(raw: unknown): CheckoutFieldOption[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const out: CheckoutFieldOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Partial<CheckoutFieldOption>;
    const label = String(row.label ?? '').trim().slice(0, CHECKOUT_FIELD_OPTION_LABEL_MAX);
    let value = String(row.value ?? '').trim().slice(0, 80);
    if (!label) continue;
    if (!value) value = slugifyCheckoutFieldKey(label);
    if (seen.has(value)) continue;
    seen.add(value);
    out.push({
      id: String(row.id ?? `opt_${value}`).slice(0, 64),
      label,
      value,
    });
    if (out.length >= 24) break;
  }
  return out.length > 0 ? out : undefined;
}

export function normalizeCheckoutFields(raw: unknown): CheckoutFieldDefinition[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CheckoutFieldDefinition[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Partial<CheckoutFieldDefinition>;
    const label = String(row.label ?? '').trim();
    let key = String(row.key ?? '').trim().toLowerCase();
    if (!key && label) key = slugifyCheckoutFieldKey(label);
    if (!label || !/^[a-z][a-z0-9_]{0,31}$/.test(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    const type = resolveCheckoutFieldType(row.type);
    const needsOptions = type === 'select' || type === 'radio';
    const options = needsOptions ? normalizeCheckoutFieldOptions(row.options) : undefined;
    if (needsOptions && (!options || options.length < 1)) continue;
    const def: CheckoutFieldDefinition = {
      id: String(row.id ?? `cf_${key}`),
      label: label.slice(0, CHECKOUT_FIELD_LABEL_MAX),
      key,
      required: !!row.required,
      type,
    };
    if (type === 'text' || type === 'textarea' || type === 'number') {
      if (row.placeholder) def.placeholder = String(row.placeholder).slice(0, 120);
    }
    if (options) def.options = options;
    out.push(def);
    if (out.length >= 12) break;
  }
  return out;
}

export function validateCustomFieldValues(
  fields: CheckoutFieldDefinition[],
  values: Record<string, string>,
  contextLabel?: string
): string | null {
  for (const field of fields) {
    const type = resolveCheckoutFieldType(field.type);
    const val = (values[field.key] ?? '').trim();
    if (field.required && !val) {
      return contextLabel
        ? `${field.label} is required for ${contextLabel}.`
        : `${field.label} is required.`;
    }
    if (!val) continue;

    const maxLen = type === 'textarea' ? 2000 : 200;
    if (val.length > maxLen) {
      return `${field.label} must be ${maxLen} characters or fewer.`;
    }

    if (type === 'number' && !/^-?\d+(\.\d+)?$/.test(val)) {
      return `${field.label} must be a valid number.`;
    }

    if ((type === 'select' || type === 'radio') && field.options?.length) {
      const allowed = new Set(field.options.map((o) => o.value));
      if (!allowed.has(val)) {
        return `Please choose a valid option for ${field.label}.`;
      }
    }
  }
  return null;
}

/** Resolve stored custom-field values for organizer display (option labels when available). */
export function formatCustomFieldDisplayValue(
  field: CheckoutFieldDefinition | undefined,
  raw: string | undefined | null
): string {
  const val = String(raw ?? '').trim();
  if (!val) return '—';
  if (!field) return val;
  const type = resolveCheckoutFieldType(field.type);
  if ((type === 'select' || type === 'radio') && field.options?.length) {
    const match = field.options.find((o) => o.value === val || o.label === val);
    if (match) return match.label;
  }
  return val;
}

export function humanizeCustomFieldKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || key;
}
