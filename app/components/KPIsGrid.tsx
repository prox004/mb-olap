"use client";

import React, { useState, useEffect } from "react";
import { useDashboard } from "../DashboardContext";
import { DollarSign, ShieldAlert, Award, Inbox, ArrowRight } from "lucide-react";

type KPIData = {
  total_products: number;
  inventory_value: number;
  net_sales: number;
  gross_profit: number;
  gross_margin_pct: number;
  closing_stock_qty: number;
  opening_stock_qty: number;
  goods_receive_qty: number;
  goods_return_qty: number;
  site_transfer_in_qty: number;
  site_transfer_out_qty: number;
  top_supplier: string;
  top_category: string;
  top_department: string;
  dead_stock_count: number;
  slow_moving_count: number;
  fast_moving_count: number;
};

export default function KPIsGrid() {
  const { filters } = useDashboard();
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchKPIs() {
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
        if (filters.minMrp) queryParams.append("min_mrp", String(filters.minMrp));
        if (filters.maxMrp) queryParams.append("max_mrp", String(filters.maxMrp));

        const res = await fetch(`http://127.0.0.1:8000/api/v1/analytics/dashboard-kpis?${queryParams.toString()}`);
        if (res.ok) {
          const result = await res.json();
          setData(result);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Failed to load dashboard KPIs", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchKPIs();
  }, [filters]);

  if (error) {
    return (
      <div className="glass-card p-6 flex flex-col items-center justify-center h-48">
        <ShieldAlert className="h-10 w-10 text-red-500 mb-2" />
        <span className="text-sm font-semibold text-[#F4F4F5]">Failed to load visualization data</span>
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatQty = (val: number) => {
    return new Intl.NumberFormat("en-IN").format(val);
  };

  const kpiList = [
    { title: "Net Sales", value: data ? formatCurrency(data.net_sales) : "0", sub: "Actual revenue", icon: DollarSign, color: "text-[#2563EB]" },
    { title: "Gross Profit", value: data ? formatCurrency(data.gross_profit) : "0", sub: "Sales - COGS", icon: DollarSign, color: "text-[#6D28D9]" },
    { title: "Gross Margin %", value: data ? `${data.gross_margin_pct.toFixed(1)}%` : "0%", sub: "Margin efficiency", icon: DollarSign, color: "text-emerald-500" },
    { title: "Inventory Value", value: data ? formatCurrency(data.inventory_value) : "0", sub: "Closing stock valuation", icon: Inbox, color: "text-violet-400" },
    { title: "Closing Qty", value: data ? formatQty(data.closing_stock_qty) : "0", sub: "Current stock level", icon: Inbox, color: "text-[#A1A1AA]" },
    { title: "Goods Received Qty", value: data ? formatQty(data.goods_receive_qty) : "0", sub: "Incoming supply", icon: Inbox, color: "text-emerald-500" },
    { title: "Goods Returned Qty", value: data ? formatQty(data.goods_return_qty) : "0", sub: "Supplier returns", icon: Inbox, color: "text-rose-500" },
    { title: "Slow Moving Items", value: data ? formatQty(data.slow_moving_count) : "0", sub: "STR < 10% monthly", icon: ShieldAlert, color: "text-amber-500" },
    { title: "Fast Moving Items", value: data ? formatQty(data.fast_moving_count) : "0", sub: "STR >= 40% monthly", icon: Award, color: "text-cyan-500" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {kpiList.map((kpi, idx) => {
        const Icon = kpi.icon;
        return (
          <div key={idx} className="glass-card p-6 flex flex-col justify-between relative overflow-hidden">
            {loading ? (
              <div className="space-y-3">
                <div className="h-4 bg-[rgba(255,255,255,0.05)] rounded w-1/3 animate-pulse"></div>
                <div className="h-8 bg-[rgba(255,255,255,0.05)] rounded w-2/3 animate-pulse"></div>
                <div className="h-3 bg-[rgba(255,255,255,0.05)] rounded w-1/2 animate-pulse"></div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">
                    {kpi.title}
                  </span>
                  <Icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div className="mt-4">
                  <h3 className="text-2xl font-bold tracking-tight text-white">{kpi.value}</h3>
                  <p className="text-[11px] text-[#A1A1AA] mt-1">{kpi.sub}</p>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
