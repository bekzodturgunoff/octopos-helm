import {SetStateAction, useCallback, useEffect, useRef, useState} from "react";

export function useDebounced<T>(value: T, ms: number = 250): T {
  let [settled, setSettled] = useState(value);
  useEffect(() => {
    let timer = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/*
 * The dash's useSessionState: a multi-step flow's draft, kept in sessionStorage so a reload on step
 * two does not throw away step one. A draft from an older build whose shape no longer matches is
 * ignored rather than drawn.
 */
function matchesShape(saved: unknown, initial: unknown): boolean {
  if (typeof initial !== "object" || initial === null) return true;
  if (typeof saved !== "object" || saved === null) return false;
  if (Array.isArray(initial) !== Array.isArray(saved)) return false;
  if (Array.isArray(initial)) return true;
  return Object.keys(initial as object).every((field) => field in (saved as object));
}

export function useSessionState<S>(key: string, initialValue: S | (() => S)): [S, (dispatch: SetStateAction<S>, persist?: boolean) => void, () => void] {
  let shouldPersist = useRef(true);
  let [state, setState] = useState<S>(() => {
    let fallback = initialValue instanceof Function ? initialValue() : initialValue;
    try {
      let saved = window.sessionStorage.getItem(key);
      if (saved != null) {
        let parsed = JSON.parse(saved) as S;
        if (matchesShape(parsed, fallback)) return parsed;
      }
    } catch {
      // Storage unavailable, or the value malformed: start from the default.
    }
    return fallback;
  });

  let reset = useCallback(() => {
    shouldPersist.current = false;
    setState(initialValue);
    window.sessionStorage.removeItem(key);
  }, [setState, initialValue, key]);

  let update = useCallback(
    (dispatch: SetStateAction<S>, persist: boolean = true) => {
      shouldPersist.current = persist;
      return setState(dispatch);
    },
    [setState],
  );

  useEffect(() => {
    if (shouldPersist.current) window.sessionStorage.setItem(key, JSON.stringify(state));
  }, [state, key]);

  return [state, update, reset];
}
