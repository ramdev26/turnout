import {
  Building2,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
  Wallet,
} from 'lucide-react';
import type { AppNavLink } from './appNav';

/** Super-admin console base path (obscured slug). */
export const BASADMIN_BASE = '/basadmin';

export const adminMainNav: AppNavLink[] = [
  { to: `${BASADMIN_BASE}/dashboard`, label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: `${BASADMIN_BASE}/organizers`, label: 'Organizers', icon: Building2, exact: true },
  { to: `${BASADMIN_BASE}/users`, label: 'Users', icon: Users, exact: true },
  { to: `${BASADMIN_BASE}/events`, label: 'Events', icon: CalendarDays, exact: true },
  { to: `${BASADMIN_BASE}/transactions`, label: 'Transactions', icon: Wallet, exact: true },
  { to: `${BASADMIN_BASE}/payouts`, label: 'Payouts', icon: Shield, exact: true },
  { to: `${BASADMIN_BASE}/settings`, label: 'Settings', icon: Settings, exact: true },
  { to: `${BASADMIN_BASE}/logs`, label: 'Logs', icon: FileText, exact: true },
];
