"use client";

import React, { useState, useEffect, useRef } from "react";
import { useDashboard } from "../DashboardContext";
import * as echarts from "echarts";
import { ShieldAlert, TrendingUp } from "lucide-react";
import { getChartTheme, CHART_COLORS } from "../../lib/chartUtils";

export default function SalesAnalytics() {
  const { filters, theme } = useDashboard();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const trendRef = useRef<HTMLDivElement | null>(null);
  const rankingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let trendChart: echarts.ECharts | null = null;
    let rankingChart: echarts.ECharts | null = null;

    async function loadChartData() {
      setLoading(true);
      setError(false);
      try {
        const queryParams = new URLSearchParams();
        filters.division.forEach((val) => queryParams.append("division", val));
        filters.section.forEach((val) => queryParams.append("section", val));
        filters.department.forEach((val) => queryParams.append("department", val));
        filters.supplier.forEach((val) => queryParams.append("supplier", val));
        filters.store.forEach((val) => queryParams.append("store", val));
        filters.category.forEach((val) => queryParams.append("category", val));

        if (filters.startDate) queryParams.append("start_date", filters.startDate);
        if (filters.endDate) queryParams.append("end_date", filters.endDate);

        const res = await fetch(
          `http://127.0.0.1:8000/api/v1/analytics/sales-charts?${queryParams.toString()}`
        );
        if (!res.ok) throw new Error("Failed to fetch chart data");
        const data = await res.json();

        const chartTheme = getChartTheme(theme);

        // 1. Render Trend Area Chart
        if (trendRef.current) {
          trendChart = echarts.init(trendRef.current);
          const periods = data.monthly_trend.map((r: any) => r.period);
          const sales = data.monthly_trend.map((r: any) => r.sales);
          const profits = data.monthly_trend.map((r: any) => r.profit);

          trendChart.setOption({
            backgroundColor: "transparent",
            tooltip: {
              trigger: "axis",
              ...chartTheme.tooltip,
            },
            legend: {
              data: ["Sales", "Profit"],
              textStyle: chartTheme.textStyle,
            },
            grid: { left: "4%", right: "4%", bottom: "3%", containLabel: true },
            xAxis: {
              type: "category",
              data: periods,
              axisLine: chartTheme.axisLine,
              axisLabel: chartTheme.textStyle,
            },
            yAxis: {
              type: "value",
              splitLine: chartTheme.splitLine,
              axisLabel: chartTheme.textStyle,
            },
            series: [
              {
                name: "Sales",
                type: "line",
                data: sales,
                smooth: true,
                areaStyle: {
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: "rgba(223, 28, 36, 0.4)" }, // Brand red glow
                    { offset: 1, color: "rgba(223, 28, 36, 0.0)" },
                  ]),
                },
                itemStyle: { color: CHART_COLORS.red },
              },
              {
                name: "Profit",
                type: "line",
                data: profits,
                smooth: true,
                areaStyle: {
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: "rgba(37, 99, 235, 0.3)" }, // Blue glow
                    { offset: 1, color: "rgba(37, 99, 235, 0.0)" },
                  ]),
                },
                itemStyle: { color: CHART_COLORS.blue },
              },
            ],
          });
        }

        // 2. Render Supplier Ranking Bar Chart
        if (rankingRef.current) {
          rankingChart = echarts.init(rankingRef.current);
          const suppliers = data.supplier_rankings.map((r: any) => r.supplier).reverse();
          const sales = data.supplier_rankings.map((r: any) => r.sales).reverse();

          rankingChart.setOption({
            backgroundColor: "transparent",
            tooltip: {
              trigger: "axis",
              axisPointer: { type: "shadow" },
              ...chartTheme.tooltip,
            },
            grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
            xAxis: {
              type: "value",
              splitLine: chartTheme.splitLine,
              axisLabel: chartTheme.textStyle,
            },
            yAxis: {
              type: "category",
              data: suppliers,
              axisLine: chartTheme.axisLine,
              axisLabel: { ...chartTheme.textStyle, fontSize: 9 },
            },
            series: [
              {
                name: "Sales Volume",
                type: "bar",
                data: sales,
                itemStyle: {
                  color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                    { offset: 0, color: CHART_COLORS.purple },
                    { offset: 1, color: CHART_COLORS.red }, // MBazars red gradient
                  ]),
                  borderRadius: [0, 4, 4, 0],
                },
              },
            ],
          });
        }
      } catch (err) {
        console.error("Failed to render sales analytics charts", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    loadChartData();

    const handleResize = () => {
      trendChart?.resize();
      rankingChart?.resize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      trendChart?.dispose();
      rankingChart?.dispose();
      window.removeEventListener("resize", handleResize);
    };
  }, [filters, theme]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Sales Trend Chart */}
      <div className="glass-card p-6 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Sales & Profit Trend</h3>
          <p className="text-xs text-muted-foreground">Monthly revenue against Gross Profit bounds</p>
        </div>
        {loading ? (
          <div className="h-80 bg-muted rounded mt-4 animate-pulse"></div>
        ) : error ? (
          <div className="h-80 flex flex-col items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-primary mb-2" />
            <span className="text-xs text-muted-foreground">Failed to load visualization data</span>
          </div>
        ) : (
          <div ref={trendRef} className="h-80 w-full mt-4"></div>
        )}
      </div>

      {/* Supplier Performance Chart */}
      <div className="glass-card p-6 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Top Supplier Performances</h3>
          <p className="text-xs text-muted-foreground">Rankings based on total Net Sales amount</p>
        </div>
        {loading ? (
          <div className="h-80 bg-muted rounded mt-4 animate-pulse"></div>
        ) : error ? (
          <div className="h-80 flex flex-col items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-primary mb-2" />
            <span className="text-xs text-muted-foreground">Failed to load visualization data</span>
          </div>
        ) : (
          <div ref={rankingRef} className="h-80 w-full mt-4"></div>
        )}
      </div>
    </div>
  );
}
