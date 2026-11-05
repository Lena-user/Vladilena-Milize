// Khoá cuộn trang khi có hộp thoại hoặc ngăn kéo đang mở (đếm số lớp đang mở, lớp cuối đóng mới mở khoá).
let open = 0;
let previousOverflow = '';

export function lockScroll() {
  if (open === 0) {
    previousOverflow = document.documentElement.style.overflow;
  }
  open += 1;
  if (open === 1) document.documentElement.style.overflow = 'hidden';
}

export function unlockScroll() {
  open = Math.max(0, open - 1);
  if (open === 0) document.documentElement.style.overflow = previousOverflow;
}

type OverlayEntry = {
  panel: HTMLElement;
  opener: HTMLElement | null;
  dismissable: () => boolean;
  close: () => void;
};

const overlays: OverlayEntry[] = [];
const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function focusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(element => {
    return (
      !element.hasAttribute('hidden') &&
      !element.closest('[inert], [aria-hidden="true"]') &&
      getComputedStyle(element).visibility !== 'hidden' &&
      element.getClientRects().length > 0
    );
  });
}

function focusPanel(entry: OverlayEntry) {
  const first = focusableElements(entry.panel)[0];
  (first ?? entry.panel).focus();
}

function onOverlayKeydown(event: KeyboardEvent) {
  const top = overlays[overlays.length - 1];
  if (!top) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    if (top.dismissable()) top.close();
    return;
  }

  if (event.key !== 'Tab') return;
  const focusable = focusableElements(top.panel);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (!first || !last) {
    event.preventDefault();
    top.panel.focus();
  } else if (event.shiftKey && (active === first || !top.panel.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !top.panel.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

export function registerOverlayFocus(panel: HTMLElement, close: () => void, dismissable: () => boolean) {
  const active = document.activeElement;
  const entry: OverlayEntry = {
    panel,
    opener: active instanceof HTMLElement ? active : null,
    dismissable,
    close
  };
  overlays.push(entry);
  if (overlays.length === 1) document.addEventListener('keydown', onOverlayKeydown, true);
  focusPanel(entry);

  return () => {
    const index = overlays.indexOf(entry);
    if (index < 0) return;
    const wasTop = index === overlays.length - 1;
    overlays.splice(index, 1);
    if (overlays.length === 0) document.removeEventListener('keydown', onOverlayKeydown, true);
    if (wasTop && entry.opener?.isConnected) entry.opener.focus();
  };
}
