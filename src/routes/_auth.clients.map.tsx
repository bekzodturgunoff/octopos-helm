import {Suspense, useMemo, useState} from "react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link, redirect} from "@tanstack/react-router";
import {Button, Input} from "@yeahuz/kdsx-react";
import {useMapConfig} from "@yeahuz/kdsx-react/map";
import {LoaderCircle, LocateFixed, MapPin, Navigation, Phone, Search, X} from "lucide-react";
import {useTranslation} from "react-i18next";
import {listClientPlacesOptions, type ClientPlace} from "@/api";
import {PageHeader} from "@/components/page-header";
import {ClientsViews} from "@/components/clients-views";
import {FilterSelect} from "@/components/filter-bar";
import {StatusText} from "@/components/status-text";
import {EmptyState} from "@/components/empty-state";
import {Skeleton} from "@/components/skeleton";
import {PlacesMap} from "@/components/places-map";
import {mapLinks, PLACE_STATES, placeKey, placeReasons, placeState, placeStateColor, placeStateWord, type PlaceState} from "@/lib/places";
import {can} from "@/permission";
import {cn} from "@/lib/utils";

type MapSearch = {state?: PlaceState; city?: string; mine?: boolean; place?: string};

export let Route = createFileRoute("/_auth/clients/map")({
  beforeLoad: ({context}) => {
    if (!can(context.user, "client.read")) throw redirect({to: "/403"});
    return {backLink: {to: "/"}};
  },
  validateSearch: (search: Record<string, unknown>): MapSearch => ({
    state: PLACE_STATES.includes(search.state as PlaceState) ? (search.state as PlaceState) : undefined,
    city: (search.city as string) || undefined,
    mine: search.mine === true || search.mine === "true" ? true : undefined,
    place: (search.place as string) || undefined,
  }),
  loader: ({context}) => {
    context.queryClient.prefetchQuery(listClientPlacesOptions());
  },
  component: MapPage,
});

function MapPage() {
  let {t} = useTranslation();
  return (
    <div className="flex flex-col gap-8 px-4">
      <PageHeader
        title={t("clients:clients", {defaultValue: "Clients"})}
        subtitle={t("clients:mapHint", {defaultValue: "Every client branch. Red needs a visit, yellow a call. Pick one to get directions."})}
      />
      <ClientsViews value="map" />
      <Suspense fallback={<Skeleton className="h-[60vh] rounded-xl" />}>
        <Places />
      </Suspense>
    </div>
  );
}

type Point = {latitude: number; longitude: number};

/** Straight-line distance in km. Good enough to say which client is closer; the map app does the road. */
function km(a: Point, b: Point) {
  let rad = Math.PI / 180;
  let dLat = (b.latitude - a.latitude) * rad;
  let dLng = (b.longitude - a.longitude) * rad;
  let h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function formatKm(value: number) {
  return value < 1 ? `${Math.round(value * 1000)} m` : `${value < 10 ? value.toFixed(1) : Math.round(value)} km`;
}

let ORDER: Record<PlaceState, number> = {down: 0, attention: 1, fine: 2, left: 3};

function Places() {
  let {t} = useTranslation();
  let search = Route.useSearch();
  let navigate = Route.useNavigate();
  let {user} = Route.useRouteContext();
  let {tiles} = useMapConfig();
  let {data} = useSuspenseQuery({...listClientPlacesOptions(), refetchInterval: 60_000});
  let [q, setQ] = useState("");
  let [me, setMe] = useState<Point>();
  let [locating, setLocating] = useState(false);
  let [locateFailed, setLocateFailed] = useState(false);

  let judged = useMemo(() => data.items.map((place) => ({place, state: placeState(place)})), [data.items]);
  let counts = useMemo(() => {
    let map = new Map<PlaceState, number>();
    for (let {state} of judged) map.set(state, (map.get(state) ?? 0) + 1);
    return map;
  }, [judged]);
  let cities = useMemo(() => [...new Set(data.items.map((p) => p.city).filter(Boolean) as string[])].sort(), [data.items]);

  let rows = useMemo(() => {
    let needle = q.trim().toLowerCase();
    return (
      judged
        // Clients who left are only on the map when asked for.
        .filter(({state}) => (search.state ? state === search.state : state !== "left"))
        .filter(({place}) => !search.city || place.city === search.city)
        .filter(({place}) => !search.mine || place.accountManager?.id === user.id)
        .filter(({place}) => !needle || place.clientName.toLowerCase().includes(needle) || place.location.name.toLowerCase().includes(needle) || place.location.address?.toLowerCase().includes(needle))
        .map((row) => ({...row, distance: me ? km(me, row.place.location) : undefined}))
        .sort((a, b) => (me ? a.distance! - b.distance! : ORDER[a.state] - ORDER[b.state] || a.place.clientName.localeCompare(b.place.clientName)))
    );
  }, [judged, search.state, search.city, search.mine, user.id, q, me]);

  let places = useMemo(() => rows.map((row) => row.place), [rows]);
  let selected = rows.find((row) => placeKey(row.place) === search.place);

  let select = (key?: string) => navigate({search: (prev) => ({...prev, place: key}), replace: true});

  function locate() {
    if (!navigator.geolocation) return setLocateFailed(true);
    setLocating(true);
    setLocateFailed(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMe({latitude: position.coords.latitude, longitude: position.coords.longitude});
        setLocating(false);
      },
      () => {
        setLocateFailed(true);
        setLocating(false);
      },
      {enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000},
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-wrap gap-2">
        {PLACE_STATES.filter((s) => counts.get(s)).map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => navigate({search: (prev) => ({...prev, state: search.state === s ? undefined : s, place: undefined}), replace: true})}
              className={cn("bg-surface-300 hover:bg-surface-400 rounded-full px-3 py-1.5 text-sm", {"ring-accent ring-2": search.state === s})}
            >
              <StatusText color={placeStateColor(s)}>
                {placeStateWord(t, s)} <span className="text-on-surface-secondary tabular-nums">{counts.get(s)}</span>
              </StatusText>
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Input
          className="sm:max-w-80"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("clients:mapSearch", {defaultValue: "Client, branch or address"})}
          startAdornment={<Search size={18} className="text-on-surface-secondary" />}
        />
        {cities.length > 1 ? (
          <FilterSelect
            label={t("clients:anyCity", {defaultValue: "Any city"})}
            value={search.city}
            options={cities.map((city) => ({value: city, label: city}))}
            onChange={(city) => navigate({search: (prev) => ({...prev, city, place: undefined}), replace: true})}
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            color="neutral"
            variant={search.mine ? "fill" : "outline"}
            onClick={() => navigate({search: (prev) => ({...prev, mine: prev.mine ? undefined : true, place: undefined}), replace: true})}
          >
            {t("clients:myClientsOnly", {defaultValue: "My clients only"})}
          </Button>
          <Button type="button" size="sm" color="neutral" variant={me ? "fill" : "outline"} disabled={locating} onClick={me ? () => setMe(undefined) : locate}>
            {locating ? <LoaderCircle size={14} className="animate-spin" /> : <LocateFixed size={14} />}
            {t("clients:nearestFirst", {defaultValue: "Nearest to me"})}
          </Button>
        </div>
      </div>
      {locateFailed ? (
        <p className="text-on-surface-secondary -mt-3 text-sm">{t("clients:locateFailed", {defaultValue: "Your browser did not share your location. Allow it in the address bar and try again."})}</p>
      ) : null}

      <div className={cn("grid gap-6", tiles ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : "")}>
        {tiles ? (
          <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
            <PlacesMap places={places} selectedKey={search.place} onSelect={select} className="h-[55vh] lg:h-[calc(100vh-17rem)] lg:min-h-[28rem]" />
            {selected ? <PlaceCard place={selected.place} distance={selected.distance} onClose={() => select(undefined)} className="lg:hidden" /> : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-4">
          {selected ? <PlaceCard place={selected.place} distance={selected.distance} onClose={() => select(undefined)} className={tiles ? "hidden lg:flex" : ""} /> : null}
          <span className="text-on-surface-secondary text-sm">
            {t("clients:branchesShown", {defaultValue: "Branches: {{count}}", count: rows.length})}
            {/* The server counts branches without a point across everything this person can see, so it only fits the unfiltered view. */}
            {data.unplaced > 0 && !search.state && !search.city && !search.mine && !q.trim()
              ? ` · ${t("clients:branchesUnplaced", {defaultValue: "{{count}} without a point on the map yet", count: data.unplaced})}`
              : ""}
          </span>
          {rows.length === 0 ? (
            <EmptyState icon={MapPin} title={t("clients:noPlaces", {defaultValue: "No branches match"})} />
          ) : (
            <ul className="flex flex-col gap-1">
              {rows.map(({place, state, distance}) => {
                let key = placeKey(place);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => select(key)}
                      className={cn("hover:bg-surface-300 flex w-full items-start justify-between gap-3 rounded-lg p-2 text-left", {"bg-surface-300": key === search.place})}
                    >
                      <span className="flex min-w-0 flex-col">
                        <StatusText color={placeStateColor(state)} className="min-w-0">
                          <span className="truncate font-medium">{place.clientName}</span>
                        </StatusText>
                        <span className="text-on-surface-secondary truncate pl-4 text-sm">
                          {place.location.name}
                          {place.location.address ? ` · ${place.location.address}` : ""}
                        </span>
                      </span>
                      {distance !== undefined ? <span className="text-on-surface-secondary shrink-0 text-sm tabular-nums">{formatKm(distance)}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function PlaceCard({place, distance, onClose, className}: {place: ClientPlace; distance?: number; onClose: () => void; className?: string}) {
  let {t} = useTranslation();
  let state = placeState(place);
  let reasons = placeReasons(t, place);
  return (
    <div className={cn("bg-surface-300 flex flex-col gap-4 rounded-xl p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Link to="/clients/$id" params={{id: place.clientID}} className="truncate font-semibold hover:underline">
            {place.clientName}
          </Link>
          <span className="text-sm">
            {place.location.name}
            {distance !== undefined ? <span className="text-on-surface-secondary"> · {formatKm(distance)}</span> : null}
          </span>
          {place.location.address ? <span className="text-on-surface-secondary text-sm">{place.location.address}</span> : null}
        </div>
        <Button type="button" size="sm" icon color="neutral" variant="ghost" aria-label={t("common:close", {defaultValue: "Close"})} onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <StatusText color={placeStateColor(state)}>{placeStateWord(t, state)}</StatusText>
        {reasons.length ? <span className="text-on-surface-secondary pl-4">{reasons.join(" · ")}</span> : null}
      </div>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
        <dt className="text-on-surface-secondary">{t("clients:owner", {defaultValue: "Owner"})}</dt>
        <dd className="flex flex-wrap gap-x-2">
          <span>{place.ownerName}</span>
          {place.ownerPhone ? <a href={`tel:${place.ownerPhone.replace(/\s/g, "")}`}>{place.ownerPhone}</a> : null}
        </dd>
        {place.location.phone ? (
          <>
            <dt className="text-on-surface-secondary">{t("clients:branchPhone", {defaultValue: "Branch"})}</dt>
            <dd>
              <a href={`tel:${place.location.phone.replace(/\s/g, "")}`}>{place.location.phone}</a>
            </dd>
          </>
        ) : null}
        {place.accountManager ? (
          <>
            <dt className="text-on-surface-secondary">{t("clients:accountManager", {defaultValue: "Account manager"})}</dt>
            <dd className="truncate">{place.accountManager.name}</dd>
          </>
        ) : null}
        <dt className="text-on-surface-secondary">{t("fleet:installations", {defaultValue: "Installations"})}</dt>
        <dd>{place.installations.total}</dd>
      </dl>

      <div className="flex flex-col gap-2">
        <span className="text-on-surface-secondary flex items-center gap-1 text-xs">
          <Navigation size={12} /> {t("clients:directionsIn", {defaultValue: "Directions in"})}
        </span>
        <div className="flex flex-wrap gap-2">
          {mapLinks(place.location).map((link) => (
            <Button key={link.name} size="sm" color="brand" variant="outline" asChild>
              <a href={link.href} target="_blank" rel="noreferrer">
                {link.name}
              </a>
            </Button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" color="brand" asChild>
          <Link to="/clients/$id" params={{id: place.clientID}}>
            {t("clients:openClient", {defaultValue: "Open client"})}
          </Link>
        </Button>
        {place.location.phone || place.ownerPhone ? (
          <Button size="sm" color="neutral" variant="outline" asChild>
            <a href={`tel:${(place.location.phone ?? place.ownerPhone)!.replace(/\s/g, "")}`}>
              <Phone size={14} /> {t("clients:call", {defaultValue: "Call"})}
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
