import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/common/Badge';
import { useAnswerChangeLog } from '@/hooks/useAttempts';
import { formatDateTime } from '@/lib/utils';

interface AnswerChangeLogModalProps {
  attemptId: string | null;
  studentName: string;
  onClose: () => void;
}

/** Full timestamped history of every answer change on one attempt - the
 * roster only ever shows the final answers; this is what actually lets a
 * teacher see pacing ("answered every question in under 2 seconds") and
 * revision bursts ("changed the answer 4 times right before submitting"). */
export function AnswerChangeLogModal({ attemptId, studentName, onClose }: AnswerChangeLogModalProps) {
  const { data: log, isLoading } = useAnswerChangeLog(attemptId);

  return (
    <Modal open={attemptId !== null} onClose={onClose} title={`Lịch sử trả lời - ${studentName}`} widthClassName="max-w-2xl">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : !log || log.length === 0 ? (
        <EmptyState title="Chưa có câu nào được trả lời" />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-neutral-500">
            Mỗi dòng là 1 lần lưu đáp án, theo đúng thứ tự thời gian - không chỉ đáp án cuối cùng.{' '}
            <Badge tone="danger">Nhanh bất thường</Badge> = trả lời dưới 3 giây kể từ lần trước.{' '}
            <Badge tone="warning">Đã đổi</Badge> = không phải lần đầu trả lời câu này.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
                <th className="py-1.5 pr-2">Lúc</th>
                <th className="py-1.5 pr-2">Câu hỏi</th>
                <th className="py-1.5 pr-2">Cách lần trước</th>
                <th className="py-1.5">Cờ</th>
              </tr>
            </thead>
            <tbody>
              {log.map((entry, index) => (
                <tr key={index} className="border-b border-neutral-100 last:border-0">
                  <td className="py-1.5 pr-2 text-neutral-600">{formatDateTime(entry.changed_at)}</td>
                  <td className="py-1.5 pr-2 text-neutral-800">#{entry.question_id}</td>
                  <td className="py-1.5 pr-2 text-neutral-600">{entry.seconds_since_previous.toFixed(1)}s</td>
                  <td className="py-1.5 space-x-1">
                    {entry.suspiciously_fast && <Badge tone="danger">Nhanh bất thường</Badge>}
                    {entry.is_revision && <Badge tone="warning">Đã đổi</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
