import React from 'react';
import { MapPin, Video } from 'lucide-react';
import { LocationAutocomplete } from './LocationAutocomplete';
import type { CreateThemeUI } from '../../themes/eventThemes';
import { accentSegmentStyleFor, fieldClassFor, fieldStyleFor } from '../../themes/flowUi';
import {
  EventLocationMode,
  OnlineEventPlatform,
  ONLINE_EVENT_PLATFORMS,
  isValidMeetingUrl,
} from '../../utils/eventLocation';
import { cn } from '../../utils/cn';

type Props = {
  ui: CreateThemeUI;
  mode: EventLocationMode;
  physicalLocation: string;
  onlinePlatform: OnlineEventPlatform;
  onlineUrl: string;
  locationTba?: boolean;
  onModeChange: (mode: EventLocationMode) => void;
  onPhysicalLocationChange: (value: string) => void;
  onOnlinePlatformChange: (platform: OnlineEventPlatform) => void;
  onOnlineUrlChange: (url: string) => void;
  onLocationTbaChange?: (tba: boolean) => void;
  /** Compact styling for Create Event panels */
  compact?: boolean;
  error?: string | null;
};

export function EventLocationFields({
  ui,
  mode,
  physicalLocation,
  onlinePlatform,
  onlineUrl,
  locationTba = false,
  onModeChange,
  onPhysicalLocationChange,
  onOnlinePlatformChange,
  onOnlineUrlChange,
  onLocationTbaChange,
  compact = false,
  error,
}: Props) {
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);
  const platform = ONLINE_EVENT_PLATFORMS.find((p) => p.id === onlinePlatform) || ONLINE_EVENT_PLATFORMS[0];
  const urlInvalid = !locationTba && mode === 'online' && onlineUrl.trim() !== '' && !isValidMeetingUrl(onlineUrl);
  const supportsTba = typeof onLocationTbaChange === 'function';
  const activeTab: 'physical' | 'online' | 'tba' = locationTba ? 'tba' : mode;

  const selectPhysical = () => {
    onLocationTbaChange?.(false);
    onModeChange('physical');
  };
  const selectOnline = () => {
    onLocationTbaChange?.(false);
    onModeChange('online');
  };
  const selectTba = () => {
    onLocationTbaChange?.(true);
    onModeChange('physical');
  };

  return (
    <div className="space-y-4">
      <div
        className={cn('inline-flex rounded-xl border p-1', compact ? 'w-full sm:w-auto' : '')}
        style={{ borderColor: ui.borderColor, background: ui.cardMutedBg }}
        role="tablist"
        aria-label="Location type"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'physical'}
          onClick={selectPhysical}
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition sm:flex-none'
          )}
          style={accentSegmentStyleFor(ui, activeTab === 'physical')}
        >
          <MapPin className="h-3.5 w-3.5" />
          Physical
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'online'}
          onClick={selectOnline}
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition sm:flex-none'
          )}
          style={accentSegmentStyleFor(ui, activeTab === 'online')}
        >
          <Video className="h-3.5 w-3.5" />
          Online
        </button>
        {supportsTba ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tba'}
            onClick={selectTba}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition sm:flex-none'
            )}
            style={accentSegmentStyleFor(ui, activeTab === 'tba')}
          >
            TBA
          </button>
        ) : null}
      </div>

      {locationTba ? (
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0" style={{ color: ui.textSubtle }} />
          <div>
            <p className="text-sm font-medium" style={{ color: ui.text }}>
              Venue to be announced
            </p>
            <p className="text-xs" style={{ color: ui.textSubtle }}>
              Attendees can reserve now — add the venue whenever you’re ready.
            </p>
          </div>
        </div>
      ) : mode === 'physical' ? (
        <div>
          {compact ? (
            <LocationAutocomplete
              value={physicalLocation}
              onChange={onPhysicalLocationChange}
              placeholder="Search venue or place"
              className="w-full border-0 bg-transparent p-0 text-sm font-medium focus:outline-none"
              style={{ color: ui.text }}
              hintClassName="mt-0.5 text-xs"
              hintStyle={{ color: ui.textSubtle }}
            />
          ) : (
            <LocationAutocomplete
              value={physicalLocation}
              onChange={onPhysicalLocationChange}
              placeholder="Search venue or place"
              className={fieldClass}
              style={fieldStyle}
              hintClassName="mt-2 text-xs"
              hintStyle={{ color: ui.textMuted }}
            />
          )}
          <p className={cn(compact ? 'mt-0.5 text-xs' : 'mt-2 text-xs')} style={{ color: compact ? ui.textSubtle : ui.textMuted }}>
            Venue or place attendees will go to
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: compact ? ui.textSubtle : ui.textMuted }}>
              Platform
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ONLINE_EVENT_PLATFORMS.map((p) => {
                const active = onlinePlatform === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onOnlinePlatformChange(p.id)}
                    className="rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition"
                    style={{
                      borderColor: active ? ui.accent : ui.borderColor,
                      background: active ? ui.accentSoft : ui.cardMutedBg,
                      color: ui.text,
                      boxShadow: active ? `0 0 0 1px ${ui.accent}` : undefined,
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: compact ? ui.textSubtle : ui.textMuted }}>
              Meeting / stream link
            </span>
            <input
              type="url"
              value={onlineUrl}
              onChange={(e) => onOnlineUrlChange(e.target.value)}
              placeholder={platform.placeholder}
              className={compact ? fieldClass : fieldClass}
              style={fieldStyle}
            />
            <p className="text-xs" style={{ color: compact ? ui.textSubtle : ui.textMuted }}>
              Attendees get this {platform.label} link at checkout, plus an email and SMS reminder 15 minutes before
              start.
            </p>
            {urlInvalid ? <p className="text-xs text-rose-500">Enter a valid http(s) link.</p> : null}
          </label>
        </div>
      )}

      {error ? <p className="text-xs text-rose-500">{error}</p> : null}
    </div>
  );
}
