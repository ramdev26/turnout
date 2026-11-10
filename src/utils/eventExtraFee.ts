import type { Event, EventCustomization, EventExtraFee } from '../types';

export const DEFAULT_EVENT_EXTRA_FEE: EventExtraFee = {
  enabled: false,
  label: 'Tax',
  type: 'percent',
  value: 0,
};

export function normalizeEventExtraFee(raw?: Partial<EventExtraFee> | null): EventExtraFee {
  const label = (raw?.label || 'Tax').trim().slice(0, 60) || 'Tax';
  const type = raw?.type === 'fixed' ? 'fixed' : 'percent';
  let value = Number(raw?.value ?? 0);
  if (!Number.isFinite(value) || value < 0) value = 0;
  if (type === 'percent') {
    if (value > 100) value = 100;
    value = Math.round(value * 100) / 100;
  } else {
    if (value > 1_000_000) value = 1_000_000;
    value = Math.round(value * 100) / 100;
  }
  const enabled = Boolean(raw?.enabled) && value > 0;
  return { enabled, label, type, value };
}

export function eventExtraFeeFromCustomization(
  customization?: EventCustomization | null
): EventExtraFee {
  return normalizeEventExtraFee(customization?.extraFee ?? null);
}

export function eventExtraFeeFromEvent(event?: Event | null): EventExtraFee {
  return eventExtraFeeFromCustomization(event?.customization);
}

/** Fee in LKR on a post-discount subtotal (LKR). */
export function computeEventExtraFeeLkr(subtotalLkr: number, fee: EventExtraFee | null | undefined): number {
  const config = normalizeEventExtraFee(fee);
  const base = Math.max(0, Number(subtotalLkr) || 0);
  if (!config.enabled || base <= 0 || config.value <= 0) return 0;
  if (config.type === 'fixed') {
    return Math.round(config.value * 100) / 100;
  }
  return Math.round(base * (config.value / 100) * 100) / 100;
}

export function formatEventExtraFeeHint(fee: EventExtraFee): string {
  const config = normalizeEventExtraFee(fee);
  if (!config.enabled) return 'Off';
  if (config.type === 'fixed') {
    return `${config.label} · LKR ${config.value.toLocaleString('en-LK')}`;
  }
  return `${config.label} · ${config.value}%`;
}
