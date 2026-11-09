import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {RouterProvider} from "@tanstack/react-router";
import {QueryClientProvider} from "@tanstack/react-query";
import {TooltipProvider} from "@yeahuz/kdsx-react";
import {MapProvider} from "@yeahuz/kdsx-react/map";
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

// In development with no tile server set, vite.config.ts serves public OpenStreetMap tiles at
// /__map, so the map is drawn without running the geo stack. Production never takes this path.
let DEV_MAP =
  import.meta.env.DEV && !import.meta.env.VITE_MAP_TILES_URL
    ? {tiles: `${location.origin}${import.meta.env.BASE_URL}__map`, glyphs: `${location.origin}${import.meta.env.BASE_URL}__map/font/{fontstack}/{range}`}
    : undefined;

function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            {/* The dash's maps: our own tiles for Uzbekistan (kdsx-api/docker-compose-geo.yml), drawn in the theme's colours. */}
            <MapProvider
              tiles={import.meta.env.VITE_MAP_TILES_URL ?? DEV_MAP?.tiles}
              archive={import.meta.env.VITE_MAP_ARCHIVE}
              glyphs={import.meta.env.VITE_MAP_GLYPHS ?? DEV_MAP?.glyphs}
              loadWorker={() => import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url")}
              debug={import.meta.env.DEV}
            >
              <Toaster>
                <StepUpProvider>
                  <RouterProvider router={router} />
                </StepUpProvider>
              </Toaster>
            </MapProvider>
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
