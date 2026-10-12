"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ImageOff, Music, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteAssetAction, setAssetStatusAction } from "@/server/actions/creative";
import type { AssetRights } from "@/lib/creative-types";
import { setDragItem, storageUrl } from "@/lib/drag";
import { cn } from "@/lib/utils";
import { RightsSummary } from "./rights";

export interface AssetSummary {
  id: string;
  name: string;
  kind: string;
  usageStatus: string;
  storageKey: string | null;
  externalUrl: string | null;
  thumbnailUrl: string | null;
  rights: AssetRights | null;
  projectName: string | null;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  candidate: { label: "Saved", cls: "bg-muted text-muted-foreground" },
  approved: { label: "Approved", cls: "bg-success/15 text-success" },
  in_use: { label: "In use", cls: "bg-tally/15 text-tally" },
};

export function MyAssets({ slug, assets, canEdit }: { slug: string; assets: AssetSummary[]; canEdit: boolean }) {
  const [open, setOpen] = useState<AssetSummary | null>(null);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {assets.map((a) => (
          <AssetCard key={a.id} slug={slug} asset={a} canEdit={canEdit} onOpen={() => setOpen(a)} />
        ))}
      </div>
      <Dialog open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-[min(820px,calc(100%-2rem))]">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="line-clamp-2 pr-8">{open.name}</DialogTitle>
              </DialogHeader>
              <Media asset={open} large />
              <RightsSummary rights={open.rights} detailed />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AssetCard({ slug, asset, canEdit, onOpen }: { slug: string; asset: AssetSummary; canEdit: boolean; onOpen: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const status = STATUS[asset.usageStatus] ?? STATUS.candidate!;
  const act = (fn: () => Promise<{ ok: boolean; message?: string }>, msg: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.message);
      toast.success(msg);
      router.refresh();
    });

  return (
    <div
      draggable
      onDragStart={(e) => setDragItem(e, { type: "asset", id: asset.id, kind: asset.kind, url: storageUrl(asset.storageKey) ?? asset.externalUrl, name: asset.name })}
      className="flex flex-col overflow-hidden rounded-lg bg-card shadow-card"
    >
      <button type="button" onClick={onOpen} className="relative text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Media asset={asset} />
        <span className={cn("absolute top-2.5 left-2.5 rounded-md px-2 py-0.5 text-xs font-medium backdrop-blur", status.cls)}>{status.label}</span>
      </button>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="line-clamp-1 font-medium">{asset.name}</p>
          <p className="text-sm text-muted-foreground">
            {asset.kind}
            {asset.projectName ? ` · ${asset.projectName}` : ""}
          </p>
        </div>
        <RightsSummary rights={asset.rights} />
        {canEdit && (
          <div className="mt-auto flex gap-1 pt-1">
            {asset.usageStatus !== "approved" && (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => setAssetStatusAction(slug, asset.id, "approved"), "Approved")}>
                <Check /> Approve
              </Button>
            )}
            {asset.usageStatus === "approved" && (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => setAssetStatusAction(slug, asset.id, "candidate"), "Moved back to saved")}>
                <X /> Unapprove
              </Button>
            )}
            <Button size="icon-sm" variant="ghost" className="ml-auto" disabled={pending} aria-label={`Delete ${asset.name}`} onClick={() => act(() => deleteAssetAction(slug, asset.id), "Asset removed")}>
              <Trash2 />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Media({ asset, large = false }: { asset: AssetSummary; large?: boolean }) {
  const src = storageUrl(asset.storageKey) ?? asset.externalUrl;
  if (asset.kind === "audio") {
    return (
      <div className={cn("flex flex-col justify-center gap-3 bg-gradient-to-br from-tally/20 to-transparent p-4", large ? "min-h-40" : "aspect-video")}>
        <Music className="size-6 text-tally" />
        {src && <audio controls src={src} className="w-full" preload="none" />}
      </div>
    );
  }
  if (asset.kind === "video" && large && src) return <video src={src} controls autoPlay muted loop className="max-h-[60dvh] w-full rounded-lg bg-black" />;
  const img = large ? (src ?? asset.thumbnailUrl) : (asset.thumbnailUrl ?? src);
  if (!img)
    return (
      <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
        <ImageOff className="size-6" />
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={img} alt={asset.name} loading="lazy" className={cn("w-full bg-muted object-cover", large ? "max-h-[60dvh] rounded-lg object-contain" : "aspect-video")} />;
}
