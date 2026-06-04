import type { CheckoutFieldDefinition, CheckoutFieldPresetsConfig, EventCustomization } from '../types';

export type CheckoutPresetId =
  | 'dateOfBirth'
  | 'emergencyContactName'
  | 'emergencyContactPhone'
  | 'duprRating'
  | 'eventCategory'
  | 'partnerName'
  | 'partnerPhone';

export const CHECKOUT_PRESET_IDS: CheckoutPresetId[] = [
  'dateOfBirth',
  'emergencyContactName',
  'emergencyContactPhone',
  'duprRating',
  'eventCategory',
  'partnerName',
  'partnerPhone',
];

export const CHECKOUT_PRESET_LABELS: Record<CheckoutPresetId, string> = {
  dateOfBirth: 'Date of birth',
  emergencyContactName: 'Emergency contact name',
  emergencyContactPhone: 'Emergency contact number',
  duprRating: 'DUPR rating (if available)',
  eventCategory: 'Event category (dropdown)',
  partnerName: 'Partner name',
  partnerPhone: "Partner's contact number",
};

export const DEFAULT_CHECKOUT_PRESETS: CheckoutFieldPresetsConfig = {
  dateOfBirth: false,
  emergencyContactName: false,
  emergencyContactPhone: false,
  duprRating: false,
  eventCategory: false,
  partnerName: false,
  partnerPhone: false,
  eventCategoryOptions: [],
  doublesCategoryValues: [],
};

export function normalizeCheckoutPresets(raw: unknown): CheckoutFieldPresetsConfig {
  const base = { ...DEFAULT_CHECKOUT_PRESETS };
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Partial<CheckoutFieldPresetsConfig>;
  for (const id of CHECKOUT_PRESET_IDS) {
    if (typeof row[id] === 'boolean') base[id] = row[id];
  }
  if (Array.isArray(row.eventCategoryOptions)) {
    base.eventCategoryOptions = row.eventCategoryOptions
      .map((o) => String(o).trim())
      .filter(Boolean)
      .slice(0, 24);
  }
  if (Array.isArray(row.doublesCategoryValues)) {
    base.doublesCategoryValues = row.doublesCategoryValues
      .map((o) => String(o).trim())
      .filter(Boolean)
      .slice(0, 24);
  }
  return base;
}

function presetFieldDefinitions(presets: CheckoutFieldPresetsConfig): CheckoutFieldDefinition[] {
  const doublesValues =
    presets.doublesCategoryValues.length > 0
      ? presets.doublesCategoryValues
      : presets.eventCategoryOptions.filter((o) => /double/i.test(o));

  const showWhenDoubles =
    doublesValues.length > 0 ? { fieldKey: 'event_category', values: doublesValues } : undefined;

  const built: CheckoutFieldDefinition[] = [];

  if (presets.dateOfBirth) {
    built.push({
      id: 'preset_date_of_birth',
      key: 'date_of_birth',
      label: 'Date of birth',
      type: 'date',
      required: true,
    });
  }
  if (presets.emergencyContactName) {
    built.push({
      id: 'preset_emergency_contact_name',
      key: 'emergency_contact_name',
      label: 'Emergency contact name',
      type: 'text',
      required: true,
      placeholder: 'Full name',
    });
  }
  if (presets.emergencyContactPhone) {
    built.push({
      id: 'preset_emergency_contact_phone',
      key: 'emergency_contact_phone',
      label: 'Emergency contact number',
      type: 'tel',
      required: true,
      placeholder: '+94 …',
    });
  }
  if (presets.duprRating) {
    built.push({
      id: 'preset_dupr_rating',
      key: 'dupr_rating',
      label: 'DUPR rating (if available)',
      type: 'text',
      required: false,
      placeholder: 'e.g. 4.25',
    });
  }
  if (presets.eventCategory && presets.eventCategoryOptions.length > 0) {
    built.push({
      id: 'preset_event_category',
      key: 'event_category',
      label: 'Event category',
      type: 'select',
      required: true,
      options: presets.eventCategoryOptions,
    });
  }
  if (presets.partnerName && showWhenDoubles) {
    built.push({
      id: 'preset_partner_name',
      key: 'partner_name',
      label: 'Partner name',
      type: 'text',
      required: true,
      showWhen: showWhenDoubles,
    });
  }
  if (presets.partnerPhone && showWhenDoubles) {
    built.push({
      id: 'preset_partner_phone',
      key: 'partner_phone',
      label: "Partner's contact number",
      type: 'tel',
      required: true,
      showWhen: showWhenDoubles,
    });
  }

  return built;
}

/** Preset + custom organizer fields for checkout. */
export function buildActiveCheckoutFields(customization: EventCustomization | undefined): CheckoutFieldDefinition[] {
  const presets = normalizeCheckoutPresets(customization?.checkoutFieldPresets);
  const presetFields = presetFieldDefinitions(presets);
  const custom = normalizeCheckoutFieldsOnly(customization?.checkoutFields);
  const seen = new Set(presetFields.map((f) => f.key));
  const merged = [...presetFields];
  for (const f of custom) {
    if (seen.has(f.key)) continue;
    seen.add(f.key);
    merged.push(f);
  }
  return merged.slice(0, 20);
}

/** Custom fields only (no presets). */
export function normalizeCheckoutFieldsOnly(raw: unknown): CheckoutFieldDefinition[] {
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
    const type = row.type === 'date' || row.type === 'tel' || row.type === 'select' ? row.type : 'text';
    const field: CheckoutFieldDefinition = {
      id: String(row.id ?? `cf_${key}`),
      label: label.slice(0, 80),
      key,
      required: !!row.required,
      type,
      placeholder: row.placeholder ? String(row.placeholder).slice(0, 120) : undefined,
    };
    if (type === 'select' && Array.isArray(row.options)) {
      field.options = row.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 24);
      if (field.options.length < 1) continue;
    }
    if (row.showWhen?.fieldKey && Array.isArray(row.showWhen.values) && row.showWhen.values.length > 0) {
      field.showWhen = {
        fieldKey: String(row.showWhen.fieldKey).toLowerCase(),
        values: row.showWhen.values.map((v) => String(v).trim()).filter(Boolean),
      };
    }
    out.push(field);
    if (out.length >= 12) break;
  }
  return out;
}

function slugifyCheckoutFieldKey(label: string): string {
  const base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  if (!base) return 'field';
  return /^[a-z]/.test(base) ? base : `f_${base}`;
}

export function isCheckoutFieldVisible(
  field: CheckoutFieldDefinition,
  values: Record<string, string>
): boolean {
  if (!field.showWhen) return true;
  const current = (values[field.showWhen.fieldKey] ?? '').trim();
  return field.showWhen.values.some((v) => v === current);
}

export function visibleCheckoutFields(
  fields: CheckoutFieldDefinition[],
  values: Record<string, string>
): CheckoutFieldDefinition[] {
  return fields.filter((f) => isCheckoutFieldVisible(f, values));
}
