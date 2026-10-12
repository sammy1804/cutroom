import Link from "next/link";
import { CropMarks } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] items-center justify-center px-4">
      <div className="relative flex w-full max-w-md flex-col items-start gap-4 rounded-lg border border-dashed px-8 py-12">
        <CropMarks />
        <span className="label-meta">404 · Missing frame</span>
        <h1 className="text-xl font-semibold tracking-tight">We couldn&apos;t find that</h1>
        <p className="text-sm text-muted-foreground">
          It may have been deleted, or you might not have access to the workspace it belongs to.
        </p>
        <Button asChild variant="outline">
          <Link href="/">Back to your workspace</Link>
        </Button>
      </div>
    </div>
  );
}
