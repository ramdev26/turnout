/** Default organizer Terms & Conditions until customized. */
export const DEFAULT_ORGANIZER_TERMS_HTML = `
<h3>About these terms</h3>
<p>These Terms &amp; Conditions apply to ticket purchases and registrations for events organized by this organizer on Turnout.</p>
<ul>
  <li>By completing checkout, you confirm that the information you provide is accurate.</li>
  <li>Tickets / registrations are personal unless the event page states otherwise.</li>
  <li>Please follow venue rules, safety instructions, and staff guidance at the event.</li>
</ul>
<h3>Payments &amp; fees</h3>
<ul>
  <li>Prices are shown in LKR unless otherwise stated.</li>
  <li>Applicable platform or payment processing fees may apply at checkout.</li>
  <li>Successful payment (or free registration confirmation) creates your booking.</li>
</ul>
<h3>Cancellations &amp; changes</h3>
<ul>
  <li>Event-specific refund and exchange rules are described in each event&apos;s Event policy.</li>
  <li>If an event is cancelled by the organizer, refund or remedy options will follow that event&apos;s policy and applicable law.</li>
</ul>
<h3>Conduct &amp; liability</h3>
<ul>
  <li>The organizer may refuse entry or remove attendees for safety, capacity, or policy reasons.</li>
  <li>To the extent permitted by law, the organizer is not responsible for personal belongings, travel costs, or indirect losses.</li>
</ul>
<p><em>This is a starting template and is not legal advice. Customize it for your organization.</em></p>
`.trim();

export function resolveOrganizerTermsHtml(raw: unknown): string {
  const html = typeof raw === 'string' ? raw.trim() : '';
  return html || DEFAULT_ORGANIZER_TERMS_HTML;
}
