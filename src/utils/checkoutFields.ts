import type { CheckoutFieldDefinition } from '../types';

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
    out.push({
      id: String(row.id ?? `cf_${key}`),
      label: label.slice(0, 80),
      key,
      required: !!row.required,
      placeholder: row.placeholder ? String(row.placeholder).slice(0, 120) : undefined,
    });
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
    const val = (values[field.key] ?? '').trim();
    if (field.required && !val) {
      return contextLabel
        ? `${field.label} is required for ${contextLabel}.`
        : `${field.label} is required.`;
    }
    if (val.length > 200) {
      return `${field.label} must be 200 characters or fewer.`;
    }
  }
  return null;
}
