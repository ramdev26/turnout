import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../utils/cn';

export type WizardStep = {
  id: string;
  title: string;
  description?: string;
};

type WizardStepperProps = {
  steps: WizardStep[];
  currentStep: number;
  onStepClick?: (index: number) => void;
};

export function WizardStepper({ steps, currentStep, onStepClick }: WizardStepperProps) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        {steps.map((step, index) => {
          const done = index < currentStep;
          const active = index === currentStep;
          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => onStepClick?.(index)}
                className={cn(
                  'group inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-all',
                  done && 'border-[#00a95d] bg-[#00a95d] text-white',
                  active && 'border-[#00a95d] bg-[#ecfdf3] text-[#006f45]',
                  !done && !active && 'border-neutral-300 bg-white text-neutral-500'
                )}
                aria-current={active ? 'step' : undefined}
                aria-label={`Step ${index + 1}: ${step.title}`}
              >
                {done ? <Check className="h-4 w-4" /> : index + 1}
              </button>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'h-[2px] flex-1 rounded-full transition-colors',
                    index < currentStep ? 'bg-[#00a95d]' : 'bg-neutral-200'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {steps.map((step, index) => (
          <div key={step.id} className="min-w-0">
            <p
              className={cn(
                'truncate text-xs font-semibold',
                index === currentStep ? 'text-[#006f45]' : 'text-neutral-600'
              )}
              title={step.title}
            >
              {step.title}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

