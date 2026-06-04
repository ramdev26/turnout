import React from 'react';
import type { CheckoutFieldDefinition } from '../../types';

type Props = {
  fields: CheckoutFieldDefinition[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  idPrefix?: string;
  /** Uses checkout sheet field focus ring and spacing */
  variant?: 'default' | 'checkout';
};

export function CheckoutCustomFields({ fields, values, onChange, idPrefix = 'cf', variant = 'default' }: Props) {
  if (fields.length < 1) return null;

  const inputClass =
    variant === 'checkout'
      ? 'landing-checkout-input w-full rounded-xl border px-4 py-3 outline-none'
      : 'landing-checkout-input rounded-xl border px-4 py-3 outline-none focus:ring-2';

  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <label key={field.id} className="flex flex-col gap-1.5">
          <span
            className={variant === 'checkout' ? 'text-xs font-semibold' : 'text-xs font-semibold uppercase tracking-wide'}
            style={{ color: 'var(--landing-text-muted)' }}
          >
            {field.label}
            {field.required ? (
              <span style={{ color: 'var(--landing-accent-readable, var(--primary))' }}> *</span>
            ) : null}
          </span>
          <input
            id={`${idPrefix}-${field.key}`}
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
        </label>
      ))}
    </div>
  );
}
