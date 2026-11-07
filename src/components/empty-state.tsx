import {cn} from "@/lib/utils";

type Props = {
  icon?: React.ElementType;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
};

export function EmptyState({icon: Icon, title, description, children, className}: Props) {
  return (
    <div className={cn("flex flex-col items-center gap-4 py-16", className)}>
      {Icon && (
        <div className="bg-surface-300 flex size-14 items-center justify-center rounded-full">
          <Icon size={20} className="text-on-surface-secondary" />
        </div>
      )}
      <div className="flex flex-col items-center gap-1">
        <h3 className="text-sm">{title}</h3>
        {description && <p className="text-on-surface-secondary text-sm">{description}</p>}
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
