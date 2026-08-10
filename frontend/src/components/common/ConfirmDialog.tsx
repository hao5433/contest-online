import { Modal } from '@/components/common/Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  danger = false,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} widthClassName="max-w-sm">
      <p className="text-sm text-neutral-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={
            danger
              ? 'rounded-md bg-danger-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-danger-600 disabled:opacity-60'
              : 'rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60'
          }
        >
          {loading ? 'Đang xử lý...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
