import {Skeleton} from "@/components/skeleton";

export function ListSkeleton({rows = 5}: {rows?: number}) {
  return (
    <ul className="flex flex-col px-2">
      {Array.from({length: rows}).map((_, i) => (
        <li key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DetailSkeleton({rows = 4}: {rows?: number}) {
  return (
    <section className="flex flex-col gap-4">
      <Skeleton className="h-4 w-32" />
      <div className="border-b-border-secondary border-b" />
      <div className="flex flex-wrap gap-y-4">
        {Array.from({length: rows}).map((_, i) => (
          <div key={i} className="flex basis-full flex-col gap-1 sm:basis-1/2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function DetailPageSkeleton({sections = 1, rows = 4}: {sections?: number; rows?: number}) {
  return (
    <div className="flex flex-col gap-10 px-4">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-3">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-36 rounded-full" />
        </div>
      </div>
      {Array.from({length: sections}).map((_, i) => (
        <DetailSkeleton key={i} rows={rows} />
      ))}
    </div>
  );
}

export function ReportListSkeleton({rows = 5}: {rows?: number}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {Array.from({length: rows}).map((_, i) => (
        <li key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FormPageSkeleton({rows = 4}: {rows?: number}) {
  return (
    <div className="flex flex-col px-4 sm:max-w-md">
      <Skeleton className="h-8 w-48" />
      <div className="mt-10 mb-5 flex flex-col gap-5">
        {Array.from({length: rows}).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:static sm:max-w-md sm:px-0">
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function FlowsPageSkeleton({rows = 4}: {rows?: number}) {
  return (
    <div className="mx-auto flex w-full flex-col px-4 sm:max-w-md">
      <Skeleton className="mx-auto h-8 w-48" />
      <div className="mt-10 mb-5 flex flex-col gap-5">
        {Array.from({length: rows}).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:static sm:px-0">
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function PaymentsReportSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-24" />
        <hr className="border-border-secondary border" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({length: 3}).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function SummaryReportSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-24" />
        <hr className="border-border-secondary border" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
      <div className="flex flex-col">
        <Skeleton className="h-6 w-20" />
        <hr className="border-border-secondary mt-2 mb-6 border" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({length: 7}).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="flex flex-col">
        <Skeleton className="h-6 w-20" />
        <hr className="border-border-secondary mt-2 mb-6 border" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({length: 7}).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
