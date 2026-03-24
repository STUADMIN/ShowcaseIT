'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Download,
  LayoutDashboard,
  Palette,
  Send,
  Settings,
  Users,
  Video,
} from 'lucide-react';
import { UserMenu } from '@/components/auth/user-menu';
import { IconTile } from '@/components/ui/icon-tile';
import { useWorkspaceBrand } from '@/components/layout/workspace-brand-context';

const navItems: { id: string; label: string; icon: LucideIcon; href: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { id: 'recordings', label: 'Recordings', icon: Video, href: '/recordings' },
  { id: 'guides', label: 'Guides', icon: BookOpen, href: '/guides' },
  { id: 'brand', label: 'Brand Kit', icon: Palette, href: '/brand' },
  { id: 'export', label: 'Export', icon: Download, href: '/export' },
  { id: 'publish', label: 'Publish', icon: Send, href: '/publish' },
];

const bottomNavItems: { id: string; label: string; icon: LucideIcon; href: string }[] = [
  { id: 'team', label: 'Team', icon: Users, href: '/team' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const {
    preferredWorkspaceId,
    activeBrandKitId,
    setActiveBrandKitId,
    brandKits,
    brandKitsLoading,
  } = useWorkspaceBrand();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const renderNavLink = (item: (typeof navItems)[number]) => {
    const active = isActive(item.href);
    return (
      <li key={item.id}>
        <Link
          href={item.href}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
            active
              ? 'bg-brand-600/10 text-brand-400 border border-brand-600/20'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
        >
          <IconTile icon={item.icon} size="sm" variant={active ? 'brand' : 'muted'} />
          {item.label}
        </Link>
      </li>
    );
  };

  return (
    <aside className="w-64 h-screen bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
      <div className="p-6 border-b border-gray-800">
        <Link href="/">
          <h1 className="text-xl font-bold text-gradient">ShowcaseIt</h1>
        </Link>
        <p className="text-xs text-gray-500 mt-1">Branded User Manuals</p>
        {preferredWorkspaceId && (brandKitsLoading || (brandKits && brandKits.length > 0)) ? (
          <div className="mt-4">
            <label htmlFor="si-sidebar-brand-kit" className="text-xs text-gray-500 block mb-1">
              Guides &amp; recordings
            </label>
            <select
              id="si-sidebar-brand-kit"
              value={activeBrandKitId ?? ''}
              onChange={(e) => setActiveBrandKitId(e.target.value.trim() || null)}
              disabled={brandKitsLoading}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs text-gray-200 outline-none focus:border-brand-600"
            >
              <option value="">All brands</option>
              {(brandKits ?? []).map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-600 mt-1 leading-snug">
              Filter lists and new captures to this brand&apos;s project.
            </p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 p-3 flex flex-col">
        <ul className="space-y-1 flex-1">{navItems.map(renderNavLink)}</ul>

        <div className="border-t border-gray-800 pt-2 mt-2">
          <ul className="space-y-1">{bottomNavItems.map(renderNavLink)}</ul>
        </div>
      </nav>

      <div className="border-t border-gray-800 p-2">
        <UserMenu />
      </div>
    </aside>
  );
}
