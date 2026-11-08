import React, { useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { EVENT_IMAGE_ACCEPT, EVENT_IMAGE_HELPER_TEXT, type EventImageLayoutHint } from '../../utils/eventImageUpload';

type BannerUploadSquareProps = {
  previewUrl?: string;
  disabled?: boolean;
  onFileSelect: (file: File) => void;
  frameClassName?: string;
  placeholderClassName?: string;
  helperText?: string;
  sizeHint?: EventImageLayoutHint | null;
};

export function BannerUploadSquare({
  previewUrl,
  disabled = false,
  onFileSelect,
  frameClassName,
  placeholderClassName,
  helperText = EVENT_IMAGE_HELPER_TEXT,
  sizeHint = null,
}: BannerUploadSquareProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-2">
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
              <Camera className="h-8 w-8 opacity-60" />
              <p className="text-sm font-medium">Add cover image</p>
              <p className="text-xs opacity-70">PNG, JPG, WEBP, or GIF</p>
            </div>
          )}
          <span className="absolute bottom-4 right-4 grid h-11 w-11 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-800 shadow-md">
            {disabled ? <Loader2 className="h-4 w-4 animate-spin text-neutral-500" /> : <Camera className="h-4 w-4" />}
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={EVENT_IMAGE_ACCEPT}
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelect(file);
            e.currentTarget.value = '';
          }}
        />
      </div>
      {sizeHint ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          <p className="font-semibold text-neutral-800">{sizeHint.label}</p>
          <p className="mt-0.5 opacity-80">{sizeHint.detail}</p>
        </div>
      ) : null}
      {helperText ? <p className="text-xs text-neutral-500">{helperText}</p> : null}
    </div>
  );
}
