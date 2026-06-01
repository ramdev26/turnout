import React from 'react';
import { cn } from '../../utils/cn';
import { Check } from 'lucide-react';

type WizardStepperProps = {
  steps: string[];
  currentStep: number;
};

export function WizardStepper({ steps, currentStep }: WizardStepperProps) {
  return (
    <ol className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {steps.map((label, index) => {
        const done = index < currentStep;
        const active = index === currentStep;
        return (
          <li key={label} className="flex flex-1 items-center gap-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm font-semibold transition',
                  done && 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-on)]',
                  active && 'border-[var(--primary)] bg-[var(--app-surface)] text-[var(--primary)]',
                  !done && !active && 'border-[var(--border)] bg-[var(--app-surface-muted)] text-[var(--text-muted)]'
                )}
              >
                {done ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <div className="hidden min-w-0 sm:block">
                <div
                  className={cn(
                    'h-0.5 w-12 rounded-full',
                    index < currentStep ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
                  )}
                />
              </div>
            </div>
            <span
              className={cn(
                'text-sm font-medium',
                index === currentStep ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
