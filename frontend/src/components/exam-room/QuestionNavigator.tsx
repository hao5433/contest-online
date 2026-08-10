import { cn } from '@/lib/utils';

interface QuestionNavigatorProps {
  totalQuestions: number;
  currentIndex: number;
  answeredIndexes: Set<number>;
  onNavigate: (index: number) => void;
}

export function QuestionNavigator({
  totalQuestions,
  currentIndex,
  answeredIndexes,
  onNavigate,
}: QuestionNavigatorProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">Danh sách câu hỏi</h3>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: totalQuestions }).map((_, index) => {
          const answered = answeredIndexes.has(index);
          const isCurrent = index === currentIndex;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onNavigate(index)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors',
                isCurrent && 'ring-2 ring-primary-500',
                answered ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-neutral-600',
              )}
              aria-label={`Câu ${index + 1}${answered ? ' (đã trả lời)' : ' (chưa trả lời)'}`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary-500" /> Đã trả lời
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-neutral-200" /> Chưa trả lời
        </span>
      </div>
    </div>
  );
}
