import React from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { APP_FLOW_UI } from '../flow/FlowPrimitives';
import { TURNOUT_BRAND } from '../../themes/brandColors';
import { cn } from '../../utils/cn';

type AdminSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  refreshing?: boolean;
  'aria-label'?: string;
  className?: string;
};

export const AdminSearchBar: React.FC<AdminSearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search…',
  refreshing = false,
  'aria-label': ariaLabel,
  className,
}) => {
  const ui = APP_FLOW_UI;
  const active = value.trim().length > 0;

  return (
    <div
      className={cn(
        'group rounded-xl border transition-all duration-200',
        'focus-within:shadow-[0_0_0_3px_rgba(192,255,114,0.18)]',
        className,
      )}
      style={{
        background: 'rgba(5, 46, 48, 0.72)',
        borderColor: active ? 'rgba(192, 255, 114, 0.48)' : 'rgba(192, 255, 114, 0.28)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 2px 12px rgba(0, 0, 0, 0.18)',
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <Search
          className="h-[18px] w-[18px] shrink-0"
          style={{ color: active || refreshing ? TURNOUT_BRAND.lime500 : ui.textMuted }}
          aria-hidden
        />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          className={cn(
            'min-w-0 flex-1 appearance-none bg-transparent text-[15px] font-medium outline-none',
            'placeholder:text-[#93B5B7] placeholder:font-normal',
            '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden',
          )}
          style={{ color: ui.text }}
        />
        {refreshing ? (
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin"
            style={{ color: TURNOUT_BRAND.lime500 }}
            aria-label="Searching"
          />
        ) : null}
        {active && !refreshing ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition hover:brightness-110"
            style={{
              borderColor: 'rgba(192, 255, 114, 0.25)',
              background: 'rgba(255, 255, 255, 0.06)',
              color: ui.textMuted,
            }}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
};
