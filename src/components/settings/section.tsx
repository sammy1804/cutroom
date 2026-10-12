import { cn } from "@/lib/utils";

export function SettingsSection({
  title,
  description,
  children,
  footer,
  tone,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <section className={cn("overflow-hidden rounded-lg border", tone === "danger" && "border-destructive/30")}>
      <div className="space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
      {footer && (
        <div className={cn("flex items-center justify-end gap-3 border-t bg-muted/20 px-5 py-3", tone === "danger" && "border-destructive/20 bg-destructive/5")}>
          {footer}
        </div>
      )}
    </section>
  );
}
