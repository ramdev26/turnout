import {
  Building2,
  CalendarCheck,
  LayoutDashboard,
  Plus,
  Settings,
  Wallet,
} from 'lucide-react';
import type { AppNavLink } from './appNav';

export type FlowNavLink = AppNavLink;

export const organizerMainNav: AppNavLink[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/events/themes', label: 'Create', icon: Plus, exact: true, matchPaths: ['/events/new'] },
  { to: '/dashboard/earnings', label: 'Earnings', icon: Wallet, exact: true },
  { to: '/dashboard/organization', label: 'Organization', icon: Building2, exact: true },
];

export function eventWorkspaceNav(eventId: string): AppNavLink[] {
  return [
    { to: `/dashboard/events/${eventId}/settings`, label: 'Settings', icon: Settings, exact: true },
    { to: `/dashboard/events/${eventId}/checkin`, label: 'Check-in', icon: CalendarCheck },
  ];
}

export function isOrganizerDashboardPath(pathname: string): boolean {
  if (pathname === '/dashboard') return true;
  if (pathname === '/dashboard/earnings') return true;
  if (pathname === '/dashboard/organization') return true;
  if (pathname === '/events/themes' || pathname === '/events/new') return true;
  return false;
}
