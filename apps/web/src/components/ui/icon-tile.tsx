'use client';

import type { LucideIcon } from 'lucide-react';

export type IconTileSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type IconTileVariant = 'brand' | 'muted' | 'brandInteractive' | 'danger' | 'success';

const sizeStyles: Record<IconTileSize, { box: string; icon: string }> = {
  xs: { box: 'rounded-lg p-1.5', icon: 'w-4 h-4' },
  sm: { box: 'rounded-lg p-2', icon: 'w-5 h-5' },
  md: { box: 'rounded-xl p-2.5', icon: 'w-5 h-5' },
  lg: { box: 'rounded-xl p-3', icon: 'w-7 h-7' },
  xl: { box: 'rounded-2xl p-4', icon: 'w-10 h-10' },
};

const variantStyles: Record<IconTileVariant, string> = {
  brand: 'bg-brand-500/10 ring-1 ring-brand-500/15 text-brand-400/95',
  muted: 'bg-gray-800/50 ring-1 ring-gray-700/60 text-gray-500',
  brandInteractive:
    'bg-brand-500/10 ring-1 ring-brand-500/15 text-brand-400/95 group-hover:bg-brand-500/15 group-hover:ring-brand-500/25',
  danger: 'bg-red-500/10 ring-1 ring-red-500/20 text-red-400',
  success: 'bg-green-500/10 ring-1 ring-green-500/25 text-green-400',
};

/** Line icon in a rounded brand-style tile (dashboard / nav / cards). */
export function IconTile({
  icon: Icon,
  size = 'md',
  variant = 'brand',
  className = '',
  strokeWidth = 1.75,
}: {
  icon: LucideIcon;
  size?: IconTileSize;
  variant?: IconTileVariant;
  className?: string;
  strokeWidth?: number;
}) {
  const s = sizeStyles[size];
  const v = variantStyles[variant];
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${s.box} ${v} ${className}`}
      aria-hidden
    >
      <Icon className={s.icon} strokeWidth={strokeWidth} />
    </span>
  );
}
