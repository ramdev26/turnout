import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SectionsDesigner, defaultSectionDesign } from '../components/SectionsDesigner';
import { SectionDesign } from '../types';

const DRAFT_KEY = 'turnout_sections_draft_v1';
const LEGACY_DRAFT_KEY = 'eventtick_sections_draft_v1';

function loadDraft(): SectionDesign | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY) || localStorage.getItem(LEGACY_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return null;
    return parsed as SectionDesign;
  } catch {
    return null;
  }
}

function saveDraft(design: SectionDesign) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(design));
  localStorage.setItem(`${DRAFT_KEY}_savedAt`, new Date().toISOString());
}

export const CanvasDesignerPage: React.FC = () => {
  const [params] = useSearchParams();
  const title = params.get('title') || 'Your Event Title';
  const location = params.get('location') || 'Sri Lanka';
  const bannerUrl = params.get('bannerUrl') || 'https://picsum.photos/seed/turnout-canvas-preview/1400/800';
  const date = params.get('date') || new Date().toISOString();
  const primaryColor = params.get('primaryColor') || '#4f46e5';
  const secondaryColor = params.get('secondaryColor') || '#10b981';

  const [design, setDesign] = useState<SectionDesign>(() =>
    loadDraft() || defaultSectionDesign({ title, description: '', bannerUrl })
  );
  const [savedAt, setSavedAt] = useState<string | null>(() => localStorage.getItem(`${DRAFT_KEY}_savedAt`));

  const preview = useMemo(
    () => ({
      title,
      date,
      location,
      bannerUrl,
      customization: {
        primaryColor,
        secondaryColor,
        fontFamily: 'Inter',
        heroText: title,
        heroSubtext: 'Design your landing page freely.',
        layout: 'standard' as const,
        sections: design,
      },
    }),
    [bannerUrl, date, design, location, primaryColor, secondaryColor, title]
  );

  const onSave = () => {
    saveDraft(design);
    setSavedAt(new Date().toISOString());
  };

  const onReset = () => {
    const fresh = defaultSectionDesign({ title, description: '', bannerUrl });
    setDesign(fresh);
    saveDraft(fresh);
    setSavedAt(new Date().toISOString());
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-neutral-900">Landing Page Designer</div>
            <div className="truncate text-xs text-neutral-500">
              Draft key: {DRAFT_KEY}
              {savedAt ? ` • Saved: ${new Date(savedAt).toLocaleString()}` : ' • Not saved yet'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onSave}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-indigo-700"
            >
              Save draft
            </button>
            <Link
              to="/events/new"
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
            >
              Back to Create Event
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 py-6">
        <SectionsDesigner
          value={design}
          onChange={setDesign}
          eventPreview={preview as any}
          ticketsPreview={[
            { id: 't1', eventId: 'e1', name: 'General', price: 1500, quantity: 100, sold: 0 },
            { id: 't2', eventId: 'e1', name: 'VIP', price: 4500, quantity: 50, sold: 0 },
            { id: 't3', eventId: 'e1', name: 'Early Bird', price: 1000, quantity: 200, sold: 0 },
          ]}
        />
      </div>
    </div>
  );
};

