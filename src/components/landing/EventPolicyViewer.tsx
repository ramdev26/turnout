import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X } from 'lucide-react';
import { resolveEventPolicyHtml } from '../../utils/eventPolicy';

type Props = {
  html?: string | null;
  open: boolean;
  onClose: () => void;
  title?: string;
};

export function EventPolicyViewerModal({
  html,
  open,
  onClose,
  title = 'Event policy',
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const content =
    typeof html === 'string' && html.trim()
      ? html.trim()
      : resolveEventPolicyHtml(html);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Close policy" className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[min(88vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:rounded-2xl"
        style={{
          borderColor: 'var(--landing-border)',
          background: 'var(--landing-surface)',
          color: 'var(--landing-text)',
        }}
      >
        <div
          className="flex items-center justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: 'var(--landing-border)', background: 'var(--landing-surface-muted)' }}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" style={{ color: 'var(--landing-accent-readable, var(--primary))' }} />
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg" aria-label="Close">
            <X className="h-4 w-4" style={{ color: 'var(--landing-text-muted)' }} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="event-policy-content text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      </div>
    </div>,
    document.body
  );
}

export function EventPolicyLink({
  html,
  className,
  label = 'Event policy',
}: {
  html?: string | null;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        style={{ color: 'var(--landing-text-muted)' }}
      >
        {label}
      </button>
      <EventPolicyViewerModal html={html} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
