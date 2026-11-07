import {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react";
import {getFinish, getFinishStrength, getColorScheme, getTheme, saveFinish, saveFinishStrength, saveColorScheme, saveTheme} from "./constants";

export type Theme = "dark" | "light";
export type ColorScheme = "default" | "blue" | "indigo" | "slate" | "coral" | "rose" | "violet" | "teal" | "volt" | "sunglow" | "hotline" | "cobalt";
export type Finish = "flat" | "sheen" | "raised" | "raised-sheen";
export type FinishStrength = "regular" | "subtle";

let Finishes: Finish[] = ["flat", "sheen", "raised", "raised-sheen"];
let FinishStrengths: FinishStrength[] = ["regular", "subtle"];

let ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
  colorScheme: ColorScheme;
  setColorScheme: (colorScheme: ColorScheme) => void;
  finish: Finish;
  setFinish: (finish: Finish) => void;
  finishStrength: FinishStrength;
  setFinishStrength: (finishStrength: FinishStrength) => void;
} | null>(null);

function getInitialTheme(): Theme {
  let saved = getTheme();
  if (saved === "light" || saved === "dark") return saved;
  return "dark";
}

function getInitialColorScheme(): ColorScheme {
  let saved = getColorScheme();
  if (saved == null || saved === "default") return "default";
  return saved as ColorScheme;
}

function getInitialFinish(): Finish {
  let saved = getFinish();
  if (Finishes.includes(saved as Finish)) return saved as Finish;
  return "raised-sheen";
}

function getInitialFinishStrength(): FinishStrength {
  let saved = getFinishStrength();
  if (FinishStrengths.includes(saved as FinishStrength)) return saved as FinishStrength;
  return "subtle";
}

function applyColorScheme(colorScheme: ColorScheme) {
  if (colorScheme === "default") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", colorScheme);
  }
}

/**
 * The finish, applied the way a storefront would: kdsx-react's components read CSS variables that
 * these two attributes turn into presets, so everything in the app follows without a prop
 * anywhere. `index.html` carries the same default statically, so the first paint before React runs
 * is already the preferred look.
 */
function applyFinish(finish: Finish, finishStrength: FinishStrength) {
  document.documentElement.setAttribute("data-finish", finish);
  document.documentElement.setAttribute("data-finish-strength", finishStrength);
}

export function ThemeProvider({children}: {children: React.ReactNode}) {
  let [theme, setThemeState] = useState<Theme>(getInitialTheme);
  let [colorScheme, setColorSchemeState] = useState<ColorScheme>(getInitialColorScheme);
  let [finish, setFinishState] = useState<Finish>(getInitialFinish);
  let [finishStrength, setFinishStrengthState] = useState<FinishStrength>(getInitialFinishStrength);

  let setTheme = useCallback((newTheme: Theme) => {
    saveTheme(newTheme);
    setThemeState(newTheme);
  }, []);

  let setColorScheme = useCallback((newColorScheme: ColorScheme) => {
    saveColorScheme(newColorScheme);
    setColorSchemeState(newColorScheme);
  }, []);

  let setFinish = useCallback((newFinish: Finish) => {
    saveFinish(newFinish);
    setFinishState(newFinish);
  }, []);

  let setFinishStrength = useCallback((newFinishStrength: FinishStrength) => {
    saveFinishStrength(newFinishStrength);
    setFinishStrengthState(newFinishStrength);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    applyColorScheme(colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    applyFinish(finish, finishStrength);
  }, [finish, finishStrength]);

  let value = useMemo(
    () => ({theme, setTheme, colorScheme, setColorScheme, finish, setFinish, finishStrength, setFinishStrength}),
    [theme, setTheme, colorScheme, setColorScheme, finish, setFinish, finishStrength, setFinishStrength],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  let context = useContext(ThemeContext);
  if (context == null) throw new Error("useTheme() must be used within ThemeProvider");
  return context;
}
