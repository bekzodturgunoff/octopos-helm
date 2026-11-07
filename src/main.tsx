import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {RouterProvider} from "@tanstack/react-router";
import {QueryClientProvider} from "@tanstack/react-query";
import {TooltipProvider} from "@yeahuz/kdsx-react";
import {router, queryClient} from "./router.tsx";
import "./index.css";
import {LocaleProvider} from "./locale-provider.tsx";
import {ThemeProvider} from "./theme-provider.tsx";
import {Toaster} from "./components/toaster.tsx";
import {StepUpProvider} from "./components/step-up.tsx";
import "../i18n";

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
  interface HistoryState {
    from?: string;
  }
}

function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster>
              <StepUpProvider>
                <RouterProvider router={router} />
              </StepUpProvider>
            </Toaster>
          </TooltipProvider>
        </QueryClientProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
