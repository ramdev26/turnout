import React from 'react';
import type { CheckoutFieldDefinition } from '../../types';
import { isCheckoutFieldVisible } from '../../utils/checkoutFieldPresets';

type Props = {
  fields: CheckoutFieldDefinition[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  idPrefix?: string;
  /** Uses checkout sheet field focus ring and spacing */
  variant?: 'default' | 'checkout';
};

export function CheckoutCustomFields({ fields, values, onChange, idPrefix = 'cf', variant = 'default' }: Props) {
  const visible = fields.filter((f) => isCheckoutFieldVisible(f, values));
  if (visible.length < 1) return null;

  const inputClass =
    variant === 'checkout'
      ? 'landing-checkout-input w-full rounded-xl border px-4 py-3 outline-none'
      : 'landing-checkout-input rounded-xl border px-4 py-3 outline-none focus:ring-2';

  const labelClass =
    variant === 'checkout' ? 'text-xs font-semibold' : 'text-xs font-semibold uppercase tracking-wide';

  return (
    <div className="space-y-3">
      {visible.map((field) => (
        <label key={field.id} className="flex flex-col gap-1.5">
          <span className={labelClass} style={{ color: 'var(--landing-text-muted)' }}>
            {field.label}
            {field.required ? (
              <span style={{ color: 'var(--landing-accent-readable, var(--primary))' }}> *</span>
            ) : null}
          </span>
          {field.type === 'select' && field.options?.length ? (
            <select
              id={`${idPrefix}-${field.key}`}
              required={field.required}
              value={values[field.key] ?? ''}
              onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
              className={inputClass}
              style={{
                borderColor: 'var(--landing-border)',
                background: variant === 'checkout' ? 'var(--landing-surface)' : 'var(--landing-surface-muted)',
                color: 'var(--landing-text)',
              }}
            >
              <option value="">Select…</option>
              {field.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`${idPrefix}-${field.key}`}
              type={field.type === 'date' ? 'date' : field.type === 'tel' ? 'tel' : 'text'}
              required={field.required}
              value={values[field.key] ?? ''}
              onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
              placeholder={field.placeholder || field.label}
              className={inputClass}
              style={{
                borderColor: 'var(--landing-border)',
                background: variant === 'checkout' ? 'var(--landing-surface)' : 'var(--landing-surface-muted)',
                color: 'var(--landing-text)',
              }}
            />
          )}
        </label>
      ))}
    </div>
  );
}
