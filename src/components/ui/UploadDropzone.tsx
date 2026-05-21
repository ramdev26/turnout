import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, UploadCloud } from 'lucide-react';
import { cn } from '../../utils/cn';

type UploadDropzoneProps = {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  previewUrl?: string;
  helperText?: string;
};

export function UploadDropzone({
  onFileSelect,
  disabled = false,
  previewUrl,
  helperText = 'PNG, JPG, WEBP or GIF up to 5MB',
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const pickFile = (file?: File | null) => {
    if (!file || disabled) return;
    onFileSelect(file);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          pickFile(e.dataTransfer.files?.[0] || null);
        }}
        className={cn(
          'w-full rounded-xl border border-dashed p-4 text-left transition',
          disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
          dragActive ? 'border-[#00a95d] bg-[#ecfdf3]' : 'border-neutral-300 bg-white hover:border-[#00a95d]/60'
        )}
      >
        {previewUrl ? (
          <div className="space-y-3">
            <img src={previewUrl} alt="Uploaded banner preview" className="h-36 w-full rounded-lg object-cover" referrerPolicy="no-referrer" />
            <div className="flex items-center gap-2 text-xs font-medium text-[#006f45]">
              <ImagePlus className="h-3.5 w-3.5" />
              Replace image
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {disabled ? <Loader2 className="h-5 w-5 animate-spin text-[#00a95d]" /> : <UploadCloud className="h-5 w-5 text-[#00a95d]" />}
            <div>
              <p className="text-sm font-semibold text-neutral-900">{disabled ? 'Uploading...' : 'Drag & drop banner here'}</p>
              <p className="text-xs text-neutral-500">or click to browse files</p>
            </div>
          </div>
        )}
      </button>
      <p className="text-xs text-neutral-500">{helperText}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          pickFile(e.target.files?.[0] || null);
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
}

