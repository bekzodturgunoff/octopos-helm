import type {RemoteAccess, RemoteApp} from "@/api/types";

/**
 * The remote-access apps support uses to reach a client's machine. Each knows what its IDs look
 * like, how to show one, and the link that opens the app on this computer already pointed at the
 * machine. "Other" covers anything else: Helm keeps the ID and copies it, the person opens the app.
 */
export type RemoteAppInfo = {
  app: RemoteApp;
  name: string;
  /** What a valid ID looks like, spaces already removed. */
  pattern: RegExp;
  placeholder: string;
  /** The app's own link scheme; undefined when there is none to open. */
  link?: (id: string) => string;
};

export let REMOTE_APPS: RemoteAppInfo[] = [
  {app: "anydesk", name: "AnyDesk", pattern: /^\d{9,10}$/, placeholder: "123 456 789", link: (id) => `anydesk:${id}`},
  // RustDesk IDs are 9 digits by default; a self-hosted server can hand out custom ones.
  {app: "rustdesk", name: "RustDesk", pattern: /^[A-Za-z0-9_-]{6,16}$/, placeholder: "123 456 789", link: (id) => `rustdesk://connection/new/${id}`},
  {app: "teamviewer", name: "TeamViewer", pattern: /^\d{9,10}$/, placeholder: "1 234 567 890", link: (id) => `teamviewer10://control?device=${id}`},
  {app: "other", name: "Other", pattern: /^\S{3,64}$/, placeholder: ""},
];

export function remoteApp(app: RemoteApp | undefined): RemoteAppInfo {
  return REMOTE_APPS.find((a) => a.app === app) ?? REMOTE_APPS[0];
}

/** "123456789" → "123 456 789": numeric IDs grouped from the right, as the apps show them. Others as typed. */
export function formatRemoteID(value: string) {
  return /^\d+$/.test(value) ? value.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : value;
}

/** "AnyDesk", "RustDesk", or what the team called the other app. */
export function appLabel(entry: Pick<RemoteAccess, "app" | "appName">) {
  return entry.app === "other" ? entry.appName || "—" : remoteApp(entry.app).name;
}
