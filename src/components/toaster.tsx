import {createContext, useCallback, useContext, useMemo, useState} from "react";
import {Button, ErrorToast, SuccessToast, ToastAction} from "@yeahuz/kdsx-react";

// One toast at a time, said by whoever acted last. Most of Helm's actions happen in a dialog that
// closes on success, so the toast is the only place the result is seen. An action — Undo, most
// often — rides on the toast the way the dash's UndoToast carries its button.

type ToastMessage = {tone: "success" | "error"; title: string; description?: string; action?: {label: string; onClick: () => void}; key: number};

let ToastContext = createContext<((message: Omit<ToastMessage, "key">) => void) | null>(null);

export function Toaster({children}: {children: React.ReactNode}) {
  let [message, setMessage] = useState<ToastMessage>();
  let show = useCallback((next: Omit<ToastMessage, "key">) => setMessage({...next, key: Date.now()}), []);
  let value = useMemo(() => show, [show]);
  let onOpenChange = (open: boolean) => {
    if (!open) setMessage(undefined);
  };
  return (
    <ToastContext.Provider value={value}>
      {children}
      {message?.tone === "error" ? (
        <ErrorToast key={message.key} title={message.title} description={message.description} open onOpenChange={onOpenChange} />
      ) : message ? (
        <SuccessToast key={message.key} className="flex items-center justify-between gap-2" title={message.title} description={message.description} open onOpenChange={onOpenChange}>
          {message.action ? (
            <ToastAction asChild altText={message.action.label}>
              <Button
                type="button"
                size="xs"
                color="neutral"
                onClick={() => {
                  message.action?.onClick();
                  setMessage(undefined);
                }}
              >
                {message.action.label}
              </Button>
            </ToastAction>
          ) : null}
        </SuccessToast>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  let context = useContext(ToastContext);
  if (context == null) throw new Error("useToast() must be used within Toaster");
  return context;
}
