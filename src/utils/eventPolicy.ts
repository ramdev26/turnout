/** Default event policy shown until the organizer customizes it. */
export const DEFAULT_EVENT_POLICY_HTML = `
<h3>Tickets &amp; refunds</h3>
<ul>
  <li><strong>Refund / exchange period:</strong> Tickets are generally non-refundable once purchased, unless the event is cancelled or postponed by the organizer.</li>
  <li>If the event is cancelled, you will be offered a refund of the ticket face value (platform fees may be non-refundable where applicable).</li>
  <li>If the event is postponed, your ticket remains valid for the new date unless otherwise stated.</li>
</ul>
<h3>Purchase &amp; authenticity</h3>
<ul>
  <li>Buy tickets only through this official event page to avoid fraudulent listings.</li>
  <li>Keep your confirmation email and QR code secure. Lost or shared tickets may not be reissued.</li>
</ul>
<h3>Entry &amp; attendance</h3>
<ul>
  <li>Please arrive with a valid ticket (QR) and photo ID if requested by venue staff.</li>
  <li>Re-entry may not be permitted after leaving the venue.</li>
  <li>The organizer or venue may refuse entry for safety, capacity, or policy reasons.</li>
</ul>
<h3>Changes</h3>
<ul>
  <li>Line-up, schedule, or venue details may change. Material updates will be communicated when possible.</li>
</ul>
<p><em>This policy is a starting template and is not legal advice. Customize it to match your event.</em></p>
`.trim();

export function resolveEventPolicyHtml(raw: unknown): string {
  const html = typeof raw === 'string' ? raw.trim() : '';
  return html || DEFAULT_EVENT_POLICY_HTML;
}

export function isDefaultEventPolicy(html: string): boolean {
  return html.trim() === DEFAULT_EVENT_POLICY_HTML;
}
