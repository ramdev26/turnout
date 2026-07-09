import type { LucideIcon } from 'lucide-react';

export type AppNavLink = {
  to: string;
  label: string;
  exact?: boolean;
  icon?: LucideIcon;
  /** Additional paths that should highlight this nav item */
  matchPaths?: string[];
};

export function isNavLinkActive(pathname: string, link: AppNavLink): boolean {
  if (link.matchPaths?.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  if (link.exact) return pathname === link.to;
  return pathname === link.to || pathname.startsWith(`${link.to}/`);
}
