// Keys are Helm's own: an operator session in the same browser as a client's dash must not be
// mistaken for theirs, or the other way round.
let SESSION_KEY = "kdsx.helm.session";
let LOCALE_KEY = "kdsx.helm.locale";
let THEME_KEY = "kdsx.helm.theme";
let COLOR_SCHEME_KEY = "kdsx.helm.color.scheme";

export function saveSession(id: string) {
  window.localStorage.setItem(SESSION_KEY, id);
}

export function clearSession() {
  window.localStorage.removeItem(SESSION_KEY);
}

export function getSession() {
  let saved = window.localStorage.getItem(SESSION_KEY);
  if (saved == null) return "";
  return saved;
}

export function saveLocale(locale: string) {
  window.localStorage.setItem(LOCALE_KEY, locale);
}

export function getLocale() {
  let saved = window.localStorage.getItem(LOCALE_KEY);
  if (saved == null) return "";
  return saved;
}

export function saveTheme(theme: string) {
  window.localStorage.setItem(THEME_KEY, theme);
}

export function getTheme() {
  let saved = window.localStorage.getItem(THEME_KEY);
  if (saved == null) return "dark";
  return saved;
}

export function saveColorScheme(colorScheme: string) {
  window.localStorage.setItem(COLOR_SCHEME_KEY, colorScheme);
}

export function getColorScheme() {
  let saved = window.localStorage.getItem(COLOR_SCHEME_KEY);
  if (saved == null) return "default";
  return saved;
}

let FINISH_KEY = "kdsx.helm.finish";
let FINISH_STRENGTH_KEY = "kdsx.helm.finish.strength";

export function saveFinish(finish: string) {
  window.localStorage.setItem(FINISH_KEY, finish);
}

export function getFinish() {
  let saved = window.localStorage.getItem(FINISH_KEY);
  if (saved == null) return "raised-sheen";
  return saved;
}

export function saveFinishStrength(finishStrength: string) {
  window.localStorage.setItem(FINISH_STRENGTH_KEY, finishStrength);
}

export function getFinishStrength() {
  let saved = window.localStorage.getItem(FINISH_STRENGTH_KEY);
  if (saved == null) return "regular";
  return saved;
}
