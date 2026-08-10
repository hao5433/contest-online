import { Badge, type BadgeTone } from '@/components/common/Badge';
import { deriveExamStatus, examStatusLabels } from '@/lib/utils';
import type { ExamTimeStatus } from '@/types';

interface ExamStatusBadgeProps {
  startTime: string;
  endTime: string;
}

const toneByStatus: Record<ExamTimeStatus, BadgeTone> = {
  draft: 'neutral',
  scheduled: 'primary',
  active: 'success',
  ended: 'neutral',
};

export function ExamStatusBadge({ startTime, endTime }: ExamStatusBadgeProps) {
  const status = deriveExamStatus(startTime, endTime);
  return <Badge tone={toneByStatus[status]}>{examStatusLabels[status]}</Badge>;
}
