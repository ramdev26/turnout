import type { LandingDisplayMode, LandingStyle } from '../types';
import type { LandingFontKey } from './landingFonts';

/** Layout templates that ship with curated design defaults. */
export type LayoutTemplateId = 'template-2' | 'template-5' | 'template-6' | 'template-7' | 'template-8' | 'template-10';

export type TemplateDesignDefaults = {
  templateId: LayoutTemplateId;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: LandingFontKey;
  landingStyle: LandingStyle;
  displayMode: LandingDisplayMode;
};

/**
 * Each landing template owns its own baseline look.
 * Category chips never override these — organizers change them in Customize design.
 */
export const TEMPLATE_DESIGN_DEFAULTS: Record<LayoutTemplateId, TemplateDesignDefaults> = {
  'template-2': {
    templateId: 'template-2',
    primaryColor: '#C0FF72',
    secondaryColor: '#0D585B',
    fontFamily: 'fraunces',
    landingStyle: 'glass',
    displayMode: 'auto',
  },
  'template-8': {
    templateId: 'template-8',
    primaryColor: '#7C3AED',
    secondaryColor: '#C4B5FD',
    fontFamily: 'manrope',
    landingStyle: 'glass',
    displayMode: 'light',
  },
  'template-7': {
    templateId: 'template-7',
    primaryColor: '#0D9488',
    secondaryColor: '#0F766E',
    fontFamily: 'manrope',
    landingStyle: 'minimal',
    displayMode: 'light',
  },
  'template-6': {
    templateId: 'template-6',
    primaryColor: '#0A0A0A',
    secondaryColor: '#666666',
    fontFamily: 'sora',
    landingStyle: 'minimal',
    displayMode: 'light',
  },
  'template-10': {
    templateId: 'template-10',
    primaryColor: '#111827',
    secondaryColor: '#6b7280',
    fontFamily: 'sora',
    landingStyle: 'minimal',
    displayMode: 'light',
  },
  'template-5': {
    templateId: 'template-5',
    primaryColor: '#059669',
    secondaryColor: '#10B981',
    fontFamily: 'manrope',
    landingStyle: 'minimal',
    displayMode: 'light',
  },
};

export function isLayoutTemplateId(id: string | undefined | null): id is LayoutTemplateId {
  return (
    id === 'template-2' ||
    id === 'template-5' ||
    id === 'template-6' ||
    id === 'template-10' ||
    id === 'template-7' ||
    id === 'template-8'
  );
}

export function resolveTemplateDesignDefaults(id?: string | null): TemplateDesignDefaults {
  if (isLayoutTemplateId(id)) return TEMPLATE_DESIGN_DEFAULTS[id];
  // Legacy layout ids map to Showcase
  if (id === 'template-1' || id === 'template-3' || id === 'template-4') {
    return TEMPLATE_DESIGN_DEFAULTS['template-2'];
  }
  return TEMPLATE_DESIGN_DEFAULTS['template-2'];
}

/** Apply a template's built-in colour / font / style defaults onto a design value. */
export function withTemplateDesignDefaults<T extends { templateId?: string }>(
  design: T,
  templateId: string
): T & {
  templateId: LayoutTemplateId;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: LandingFontKey;
  landingStyle: LandingStyle;
  displayMode: LandingDisplayMode;
} {
  const defaults = resolveTemplateDesignDefaults(templateId);
  return {
    ...design,
    ...defaults,
  };
}
