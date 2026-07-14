import { Calendar, User } from 'lucide-react';
import type { AppNavLink } from './appNav';

export const attendeeMainNav: AppNavLink[] = [
  { to: '/attendee/dashboard', label: 'Dashboard', icon: Calendar, exact: true },
  { to: '/attendee/account', label: 'My Account', icon: User, exact: true },
];
