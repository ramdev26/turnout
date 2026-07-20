import React from 'react';
import type { CheckoutFieldDefinition } from '../../types';
import { resolveCheckoutFieldType } from '../../utils/checkoutFields';

type Props = {
  fields: CheckoutFieldDefinition[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  idPrefix?: string;
};

const inputStyle: React.CSSProperties = {
  borderColor: 'var(--landing-border)',
  background: 'var(--landing-surface-muted)',
  color: 'var(--landing-text)',
};

export function CheckoutCustomFields({ fields, values, onChange, idPrefix = 'cf' }: Props) {
  if (fields.length < 1) return null;

  const setValue = (key: string, value: string) => onChange({ ...values, [key]: value });

  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const type = resolveCheckoutFieldType(field.type);
        const inputId = `${idPrefix}-${field.key}`;
        const value = values[field.key] ?? '';
        const label = (
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
            {field.label}
            {field.required ? ' *' : ''}
          </span>
        );

        if (type === 'textarea') {
          return (
            <label key={field.id} className="flex flex-col gap-1.5">
              {label}
              <textarea
                id={inputId}
                required={field.required}
                rows={3}
                value={value}
                onChange={(e) => setValue(field.key, e.target.value)}
                placeholder={field.placeholder || field.label}
                className="landing-checkout-input rounded-xl border px-4 py-3 outline-none focus:ring-2"
                style={inputStyle}
              />
            </label>
          );
        }

        if (type === 'number') {
          return (
            <label key={field.id} className="flex flex-col gap-1.5">
              {label}
              <input
                id={inputId}
                type="number"
                inputMode="decimal"
                required={field.required}
                value={value}
                onChange={(e) => setValue(field.key, e.target.value)}
                placeholder={field.placeholder || field.label}
                className="landing-checkout-input rounded-xl border px-4 py-3 outline-none focus:ring-2"
                style={inputStyle}
              />
            </label>
          );
        }

        if (type === 'select') {
          return (
            <label key={field.id} className="flex flex-col gap-1.5">
              {label}
              <select
                id={inputId}
                required={field.required}
                value={value}
                onChange={(e) => setValue(field.key, e.target.value)}
                className="landing-checkout-input rounded-xl border px-4 py-3 outline-none focus:ring-2"
                style={inputStyle}
              >
                <option value="">{field.placeholder || 'Select an option'}</option>
                {(field.options || []).map((opt) => (
                  <option key={opt.id} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        if (type === 'radio') {
          return (
            <fieldset key={field.id} className="flex flex-col gap-2">
              <legend className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--landing-text-muted)' }}>
                {field.label}
                {field.required ? ' *' : ''}
              </legend>
              <div className="space-y-2">
                {(field.options || []).map((opt) => {
                  const radioId = `${inputId}-${opt.id}`;
                  return (
                    <label
                      key={opt.id}
                      htmlFor={radioId}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5"
                      style={{
                        borderColor: value === opt.value ? 'var(--landing-accent-readable, var(--primary))' : 'var(--landing-border)',
                        background: 'var(--landing-surface-muted)',
                        color: 'var(--landing-text)',
                      }}
                    >
                      <input
                        id={radioId}
                        type="radio"
                        name={inputId}
                        required={field.required}
                        checked={value === opt.value}
                        onChange={() => setValue(field.key, opt.value)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        }

        return (
          <label key={field.id} className="flex flex-col gap-1.5">
            {label}
            <input
              id={inputId}
              type="text"
              required={field.required}
              value={value}
              onChange={(e) => setValue(field.key, e.target.value)}
              placeholder={field.placeholder || field.label}
              className="landing-checkout-input rounded-xl border px-4 py-3 outline-none focus:ring-2"
              style={inputStyle}
            />
          </label>
        );
      })}
    </div>
  );
}
