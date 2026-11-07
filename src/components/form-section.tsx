import {ChevronDown} from "lucide-react";
import {cn} from "@/lib/utils";

/**
 * A form's collapsible card: what it asks, with its current answer under the title. Collapsed
 * fields stay mounted, so they still submit.
 */
export function CollapsibleSection({
  title,
  summary,
  className,
  bodyClassName,
  children,
  ...props
}: Omit<React.DetailsHTMLAttributes<HTMLDetailsElement>, "title"> & {
  title: React.ReactNode;
  summary?: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <details {...props} className={cn("border-border-secondary bg-surface group/details rounded-lg border lg:col-span-2", className)}>
      <summary className="bg-surface-300 border-b-border-secondary flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 group-open/details:rounded-b-none group-open/details:border-b">
        <span className="flex min-w-0 flex-col text-left">
          <span className="truncate">{title}</span>
          {summary ? <span className="text-on-surface-secondary truncate text-sm">{summary}</span> : null}
        </span>
        <ChevronDown size={20} className="text-on-surface-accent shrink-0 duration-300 group-open/details:rotate-180" />
      </summary>
      <div className={cn("p-3", bodyClassName)}>{children}</div>
    </details>
  );
}

/** The ruled heading over a section of a record's page, with what can be done to it at the end. */
export function SectionHeader({title, action}: {title: React.ReactNode; action?: React.ReactNode}) {
  return (
    <div className="border-b-border-secondary flex justify-between border-b py-1.5">
      <h5 className="text-on-surface-secondary text-sm font-medium">{title}</h5>
      {action}
    </div>
  );
}
