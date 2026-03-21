/**
 * Brief animated target (bullseye + rings) at viewport coordinates — e.g. screen recorder feedback.
 */
export function showClickTargetRipple(clientX: number, clientY: number): void {
  if (typeof document === 'undefined') return;

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.className = 'si-click-ripple-host';
  host.style.left = `${clientX}px`;
  host.style.top = `${clientY}px`;

  host.innerHTML = `
    <div class="si-click-ripple-stack">
      <span class="si-click-ripple-ring"></span>
      <span class="si-click-ripple-ring si-click-ripple-ring--delayed"></span>
      <span class="si-click-ripple-core"></span>
    </div>
  `;

  document.body.appendChild(host);
  window.setTimeout(() => host.remove(), 900);
}

export function showClickTargetRippleViewportCenter(): void {
  showClickTargetRipple(window.innerWidth / 2, window.innerHeight * 0.36);
}
