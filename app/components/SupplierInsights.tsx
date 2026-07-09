"use client";

import React, { useState, useEffect } from "react";
import { useDashboard } from "../DashboardContext";
import { Search, TrendingUp, TrendingDown, ShieldAlert, Award, Package, Percent, FileText, X } from "lucide-react";
import { cn } from "../../lib/utils";

type SupplierStat = {
  supplier: string;
  sales: number;
  profit: number;
  stock_qty: number;
  margin_pct: number;
  sku_count: number;
  receive_qty: number;
  return_qty: number;
  return_rate_pct: number;
};

type ProductStat = {
  icode: string;
  description: string;
  sales: number;
  qty: number;
};

export default function SupplierInsights() {
  const { filters } = useDashboard();
  const [data, setData] = useState<{
    best_selling: SupplierStat[];
    lowest_selling: SupplierStat[];
    all_suppliers: SupplierStat[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierStat | null>(null);
  const [topProducts, setTopProducts] = useState<ProductStat[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    async function fetchSupplierData() {
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
          `http://127.0.0.1:8000/api/v1/analytics/suppliers?${queryParams.toString()}`
        );
        if (res.ok) {
          const result = await res.json();
          setData(result);

          // Auto-select first supplier as default profile
          if (result.best_selling && result.best_selling.length > 0) {
            setSelectedSupplier(result.best_selling[0]);
          }
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Failed to fetch supplier analytical data", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchSupplierData();
  }, [filters]);

  useEffect(() => {
    async function fetchTopProducts() {
      if (!selectedSupplier) return;
      setTopProducts([]);
      setLoadingProducts(true);
      try {
        const res = await fetch(
          `http://127.0.0.1:8000/api/v1/analytics/suppliers/top-products?partyname=${encodeURIComponent(
            selectedSupplier.supplier
          )}`
        );
        if (res.ok) {
          const result = await res.json();
          setTopProducts(result.products || []);
        }
      } catch (err) {
        console.error("Failed to load top products for supplier", err);
      } finally {
        setLoadingProducts(false);
      }
    }
    fetchTopProducts();
  }, [selectedSupplier]);

  if (error) {
    return (
      <div className="glass-card p-8 flex flex-col items-center justify-center h-48 text-center">
        <ShieldAlert className="h-10 w-10 text-primary mb-3" />
        <span className="text-sm font-semibold text-foreground">
          Failed to load supplier analytics data
        </span>
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

  const filteredSuppliers =
    data?.all_suppliers.filter((s) =>
      s.supplier.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  return (
    <div className="space-y-6">
      {/* Top Search bar with Fuzzy Search */}
      <div className="glass-card p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
          Fuzzy Supplier Registry Lookup
        </h3>
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type supplier name or code to filter and select supplier analytics..."
            className="w-full h-10 bg-secondary/30 hover:bg-secondary/50 focus:bg-background border border-border focus:border-primary rounded-xl pl-10 pr-10 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all duration-200 shadow-sm focus:ring-2 focus:ring-primary/10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 cursor-pointer transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}

          {/* Selected Supplier dropdown lookup drawer when search query is typing - Positioned absolutely to float */}
          {searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 mt-1 border border-border rounded-lg max-h-60 overflow-y-auto z-50 shadow-2xl bg-card">
              {filteredSuppliers.length > 0 ? (
                filteredSuppliers.map((item) => (
                  <button
                    key={item.supplier}
                    onClick={() => {
                      setSelectedSupplier(item);
                      setSearchQuery("");
                    }}
                    className="w-full text-left text-xs p-2.5 hover:bg-primary/10 hover:text-primary border-b border-border font-mono transition-colors cursor-pointer text-foreground block bg-card"
                  >
                    {item.supplier} (Sales: {formatCurrency(item.sales)})
                  </button>
                ))
              ) : (
                <div className="text-xs text-muted-foreground p-4 text-center bg-card">
                  No suppliers matched.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Supplier detailed Profile Panel & Metrics */}
      {selectedSupplier && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Supplier stats card */}
          <div className="glass-card p-6 flex flex-col justify-between min-h-[350px]">
            <div>
              <span className="text-[9px] font-bold text-primary uppercase tracking-widest bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
                Supplier Profile
              </span>
              <h3 className="text-base font-bold text-foreground mt-4 truncate">
                {selectedSupplier.supplier}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                Performance Assessment
              </p>
            </div>
            <div className="space-y-3.5 mt-6">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-xs text-muted-foreground">Net Revenue</span>
                <span className="text-xs font-bold text-foreground font-mono">
                  {formatCurrency(selectedSupplier.sales)}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-xs text-muted-foreground">Gross Profit</span>
                <span className="text-xs font-bold text-emerald-500 font-mono">
                  {formatCurrency(selectedSupplier.profit)}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-xs text-muted-foreground">Gross Margin %</span>
                <span className={cn("text-xs font-bold font-mono",
                  selectedSupplier.margin_pct > 0 ? "text-emerald-500" : selectedSupplier.margin_pct < 0 ? "text-rose-500" : "text-muted-foreground"
                )}>
                  {(selectedSupplier.margin_pct || 0).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-xs text-muted-foreground">SKUs Supplied</span>
                <span className="text-xs font-bold text-indigo-500 font-mono">
                  {selectedSupplier.sku_count || 0} Products
                </span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-xs text-muted-foreground">Closing Stock</span>
                <span className="text-xs font-bold text-sky-500 font-mono">
                  {selectedSupplier.stock_qty.toLocaleString()} Units
                </span>
              </div>
            </div>
          </div>

          {/* Supplier Supply Chain Logistics KPIs */}
          <div className="glass-card p-6 flex flex-col justify-between min-h-[350px]">
            <div>
              <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
                Logistics & Returns
              </span>
              <h3 className="text-base font-bold text-foreground mt-4">Supply Quality KPIs</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                Operations tracking metrics
              </p>
            </div>
            <div className="space-y-3.5 mt-6">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-xs text-muted-foreground">Incoming Received</span>
                <span className="text-xs font-bold text-emerald-500 font-mono">
                  {(selectedSupplier.receive_qty || 0).toLocaleString()} Units
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-xs text-muted-foreground">Returned Volume</span>
                <span className="text-xs font-bold text-rose-500 font-mono">
                  {(selectedSupplier.return_qty || 0).toLocaleString()} Units
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-xs text-muted-foreground">Return Rate %</span>
                <span
                  className={cn(
                    "text-xs font-bold font-mono",
                    selectedSupplier.return_rate_pct > 0 ? "text-emerald-500" : selectedSupplier.return_rate_pct < 0 ? "text-rose-500" : "text-muted-foreground"
                  )}
                >
                  {(selectedSupplier.return_rate_pct || 0).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-xs text-muted-foreground">Avg Revenue / SKU</span>
                <span className="text-xs font-bold text-foreground font-mono">
                  {formatCurrency(
                    (selectedSupplier.sales || 0) / (selectedSupplier.sku_count || 1)
                  )}
                </span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-xs text-muted-foreground">Margin Grade</span>
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border",
                    selectedSupplier.margin_pct > 12
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                  )}
                >
                  {selectedSupplier.margin_pct > 12 ? "High Margin" : "Low Margin"}
                </span>
              </div>
            </div>
          </div>

          {/* Top 5 Products of Selected Supplier */}
          <div className="glass-card p-6 flex flex-col justify-between min-h-[350px]">
            <div>
              <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                Product Rankings
              </span>
              <h3 className="text-base font-bold text-foreground mt-4">Top 5 Products</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                Ranked by revenue contribution
              </p>
            </div>
            {loadingProducts ? (
              <div className="flex-1 flex items-center justify-center animate-pulse text-xs text-muted-foreground min-h-[150px]">
                Querying products database...
              </div>
            ) : topProducts.length > 0 ? (
              <div className="flex-1 space-y-3 mt-6">
                {topProducts.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center text-xs font-mono border-b border-border pb-2 last:border-0"
                  >
                    <div className="truncate max-w-[160px]">
                      <span className="text-[9px] text-muted-foreground block">{p.icode}</span>
                      <span className="text-foreground block font-medium truncate">
                        {p.description}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-primary block font-bold">
                        {formatCurrency(p.sales)}
                      </span>
                      <span className="text-muted-foreground block text-[9px]">
                        {p.qty.toLocaleString()} units
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground min-h-[150px]">
                No sales records mapped for this supplier.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rankings Side-by-Side Tables (Best vs Lowest Selling) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best Selling Suppliers */}
        <div className="glass-card p-6 flex flex-col justify-between h-[440px]">
          <div className="flex items-center gap-2.5 mb-4">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <div>
              <h3 className="text-sm font-bold text-foreground font-sans">
                Top 10 Best Selling Suppliers
              </h3>
              <p className="text-[11px] text-muted-foreground">Highest contribution to Net Sales</p>
            </div>
          </div>
          {loading ? (
            <div className="h-64 bg-muted rounded animate-pulse"></div>
          ) : (
            <div className="overflow-y-auto flex-1 pr-1 border border-border rounded-lg bg-card">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/50 sticky top-0 z-10">
                    <th className="p-2.5 text-muted-foreground font-semibold">Supplier</th>
                    <th className="p-2.5 text-muted-foreground font-semibold text-right">Sales</th>
                    <th className="p-2.5 text-muted-foreground font-semibold text-right">Profit</th>
                    <th className="p-2.5 text-muted-foreground font-semibold text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.best_selling.map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => setSelectedSupplier(item)}
                      className={cn(
                        "border-b border-border hover:bg-secondary/40 transition-colors cursor-pointer",
                        selectedSupplier?.supplier === item.supplier && "bg-primary/5 font-bold"
                      )}
                    >
                      <td className="p-2.5 text-foreground max-w-[180px] truncate">
                        {item.supplier}
                      </td>
                      <td className="p-2.5 text-foreground text-right">
                        {formatCurrency(item.sales)}
                      </td>
                      <td className="p-2.5 text-emerald-500 text-right">
                        {formatCurrency(item.profit)}
                      </td>
                      <td className={cn("p-2.5 text-right font-semibold",
                        item.margin_pct > 0 ? "text-emerald-500" : item.margin_pct < 0 ? "text-rose-500" : "text-muted-foreground"
                      )}>
                        {(item.margin_pct || 0).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Lowest Selling Suppliers */}
        <div className="glass-card p-6 flex flex-col justify-between h-[440px]">
          <div className="flex items-center gap-2.5 mb-4">
            <TrendingDown className="h-5 w-5 text-rose-500" />
            <div>
              <h3 className="text-sm font-bold text-foreground font-sans">
                Top 10 Low Selling Suppliers
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Lowest contribution (excluding zero-sales)
              </p>
            </div>
          </div>
          {loading ? (
            <div className="h-64 bg-muted rounded animate-pulse"></div>
          ) : (
            <div className="overflow-y-auto flex-1 pr-1 border border-border rounded-lg bg-card">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/50 sticky top-0 z-10">
                    <th className="p-2.5 text-muted-foreground font-semibold">Supplier</th>
                    <th className="p-2.5 text-muted-foreground font-semibold text-right">Sales</th>
                    <th className="p-2.5 text-muted-foreground font-semibold text-right">Profit</th>
                    <th className="p-2.5 text-muted-foreground font-semibold text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.lowest_selling.map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => setSelectedSupplier(item)}
                      className={cn(
                        "border-b border-border hover:bg-secondary/40 transition-colors cursor-pointer",
                        selectedSupplier?.supplier === item.supplier && "bg-primary/5 font-bold"
                      )}
                    >
                      <td className="p-2.5 text-foreground max-w-[180px] truncate">
                        {item.supplier}
                      </td>
                      <td className="p-2.5 text-foreground text-right">
                        {formatCurrency(item.sales)}
                      </td>
                      <td className="p-2.5 text-rose-500 text-right">
                        {formatCurrency(item.profit)}
                      </td>
                      <td className={cn("p-2.5 text-right font-semibold",
                        item.margin_pct > 0 ? "text-emerald-500" : item.margin_pct < 0 ? "text-rose-500" : "text-muted-foreground"
                      )}>
                        {(item.margin_pct || 0).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
