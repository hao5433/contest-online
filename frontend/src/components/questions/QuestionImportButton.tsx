import { useRef } from 'react';
import { toast } from 'sonner';
import { useImportQuestions } from '@/hooks/useQuestions';
import { extractErrorMessage } from '@/api/client';

export function QuestionImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportQuestions();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    importMutation.mutate(file, {
      onSuccess: (result) => {
        toast.success(`Đã nhập ${result.imported} câu hỏi từ file Excel.`);
      },
      onError: (error) => {
        toast.error(extractErrorMessage(error, 'Nhập câu hỏi từ Excel thất bại.'));
      },
    });

    e.target.value = '';
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={importMutation.isPending}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
      >
        {importMutation.isPending ? 'Đang nhập...' : '⬆ Nhập từ Excel'}
      </button>
    </>
  );
}
