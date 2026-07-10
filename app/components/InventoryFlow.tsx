"use client";

import React, { useState, useEffect, useRef } from "react";
import { useDashboard } from "../DashboardContext";
import * as echarts from "echarts";
import { ShieldAlert, PieChart as PieIcon } from "lucide-react";
import { getChartTheme, CHART_COLORS } from "../../lib/chartUtils";
import { API_BASE_URL } from "../../lib/utils";

export default function InventoryFlow() {
  const { filters, theme } = useDashboard();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const chartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let pieChart: echarts.ECharts | null = null;

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
          `${API_BASE_URL}/api/v1/analytics/sales-charts?${queryParams.toString()}`
        );
        if (!res.ok) throw new Error("Failed to fetch inventory chart data");
        const data = await res.json();

        // Calculate total sales
        const totalSales = data.category_rankings.reduce(
          (sum: number, r: any) => sum + (r.sales || 0),
          0
        );

        const chartTheme = getChartTheme(theme);

        if (chartRef.current) {
          pieChart = echarts.init(chartRef.current);

          const pieData = data.category_rankings.map((r: any) => ({
            name: r.category,
            value: r.sales,
          }));

          const option = {
            backgroundColor: "transparent",
            tooltip: {
              trigger: "item",
              formatter: function (params: any) {
                const val =
                  typeof params.value === "number"
                    ? params.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : params.value;
                return `<div style="padding: 4px 8px; font-family: Outfit, sans-serif; font-size: 11px;">
                  <strong style="color: ${theme === "dark" ? "#fff" : "#09090B"};">${params.name}</strong><br/>
                  <span style="color: #888;">Sales:</span> <span style="color: ${CHART_COLORS.red}; font-weight: bold;">₹${val}</span><br/>
                  <span style="color: #888;">Share:</span> <span style="color: ${CHART_COLORS.green}; font-weight: bold;">${params.percent}%</span>
                </div>`;
              },
              ...chartTheme.tooltip,
            },
            legend: {
              orient: "vertical",
              right: "5%",
              top: "center",
              textStyle: chartTheme.textStyle,
              icon: "circle",
              itemWidth: 8,
              itemHeight: 8,
              itemGap: 12,
            },
            color: [
              CHART_COLORS.red,
              CHART_COLORS.purple,
              CHART_COLORS.blue,
              CHART_COLORS.indigo,
              CHART_COLORS.teal,
              CHART_COLORS.amber,
              CHART_COLORS.rose,
              CHART_COLORS.sky,
              CHART_COLORS.violet,
              CHART_COLORS.green,
            ],
            series: [
              {
                name: "Category Sales Share",
                type: "pie",
                radius: ["50%", "75%"],
                center: ["40%", "50%"],
                avoidLabelOverlap: false,
                itemStyle: {
                  borderRadius: 6,
                  borderColor: chartTheme.pieBorderColor,
                  borderWidth: 2,
                },
                label: {
                  show: false,
                  position: "center",
                },
                emphasis: {
                  label: {
                    show: true,
                    fontSize: 12,
                    fontWeight: "bold",
                    color: theme === "dark" ? "#fff" : "#09090B",
                    formatter: function (params: any) {
                      return `${params.name}\n${params.percent}%`;
                    },
                  },
                },
                labelLine: {
                  show: false,
                },
                data: pieData,
              },
            ],
            graphic: [
              {
                type: "text",
                left: "35%",
                top: "46%",
                style: {
                  text: "Total Sales",
                  textAlign: "center",
                  fill: theme === "dark" ? "#A1A1AA" : "#71717A",
                  fontSize: 10,
                  fontWeight: "bold",
                },
              },
              {
                type: "text",
                left: "35%",
                top: "52%",
                style: {
                  text: `₹${(totalSales / 100000).toFixed(1)}L`,
                  textAlign: "center",
                  fill: theme === "dark" ? "#fff" : "#09090B",
                  fontSize: 13,
                  fontWeight: "bold",
                },
              },
            ],
          };

          pieChart.setOption(option);
        }
      } catch (err) {
        console.error("Failed to render category sales pie chart", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    loadChartData();

    const handleResize = () => {
      pieChart?.resize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      pieChart?.dispose();
      window.removeEventListener("resize", handleResize);
    };
  }, [filters, theme]);

  return (
    <div className="glass-card p-6 flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <PieIcon className="h-4 w-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Category Sales Contribution</h3>
            <p className="text-xs text-muted-foreground">Market share contribution by category</p>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="h-80 bg-muted rounded mt-4 animate-pulse"></div>
      ) : error ? (
        <div className="h-80 flex flex-col items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-primary mb-2" />
          <span className="text-xs text-muted-foreground">Failed to load visualization data</span>
        </div>
      ) : (
        <div ref={chartRef} className="h-80 w-full mt-4"></div>
      )}
    </div>
  );
}
