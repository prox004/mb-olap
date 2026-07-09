"use client";

import React, { useState, useEffect, useRef } from "react";
import { useDashboard } from "../DashboardContext";
import * as echarts from "echarts";
import { LineChart, Calendar, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "../../lib/utils";
import { getChartTheme, CHART_COLORS } from "../../lib/chartUtils";

type ForecastData = {
  date: string;
  predicted_value: number;
  lower_bound: number;
  upper_bound: number;
};

type HistoryData = {
  date: string;
  value: number;
};

export default function Forecasting() {
  const { filters, theme } = useDashboard();
  const [metric, setMetric] = useState<"sales" | "stock">("sales");
  const [horizon, setHorizon] = useState<number>(30);
  const [data, setData] = useState<{ forecast: ForecastData[]; history: HistoryData[] } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const chartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function fetchForecast() {
      setLoading(true);
      setError(false);
      try {
        const queryParams = new URLSearchParams();
        queryParams.append("metric", metric);
        queryParams.append("horizon", horizon.toString());

        // Append filters if set
        filters.division.forEach((val) => queryParams.append("division", val));
        filters.section.forEach((val) => queryParams.append("section", val));
        filters.department.forEach((val) => queryParams.append("department", val));
        filters.supplier.forEach((val) => queryParams.append("supplier", val));
        filters.store.forEach((val) => queryParams.append("store", val));
        filters.category.forEach((val) => queryParams.append("category", val));

        const res = await fetch(
          `http://127.0.0.1:8000/api/v1/analytics/forecast?${queryParams.toString()}`
        );
        if (res.ok) {
          const result = await res.json();
          setData(result);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Failed to load forecast data", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchForecast();
  }, [filters, metric, horizon]);

  useEffect(() => {
    if (!data || !chartRef.current) return;

    const chart = echarts.init(chartRef.current);

    const history = data.history || [];
    const forecast = data.forecast || [];

    // Prepare history and forecast series
    const histDates = history.map((h) => h.date);
    const histValues = history.map((h) => h.value);

    const foreDates = forecast.map((f) => f.date);
    const foreValues = forecast.map((f) => f.predicted_value);
    const lowerBounds = forecast.map((f) => f.lower_bound);
    const upperBounds = forecast.map((f) => f.upper_bound);

    // Combine for X-axis labels
    const allDates = [...histDates, ...foreDates];

    // Align values for series (padding historical values with null in forecast, and vice versa)
    const alignedHistValues = [...histValues, ...Array(foreValues.length).fill(null)];

    // To make a continuous line, the first item of forecast series shares the last historical value
    const lastHistVal = histValues.length > 0 ? histValues[histValues.length - 1] : 0;
    const alignedForeValues = [
      ...Array(histValues.length > 0 ? histValues.length - 1 : 0).fill(null),
      lastHistVal,
      ...foreValues,
    ];

    const alignedLowerBounds = [
      ...Array(histValues.length > 0 ? histValues.length - 1 : 0).fill(null),
      lastHistVal,
      ...alignedForeValues
        .slice(histValues.length > 0 ? histValues.length : 0)
        .map((_, idx) => lowerBounds[idx] || 0),
    ];

    const alignedUpperBounds = [
      ...Array(histValues.length > 0 ? histValues.length - 1 : 0).fill(null),
      lastHistVal,
      ...alignedForeValues
        .slice(histValues.length > 0 ? histValues.length : 0)
        .map((_, idx) => upperBounds[idx] || 0),
    ];

    const labelFormatter = (val: number) => {
      if (metric === "sales") {
        return new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0,
        }).format(val);
      }
      return val.toLocaleString() + " units";
    };

    const chartTheme = getChartTheme(theme);

    const option = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        ...chartTheme.tooltip,
        formatter: (params: any) => {
          const dateStr = params[0].axisValue;
          let html = `<div style="padding: 4px; font-family: Outfit, sans-serif; font-size: 11px;">
            <strong style="color: ${theme === "dark" ? "#fff" : "#09090B"}">${dateStr}</strong><br/>`;
          params.forEach((p: any) => {
            if (p.value !== null && p.value !== undefined && p.seriesName !== "Lower Bound") {
              let name = p.seriesName;
              if (name === "Upper Bound") name = "Confidence Range";

              let displayVal = "";
              if (name === "Confidence Range") {
                const idx = p.dataIndex - histDates.length + 1;
                if (idx >= 0 && forecast[idx]) {
                  displayVal = `${labelFormatter(forecast[idx].lower_bound)} - ${labelFormatter(
                    forecast[idx].upper_bound
                  )}`;
                } else {
                  displayVal = labelFormatter(p.value);
                }
              } else {
                displayVal = labelFormatter(p.value);
              }
              html += `<span style="color:${p.color}">●</span> ${name}: <b>${displayVal}</b><br/>`;
            }
          });
          html += `</div>`;
          return html;
        },
      },
      legend: {
        data: ["Historical", "ML Predicted Forecast", "Confidence Range"],
        textStyle: chartTheme.textStyle,
        top: 0,
      },
      grid: {
        left: "4%",
        right: "4%",
        bottom: "8%",
        top: "12%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: allDates,
        axisLine: chartTheme.axisLine,
        axisLabel: { ...chartTheme.textStyle, rotate: 15 },
      },
      yAxis: {
        type: "value",
        axisLine: chartTheme.axisLine,
        axisLabel: chartTheme.textStyle,
        splitLine: chartTheme.splitLine,
      },
      series: [
        {
          name: "Historical",
          type: "line",
          data: alignedHistValues,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 3, color: CHART_COLORS.purple },
          itemStyle: { color: CHART_COLORS.purple },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(109, 40, 217, 0.2)" },
              { offset: 1, color: "rgba(109, 40, 217, 0.0)" },
            ]),
          },
        },
        {
          name: "ML Predicted Forecast",
          type: "line",
          data: alignedForeValues,
          smooth: true,
          showSymbol: true,
          symbolSize: 6,
          lineStyle: { width: 3, type: "dashed", color: CHART_COLORS.red }, // MBazars red for forecast line!
          itemStyle: { color: CHART_COLORS.red },
        },
        {
          name: "Lower Bound",
          type: "line",
          data: alignedLowerBounds,
          lineStyle: { opacity: 0 },
          stack: "confidence-band",
          symbol: "none",
        },
        {
          name: "Upper Bound",
          type: "line",
          data: alignedUpperBounds,
          lineStyle: { opacity: 0 },
          stack: "confidence-band",
          symbol: "none",
          areaStyle: {
            color: "rgba(223, 28, 36, 0.08)", // Light red transparent confidence range
          },
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [data, metric, theme]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getKPIs = () => {
    const history = data?.history || [];
    const forecast = data?.forecast || [];

    if (forecast.length === 0) return { total: 0, avg: 0, peak: 0, trend: "Stable" };

    const vals = forecast.map((f) => f.predicted_value);
    const total = vals.reduce((a, b) => a + b, 0);
    const avg = total / vals.length;
    const peak = Math.max(...vals);

    const histVals = history.map((h) => h.value);
    const histAvg = histVals.length > 0 ? histVals.reduce((a, b) => a + b, 0) / histVals.length : 1;
    const percentDiff = ((avg - histAvg) / histAvg) * 100;

    let trend = "Stable";
    if (percentDiff > 3) trend = `+${percentDiff.toFixed(1)}% Growth`;
    else if (percentDiff < -3) trend = `${percentDiff.toFixed(1)}% Decline`;

    return { total, avg, peak, trend };
  };

  const kpis = getKPIs();

  return (
    <div className="space-y-6">
      {/* Control Tabs */}
      <div className="glass-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <LineChart className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-bold text-foreground">Advanced ML Demand Forecasting</h3>
            <p className="text-[11px] text-muted-foreground">
              Time-series analysis using Classical Decomposition (Trend + Seasonality)
            </p>
          </div>
        </div>

        {/* Toggle options */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Target Metric */}
          <div className="flex bg-secondary rounded-lg p-1 border border-border">
            <button
              onClick={() => setMetric("sales")}
              className={cn(
                "text-xs px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer",
                metric === "sales" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              Sales Revenue
            </button>
            <button
              onClick={() => setMetric("stock")}
              className={cn(
                "text-xs px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer",
                metric === "stock" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              Stock Volume
            </button>
          </div>

          {/* Horizon */}
          <div className="flex bg-secondary rounded-lg p-1 border border-border">
            {[7, 14, 30].map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer",
                  horizon === h ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                {h}D Horizon
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Forecasted Card */}
        <div className="glass-card p-5 flex flex-col justify-between h-28">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Total Forecasted Value
          </span>
          <h2 className="text-lg font-bold text-foreground font-mono mt-2 block">
            {metric === "sales"
              ? formatCurrency(kpis.total)
              : kpis.total.toLocaleString() + " units"}
          </h2>
          <span className="text-[9px] text-muted-foreground mt-1 font-mono block">
            Accumulated over {horizon} days
          </span>
        </div>

        {/* Avg Daily Prediction */}
        <div className="glass-card p-5 flex flex-col justify-between h-28">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Avg Daily Prediction
          </span>
          <h2 className="text-lg font-bold text-primary font-mono mt-2 block">
            {metric === "sales" ? formatCurrency(kpis.avg) : kpis.avg.toLocaleString() + " units"}
          </h2>
          <span className="text-[9px] text-muted-foreground mt-1 font-mono block">
            Expected daily rate
          </span>
        </div>

        {/* Expected Peak Day */}
        <div className="glass-card p-5 flex flex-col justify-between h-28">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Predicted Peak Value
          </span>
          <h2 className="text-lg font-bold text-emerald-500 font-mono mt-2 block">
            {metric === "sales" ? formatCurrency(kpis.peak) : kpis.peak.toLocaleString() + " units"}
          </h2>
          <span className="text-[9px] text-muted-foreground mt-1 font-mono block">
            Highest daily value
          </span>
        </div>

        {/* Growth vs Historical Avg */}
        <div className="glass-card p-5 flex flex-col justify-between h-28">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Projected Trend vs Past
          </span>
          <h2
            className={cn(
              "text-lg font-bold font-mono mt-2 block",
              kpis.trend.includes("Growth") ? "text-emerald-500" : "text-amber-500"
            )}
          >
            {kpis.trend}
          </h2>
          <span className="text-[9px] text-muted-foreground mt-1 font-mono block">
            Compared to 60-day average
          </span>
        </div>
      </div>

      {/* Chart container */}
      <div className="glass-card p-6 flex flex-col justify-between">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4.5 w-4.5 text-primary" />
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              ML Forecasting Timeline Profile
            </h4>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-primary font-mono bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
            <Sparkles className="h-3 w-3" />
            <span>Confidence Interval Band (95% Accuracy)</span>
          </div>
        </div>

        {loading ? (
          <div className="h-[400px] flex items-center justify-center animate-pulse text-xs text-muted-foreground">
            Running predictive model calculations...
          </div>
        ) : error ? (
          <div className="h-[400px] flex flex-col items-center justify-center text-xs text-rose-500">
            <AlertCircle className="h-8 w-8 mb-2" />
            <span>Failed to run forecasting models. Verify data is populated.</span>
          </div>
        ) : (
          <div ref={chartRef} className="w-full h-[400px]" />
        )}
      </div>
    </div>
  );
}
