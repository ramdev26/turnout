import React from 'react';
import { cn } from '../../utils/cn';

export function FlowToggle({
  checked,
  onChange,
  label,
  accent,
  offColor,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  accent: string;
  offColor: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative h-7 w-12 shrink-0 rounded-full transition"
      style={{ backgroundColor: checked ? accent : offColor }}
    >
      <span
        className={cn(
          'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition',
          checked ? 'left-6' : 'left-1'
        )}
      />
    </button>
  );
}
