import {SectionHeader} from "@/components/form-section";
import {cn} from "@/lib/utils";

// The dash's record-page pieces (they live inline on its fleet page): a label over a value, half a
// row wide on a large screen, and a ruled section to hold them.

export function Field({label, value, wide, className}: {label: string; value: React.ReactNode; wide?: boolean; className?: string}) {
  return (
    <li className={cn(wide ? "flex basis-full flex-col" : "flex basis-full flex-col sm:basis-1/2", className)}>
      <span className="text-on-surface-secondary text-sm">{label}</span>
      <span className={wide ? "break-all" : undefined}>{value}</span>
    </li>
  );
}

export function Section({title, action, children, className}: {title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string}) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <SectionHeader title={title} action={action} />
      {children}
    </section>
  );
}

export function Fields({children}: {children: React.ReactNode}) {
  return <ul className="flex flex-wrap gap-y-4">{children}</ul>;
}
