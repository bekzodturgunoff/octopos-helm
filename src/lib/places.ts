import type {TFunction} from "i18next";
import type {ClientPlace} from "@/api";
import type {StatusColor} from "@/components/status-text";

/**
 * What a branch on the map needs, worst first:
 * - down: a till there is not running or not heard from, or the client is suspended. Someone may
 *   have to go there.
 * - attention: a till is lagging, the client owes money, or is at risk. A call first.
 * - fine: nothing to do.
 * - left: the client has churned. Shown only when asked for.
 */
export type PlaceState = "down" | "attention" | "fine" | "left";

export let PLACE_STATES: PlaceState[] = ["down", "attention", "fine", "left"];

export function placeState(place: ClientPlace): PlaceState {
  if (place.clientStatus === "churned") return "left";
  let i = place.installations;
  if (i.failing > 0 || i.offline > 0 || place.clientStatus === "suspended") return "down";
  if (i.degraded > 0 || place.balanceDue.amount > 0 || place.grade === "atRisk") return "attention";
  return "fine";
}

export function placeStateColor(state: PlaceState): StatusColor {
  return state === "down" ? "red" : state === "attention" ? "yellow" : state === "fine" ? "green" : "neutral";
}

export function placeStateWord(t: TFunction, state: PlaceState) {
  switch (state) {
    case "down":
      return t("clients:placeDown", {defaultValue: "Needs a visit"});
    case "attention":
      return t("clients:placeAttention", {defaultValue: "Needs attention"});
    case "fine":
      return t("clients:placeFine", {defaultValue: "All good"});
    case "left":
      return t("clients:placeLeft", {defaultValue: "Left"});
  }
}

/** Why a branch has the colour it has, in short phrases, worst first. */
export function placeReasons(t: TFunction, place: ClientPlace): string[] {
  let i = place.installations;
  let reasons: string[] = [];
  if (place.clientStatus === "suspended") reasons.push(t("clients:placeSuspended", {defaultValue: "Client suspended"}));
  if (i.failing > 0) reasons.push(t("clients:placeFailing", {defaultValue: "Not syncing: {{count}}", count: i.failing}));
  if (i.offline > 0) reasons.push(t("clients:placeOffline", {defaultValue: "Offline: {{count}}", count: i.offline}));
  if (i.degraded > 0) reasons.push(t("clients:placeDegraded", {defaultValue: "Behind on sync: {{count}}", count: i.degraded}));
  if (place.balanceDue.amount > 0) reasons.push(t("clients:placeOwes", {defaultValue: "Owes {{amount}}", amount: place.balanceDue.display}));
  if (place.grade === "atRisk") reasons.push(t("clients:placeAtRisk", {defaultValue: "At risk"}));
  return reasons;
}

/** A stable key for one branch: a location id is only unique within its client. */
export function placeKey(place: {clientID: string; location: {id: string}}) {
  return `${place.clientID}:${place.location.id}`;
}

/**
 * The map apps people here actually use. Each is a plain link, which a phone hands to the app when
 * it is installed: Yandex is better in one city, Google or 2GIS in another.
 */
export function mapLinks(point: {latitude: number; longitude: number}) {
  let {latitude, longitude} = point;
  return [
    {name: "Yandex", href: `https://yandex.uz/maps/?rtext=~${latitude},${longitude}&rtt=auto`},
    {name: "Google", href: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`},
    {name: "2GIS", href: `https://2gis.uz/geo/${longitude},${latitude}`},
  ];
}
