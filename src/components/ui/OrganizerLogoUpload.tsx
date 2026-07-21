import React, { useRef } from 'react';
import { Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import type { CreateThemeUI } from '../../themes/eventThemes';
import { cn } from '../../utils/cn';

type Props = {
  previewUrl?: string;
  disabled?: boolean;
  removing?: boolean;
  canEdit?: boolean;
  ui: CreateThemeUI;
  onFileSelect: (file: File) => void;
  onRemove?: () => void;
};

/** Square logo uploader tuned for organizer settings (dark/light flow UI). */
export function OrganizerLogoUpload({
  previewUrl,
  disabled = false,
  removing = false,
  canEdit = true,
  ui,
  onFileSelect,
  onRemove,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const busy = disabled || removing;

  return (
    <div className="flex w-full max-w-[11rem] flex-col items-stretch gap-3">
      <button
        type="button"
        onClick={() => canEdit && !busy && inputRef.current?.click()}
        disabled={!canEdit || busy}
        className={cn(
          'group relative aspect-square w-full overflow-hidden rounded-2xl border transition',
          canEdit && !busy ? 'cursor-pointer hover:brightness-110' : 'cursor-default'
        )}
        style={{
          borderColor: ui.borderColor,
          background: ui.cardMutedBg,
        }}
        aria-label={previewUrl ? 'Change organization logo' : 'Upload organization logo'}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Organization logo"
            className="h-full w-full object-contain p-3"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
            <div
              className="grid h-11 w-11 place-items-center rounded-full"
              style={{ background: ui.accentSoft, color: ui.accent }}
            >
              <ImagePlus className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold" style={{ color: ui.text }}>
              Add logo
            </p>
            <p className="text-[11px] leading-snug" style={{ color: ui.textMuted }}>
              PNG, JPG, or WEBP
            </p>
          </div>
        )}

        {canEdit ? (
          <span
            className="absolute bottom-2.5 right-2.5 grid h-9 w-9 place-items-center rounded-full shadow-md transition group-hover:scale-105"
            style={{
              background: ui.accent,
              color: ui.accentOn,
              boxShadow: `0 0 0 2px ${ui.cardBg}`,
            }}
          >
            {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </span>
        ) : null}
      </button>

      <div className="space-y-1.5">
        <p className="text-center text-xs font-medium" style={{ color: ui.textMuted }}>
          Organization logo
        </p>
        {canEdit ? (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-60"
              style={{ borderColor: ui.borderColor, color: ui.text, background: ui.cardMutedBg }}
            >
              {disabled ? 'Uploading…' : previewUrl ? 'Change logo' : 'Upload logo'}
            </button>
            {previewUrl && onRemove ? (
              <button
                type="button"
                disabled={busy}
                onClick={onRemove}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-400 disabled:opacity-60 hover:bg-rose-500/10"
              >
                {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {removing ? 'Removing…' : 'Remove'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        disabled={!canEdit || busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
}
