import { PageContainer } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export function HeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-2.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-56" />
      </div>
      {withAction && <Skeleton className="h-8 w-28" />}
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <PageContainer className="space-y-10" aria-busy>
      <HeaderSkeleton />
      <Skeleton className="h-[84px] w-full rounded-lg" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <div className="divide-y rounded-lg border">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/5" />
              <Skeleton className="ml-auto h-5 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <CardGridSkeleton />
    </PageContainer>
  );
}

export function CardGridSkeleton({ count = 6, cols = "sm:grid-cols-2 lg:grid-cols-3" }: { count?: number; cols?: string }) {
  return (
    <div className={`grid gap-3 ${cols}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-6 rounded-lg border p-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function ListPageSkeleton() {
  return (
    <PageContainer className="space-y-6" aria-busy>
      <HeaderSkeleton />
      <Skeleton className="h-8 w-40" />
      <div className="divide-y rounded-lg border">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <Skeleton className="size-3 rounded-[3px]" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="ml-auto h-3 w-16" />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}

export function DetailSkeleton() {
  return (
    <PageContainer className="space-y-8" aria-busy>
      <Skeleton className="h-3 w-40" />
      <HeaderSkeleton />
      <Skeleton className="h-24 w-full rounded-md" />
      <CardGridSkeleton count={4} cols="md:grid-cols-2" />
    </PageContainer>
  );
}
