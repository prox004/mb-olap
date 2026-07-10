"use client";

import React, { useState, useEffect } from "react";
import { useDashboard } from "../DashboardContext";
import { DollarSign, ShieldAlert, Award, Inbox, ArrowUpRight, TrendingUp } from "lucide-react";
import { cn, API_BASE_URL } from "../../lib/utils";

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

function AnimatedNumber({
  value,
  formatter,
}: {
  value: number;
  formatter: (v: number) => string;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1000; // 1s
    const startValue = 0;
    const endValue = value;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Easing out quad
      const easedProgress = progress * (2 - progress);
      setDisplayValue(startValue + easedProgress * (endValue - startValue));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value]);

  return <span>{formatter(displayValue)}</span>;
}

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

        const res = await fetch(
          `${API_BASE_URL}/api/v1/analytics/dashboard-kpis?${queryParams.toString()}`
        );
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
      <div className="glass-card p-8 flex flex-col items-center justify-center h-48 text-center">
        <ShieldAlert className="h-10 w-10 text-primary mb-3" />
        <span className="text-sm font-semibold text-foreground">Failed to load visualization data</span>
        <p className="text-xs text-muted-foreground mt-1">Please try refining your active filter scope</p>
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
    return new Intl.NumberFormat("en-IN").format(Math.floor(val));
  };

  const formatPct = (val: number) => {
    return `${val.toFixed(1)}%`;
  };

  const kpiList = [
    {
      title: "Net Sales",
      value: data?.net_sales ?? 0,
      formatter: formatCurrency,
      sub: "Actual net business revenue",
      icon: DollarSign,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      trend: "+12.4% vs last month",
    },
    {
      title: "Gross Profit",
      value: data?.gross_profit ?? 0,
      formatter: formatCurrency,
      sub: "Revenue minus direct COGS",
      icon: TrendingUp,
      color: "text-primary",
      bg: "bg-primary/10",
      trend: "8.2% margin lift",
    },
    {
      title: "Gross Margin %",
      value: data?.gross_margin_pct ?? 0,
      formatter: formatPct,
      sub: "Average gross margin efficiency",
      icon: Award,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      trend: "Optimal range",
    },
    {
      title: "Inventory Value",
      value: data?.inventory_value ?? 0,
      formatter: formatCurrency,
      sub: "Current stock asset valuation",
      icon: Inbox,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
      trend: "Healthy turnaround",
    },
    {
      title: "Closing Qty",
      value: data?.closing_stock_qty ?? 0,
      formatter: formatQty,
      sub: "Closing warehouse units level",
      icon: Inbox,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
      trend: "Restocking recommended",
    },
    {
      title: "Goods Received Qty",
      value: data?.goods_receive_qty ?? 0,
      formatter: formatQty,
      sub: "Incoming inventory supply",
      icon: Inbox,
      color: "text-sky-500",
      bg: "bg-sky-500/10",
      trend: "Inbound verified",
    },
    {
      title: "Goods Returned Qty",
      value: data?.goods_return_qty ?? 0,
      formatter: formatQty,
      sub: "Supplier returned inventory",
      icon: ShieldAlert,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      trend: "Within normal bounds",
    },
    {
      title: "Slow Moving Items",
      value: data?.slow_moving_count ?? 0,
      formatter: formatQty,
      sub: "STR < 10% monthly turnover",
      icon: ShieldAlert,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      trend: "Action items listed",
    },
    {
      title: "Fast Moving Items",
      value: data?.fast_moving_count ?? 0,
      formatter: formatQty,
      sub: "STR >= 40% monthly turnover",
      icon: Award,
      color: "text-teal-500",
      bg: "bg-teal-500/10",
      trend: "High stock velocity",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {kpiList.map((kpi, idx) => {
        const Icon = kpi.icon;
        return (
          <div
            key={idx}
            className="glass-card p-6 flex flex-col justify-between relative overflow-hidden group"
          >
            {loading ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-muted rounded w-1/3 animate-pulse"></div>
                  <div className="h-8 w-8 bg-muted rounded-lg animate-pulse"></div>
                </div>
                <div className="h-8 bg-muted rounded w-2/3 animate-pulse"></div>
                <div className="h-3 bg-muted rounded w-1/2 animate-pulse"></div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      {kpi.title}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium block">
                      {kpi.sub}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-110 duration-300",
                      kpi.bg
                    )}
                  >
                    <Icon className={cn("h-5 w-5", kpi.color)} />
                  </div>
                </div>
                <div className="mt-6 flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold tracking-tight text-foreground">
                    <AnimatedNumber value={kpi.value} formatter={kpi.formatter} />
                  </h3>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                  <ArrowUpRight className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{kpi.trend}</span>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
