"use client";

import React, { useState, useEffect, useRef } from "react";
import { useDashboard } from "../DashboardContext";
import * as echarts from "echarts";
import { ShieldAlert, PieChart as PieIcon } from "lucide-react";

export default function InventoryFlow() {
  const { filters } = useDashboard();
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

        const res = await fetch(`http://127.0.0.1:8000/api/v1/analytics/sales-charts?${queryParams.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch inventory chart data");
        const data = await res.json();

        // Calculate total sales
        const totalSales = data.category_rankings.reduce((sum: number, r: any) => sum + (r.sales || 0), 0);

        if (chartRef.current) {
          pieChart = echarts.init(chartRef.current);
          
          const pieData = data.category_rankings.map((r: any) => ({
            name: r.category,
            value: r.sales
          }));

          const option = {
            backgroundColor: "transparent",
            tooltip: {
              trigger: "item",
              formatter: function(params: any) {
                const val = typeof params.value === 'number' ? params.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : params.value;
                return `<div style="padding: 4px 8px; font-family: sans-serif; font-size: 11px;">
                  <strong style="color: #fff;">${params.name}</strong><br/>
                  <span style="color: #A1A1AA;">Sales:</span> <span style="color: #6D28D9; font-weight: bold;">₹${val}</span><br/>
                  <span style="color: #A1A1AA;">Share:</span> <span style="color: #10B981; font-weight: bold;">${params.percent}%</span>
                </div>`;
              },
              backgroundColor: "rgba(18, 18, 23, 0.9)",
              borderColor: "rgba(255, 255, 255, 0.08)",
              borderWidth: 1,
              textStyle: {
                color: "#F4F4F5"
              }
            },
            legend: {
              orient: "vertical",
              right: "5%",
              top: "center",
              textStyle: {
                color: "#A1A1AA",
                fontSize: 10,
                fontFamily: "monospace"
              },
              icon: "circle",
              itemWidth: 8,
              itemHeight: 8,
              itemGap: 12
            },
            // Color palette from design guidelines: Deep Mattes, High-End Luxury Purples, Indigo, Cyber Blue
            color: [
              "#6D28D9", // Accent Purple
              "#4338CA", // Indigo Primary
              "#2563EB", // Cyber Blue
              "#3B82F6", 
              "#1D4ED8",
              "#4F46E5",
              "#7C3AED",
              "#8B5CF6",
              "#A78BFA",
              "#C084FC"
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
                  borderColor: "#09090B",
                  borderWidth: 2
                },
                label: {
                  show: false,
                  position: "center"
                },
                emphasis: {
                  label: {
                    show: true,
                    fontSize: 12,
                    fontWeight: "bold",
                    color: "#fff",
                    formatter: function(params: any) {
                      return `${params.name}\n${params.percent}%`;
                    }
                  }
                },
                labelLine: {
                  show: false
                },
                data: pieData
              }
            ],
            // Visual text overlay in center of donut chart when idle
            graphic: [
              {
                type: "text",
                left: "38%",
                top: "47%",
                style: {
                  text: "Total Sales",
                  textAlign: "center",
                  fill: "#A1A1AA",
                  fontSize: 10,
                  fontWeight: "bold"
                }
              },
              {
                type: "text",
                left: "38%",
                top: "53%",
                style: {
                  text: `₹${(totalSales / 100000).toFixed(1)}L`,
                  textAlign: "center",
                  fill: "#fff",
                  fontSize: 13,
                  fontWeight: "bold"
                }
              }
            ]
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
  }, [filters]);

  return (
    <div className="glass-card p-6 flex flex-col justify-between mt-8">
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-3">
        <div className="flex items-center gap-2">
          <PieIcon className="h-4 w-4 text-[#6D28D9]" />
          <div>
            <h3 className="text-sm font-semibold text-white">Category Sales Contribution</h3>
            <p className="text-xs text-[#A1A1AA]">Market share contribution by category</p>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="h-80 bg-[rgba(255,255,255,0.02)] rounded mt-4 animate-pulse"></div>
      ) : error ? (
        <div className="h-80 flex flex-col items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-red-500 mb-2" />
          <span className="text-xs text-[#A1A1AA]">Failed to load visualization data</span>
        </div>
      ) : (
        <div ref={chartRef} className="h-80 w-full mt-4"></div>
      )}
    </div>
  );
}
