import React, { useEffect, useId, useRef, useState } from 'react';
import { searchLocations, type LocationSuggestion } from '../../lib/locationSearch';
import { cn } from '../../utils/cn';

export type LocationAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  hintClassName?: string;
  hintStyle?: React.CSSProperties;
};

const SEARCH_DEBOUNCE_MS = 320;

/**
 * Location field with address suggestions while typing (OpenStreetMap via Photon).
 * No Google Cloud account or API key required.
 */
export function LocationAutocomplete({
  value,
  onChange,
  onBlur,
  placeholder = 'Add event location',
  className = '',
  style,
  disabled = false,
  hintClassName = 'mt-0.5 text-xs',
  hintStyle,
}: LocationAutocompleteProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (disabled || value.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(false);
      searchLocations(value, controller.signal)
        .then((results) => {
          setSuggestions(results);
          setOpen(results.length > 0);
          setActiveIndex(-1);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setSuggestions([]);
          setOpen(false);
          setError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value, disabled]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const pickSuggestion = (label: string) => {
    onChange(label);
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pickSuggestion(suggestions[activeIndex].label);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && suggestions.length > 0;

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          window.setTimeout(() => onBlur?.(), 150);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        className={className}
        style={style}
      />

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[10050] mt-1 max-h-56 overflow-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-white/15 dark:bg-neutral-900"
        >
          {suggestions.map((item, index) => (
            <li key={item.id} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={cn(
                  'w-full px-3 py-2.5 text-left text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-white/10',
                  index === activeIndex && 'bg-neutral-100 dark:bg-white/10'
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickSuggestion(item.label)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className={hintClassName} style={hintStyle}>
        {error
          ? 'Suggestions unavailable — you can still type the address manually.'
          : loading
            ? 'Searching…'
            : 'Start typing to search venues and addresses (no setup required)'}
      </p>
    </div>
  );
}
