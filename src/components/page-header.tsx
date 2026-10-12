import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: React.ReactNode;
  /** Notion-style page icon shown above the title. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, icon, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-2">
        {icon && <div className="mb-3 flex size-14 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-7">{icon}</div>}
        {eyebrow && <div className="label-meta">{eyebrow}</div>}
        <h1 className="text-[32px] leading-tight font-bold tracking-[-0.01em] sm:text-[40px]">{title}</h1>
        {description && <p className="max-w-[68ch] text-base leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PageContainer({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-12 sm:py-14", className)} {...props}>
      {children}
    </div>
  );
}
