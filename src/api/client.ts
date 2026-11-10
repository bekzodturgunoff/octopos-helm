import type {ApiErrorBody} from "./types";
import {getLocale, getSession} from "@/constants";
import i18n from "i18next";

// The one door every request goes through. Swapping it for kdsx-api's generated client later
// changes nothing above it: pages only ever see `xxxOptions()` and `xxxMutation()`.

export type Method = "GET" | "POST";

export type RequestOptions = {
  query?: object;
  body?: unknown;
  signal?: AbortSignal;
};

/** Thrown for every non-2xx answer, carrying the API's own error body so a page can show its message. */
export class ApiError extends Error implements ApiErrorBody {
  status: number;
  code: string;
  traceID: string;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = body.status;
    this.code = body.code;
    this.traceID = body.traceID;
  }
}

let mockEnabled = import.meta.env.VITE_API_MOCK === "on";

// The step-up token lives in memory only: a reload, a new tab or five minutes and it is gone,
// which is the point — it proves somebody just typed a code, not that they did once.
let stepUp: {token: string; expiresAt: number} | undefined;

export function setStepUp(token: string, expiresAt: string) {
  stepUp = {token, expiresAt: Date.parse(expiresAt)};
}

export function currentStepUp() {
  if (!stepUp || stepUp.expiresAt <= Date.now()) return undefined;
  return stepUp.token;
}

function buildQuery(query: object | undefined) {
  if (!query) return "";
  let params = new URLSearchParams();
  for (let [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  let encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export async function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  if (mockEnabled) {
    // Loaded on first use, so a production build that never turns mocks on never downloads them.
    let {handleMock} = await import("./mock");
    return handleMock<T>(method, path, options);
  }

  let headers = new Headers({Accept: "application/json"});
  let session = getSession();
  // Bearer, like the API's existing OperatorToken scheme on operator.fleet.nodes — a session issued by
  // operator.auth.signIn travels the same way, so one security scheme covers every operator.* call.
  if (session) headers.set("Authorization", `Bearer ${session}`);
  // The chosen language, or the one Helm is showing when nobody has chosen: server text (errors,
  // the digest) always comes back in the language on screen.
  let locale = getLocale() || i18n.language;
  if (locale) headers.set("Accept-Language", locale);
  let step = currentStepUp();
  if (step) headers.set("X-Step-Up", step);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");

  let response = await fetch(`${import.meta.env.VITE_API_URL}${path}${buildQuery(options.query)}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (!response.ok) {
    let body: ApiErrorBody;
    try {
      body = await response.json();
    } catch {
      body = {message: response.statusText || "Request failed", status: response.status, code: "unknown", traceID: ""};
    }
    throw new ApiError({...body, status: body.status ?? response.status});
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
