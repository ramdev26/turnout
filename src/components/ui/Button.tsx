import React from 'react';
import { cn } from '../../utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-[color-mix(in_srgb,var(--primary)_35%,transparent)] bg-[var(--primary)] text-[var(--primary-on)] shadow-[0_8px_20px_var(--glow)] hover:-translate-y-0.5 hover:bg-[var(--primary-hover)] hover:shadow-[0_12px_24px_var(--glow)]',
  secondary:
    'border border-[var(--border)] bg-[var(--app-surface)] text-[var(--text)] hover:bg-[var(--app-surface-muted)]',
  ghost:
    'border border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--text)]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
});
