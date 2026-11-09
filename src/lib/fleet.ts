import type {TFunction} from "i18next";
import type {FleetNode} from "@/api/types";

export type FleetHealth = "healthy" | "degraded" | "crashLooping" | "misconfigured" | "offline" | "neverStarted" | "retired";

// An installation reports twice, on two channels, and the pair is what makes a
// diagnosis possible. The spoke reports on every sync exchange — only the running
// process knows what is actually running. The supervisor reports on its own 60s
// timer — only it knows whether the spoke is alive at all, because a crashed
// process cannot report its own crash.
//
// So the two silences mean different things, and reading either alone gets it
// wrong: a crash-looping spoke is silent on the exchange while its agent checks in
// perfectly, and reporting that as "offline" sends somebody to the customer's
// router when the fault is ours.
const STALE_EXCHANGE_MS = 5 * 60 * 1000;
const STALE_CHECKIN_MS = 5 * 60 * 1000;

// EX_CONFIG. The spoke saying its configuration is wrong, not its code — which is
// why the agent does not roll back on it, and why an operator should be sent to
// the env file rather than to the release.
const EXIT_CONFIG = 78;

function isFresh(at: string | undefined, within: number, now: number) {
  if (!at) return false;
  let parsed = Date.parse(at);
  return Number.isFinite(parsed) && now - parsed < within;
}

export function fleetHealth(node: FleetNode, now = Date.now()): FleetHealth {
  if (node.retiredAt) return "retired";
  let exchanging = isFresh(node.lastExchangeAt, STALE_EXCHANGE_MS, now);
  // A node with no agent predates the supervisor and can only ever be judged by
  // its exchange. Treating its missing checkin as a crash would report every
  // older installation in the fleet as broken.
  let checkingIn = node.supervised ? isFresh(node.lastCheckinAt, STALE_CHECKIN_MS, now) : exchanging;

  if (exchanging && checkingIn) {
    // Talking to us, but not everything it produced has arrived. Worth surfacing
    // separately from healthy: this is the shape of takings with no sale behind
    // them, and it is invisible in a plain up/down reading.
    if ((node.behindBy ?? 0) > 0 || (node.parkedOutstanding ?? 0) > 0 || node.unresolvedConflicts > 0) return "degraded";
    return "healthy";
  }
  if (checkingIn) {
    // The supervisor is answering and the spoke is not. That is ours to fix, and
    // the exit code says which half.
    if (node.lastExitCode === EXIT_CONFIG) return "misconfigured";
    if (!node.lastExchangeAt) return "neverStarted";
    return "crashLooping";
  }
  return "offline";
}

// Tag colours, kept in one place so the list and the detail page cannot drift.
// Only offline is the customer's network; everything amber or red is ours.
export function fleetHealthColor(health: FleetHealth): "green" | "yellow" | "red" | "neutral" {
  switch (health) {
    case "healthy":
      return "green";
    case "degraded":
      return "yellow";
    case "crashLooping":
    case "misconfigured":
    case "neverStarted":
      return "red";
    default:
      return "neutral";
  }
}

// A node has no name of its own. The address it advertises is what somebody
// standing in the building would recognise, so prefer it and fall back to a short
// id rather than showing a full UUID nobody can match to a machine.
export function fleetNodeLabel(node: FleetNode) {
  if (node.lanName) return node.lanName.replace(/^https?:\/\//, "").replace(/\/$/, "");
  let firstURL = node.lanURLs?.[0];
  if (firstURL) return firstURL.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return node.nodeID.slice(0, 8);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  let units = ["KB", "MB", "GB"];
  let value = bytes;
  let unit = -1;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

// Says what to do about it, not just what it is — the same words the dash shows a client's admin,
// so support and the client read one diagnosis.
export function fleetHealthHint(health: FleetHealth) {
  switch (health) {
    case "healthy":
      return "Reporting on both channels and up to date.";
    case "degraded":
      return "Reaching us, but some of what it produced has not arrived. Check the conflicts and the events it says it sent.";
    case "crashLooping":
      return "The supervisor is answering and the installation is not. It is crash-looping or failing to start — the error below says which.";
    case "misconfigured":
      return "The installation exited saying its configuration is wrong. Rolling back the version will not help; fix the configuration.";
    case "neverStarted":
      return "The supervisor is answering but this installation has never completed an exchange.";
    case "retired":
      return "Retired from the hub. Its exchanges are refused; re-enrol it from a seed to use the device again.";
    default:
      return "Nothing has been heard on either channel. The device is switched off or off the network — the client's side, not ours.";
  }
}

export let FLEET_HEALTH_ORDER: FleetHealth[] = ["crashLooping", "misconfigured", "neverStarted", "degraded", "offline", "healthy", "retired"];

export function healthWord(t: TFunction, health: FleetHealth) {
  let defaults: Record<FleetHealth, string> = {
    healthy: "Healthy",
    degraded: "Degraded",
    crashLooping: "Crash-looping",
    misconfigured: "Misconfigured",
    neverStarted: "Never started",
    offline: "Offline",
    retired: "Retired",
  };
  return t(`fleet:healthState.${health}`, {defaultValue: defaults[health]});
}
