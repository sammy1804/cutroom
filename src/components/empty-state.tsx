import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/** Quiet, Notion-style empty state: a soft gray block with one clear next step. */
export function EmptyState({ icon, title, description, action, className, children }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-start gap-4 rounded-lg bg-muted px-6 py-10 sm:px-10 sm:py-12", className)}>
      {icon && <div className="flex size-11 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-card [&_svg]:size-5">{icon}</div>}
      <div className="max-w-lg space-y-1.5">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="text-base leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action}
      {children}
    </div>
  );
}

/** Kept for the error and 404 views. */
export function CropMarks({ className }: { className?: string }) {
  return <span aria-hidden className={className} />;
}
