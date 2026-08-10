import { formatSeconds } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface CountdownProps {
  remainingSeconds: number;
  connected: boolean;
}

export function Countdown({ remainingSeconds, connected }: CountdownProps) {
  const isLow = remainingSeconds <= 60;
  const isWarning = remainingSeconds <= 300 && !isLow;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'rounded-md px-3 py-1.5 text-sm font-semibold tabular-nums',
          isLow
            ? 'bg-danger-50 text-danger-700'
            : isWarning
              ? 'bg-warning-50 text-warning-700'
              : 'bg-neutral-100 text-neutral-800',
        )}
      >
        ⏱ {formatSeconds(remainingSeconds)}
      </div>
      {connected ? (
        <span
          className="flex items-center gap-1 text-xs text-success-600"
          title="Đồng hồ đang đồng bộ với server qua WebSocket"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
          Đồng bộ
        </span>
      ) : (
        <span
          className="flex items-center gap-1 text-xs text-neutral-400"
          title="Mất kết nối realtime, đang dùng đồng hồ cục bộ của máy bạn"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" aria-hidden="true" />
          Ngoại tuyến
        </span>
      )}
    </div>
  );
}
