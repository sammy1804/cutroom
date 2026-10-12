import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-10 px-4 py-14 sm:px-8 lg:grid-cols-[180px_minmax(0,1fr)_300px]" aria-busy>
      <Skeleton className="h-16 w-full" />
      <div className="space-y-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
      <Skeleton className="hidden h-40 w-full lg:block" />
    </div>
  );
}
