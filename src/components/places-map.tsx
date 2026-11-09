import {useEffect, useRef} from "react";
import type {Marker} from "maplibre-gl";
import {createRoot, type Root} from "react-dom/client";
import {useTranslation} from "react-i18next";
import {MapControls, useBasemap} from "@yeahuz/kdsx-react/map";
import type {ClientPlace} from "@/api";
import {placeKey, placeState, type PlaceState} from "@/lib/places";
import {cn} from "@/lib/utils";

// Tashkent, where most clients are: where the map opens before it knows what to frame.
let TASHKENT = {latitude: 41.3111, longitude: 69.2797};

let PIN: Record<PlaceState, string> = {
  down: "bg-error-bright",
  attention: "bg-on-surface-yellow",
  fine: "bg-on-surface-green",
  left: "bg-on-surface-secondary",
};

// Worst on top, so a red pin is never hidden under a green one next door.
let LAYER: Record<PlaceState, number> = {down: 4, attention: 3, fine: 2, left: 1};

/**
 * Client branches on our own basemap (the same tiles and look as the dash's maps), one coloured pin
 * each. The colours are the page's: red needs a visit, yellow a call, green nothing.
 *
 * Pins are small React trees on MapLibre markers, kept by key, so a refetch moves and repaints the
 * same marker instead of making a new one.
 */
export function PlacesMap({
  places,
  selectedKey,
  onSelect,
  className,
  cooperative,
}: {
  places: ClientPlace[];
  selectedKey?: string;
  onSelect?: (key: string) => void;
  className?: string;
  /** In a scrolling page: one finger scrolls the page, two move the map. */
  cooperative?: boolean;
}) {
  let {t} = useTranslation();
  let {container, map, ready, tiles, debug} = useBasemap({center: places[0]?.location ?? TASHKENT, zoom: 11, options: cooperative ? {cooperativeGestures: true} : undefined});
  let markers = useRef(new Map<string, {marker: Marker; root: Root}>());
  let onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let instance = map.current;
    if (!instance || !ready) return;
    let cancelled = false;
    (async () => {
      let maplibre = await import("maplibre-gl");
      if (cancelled) return;
      let current = markers.current;
      let keep = new Set(places.map(placeKey));
      for (let [key, entry] of current) {
        if (keep.has(key)) continue;
        entry.marker.remove();
        let root = entry.root;
        setTimeout(() => root.unmount(), 0);
        current.delete(key);
      }
      for (let place of places) {
        let key = placeKey(place);
        let state = placeState(place);
        let selected = key === selectedKey;
        let content = <Pin state={state} selected={selected} label={selected ? `${place.clientName} · ${place.location.name}` : undefined} />;
        let at: [number, number] = [place.location.longitude, place.location.latitude];
        let entry = current.get(key);
        if (!entry) {
          let element = document.createElement("button");
          element.type = "button";
          element.style.cursor = onSelectRef.current ? "pointer" : "default";
          element.addEventListener("click", (event) => {
            event.stopPropagation();
            onSelectRef.current?.(key);
          });
          let root = createRoot(element);
          entry = {marker: new maplibre.Marker({element, anchor: "center"}).setLngLat(at).addTo(instance), root};
          current.set(key, entry);
        }
        entry.marker.setLngLat(at);
        let element = entry.marker.getElement();
        element.setAttribute("aria-label", `${place.clientName}, ${place.location.name}`);
        element.style.zIndex = String(selected ? 10 : LAYER[state]);
        entry.root.render(content);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, places, selectedKey, map]);

  useEffect(() => {
    let current = markers.current;
    return () => {
      for (let entry of current.values()) {
        entry.marker.remove();
        let root = entry.root;
        setTimeout(() => root.unmount(), 0);
      }
      current.clear();
    };
  }, []);

  // Every pin in view.
  function frame() {
    let instance = map.current;
    if (!instance || !ready || places.length === 0) return;
    let lats = places.map((p) => p.location.latitude);
    let lngs = places.map((p) => p.location.longitude);
    let [west, east, south, north] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)];
    if (west === east && south === north) return void instance.easeTo({center: [west, south], zoom: 15, duration: 500});
    instance.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      {padding: 48, maxZoom: 15, duration: 600},
    );
  }

  // Framed when the map is ready and whenever the filters change what is on it; after that the
  // view is the person's to move.
  let framedFor = useRef("");
  let shown = places.map(placeKey).join();
  useEffect(() => {
    if (!ready || framedFor.current === shown) return;
    framedFor.current = shown;
    frame();
  }, [ready, shown]);

  // Picking a branch in the list flies there.
  useEffect(() => {
    let instance = map.current;
    let place = places.find((p) => placeKey(p) === selectedKey);
    if (!instance || !ready || !place) return;
    instance.easeTo({center: [place.location.longitude, place.location.latitude], zoom: Math.max(instance.getZoom(), 14), duration: 500});
  }, [ready, selectedKey]);

  if (!tiles) {
    if (!debug) return null;
    return (
      <div className={cn("bg-surface-300 flex items-center justify-center rounded-xl p-4", className)}>
        <p className="text-on-surface-secondary text-center text-sm">VITE_MAP_TILES_URL is not set, so no map is drawn.</p>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      {/* In flow with an explicit height: MapLibre's own position:relative would collapse an absolute box. */}
      <div ref={container} className="h-full w-full" />
      <div className="absolute top-3 right-3">
        <MapControls
          map={map}
          ready={ready}
          onRecenter={frame}
          labels={{
            zoomIn: t("clients:mapZoomIn", {defaultValue: "Zoom in"}),
            zoomOut: t("clients:mapZoomOut", {defaultValue: "Zoom out"}),
            recenter: t("clients:mapShowAll", {defaultValue: "Show all"}),
          }}
        />
      </div>
    </div>
  );
}

function Pin({state, selected, label}: {state: PlaceState; selected: boolean; label?: string}) {
  return (
    <span className="relative flex items-center justify-center">
      {state === "down" ? <span className={cn("absolute size-5 animate-ping rounded-full opacity-50", PIN[state])} /> : null}
      <span className={cn("relative block rounded-full shadow ring-2 ring-white transition-all", PIN[state], selected ? "size-5" : "size-3.5")} />
      {label ? (
        <span className="bg-surface-100 text-on-surface absolute top-6 left-1/2 max-w-56 -translate-x-1/2 truncate rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap shadow">{label}</span>
      ) : null}
    </span>
  );
}
