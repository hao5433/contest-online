import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useImportStudents } from '@/hooks/useClassrooms';
import { extractErrorMessage } from '@/api/client';
import { Modal } from '@/components/common/Modal';
import type { ImportStudentsResult } from '@/types';

interface StudentImportButtonProps {
  classroomId: string;
}

export function StudentImportButton({ classroomId }: StudentImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportStudents(classroomId);
  const [result, setResult] = useState<ImportStudentsResult | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    importMutation.mutate(file, {
      onSuccess: (data) => {
        setResult(data);
        const parts = [];
        if (data.created.length > 0) parts.push(`${data.created.length} tài khoản mới`);
        if (data.enrolled_existing > 0) parts.push(`${data.enrolled_existing} học sinh có sẵn`);
        if (data.already_enrolled > 0) parts.push(`${data.already_enrolled} đã ở trong lớp`);
        if (data.errors.length > 0) parts.push(`${data.errors.length} dòng lỗi`);
        toast[data.errors.length > 0 ? 'warning' : 'success'](`Nhập xong: ${parts.join(', ') || 'không có gì để nhập'}.`);
      },
      onError: (error) => toast.error(extractErrorMessage(error, 'Nhập danh sách học sinh thất bại')),
    });

    e.target.value = '';
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={importMutation.isPending}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
      >
        {importMutation.isPending ? 'Đang nhập...' : '⬆ Nhập từ Excel'}
      </button>

      <Modal
        open={Boolean(result)}
        onClose={() => setResult(null)}
        title="Kết quả nhập danh sách học sinh"
        widthClassName="max-w-2xl"
      >
        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-md bg-success-50 p-2">
                <p className="text-lg font-semibold text-success-700">{result.created.length}</p>
                <p className="text-xs text-neutral-600">Tài khoản mới</p>
              </div>
              <div className="rounded-md bg-primary-50 p-2">
                <p className="text-lg font-semibold text-primary-700">{result.enrolled_existing}</p>
                <p className="text-xs text-neutral-600">Học sinh có sẵn, đã thêm vào lớp</p>
              </div>
              <div className="rounded-md bg-neutral-100 p-2">
                <p className="text-lg font-semibold text-neutral-700">{result.already_enrolled}</p>
                <p className="text-xs text-neutral-600">Đã ở trong lớp từ trước</p>
              </div>
            </div>

            {result.created.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium text-neutral-900">
                  Mật khẩu tạm cho tài khoản mới - hãy gửi cho học sinh, mật khẩu này chỉ hiện 1 lần ở đây:
                </p>
                <div className="max-h-48 overflow-y-auto rounded-md border border-neutral-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                        <th className="px-3 py-1.5">Họ tên</th>
                        <th className="px-3 py-1.5">Email</th>
                        <th className="px-3 py-1.5">Mật khẩu tạm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.created.map((account) => (
                        <tr key={account.email} className="border-b border-neutral-100 last:border-0">
                          <td className="px-3 py-1.5 text-neutral-800">{account.full_name}</td>
                          <td className="px-3 py-1.5 text-neutral-600">{account.email}</td>
                          <td className="px-3 py-1.5 font-mono text-neutral-800">{account.temporary_password}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.errors.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium text-danger-700">Các dòng bị lỗi (đã bỏ qua):</p>
                <ul className="max-h-32 space-y-1 overflow-y-auto text-sm text-neutral-600">
                  {result.errors.map((err, idx) => (
                    <li key={idx}>
                      Dòng {err.row}
                      {err.email ? ` (${err.email})` : ''}: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
