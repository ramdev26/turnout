import React from 'react';
import type { CheckoutFieldDefinition } from '../../types';
import { resolveCheckoutFieldType } from '../../utils/checkoutFields';
import { TurnoutSelect } from '../ui/TurnoutSelect';

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
          <span
            className="text-sm font-semibold leading-snug whitespace-normal break-words"
            style={{ color: 'var(--landing-text)' }}
          >
            {field.label}
            {field.required ? <span style={{ color: 'var(--landing-text-muted)' }}> *</span> : null}
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
            <div key={field.id} className="flex flex-col gap-1.5">
              <label htmlFor={inputId}>{label}</label>
              <TurnoutSelect
                id={inputId}
                value={value}
                required={field.required}
                onChange={(next) => setValue(field.key, next)}
                placeholder={field.placeholder || 'Select an option'}
                ariaLabel={field.label}
                tone="light"
                style={inputStyle}
                buttonClassName="landing-checkout-input rounded-xl border px-4 py-3 outline-none focus:ring-2"
                options={(field.options || []).map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
              />
            </div>
          );
        }

        if (type === 'radio') {
          return (
            <fieldset key={field.id} className="flex flex-col gap-2">
              <legend
                className="text-sm font-semibold leading-snug whitespace-normal break-words"
                style={{ color: 'var(--landing-text)' }}
              >
                {field.label}
                {field.required ? <span style={{ color: 'var(--landing-text-muted)' }}> *</span> : null}
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
                        borderColor:
                          value === opt.value
                            ? 'var(--landing-accent-readable, var(--primary))'
                            : 'var(--landing-border)',
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
