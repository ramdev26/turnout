import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlignLeft,
  Code2,
  Link2,
  List,
  ListOrdered,
  X,
} from 'lucide-react';
import type { CreateThemeUI } from '../../themes/eventThemes';
import { accentButtonStyleFor, cardMutedStyleFor, cardStyleFor, fieldStyleFor } from '../../themes/flowUi';
import { DEFAULT_EVENT_POLICY_HTML } from '../../utils/eventPolicy';
import { cn } from '../../utils/cn';
import { TurnoutSelect } from '../ui/TurnoutSelect';

type Props = {
  open: boolean;
  title?: string;
  value: string;
  /** Template inserted via “Insert template” (defaults to event policy). */
  defaultTemplate?: string;
  onClose: () => void;
  onSave: (html: string) => void;
  ui: CreateThemeUI;
  saving?: boolean;
};

function runCommand(command: string, value?: string) {
  try {
    document.execCommand(command, false, value);
  } catch {
    // Ignore unsupported commands in some browsers.
  }
}

export function EventPolicyEditorModal({
  open,
  title = 'Event policy',
  value,
  defaultTemplate = DEFAULT_EVENT_POLICY_HTML,
  onClose,
  onSave,
  ui,
  saving = false,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showHtml, setShowHtml] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState(value);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowHtml(false);
    setHtmlDraft(value);
    setDirty(false);
    const id = window.setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = value || defaultTemplate;
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, value, defaultTemplate]);

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

  const cardStyle = cardStyleFor(ui);
  const cardMuted = cardMutedStyleFor(ui);
  const fieldStyle = fieldStyleFor(ui);

  const readHtml = () => {
    if (showHtml) return htmlDraft;
    return editorRef.current?.innerHTML || '';
  };

  const insertTemplate = () => {
    const next = defaultTemplate;
    setHtmlDraft(next);
    setDirty(true);
    if (editorRef.current && !showHtml) editorRef.current.innerHTML = next;
  };

  const toggleHtml = () => {
    if (showHtml) {
      if (editorRef.current) editorRef.current.innerHTML = htmlDraft;
      setShowHtml(false);
    } else {
      setHtmlDraft(editorRef.current?.innerHTML || htmlDraft);
      setShowHtml(true);
    }
  };

  const toolbarBtn = (label: string, onClick: () => void, active?: boolean) => (
    <button
      key={label}
      type="button"
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-semibold transition',
        active ? 'opacity-100' : 'opacity-80 hover:opacity-100'
      )}
      style={{
        background: active ? ui.accentSoft : 'transparent',
        color: active ? ui.accent : ui.text,
      }}
    >
      {label}
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close policy editor"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-policy-title"
        className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:rounded-2xl"
        style={{ ...cardStyle, color: ui.text }}
      >
        <div
          className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5"
          style={{ borderColor: ui.borderColor, background: ui.cardMutedBg }}
        >
          <h2 id="event-policy-title" className="text-base font-semibold sm:text-lg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg"
            style={{ color: ui.textMuted }}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <div
            className="flex flex-col gap-3 rounded-xl border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
            style={cardMuted}
          >
            <p className="text-sm" style={{ color: ui.textMuted }}>
              Templates aren&apos;t legal advice. By using policy templates, you agree that you&apos;ve read and agree to
              customize them for your event.
            </p>
            <button
              type="button"
              onClick={insertTemplate}
              className="shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold"
              style={{ borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text }}
            >
              Insert template
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border" style={{ borderColor: ui.borderColor }}>
            <div
              className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5"
              style={{ borderColor: ui.borderColor, background: ui.cardMutedBg }}
            >
              <TurnoutSelect
                value="p"
                ariaLabel="Text style"
                tone={ui.isDark ? 'dark' : 'light'}
                className="mr-1 w-[8.5rem]"
                style={{ borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text }}
                buttonClassName="rounded-lg border px-2 py-1.5 text-xs font-semibold"
                onChange={(v) => {
                  if (v === 'p') runCommand('formatBlock', 'p');
                  else runCommand('formatBlock', v);
                  setDirty(true);
                }}
                options={[
                  { value: 'p', label: 'Paragraph' },
                  { value: 'h3', label: 'Heading' },
                  { value: 'h4', label: 'Subheading' },
                ]}
              />
              {toolbarBtn('B', () => {
                runCommand('bold');
                setDirty(true);
              })}
              {toolbarBtn('I', () => {
                runCommand('italic');
                setDirty(true);
              })}
              {toolbarBtn('U', () => {
                runCommand('underline');
                setDirty(true);
              })}
              <span className="mx-1 h-5 w-px" style={{ background: ui.borderColor }} />
              <button
                type="button"
                title="Bulleted list"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  runCommand('insertUnorderedList');
                  setDirty(true);
                }}
                className="grid h-8 w-8 place-items-center rounded-lg"
                style={{ color: ui.text }}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Numbered list"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  runCommand('insertOrderedList');
                  setDirty(true);
                }}
                className="grid h-8 w-8 place-items-center rounded-lg"
                style={{ color: ui.text }}
              >
                <ListOrdered className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Align left"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  runCommand('justifyLeft');
                  setDirty(true);
                }}
                className="grid h-8 w-8 place-items-center rounded-lg"
                style={{ color: ui.text }}
              >
                <AlignLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Insert link"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const url = window.prompt('Link URL');
                  if (url) runCommand('createLink', url);
                  setDirty(true);
                }}
                className="grid h-8 w-8 place-items-center rounded-lg"
                style={{ color: ui.text }}
              >
                <Link2 className="h-4 w-4" />
              </button>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  title={showHtml ? 'Visual editor' : 'HTML view'}
                  onClick={toggleHtml}
                  className="grid h-8 w-8 place-items-center rounded-lg"
                  style={{ color: ui.text, background: showHtml ? ui.accentSoft : 'transparent' }}
                >
                  <Code2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {showHtml ? (
              <textarea
                value={htmlDraft}
                onChange={(e) => {
                  setHtmlDraft(e.target.value);
                  setDirty(true);
                }}
                className="min-h-[320px] w-full resize-y border-0 px-4 py-3 font-mono text-sm outline-none"
                style={{ ...fieldStyle, background: ui.fieldBg }}
              />
            ) : (
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="event-policy-editor min-h-[320px] max-h-[48vh] overflow-y-auto px-4 py-3 text-sm leading-relaxed outline-none"
                style={{ background: ui.fieldBg, color: ui.text }}
                onInput={() => setDirty(true)}
              />
            )}
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-2 border-t px-4 py-3 sm:px-5"
          style={{ borderColor: ui.borderColor, background: ui.cardMutedBg }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
            style={{ borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(readHtml())}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={accentButtonStyleFor(ui)}
          >
            {saving ? 'Saving…' : dirty ? 'Save' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
