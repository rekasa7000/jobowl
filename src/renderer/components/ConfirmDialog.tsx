import * as AlertDialog from '@radix-ui/react-alert-dialog';

interface Props {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  open: boolean;
  busy?: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** A confirmation for something that can't be undone. Focus is trapped and Escape cancels. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  open,
  busy = false,
  error = null,
  onOpenChange,
  onConfirm,
}: Props) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="dialog-content">
          <AlertDialog.Title className="font-display-caps text-[1.75rem]">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-3 text-ink-2">
            {description}
          </AlertDialog.Description>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Cancel className="btn-ghost">{cancelLabel}</AlertDialog.Cancel>
            <button type="button" className="btn-danger" disabled={busy} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
