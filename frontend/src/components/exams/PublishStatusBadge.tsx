import { Badge, type BadgeTone } from '@/components/common/Badge';
import { examPublishStatusLabels } from '@/lib/utils';
import type { ExamPublishStatus } from '@/types';

interface PublishStatusBadgeProps {
  status: ExamPublishStatus;
}

const toneByStatus: Record<ExamPublishStatus, BadgeTone> = {
  draft: 'warning',
  published: 'success',
  closed: 'neutral',
};

/** Shows the exam's REAL lifecycle status - the one that actually controls
 * whether students can see/take it (unlike ExamStatusBadge, which is just a
 * time-window hint). A 'draft' exam is invisible to students no matter what
 * its scheduled start_time says. */
export function PublishStatusBadge({ status }: PublishStatusBadgeProps) {
  return <Badge tone={toneByStatus[status]}>{examPublishStatusLabels[status]}</Badge>;
}
