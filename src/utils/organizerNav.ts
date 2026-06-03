export type FlowNavLink = {
  to: string;
  label: string;
  exact?: boolean;
};

export const organizerMainNav: FlowNavLink[] = [
  { to: '/dashboard', label: 'Dashboard', exact: true },
  { to: '/events/themes', label: 'Create', exact: true },
  { to: '/dashboard/earnings', label: 'Earnings', exact: true },
  { to: '/dashboard/organization', label: 'Organization', exact: true },
];

export function eventWorkspaceNav(eventId: string): FlowNavLink[] {
  return [
    { to: '/dashboard', label: 'Dashboard', exact: true },
    { to: `/dashboard/events/${eventId}/settings`, label: 'Settings', exact: true },
    { to: `/dashboard/events/${eventId}/agenda`, label: 'Agenda' },
    { to: `/dashboard/events/${eventId}/checkin`, label: 'Check-in' },
    { to: `/dashboard/events/${eventId}/runbook`, label: 'Runbook' },
  ];
}
