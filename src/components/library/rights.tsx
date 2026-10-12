import { Check, X } from "lucide-react";
import type { AssetRights } from "@/lib/creative-types";
import { cn } from "@/lib/utils";

/** Compact licence summary. Every usable asset shows one; references never do. */
export function RightsSummary({ rights, className, detailed = false }: { rights: AssetRights | null; className?: string; detailed?: boolean }) {
  if (!rights) {
    return <span className={cn("rounded-md border border-destructive/40 px-2 py-0.5 text-xs text-destructive", className)}>No licence on record</span>;
  }
  const flags = [
    { ok: rights.commercialUse, label: "Commercial use" },
    { ok: rights.modificationAllowed, label: "Edits allowed" },
    { ok: !rights.attributionRequired, label: rights.attributionRequired ? "Credit required" : "No credit needed" },
  ];
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-[11px]">{rights.license}</span>
        {flags.map((f) => (
          <span key={f.label} className={cn("inline-flex items-center gap-1 text-xs", f.ok ? "text-muted-foreground" : "text-tally")}>
            {f.ok ? <Check className="size-3.5 text-success" /> : <X className="size-3.5" />}
            {f.label}
          </span>
        ))}
      </div>
      {detailed && (
        <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Source</dt>
          <dd>
            <a href={rights.sourceUrl} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
              {rights.source}
            </a>
          </dd>
          <dt className="text-muted-foreground">Creator</dt>
          <dd>{rights.creator ?? "Unknown"}</dd>
          {rights.licenseUrl && (
            <>
              <dt className="text-muted-foreground">Licence</dt>
              <dd>
                <a href={rights.licenseUrl} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                  Read the terms
                </a>
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">Collected</dt>
          <dd>{new Date(rights.collectedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</dd>
          {rights.notes && (
            <>
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="text-muted-foreground">{rights.notes}</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
