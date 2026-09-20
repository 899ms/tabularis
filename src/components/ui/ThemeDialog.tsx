import { useEffect, useId, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Modal } from "./Modal";

interface ThemeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  busy?: boolean;
}

/** Theme workflows share focus containment and restore the invoking control. */
export function ThemeDialog({ isOpen, onClose, title, children, busy = false }: ThemeDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement;
    container.current?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [isOpen]);
  if (!isOpen) return null;
  return <Modal isOpen onClose={() => { if (!busy) onClose(); }}>
    <div ref={container} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
      className="bg-elevated border border-strong rounded-xl shadow-2xl w-[760px] max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(container.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? []).filter((element) => !element.hidden)
          .sort((a, b) => a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
        const first = controls[0]; const last = controls.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === container.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === container.current)) { event.preventDefault(); first.focus(); }
      }}>
      <div className="flex items-center justify-between p-4 border-b border-default bg-base">
        <h2 id={titleId} className="text-lg font-semibold text-primary">{title}</h2>
        <button type="button" disabled={busy} onClick={onClose} aria-label={t("common.close")} className="text-secondary hover:text-primary disabled:opacity-50"><X size={20} /></button>
      </div>
      <div className="p-6 space-y-4 overflow-y-auto">{children}</div>
    </div>
  </Modal>;
}
