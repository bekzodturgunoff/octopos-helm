import type {EChartsOption} from "echarts";
import type {ColorScheme, Theme} from "@/theme-provider";

// The theme's tokens are oklch, which ECharts cannot parse (it draws them black). Painting one pixel
// and reading it back gives the same colour as rgba, whatever syntax the token was written in.
function readVar(name: string): string {
  let probe = document.createElement("div");
  probe.style.cssText = `color: var(${name}); position: absolute; visibility: hidden; pointer-events: none;`;
  document.documentElement.appendChild(probe);
  let resolved = getComputedStyle(probe).color;
  probe.remove();
  if (!resolved) return "transparent";
  let pixel = pixelCanvas();
  if (!pixel) return resolved;
  pixel.clearRect(0, 0, 1, 1);
  pixel.fillStyle = resolved;
  pixel.fillRect(0, 0, 1, 1);
  let [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${+(a / 255).toFixed(3)})`;
}

let pixelContext: CanvasRenderingContext2D | null = null;
function pixelCanvas(): CanvasRenderingContext2D | null {
  if (!pixelContext) {
    let canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    pixelContext = canvas.getContext("2d", {willReadFrequently: true});
  }
  return pixelContext;
}

let colorCanvas: CanvasRenderingContext2D | null = null;
export function withAlpha(color: string, alpha: number): string {
  let rgb = color.match(/^rgba?\(([^)]+)\)/);
  if (rgb) {
    let [r, g, b] = rgb[1].split(/[\s,/]+/).filter(Boolean);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (!colorCanvas) colorCanvas = document.createElement("canvas").getContext("2d");
  if (colorCanvas) {
    colorCanvas.fillStyle = color;
    let hex = colorCanvas.fillStyle.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
    if (hex) return `rgba(${parseInt(hex[1], 16)}, ${parseInt(hex[2], 16)}, ${parseInt(hex[3], 16)}, ${alpha})`;
  }
  return color;
}

export function areaGradient(color: string, top = 0.3, bottom = 0.02) {
  return {
    type: "linear" as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      {offset: 0, color: withAlpha(color, top)},
      {offset: 1, color: withAlpha(color, bottom)},
    ],
  };
}

export function barGradient(color: string, horizontal = true) {
  let dir = horizontal ? {x: 0, y: 0, x2: 1, y2: 0} : {x: 0, y: 0, x2: 0, y2: 1};
  return {
    type: "linear" as const,
    ...dir,
    colorStops: [
      {offset: 0, color: withAlpha(color, 1)},
      {offset: 1, color: withAlpha(color, 0.68)},
    ],
  };
}

export type ChartPalette = {
  brand: string;
  brandSoft: string;
  accentYellow: string;
  accentBlue: string;
  surface: string;
  surfaceElevated: string;
  onSurface: string;
  onSurfaceSecondary: string;
  border: string;
  borderStrong: string;
  danger: string;
};

let paletteCache = new Map<string, ChartPalette>();

export let CHART_FONT_FAMILY = '"Inter", sans-serif';

export let CHART_TYPOGRAPHY = {
  family: CHART_FONT_FAMILY,
  axis: {size: 12, weight: 500},
  legend: {size: 12, weight: 500},
  tooltipLabel: {size: 12, weight: 500},
  tooltipValue: {size: 13, weight: 600},
  treemapLabel: {size: 12, weight: 600},
  treemapValue: {size: 12, weight: 500},
} as const;

export let CHART_GRID = {
  base: {top: 8, right: 8, bottom: 8, left: 8, containLabel: true},
  withLegend: {top: 32, right: 8, bottom: 8, left: 8, containLabel: true},
  rotatedXLabels: {top: 8, right: 8, bottom: 32, left: 8, containLabel: true},
  horizontalBars: {top: 8, right: 24, bottom: 8, left: 160},
  horizontalBarsPareto: {top: 56, right: 24, bottom: 8, left: 160},
} as const;

export let CHART_SPACING = {
  tooltipRowGap: 8,
  tooltipInlineGap: 12,
  tooltipMinWidth: 176,
  horizontalBarRowHeight: 36,
  horizontalBarWidth: 18,
} as const;

export function readPalette(theme: Theme, colorScheme: ColorScheme = "default"): ChartPalette {
  let cacheKey = `${theme}:${colorScheme}`;
  let cached = paletteCache.get(cacheKey);
  if (cached) return cached;
  let palette: ChartPalette = {
    brand: readVar("--color-accent"),
    brandSoft: readVar("--color-accent-active"),
    accentYellow: readVar("--color-bright-yellow"),
    accentBlue: readVar("--color-bright-blue"),
    surface: readVar("--color-surface"),
    surfaceElevated: readVar("--color-surface-300"),
    onSurface: readVar("--color-on-surface"),
    onSurfaceSecondary: readVar("--color-on-surface-secondary"),
    border: readVar("--color-border-secondary"),
    borderStrong: readVar("--color-border"),
    danger: readVar("--color-error-bright"),
  };
  paletteCache.set(cacheKey, palette);
  return palette;
}

export function chartTooltipStyle(theme: Theme, colorScheme?: ColorScheme) {
  let p = readPalette(theme, colorScheme);
  return {
    backgroundColor: p.surfaceElevated,
    borderColor: p.border,
    borderWidth: 1,
    padding: [10, 12] as [number, number],
    textStyle: {
      color: p.onSurface,
      fontSize: CHART_TYPOGRAPHY.tooltipLabel.size,
      fontFamily: CHART_FONT_FAMILY,
      fontWeight: CHART_TYPOGRAPHY.tooltipLabel.weight,
    },
    extraCssText: "border-radius: 12px; box-shadow: 0 8px 24px -8px rgba(0,0,0,0.35);",
  };
}

export function chartTextColor(theme: Theme): string {
  return theme === "dark" ? "#ffffff" : readPalette(theme).onSurface;
}

export function buildGlobalChartDefaults(theme: Theme, colorScheme: ColorScheme = "default"): EChartsOption {
  let p = readPalette(theme, colorScheme);
  let textColor = chartTextColor(theme);
  return {
    color: [p.brand, p.accentYellow, p.accentBlue, p.brandSoft, p.danger, p.onSurfaceSecondary],
    backgroundColor: "transparent",
    textStyle: {
      fontFamily: CHART_FONT_FAMILY,
      color: textColor,
    },
    animationDuration: 400,
    animationEasing: "cubicOut",
    // ECharts 5.6 can leave category-axis pointer interpolation in a failing
    // animation loop after a mouse move. Pointer tracking remains enabled; it
    // just follows the cursor immediately instead of tweening between points.
    axisPointer: {
      animation: false,
    },
    legend: {
      textStyle: {
        color: textColor,
        fontSize: CHART_TYPOGRAPHY.legend.size,
        fontFamily: CHART_FONT_FAMILY,
        fontWeight: CHART_TYPOGRAPHY.legend.weight,
      },
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 16,
    },
  };
}

export function axisDefaults(theme: Theme, colorScheme?: ColorScheme) {
  let p = readPalette(theme, colorScheme);
  return {
    axisLine: {show: false},
    axisTick: {show: false},
    axisLabel: {
      color: p.onSurfaceSecondary,
      fontSize: CHART_TYPOGRAPHY.axis.size,
      fontFamily: CHART_FONT_FAMILY,
      fontWeight: CHART_TYPOGRAPHY.axis.weight,
      margin: 12,
    },
    splitLine: {lineStyle: {color: p.border, type: "solid" as const, opacity: 0.45}},
  };
}

export function valueLabelStyle(theme: Theme, colorScheme?: ColorScheme) {
  let p = readPalette(theme, colorScheme);
  return {
    color: p.onSurfaceSecondary,
    fontSize: 11,
    fontWeight: 600 as const,
    fontFamily: CHART_FONT_FAMILY,
  };
}

export function peakMarkPoint(theme: Theme, color: string, index: number, value: number, display: string, colorScheme?: ColorScheme) {
  let p = readPalette(theme, colorScheme);
  return {
    symbol: "circle" as const,
    symbolSize: 8,
    itemStyle: {color, borderColor: p.surfaceElevated, borderWidth: 2},
    label: {
      show: true,
      position: "top" as const,
      formatter: () => display,
      color: p.onSurface,
      fontSize: 11,
      fontWeight: 600 as const,
      fontFamily: CHART_FONT_FAMILY,
    },
    data: [{name: "peak", coord: [index, value] as [number, number]}],
  };
}

export function axisPointerStyle(theme: Theme, colorScheme?: ColorScheme) {
  let p = readPalette(theme, colorScheme);
  return {
    lineStyle: {color: p.borderStrong, width: 1, type: "solid" as const, opacity: 0.5},
  };
}

export function tooltipHtmlStyles(theme: Theme, colorScheme?: ColorScheme) {
  let p = readPalette(theme, colorScheme);
  let labelCss = `color:${p.onSurfaceSecondary};font-size:${CHART_TYPOGRAPHY.tooltipLabel.size}px;font-weight:${CHART_TYPOGRAPHY.tooltipLabel.weight};font-family:${CHART_FONT_FAMILY}`;
  let valueCss = `color:${p.onSurface};font-size:${CHART_TYPOGRAPHY.tooltipValue.size}px;font-weight:${CHART_TYPOGRAPHY.tooltipValue.weight};font-family:${CHART_FONT_FAMILY}`;
  return {labelCss, valueCss};
}
