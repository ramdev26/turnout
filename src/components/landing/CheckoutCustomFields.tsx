import React from 'react';
import type { CheckoutFieldDefinition } from '../../types';

type Props = {
  fields: CheckoutFieldDefinition[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  idPrefix?: string;
};

export function CheckoutCustomFields({ fields, values, onChange, idPrefix = 'cf' }: Props) {
  if (fields.length < 1) return null;

  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <label key={field.id} className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
            {field.label}
            {field.required ? ' *' : ''}
          </span>
          <input
            id={`${idPrefix}-${field.key}`}
            required={field.required}
            value={values[field.key] ?? ''}
            onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
            placeholder={field.placeholder || field.label}
            className="landing-checkout-input rounded-xl border px-4 py-3 outline-none focus:ring-2"
            style={{
              borderColor: 'var(--landing-border)',
              background: 'var(--landing-surface-muted)',
              color: 'var(--landing-text)',
            }}
          />
        </label>
      ))}
    </div>
  );
}
