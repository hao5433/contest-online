import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-[3px]',
};

export function Spinner({ className, size = 'md' }: SpinnerProps) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-neutral-200 border-t-primary-500',
        sizeClasses[size],
        className,
      )}
      role="status"
      aria-label="Đang tải"
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-neutral-50">
      <Spinner size="lg" />
    </div>
  );
}
