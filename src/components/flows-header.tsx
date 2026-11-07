import {Link, useLocation} from "@tanstack/react-router";
import {Button} from "@yeahuz/kdsx-react";
import {ArrowLeft, X} from "lucide-react";
import {cn} from "@/lib/utils";
import {useMemo} from "react";
import {LinkComponentProps} from "node_modules/@tanstack/react-router/dist/esm/link";
import {NavLink} from "./nav-link";
import {Show} from "@yeahuz/kdsx-react";

export type Step = {
  label: string;
  pathname: LinkComponentProps<"a">["to"];
};

// closable defaults to true because leaving is the ordinary case: every flow
// under /flows is something a person may abandon. It used to be driven by
// onClose, which only multi-step flows pass - they have a draft to reset - so
// every single-page flow silently lost its way out. Onboarding is the one
// place that genuinely cannot be left, and it says so.
export function FlowsHeader({steps = [], onClose, closable = true}: {steps?: Step[]; onClose?: () => void; closable?: boolean}) {
  let location = useLocation();
  let stepIndex = useMemo(() => steps.findIndex((s) => s.pathname === location.pathname), [steps, location]);
  return (
    <div>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 md:gap-0">
        {stepIndex > 0 ? (
          <div className="flex-1 shrink-0">
            <Button size="lg" color="neutral" icon={true} asChild>
              <Link to={steps[stepIndex - 1].pathname}>
                <ArrowLeft size={20} />
              </Link>
            </Button>
          </div>
        ) : (
          <Link to="/" className="flex-1 shrink-0 text-2xl font-semibold tracking-tighter">
            Octopos <span className="text-on-surface-secondary font-normal">Helm</span>
          </Link>
        )}
        {steps.length ? (
          <div className="relative order-1 flex flex-1 basis-full flex-col px-8 md:order-[0] md:basis-auto">
            <div className="bg-surface-300 my-2.5 h-1 w-full overflow-hidden rounded-md">
              <div className="bg-accent h-full rounded-md transition-[width] duration-500" style={{width: (stepIndex / (steps.length - 1)) * 100 + "%"}}></div>
            </div>
            <ol className="-mx-6 flex items-center justify-between text-sm">
              {steps.map((step, index) => (
                <li key={index}>
                  <NavLink to={index < stepIndex ? step.pathname : undefined} className={cn({"font-semibold": index === stepIndex})}>
                    {step.label}
                  </NavLink>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        <div className="flex flex-1 shrink-0 justify-end">
          <Show when={closable}>
            <Button size="lg" color="neutral" variant="ghost" icon={true} className="ml-auto shrink-0" asChild onClick={onClose}>
              <Link to="/">
                <X size={20} />
              </Link>
            </Button>
          </Show>
        </div>
      </div>
    </div>
  );
}
