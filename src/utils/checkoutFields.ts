import type { CheckoutFieldDefinition } from '../types';
import { isCheckoutFieldVisible, normalizeCheckoutFieldsOnly } from './checkoutFieldPresets';

export { buildActiveCheckoutFields, normalizeCheckoutFieldsOnly, normalizeCheckoutPresets } from './checkoutFieldPresets';

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

/** @deprecated Use normalizeCheckoutFieldsOnly for custom fields only */
export function normalizeCheckoutFields(raw: unknown): CheckoutFieldDefinition[] {
  return normalizeCheckoutFieldsOnly(raw);
}

export function validateCustomFieldValues(
  fields: CheckoutFieldDefinition[],
  values: Record<string, string>,
  contextLabel?: string
): string | null {
  for (const field of fields) {
    if (!isCheckoutFieldVisible(field, values)) continue;
    const val = (values[field.key] ?? '').trim();
    if (field.type === 'select' && field.options?.length && val && !field.options.includes(val)) {
      return `${field.label} must be one of the listed options.`;
    }
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
