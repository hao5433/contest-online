interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
    </div>
  );
}
