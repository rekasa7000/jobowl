import * as AlertDialog from '@radix-ui/react-alert-dialog';

interface Props {
  title: string;
  open: boolean;
  busy: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ConfirmDelete({ title, open, busy, error, onOpenChange, onConfirm }: Props) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="dialog-content">
          <AlertDialog.Title className="font-display-caps text-[1.75rem]">
            Delete this application?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-3 text-ink-2">
            {title} and its history will be removed. This can't be undone.
          </AlertDialog.Description>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Cancel className="btn-ghost">Keep it</AlertDialog.Cancel>
            <button type="button" className="btn-danger" disabled={busy} onClick={onConfirm}>
              Delete application
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
