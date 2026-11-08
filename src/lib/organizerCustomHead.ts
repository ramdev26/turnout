/**
 * Injects organizer-supplied custom <head> snippets on public event pages.
 * Organization codes run on every event; per-event codes are additive.
 */

const CUSTOM_HEAD_ATTR = 'data-turnout-custom-head';
const CUSTOM_HEAD_SIG_ATTR = 'data-turnout-custom-head-sig';
const ALLOWED_TAGS = new Set(['SCRIPT', 'META', 'LINK', 'STYLE', 'NOSCRIPT']);

export type OrganizerCustomHeadParts = {
  organizationCustomHeadHtml?: string | null;
  eventCustomHeadHtml?: string | null;
};

export function normalizeCustomHeadHtml(raw: string | null | undefined): string | null {
  const html = String(raw || '')
    .replace(/\0/g, '')
    .replace(/\r\n?/g, '\n')
    .trim();
  if (!html) return null;
  if (html.length > 20000) return null;
  if (/<\?(?:php|=)|<%|<\/?(?:html|body|iframe|object|embed)\b/i.test(html)) return null;
  return html;
}

function nodesFromHtml(html: string): ChildNode[] {
  const trimmed = html.trim();
  if (!trimmed) return [];
  if (/<html[\s>]|<head[\s>]/i.test(trimmed)) {
    const doc = new DOMParser().parseFromString(trimmed, 'text/html');
    return Array.from(doc.head.childNodes);
  }
  const template = document.createElement('template');
  template.innerHTML = trimmed;
  return Array.from(template.content.childNodes);
}

function materializeNode(node: ChildNode, scope: string): Node | null {
  if (node.nodeType === Node.COMMENT_NODE) {
    return document.createComment(node.textContent || '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as HTMLElement;
  const tag = el.tagName.toUpperCase();
  if (!ALLOWED_TAGS.has(tag)) return null;

  if (tag === 'SCRIPT') {
    const script = document.createElement('script');
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.toLowerCase() === CUSTOM_HEAD_ATTR) continue;
      script.setAttribute(attr.name, attr.value);
    }
    script.text = el.textContent || '';
    script.setAttribute(CUSTOM_HEAD_ATTR, scope);
    return script;
  }

  const clone = el.cloneNode(true) as HTMLElement;
  // Nested <script> inside allowed tags (rare) still need rematerializing to execute.
  if (tag === 'NOSCRIPT') {
    clone.setAttribute(CUSTOM_HEAD_ATTR, scope);
    return clone;
  }

  const scripts = Array.from(clone.querySelectorAll('script'));
  for (const nested of scripts) {
    const replacement = document.createElement('script');
    for (const attr of Array.from(nested.attributes)) {
      replacement.setAttribute(attr.name, attr.value);
    }
    replacement.text = nested.textContent || '';
    nested.replaceWith(replacement);
  }
  clone.setAttribute(CUSTOM_HEAD_ATTR, scope);
  return clone;
}

function injectFragment(html: string, scope: 'organization' | 'event'): void {
  if (!html || typeof document === 'undefined') return;
  for (const node of nodesFromHtml(html)) {
    const prepared = materializeNode(node, scope);
    if (prepared) document.head.appendChild(prepared);
  }
}

/** Load organizer custom head snippets. Re-entrant; replaces previous injection. */
export function ensureOrganizerCustomHead(parts: OrganizerCustomHeadParts): void {
  if (typeof document === 'undefined') return;

  const organization = normalizeCustomHeadHtml(parts.organizationCustomHeadHtml);
  const event = normalizeCustomHeadHtml(parts.eventCustomHeadHtml);
  const signature = `${organization || ''}\n---\n${event || ''}`;

  if (document.documentElement.getAttribute(CUSTOM_HEAD_SIG_ATTR) === signature) return;

  document.querySelectorAll(`[${CUSTOM_HEAD_ATTR}]`).forEach((node) => node.remove());
  document.documentElement.setAttribute(CUSTOM_HEAD_SIG_ATTR, signature);

  if (organization) injectFragment(organization, 'organization');
  if (event) injectFragment(event, 'event');
}
