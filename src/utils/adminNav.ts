import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
  Wallet,
} from 'lucide-react';
import type { AppNavLink } from './appNav';

export const adminMainNav: AppNavLink[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/admin/users', label: 'Users', icon: Users, exact: true },
  { to: '/admin/events', label: 'Events', icon: CalendarDays, exact: true },
  { to: '/admin/transactions', label: 'Transactions', icon: Wallet, exact: true },
  { to: '/admin/payouts', label: 'Payouts', icon: Shield, exact: true },
  { to: '/admin/settings', label: 'Settings', icon: Settings, exact: true },
  { to: '/admin/logs', label: 'Logs', icon: FileText, exact: true },
];
