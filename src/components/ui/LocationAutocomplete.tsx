import React, { useEffect, useRef, useState } from 'react';
import { checkGoogleMapsConfigured, loadGoogleMaps } from '../../lib/loadGoogleMaps';

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

function localityFromPlace(place: google.maps.places.PlaceResult): string {
  const components = place.address_components;
  if (components?.length) {
    const locality = components.find((c) => c.types.includes('locality'));
    if (locality?.long_name) return locality.long_name.trim();
    const admin = components.find((c) => c.types.includes('administrative_area_level_1'));
    if (admin?.long_name) return admin.long_name.trim();
  }
  return place.vicinity?.trim() || '';
}

/** Prefer venue/place name (e.g. auditorium) over full street address. */
function placeLabel(place: google.maps.places.PlaceResult): string {
  const name = place.name?.trim();
  const types = new Set(place.types || []);

  if (name && !types.has('street_address') && !types.has('route')) {
    const area = localityFromPlace(place);
    if (area && !name.toLowerCase().includes(area.toLowerCase())) {
      return `${name}, ${area}`;
    }
    return name;
  }

  if (name) {
    return name;
  }

  return place.vicinity?.trim() || place.formatted_address?.trim() || '';
}

/**
 * Location field with Google Places suggestions while typing.
 * Saves venue/place names, not full mailing addresses.
 */
export function LocationAutocomplete({
  value,
  onChange,
  onBlur,
  placeholder = 'Search for a venue or place',
  className = '',
  style,
  disabled = false,
  hintClassName = 'mt-0.5 text-xs',
  hintStyle,
}: LocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [placesReady, setPlacesReady] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    checkGoogleMapsConfigured()
      .then((ok) => {
        if (!cancelled) setConfigured(ok);
      })
      .catch(() => {
        if (!cancelled) setConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!configured || disabled) return;

    let cancelled = false;
    let listener: google.maps.MapsEventListener | undefined;
    let autocomplete: google.maps.places.Autocomplete | undefined;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !inputRef.current) return;
        autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ['name', 'formatted_address', 'vicinity', 'place_id', 'address_components', 'types'],
        });
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete?.getPlace();
          if (!place) return;
          const label = placeLabel(place);
          if (label) onChangeRef.current(label);
        });
        setPlacesReady(true);
        setPlacesError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setPlacesError(err instanceof Error ? err.message : 'Place search unavailable');
        }
      });

    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, [configured, disabled]);

  let hintText: string | null = null;
  if (configured === false) {
    hintText = 'Add VITE_GOOGLE_MAPS_API_KEY (or GOOGLE_MAPS_API_KEY) in deployment env, then redeploy.';
  } else if (placesError) {
    hintText = placesError;
  } else if (placesReady) {
    hintText = 'Search venues and places (e.g. hall, stadium, hotel)';
  } else if (configured) {
    hintText = 'Loading place search…';
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
