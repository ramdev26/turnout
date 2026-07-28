import React, { useRef } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { cn } from '../../utils/cn';

type BannerUploadSquareProps = {
  previewUrl?: string;
  disabled?: boolean;
  onFileSelect: (file: File) => void;
  onRemove?: () => void;
  frameClassName?: string;
  placeholderClassName?: string;
};

export function BannerUploadSquare({
  previewUrl,
  disabled = false,
  onFileSelect,
  onRemove,
  frameClassName,
  placeholderClassName,
}: BannerUploadSquareProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="relative h-full min-h-[280px]">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className={cn(
          'relative h-full min-h-[280px] w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 transition',
          disabled ? 'cursor-wait opacity-80' : 'cursor-pointer hover:shadow-sm',
          frameClassName
        )}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="Event banner" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div
            className={cn(
              'flex h-full min-h-[280px] flex-col items-center justify-center gap-2 px-4 text-center',
              placeholderClassName
            )}
          >
            <Camera className="h-8 w-8 text-neutral-800 drop-shadow-sm" />
            <p className="text-sm font-medium">Add cover image</p>
            <p className="text-xs opacity-70">Click to upload</p>
          </div>
        )}
        <span className="absolute bottom-4 right-4 grid h-11 w-11 place-items-center rounded-full border border-white/35 bg-black/70 text-white shadow-md backdrop-blur-sm">
          {disabled ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Camera className="h-4 w-4 text-white" />}
        </span>
        {previewUrl && onRemove ? (
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
            className={cn(
              'absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-rose-700 shadow-sm backdrop-blur-sm transition hover:bg-white',
              disabled && 'pointer-events-none opacity-70'
            )}
            aria-label="Remove cover image"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        ) : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
}
