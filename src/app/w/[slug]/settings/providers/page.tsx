import type { Metadata } from "next";
import { CAPABILITY_META } from "@/server/providers/catalog";
import { getCapabilityStatuses } from "@/server/providers/registry";
import type { CapabilityStatus } from "@/server/providers/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Providers" };

const STATE: Record<CapabilityStatus["state"], { label: string; dot: string }> = {
  ready: { label: "Ready", dot: "bg-success" },
  planned: { label: "Configured", dot: "bg-chart-2" },
  missing_credentials: { label: "Missing key", dot: "bg-tally" },
  unconfigured: { label: "Not configured", dot: "bg-muted-foreground/40" },
};

export default function ProvidersPage() {
  const statuses = getCapabilityStatuses();
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Providers</h2>
        <p className="max-w-[65ch] text-sm text-muted-foreground">
          Each production capability is served by a swappable provider. They are set in the server environment, and keys never
          reach the browser. Generation capabilities arrive in later phases.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr className="text-left">
              <th className="label-meta px-4 py-2.5 font-medium">Capability</th>
              <th className="label-meta px-4 py-2.5 font-medium">Provider</th>
              <th className="label-meta px-4 py-2.5 font-medium">Status</th>
              <th className="label-meta hidden px-4 py-2.5 text-right font-medium sm:table-cell">Phase</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {statuses.map(({ capability, status }) => {
              const meta = CAPABILITY_META[capability];
              const state = STATE[status.state];
              return (
                <tr key={capability}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                    {"provider" in status ? status.provider.label : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
                      <span className={cn("size-1.5 rounded-full", state.dot)} />
                      {state.label}
                    </span>
                    {status.state !== "ready" && <p className="mt-0.5 text-[11px] text-muted-foreground">{status.reason}</p>}
                  </td>
                  <td className="tabular hidden px-4 py-3 text-right text-[13px] text-muted-foreground sm:table-cell">
                    {String(meta.phase).padStart(2, "0")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
