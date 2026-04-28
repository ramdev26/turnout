import React from 'react';
import { cn } from '../../utils/cn';

type BaseProps = {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
};

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & BaseProps;
type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & BaseProps;
type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & BaseProps;

const fieldBase =
  'w-full rounded-xl border border-transparent bg-[#f3f4f6] px-3.5 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#00E676]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00E676]/25';

function FieldMeta({ hint, error }: { hint?: string; error?: string }) {
  if (!hint && !error) return null;
  return <p className={cn('mt-1 text-xs', error ? 'text-red-500' : 'text-neutral-500')}>{error || hint}</p>;
}

export function Input({ label, hint, error, wrapperClassName, className, ...props }: InputProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
      {label && <label className="text-sm font-medium text-neutral-700">{label}</label>}
      <input className={cn(fieldBase, className)} {...props} />
      <FieldMeta hint={hint} error={error} />
    </div>
  );
}

export function Textarea({ label, hint, error, wrapperClassName, className, ...props }: TextareaProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
      {label && <label className="text-sm font-medium text-neutral-700">{label}</label>}
      <textarea className={cn(fieldBase, 'min-h-[96px] resize-y', className)} {...props} />
      <FieldMeta hint={hint} error={error} />
    </div>
  );
}

export function Select({ label, hint, error, wrapperClassName, className, children, ...props }: SelectProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
      {label && <label className="text-sm font-medium text-neutral-700">{label}</label>}
      <select className={cn(fieldBase, className)} {...props}>
        {children}
      </select>
      <FieldMeta hint={hint} error={error} />
    </div>
  );
}

