"use client";

import React, { useState, useEffect, useRef } from "react";
import { useDashboard } from "../DashboardContext";
import * as echarts from "echarts";
import { ShieldAlert } from "lucide-react";

export default function SalesAnalytics() {
  const { filters } = useDashboard();
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

        const res = await fetch(`http://127.0.0.1:8000/api/v1/analytics/sales-charts?${queryParams.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch chart data");
        const data = await res.json();

        // 1. Render Trend Area Chart
        if (trendRef.current) {
          trendChart = echarts.init(trendRef.current);
          const periods = data.monthly_trend.map((r: any) => r.period);
          const sales = data.monthly_trend.map((r: any) => r.sales);
          const profits = data.monthly_trend.map((r: any) => r.profit);

          trendChart.setOption({
            backgroundColor: "transparent",
            tooltip: { trigger: "axis" },
            legend: { data: ["Sales", "Profit"], textStyle: { color: "#A1A1AA" } },
            grid: { left: "4%", right: "4%", bottom: "3%", containLabel: true },
            xAxis: {
              type: "category",
              data: periods,
              axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
              axisLabel: { color: "#A1A1AA" },
            },
            yAxis: {
              type: "value",
              splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
              axisLabel: { color: "#A1A1AA" },
            },
            series: [
              {
                name: "Sales",
                type: "line",
                data: sales,
                smooth: true,
                areaStyle: {
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: "rgba(37, 99, 235, 0.4)" },
                    { offset: 1, color: "rgba(37, 99, 235, 0.0)" },
                  ]),
                },
                itemStyle: { color: "#2563EB" },
              },
              {
                name: "Profit",
                type: "line",
                data: profits,
                smooth: true,
                areaStyle: {
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: "rgba(109, 40, 217, 0.4)" },
                    { offset: 1, color: "rgba(109, 40, 217, 0.0)" },
                  ]),
                },
                itemStyle: { color: "#6D28D9" },
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
            tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
            grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
            xAxis: {
              type: "value",
              splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
              axisLabel: { color: "#A1A1AA" },
            },
            yAxis: {
              type: "category",
              data: suppliers,
              axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
              axisLabel: { color: "#A1A1AA", fontSize: 10 },
            },
            series: [
              {
                name: "Sales Volume",
                type: "bar",
                data: sales,
                itemStyle: {
                  color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                    { offset: 0, color: "#4338CA" },
                    { offset: 1, color: "#2563EB" },
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
  }, [filters]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
      {/* Sales Trend Chart */}
      <div className="glass-card p-6 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Sales & Profit Trend</h3>
          <p className="text-xs text-[#A1A1AA]">Monthly revenue against Gross Profit bounds</p>
        </div>
        {loading ? (
          <div className="h-80 bg-[rgba(255,255,255,0.02)] rounded mt-4 animate-pulse"></div>
        ) : error ? (
          <div className="h-80 flex flex-col items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-red-500 mb-2" />
            <span className="text-xs text-[#A1A1AA]">Failed to load visualization data</span>
          </div>
        ) : (
          <div ref={trendRef} className="h-80 w-full mt-4"></div>
        )}
      </div>

      {/* Supplier Performance Chart */}
      <div className="glass-card p-6 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Top Supplier Performances</h3>
          <p className="text-xs text-[#A1A1AA]">Rankings based on total Net Sales amount</p>
        </div>
        {loading ? (
          <div className="h-80 bg-[rgba(255,255,255,0.02)] rounded mt-4 animate-pulse"></div>
        ) : error ? (
          <div className="h-80 flex flex-col items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-red-500 mb-2" />
            <span className="text-xs text-[#A1A1AA]">Failed to load visualization data</span>
          </div>
        ) : (
          <div ref={rankingRef} className="h-80 w-full mt-4"></div>
        )}
      </div>
    </div>
  );
}
