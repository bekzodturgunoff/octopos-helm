/** Every page's title block, as the dash writes it: a big title, a quiet line under it, actions below. */
export function PageHeader({title, subtitle, children}: {title: React.ReactNode; subtitle?: React.ReactNode; children?: React.ReactNode}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-on-surface-secondary text-sm">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
