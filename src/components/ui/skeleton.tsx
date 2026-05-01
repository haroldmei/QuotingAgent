import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("rounded-md skeleton-shimmer", className)}
      {...props}
    />
  );
}

function LeadCardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading lead"
      className="rounded-md border border-slate-200 bg-white p-4 min-h-[96px] flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-3 w-40" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
    </div>
  );
}

function QuoteDraftSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading quote" className="flex flex-col gap-3">
      <Skeleton className="h-12 w-full" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-8 w-10 rounded-full" />
        </div>
      ))}
      <Skeleton className="h-20 w-full rounded-md mt-2" />
    </div>
  );
}

export { Skeleton, LeadCardSkeleton, QuoteDraftSkeleton };
