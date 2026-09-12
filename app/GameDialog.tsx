import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Native modal focus/inert handling also works inside the fullscreen game. */
export function GameDialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="game-dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <header className="dialog-header">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label={title + ' 닫기'}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
