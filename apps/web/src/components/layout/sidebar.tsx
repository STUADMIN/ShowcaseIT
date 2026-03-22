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
