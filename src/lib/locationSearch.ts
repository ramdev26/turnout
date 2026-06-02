/** Free geocoding via Komoot Photon (OpenStreetMap data). No API key required. */

export type LocationSuggestion = {
  id: string;
  label: string;
};

type PhotonFeature = {
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

function formatPhotonLabel(props: NonNullable<PhotonFeature['properties']>): string {
  const line1 =
    props.housenumber && props.street
      ? `${props.housenumber} ${props.street}`
      : props.street || props.name || '';
  const locality = [props.city, props.state, props.postcode].filter(Boolean).join(' ');
  const tail = [locality, props.country].filter(Boolean).join(', ');
  if (line1 && tail) return `${line1}, ${tail}`;
  return line1 || tail || props.name || '';
}

export async function searchLocations(query: string, signal?: AbortSignal): Promise<LocationSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '8');
  url.searchParams.set('lang', 'en');

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error('Location search failed');

  const data = (await res.json()) as PhotonResponse;
  const seen = new Set<string>();

  return (data.features || [])
    .map((feature, index) => {
      const props = feature.properties || {};
      const label = formatPhotonLabel(props).trim();
      if (!label || seen.has(label)) return null;
      seen.add(label);
      return { id: `${label}-${index}`, label };
    })
    .filter((item): item is LocationSuggestion => item !== null);
}
