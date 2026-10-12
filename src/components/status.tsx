import { cn } from "@/lib/utils";
import type { CampaignStatus } from "@/server/db/schema/app";
import { CAMPAIGN_STATUSES } from "@/lib/validation";

const DOT: Record<CampaignStatus, string> = {
  draft: "bg-muted-foreground/60",
  in_production: "bg-tally",
  in_review: "bg-chart-2",
  approved: "bg-success",
  archived: "bg-muted-foreground/30",
};

export function campaignStatusLabel(status: CampaignStatus) {
  return CAMPAIGN_STATUSES.find((s) => s.id === status)?.label ?? status;
}

export function StatusDot({ status, className }: { status: CampaignStatus; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-1.5 shrink-0 rounded-full", DOT[status], className)}>
      {status === "in_production" && (
        <span className="absolute inset-0 animate-ping rounded-full bg-tally opacity-60 motion-reduce:hidden" />
      )}
    </span>
  );
}

export function CampaignStatusPill({ status, className }: { status: CampaignStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-full border bg-muted/40 px-2 text-xs whitespace-nowrap text-foreground/85",
        className,
      )}
    >
      <StatusDot status={status} />
      {campaignStatusLabel(status)}
    </span>
  );
}

export function ProjectSwatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-[3px] ring-1 ring-black/10 ring-inset", className)}
      style={{ backgroundColor: color }}
    />
  );
}
