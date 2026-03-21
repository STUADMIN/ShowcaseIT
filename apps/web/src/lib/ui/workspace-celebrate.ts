/** Fired after successful guide generation when Settings → celebrate is on. */
export const WORKSPACE_CELEBRATE_EVENT = 'showcaseit:workspace-celebrate';

export function dispatchWorkspaceCelebrate(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(WORKSPACE_CELEBRATE_EVENT));
}

/**
 * Lightweight confetti-style burst (no dependency). Respects reduced motion via caller.
 */
export function fireWorkspaceCelebration(): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const root = document.createElement('div');
  root.className = 'si-celebrate-root';
  root.setAttribute('aria-hidden', 'true');

  const colors = ['#60a5fa', '#a855f7', '#34d399', '#fbbf24', '#f472b6', '#93c5fd'];
  const n = 22;
  for (let i = 0; i < n; i++) {
    const bit = document.createElement('span');
    bit.className = 'si-celebrate-bit';
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const d = 80 + Math.random() * 120;
    bit.style.setProperty('--si-celeb-dx', `${Math.cos(a) * d}px`);
    bit.style.setProperty('--si-celeb-dy', `${Math.sin(a) * d}px`);
    bit.style.setProperty('--si-celeb-rot', `${(Math.random() - 0.5) * 720}deg`);
    bit.style.setProperty('--si-celeb-color', colors[i % colors.length]!);
    bit.style.animationDelay = `${i * 0.02}s`;
    root.appendChild(bit);
  }

  document.body.appendChild(root);
  window.setTimeout(() => root.remove(), 1100);
}
