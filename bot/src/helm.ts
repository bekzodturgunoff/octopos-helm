import {config} from "./config.ts";
import type {Link} from "./store.ts";

// Calls to the operator API. Everything the bot does for a person goes out with that person's own
// session, so the server applies their role: the bot cannot show or do more than Helm would.

export class HelmError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Options = {query?: Record<string, string | number | boolean | undefined>; body?: unknown};

async function request<T>(method: "GET" | "POST", path: string, headers: Record<string, string>, options: Options = {}): Promise<T> {
  let url = new URL(config.apiURL + path);
  for (let [key, value] of Object.entries(options.query ?? {})) if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  let response = await fetch(url, {
    method,
    headers: {Accept: "application/json", ...(options.body !== undefined ? {"Content-Type": "application/json"} : {}), ...headers},
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  let text = await response.text();
  let body = text ? JSON.parse(text) : undefined;
  if (!response.ok) throw new HelmError(response.status, body?.code ?? "ERROR", body?.message ?? response.statusText);
  return body as T;
}

/** As the linked operator. */
export function asOperator<T>(link: Link, method: "GET" | "POST", path: string, options?: Options) {
  return request<T>(method, path, {Authorization: `Bearer ${link.sessionID}`, "Accept-Language": link.lang}, options);
}

/** As the bot itself; only /bot.* paths accept this. */
export function asBot<T>(path: string, body: unknown) {
  return request<T>("POST", path, {"X-Bot-Key": config.botKey}, {body});
}
