/** Accessible modal: focus moves in, Tab is trapped, Esc closes, focus returns to the opener. */
import { useEffect, useRef, type ReactNode } from 'react';

type Props = { open: boolean; title: string; overline?: string; onClose: () => void; children: ReactNode; wide?: boolean };

export function Dialog({ open, title, overline, onClose, children, wide }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  // keep the latest onClose without re-running the focus effect on every parent render
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const el = ref.current;
    el?.querySelector<HTMLElement>('[data-autofocus], button, a, input, select')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
      }
      if (e.key === 'Tab' && el) {
        const items = Array.from(el.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')).filter((x) => !x.hasAttribute('disabled'));
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog${wide ? ' dialog--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref}>
        <button className="dialog__close" onClick={onClose} aria-label="Close">
          Close
        </button>
        {overline && <span className="eyebrow eyebrow--copper">{overline}</span>}
        <h2 id="dialog-title" className="display">{title}</h2>
        {children}
      </div>
    </div>
  );
}
