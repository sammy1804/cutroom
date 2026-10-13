"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Imports a board pack (.cutroom.json) as a new project and opens its board. */
export function ImportBoardButton({ slug }: { slug: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    const form = new FormData();
    form.set("slug", slug);
    form.set("file", file);
    const res = await fetch("/api/board/import", { method: "POST", body: form }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { ok?: boolean; projectId?: string; message?: string } | null;
    setBusy(false);
    if (!res?.ok || !data?.ok || !data.projectId) return void toast.error(data?.message ?? "Import failed. Try again.");
    toast.success("Board imported");
    router.push(`/w/${slug}/projects/${data.projectId}/board`);
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        aria-label="Board pack file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void upload(f);
        }}
      />
      <Button variant="outline" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Upload data-icon="inline-start" />}
        Import board
      </Button>
    </>
  );
}
