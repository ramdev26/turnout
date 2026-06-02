import React, { useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

type BannerUploadSquareProps = {
  previewUrl?: string;
  disabled?: boolean;
  onFileSelect: (file: File) => void;
  frameClassName?: string;
  placeholderClassName?: string;
};

export function BannerUploadSquare({
  previewUrl,
  disabled = false,
  onFileSelect,
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
          <img src={previewUrl} alt="Event banner" className="h-full w-full object-contain object-center" referrerPolicy="no-referrer" />
        ) : (
          <div
            className={cn(
              'flex h-full min-h-[280px] flex-col items-center justify-center gap-2 px-4 text-center',
              placeholderClassName
            )}
          >
            <Camera className="h-8 w-8 opacity-60" />
            <p className="text-sm font-medium">Add cover image</p>
            <p className="text-xs opacity-70">Click to upload</p>
          </div>
        )}
        <span className="absolute bottom-4 right-4 grid h-11 w-11 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-800 shadow-md">
          {disabled ? <Loader2 className="h-4 w-4 animate-spin text-neutral-500" /> : <Camera className="h-4 w-4" />}
        </span>
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
