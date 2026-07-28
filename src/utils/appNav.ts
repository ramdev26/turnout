import type { LucideIcon } from 'lucide-react';

export type AppNavLink = {
  to: string;
  label: string;
  exact?: boolean;
  icon?: LucideIcon;
  /** Additional paths that should highlight this nav item */
  matchPaths?: string[];
};

export function isNavLinkActive(pathname: string, link: AppNavLink, currentHash = ''): boolean {
  const [linkPath, linkHash = ''] = link.to.split('#');
  const normalizedPath = linkPath || link.to;
  if (link.matchPaths?.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  if (linkHash) {
    return pathname === normalizedPath && currentHash === `#${linkHash}`;
  }
  if (link.exact) return pathname === normalizedPath;
  return pathname === normalizedPath || pathname.startsWith(`${normalizedPath}/`);
}
