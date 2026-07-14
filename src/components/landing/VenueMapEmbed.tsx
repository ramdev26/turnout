import React, { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { resolveGoogleMapsApiKey } from '../../lib/loadGoogleMaps';

type VenueMapEmbedProps = {
  query?: string | null;
  title?: string;
  className?: string;
  /** Shown when no location query is available */
  emptyLabel?: string;
};

/**
 * Embedded Google Map for venue/location sections.
 * Prefers Maps Embed API when a key is available; falls back to keyless embed.
 */
export const VenueMapEmbed: React.FC<VenueMapEmbedProps> = ({
  query,
  title = 'Event venue map',
  className = '',
  emptyLabel = 'Venue to be announced',
}) => {
  const trimmed = query?.trim() || '';
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setSrc(null);

    if (!trimmed) return;

    (async () => {
      const key = await resolveGoogleMapsApiKey();
      if (cancelled) return;
      if (key) {
        setSrc(
          `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(trimmed)}`
        );
        return;
      }
      setSrc(`https://www.google.com/maps?q=${encodeURIComponent(trimmed)}&hl=en&z=15&output=embed`);
    })().catch(() => {
      if (!cancelled) {
        setSrc(`https://www.google.com/maps?q=${encodeURIComponent(trimmed)}&hl=en&z=15&output=embed`);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [trimmed]);

  if (!trimmed) {
    return (
      <div className={`venue-map venue-map--empty ${className}`.trim()} role="img" aria-label={emptyLabel}>
        <div className="venue-map-fallback">
          <MapPin className="h-5 w-5" />
          <span>{emptyLabel}</span>
        </div>
      </div>
    );
  }

  if (failed || !src) {
    return (
      <div className={`venue-map ${!src ? 'venue-map--loading' : 'venue-map--failed'} ${className}`.trim()}>
        <div className="venue-map-fallback">
          <MapPin className="h-5 w-5" />
          <span>{!src ? 'Loading map…' : trimmed}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`venue-map ${className}`.trim()}>
      <iframe
        title={title}
        src={src}
        className="venue-map-frame"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        onError={() => setFailed(true)}
      />
    </div>
  );
};
