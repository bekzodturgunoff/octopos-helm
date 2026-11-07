import {useEffect, useMemo, useRef, useState} from "react";
import * as echarts from "echarts/core";
import {BarChart, LineChart, PieChart, TreemapChart} from "echarts/charts";
import {GridComponent, LegendComponent, MarkLineComponent, MarkPointComponent, TitleComponent, TooltipComponent} from "echarts/components";
import {CanvasRenderer} from "echarts/renderers";
import type {EChartsOption} from "echarts";
import {useTheme} from "@/theme-provider";
import {buildGlobalChartDefaults} from "@/lib/echarts-theme";

echarts.use([LineChart, BarChart, PieChart, TreemapChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, MarkPointComponent, MarkLineComponent, CanvasRenderer]);

type Props = {
  option: EChartsOption;
  className?: string;
  height?: number | string;
  ariaLabel?: string;
};

function currentDpr() {
  return typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
}

export function ECharts({option, className, height, ariaLabel}: Props) {
  let {theme, colorScheme} = useTheme();
  let containerRef = useRef<HTMLDivElement>(null);
  let instanceRef = useRef<echarts.ECharts | null>(null);
  let optionRef = useRef<EChartsOption | null>(null);
  let [dpr, setDpr] = useState(currentDpr);

  let defaults = useMemo(() => buildGlobalChartDefaults(theme, colorScheme), [theme, colorScheme]);

  // Browser zoom, and dragging a window between a HiDPI and a 1x display,
  // change devicePixelRatio. zrender reads it once when the painter is built
  // and resize() never revisits it, so without rebuilding the chart its text
  // stays rasterised at the old scale and looks blurry for the life of the
  // page. The media query matches only while the ratio is unchanged.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let media = window.matchMedia(`(resolution: ${dpr}dppx)`);
    let onChange = () => setDpr(currentDpr());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [dpr]);

  useEffect(() => {
    let host = containerRef.current;
    if (!host) return;
    let chart = echarts.init(host, undefined, {renderer: "canvas", devicePixelRatio: dpr});
    instanceRef.current = chart;
    // Re-applied because a devicePixelRatio change disposes and rebuilds the
    // instance after the option has already been set.
    if (optionRef.current) chart.setOption(optionRef.current, {notMerge: true});
    let ro = new ResizeObserver(() => chart.resize());
    ro.observe(host);
    return () => {
      ro.disconnect();
      chart.dispose();
      instanceRef.current = null;
    };
  }, [dpr]);

  useEffect(() => {
    let chart = instanceRef.current;
    if (!chart) return;
    let merged: EChartsOption = {...defaults, ...option};
    if (defaults.legend && option.legend && !Array.isArray(defaults.legend) && !Array.isArray(option.legend)) {
      merged.legend = {...defaults.legend, ...option.legend};
    }
    if (defaults.textStyle && option.textStyle) {
      merged.textStyle = {...defaults.textStyle, ...option.textStyle};
    }
    if (optionRef.current) {
      merged = {...merged, animation: false};
    }
    let isFirst = optionRef.current === null;
    optionRef.current = merged;
    chart.setOption(merged, isFirst ? {notMerge: true} : undefined);
  }, [defaults, option]);

  let style: React.CSSProperties = {width: "100%"};
  if (height !== undefined) style.height = height;

  return <div ref={containerRef} role="img" aria-label={ariaLabel} className={className} style={style} />;
}
