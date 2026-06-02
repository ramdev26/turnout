import React, { useEffect, useRef, useState } from 'react';
import { isGoogleMapsConfigured, loadGoogleMaps } from '../../lib/loadGoogleMaps';

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

function placeLabel(place: google.maps.places.PlaceResult): string {
  if (place.formatted_address?.trim()) return place.formatted_address.trim();
  const parts = [place.name, place.vicinity].filter((p) => p && String(p).trim());
  if (parts.length) return parts.join(', ');
  return '';
}

/**
 * Location field with Google Places suggestions while typing.
 * Requires `VITE_GOOGLE_MAPS_API_KEY` (Maps JavaScript API + Places API).
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
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const [placesReady, setPlacesReady] = useState(false);
  const [placesError, setPlacesError] = useState(false);
  const configured = isGoogleMapsConfigured();

  onChangeRef.current = onChange;

  useEffect(() => {
    if (!configured || disabled) return;

    let cancelled = false;
    let listener: google.maps.MapsEventListener | undefined;
    let autocomplete: google.maps.places.Autocomplete | undefined;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !inputRef.current) return;
        autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ['formatted_address', 'name', 'vicinity', 'place_id'],
        });
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete?.getPlace();
          if (!place) return;
          const label = placeLabel(place);
          if (label) onChangeRef.current(label);
        });
        setPlacesReady(true);
        setPlacesError(false);
      })
      .catch(() => {
        if (!cancelled) setPlacesError(true);
      });

    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, [configured, disabled]);

  let hintText: string | null = null;
  if (!configured) {
    hintText = 'Add VITE_GOOGLE_MAPS_API_KEY to enable Google location suggestions.';
  } else if (placesError) {
    hintText = 'Google Places unavailable — you can still type the address manually.';
  } else if (placesReady) {
    hintText = 'Start typing to search venues and addresses';
  }

  return (
    <div className="min-w-0 flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className={className}
        style={style}
      />
      {hintText ? (
        <p className={hintClassName} style={hintStyle}>
          {hintText}
        </p>
      ) : null}
    </div>
  );
}
