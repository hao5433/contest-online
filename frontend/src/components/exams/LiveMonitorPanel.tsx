import { useExamMonitorSocket } from '@/hooks/useExamMonitorSocket';
import { Badge } from '@/components/common/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { formatViolationBreakdown } from '@/lib/utils';

interface LiveMonitorPanelProps {
  examId: string;
  enabled: boolean;
}

/** Teacher live monitor: subscribes to the exam's monitor WebSocket and lists
 * in-progress attempts with a running violation count, updating in real time. */
export function LiveMonitorPanel({ examId, enabled }: LiveMonitorPanelProps) {
  const { connected, attempts } = useExamMonitorSocket(examId, enabled);
  const rows = Object.values(attempts).sort((a, b) => b.violationCount - a.violationCount);

  if (!enabled) {
    return (
      <EmptyState
        title="Giám sát trực tiếp chỉ khả dụng khi đề thi đang diễn ra"
        description="Quay lại trang này trong thời gian thi để theo dõi học sinh."
      />
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-neutral-900">Giám sát trực tiếp</h3>
        <span className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span
            className={`h-2 w-2 rounded-full ${connected ? 'bg-success-500' : 'bg-neutral-300'}`}
            aria-hidden="true"
          />
          {connected ? 'Đang kết nối' : 'Mất kết nối'}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState title="Chưa có học sinh nào đang làm bài" />
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
              <th className="px-4 py-2">Học sinh</th>
              <th className="px-4 py-2">Tiến độ</th>
              <th className="px-4 py-2">Vi phạm</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.attemptId} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2.5 text-neutral-800">{row.studentName}</td>
                <td className="px-4 py-2.5 text-neutral-600">
                  {row.answeredCount}/{row.totalQuestions || '—'}
                </td>
                <td className="px-4 py-2.5">
                  {row.violationCount > 0 ? (
                    <div className="space-y-0.5">
                      <Badge tone="danger">{row.violationCount} lần</Badge>
                      <div className="text-xs text-neutral-500">{formatViolationBreakdown(row.violationsByType)}</div>
                    </div>
                  ) : (
                    <Badge tone="success">Không vi phạm</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
