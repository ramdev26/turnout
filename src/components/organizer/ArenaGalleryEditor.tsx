import React, { useRef } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { cn } from '../../utils/cn';

type ArenaGalleryEditorProps = {
  images: string[];
  title?: string;
  description?: string;
  emptyText?: string;
  disabled?: boolean;
  uploading?: boolean;
  onUpload: (file: File) => void | Promise<void>;
  onRemove: (index: number) => void;
  ui: {
    borderColor: string;
    text: string;
    textMuted: string;
    textSubtle: string;
    cardBg: string;
  };
};

export function ArenaGalleryEditor({
  images,
  title = 'Event gallery',
  description = 'Cover image is image 1. Add venue maps, seating charts, or more posters.',
  emptyText = 'No extra images yet — add more visuals to showcase your event.',
  disabled = false,
  uploading = false,
  onUpload,
  onRemove,
  ui,
}: ArenaGalleryEditorProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canAdd = images.length < 8;

  return (
    <div className="rounded-xl border p-3.5" style={{ borderColor: ui.borderColor, background: ui.cardBg }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
            {title}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: ui.textMuted }}>
            {description}
          </p>
        </div>
        {canAdd ? (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
            style={{ borderColor: ui.borderColor, color: ui.text }}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            Add image
          </button>
        ) : null}
      </div>

      {images.length > 0 ? (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {images.map((url, index) => (
            <li key={`${url}-${index}`} className="group relative aspect-[4/5] overflow-hidden rounded-lg border" style={{ borderColor: ui.borderColor }}>
              <img src={url} alt="" className="h-full w-full object-contain bg-black/5" referrerPolicy="no-referrer" />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(index)}
                className={cn(
                  'absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-md border bg-black/55 text-white opacity-0 transition group-hover:opacity-100',
                  disabled && 'pointer-events-none opacity-40',
                )}
                aria-label="Remove image"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <span
                className="absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                style={{ background: 'rgba(0,0,0,0.55)' }}
              >
                Slide {index + 2}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs" style={{ color: ui.textMuted }}>
          {emptyText}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        disabled={disabled || uploading || !canAdd}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onUpload(file);
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
}
