import {createContext, type ReactNode, useCallback, useContext, useLayoutEffect, useState} from "react";
import {cn} from "@/lib/utils";

type Props = {
  title: string;
  hint?: string;
  endAdornment?: ReactNode;
  className?: string;
  children: ReactNode;
};

type EndAdornmentRegistrar = (endAdornment: ReactNode | null) => void;

let ChartCardEndAdornmentContext = createContext<EndAdornmentRegistrar | null>(null);

export function useChartCardEndAdornment(endAdornment: ReactNode) {
  let register = useContext(ChartCardEndAdornmentContext);

  useLayoutEffect(() => {
    if (!register) return;
    register(endAdornment);
    return () => register(null);
  }, [register, endAdornment]);

  return register !== null;
}

export function ChartCard({title, hint, endAdornment, className, children}: Props) {
  let [registeredEndAdornment, setRegisteredEndAdornment] = useState<ReactNode>(null);
  let registerEndAdornment = useCallback<EndAdornmentRegistrar>((value) => setRegisteredEndAdornment(value), []);
  let resolvedEndAdornment = endAdornment ?? registeredEndAdornment;

  return (
    <ChartCardEndAdornmentContext.Provider value={registerEndAdornment}>
      <div className={cn("bg-surface-300 flex flex-col gap-4 rounded-xl p-4", className)}>
        {resolvedEndAdornment ? (
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h3 className="text-sm font-medium">{title}</h3>
              {hint ? <p className="text-on-surface-secondary text-xs">{hint}</p> : null}
            </div>
            <div className="shrink-0">{resolvedEndAdornment}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">{title}</h3>
            {hint ? <p className="text-on-surface-secondary text-xs">{hint}</p> : null}
          </div>
        )}
        {children}
      </div>
    </ChartCardEndAdornmentContext.Provider>
  );
}
