"use client";

import React, { useState, useEffect } from "react";
import { useDashboard } from "../DashboardContext";
import { Search, TrendingUp, TrendingDown, ShieldAlert } from "lucide-react";

type DepartmentStat = {
  department: string;
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

export default function DepartmentInsights() {
  const { filters } = useDashboard();
  const [data, setData] = useState<{ best_selling: DepartmentStat[]; lowest_selling: DepartmentStat[]; all_departments: DepartmentStat[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<DepartmentStat | null>(null);
  const [topProducts, setTopProducts] = useState<ProductStat[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    async function fetchDepartmentData() {
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

        const res = await fetch(`http://127.0.0.1:8000/api/v1/analytics/departments?${queryParams.toString()}`);
        if (res.ok) {
          const result = await res.json();
          setData(result);

          if (result.best_selling && result.best_selling.length > 0) {
            setSelectedDept(result.best_selling[0]);
          }
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Failed to fetch departments analytical data", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchDepartmentData();
  }, [filters]);

  useEffect(() => {
    async function fetchTopProducts() {
      if (!selectedDept) return;
      setTopProducts([]);
      setLoadingProducts(true);
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/analytics/departments/top-products?department_name=${encodeURIComponent(selectedDept.department)}`);
        if (res.ok) {
          const result = await res.json();
          setTopProducts(result.products || []);
        }
      } catch (err) {
        console.error("Failed to load top products for department", err);
      } finally {
        setLoadingProducts(false);
      }
    }
    fetchTopProducts();
  }, [selectedDept]);

  if (error) {
    return (
      <div className="glass-card p-6 flex flex-col items-center justify-center h-48">
        <ShieldAlert className="h-10 w-10 text-red-500 mb-2" />
        <span className="text-sm font-semibold text-[#F4F4F5]">Failed to load department analytics data</span>
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

  const filteredDepts = data?.all_departments.filter((d) =>
    d.department.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      {/* Top Search bar with Fuzzy Search */}
      <div className="glass-card p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA] mb-2.5">
          Fuzzy Department Registry Lookup
        </h3>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type department name or code to filter and select department analytics..."
            className="w-full glass-input text-xs py-2.5"
            style={{ paddingLeft: "2.5rem" }}
          />
          <Search className="absolute left-3.5 top-2 h-4 w-4 text-[#A1A1AA]" />

          {/* Department dropdown drawer when search query is typing - Positioned absolutely to float */}
          {/* Department dropdown drawer when search query is typing - Positioned absolutely to float */}
          {searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 mt-1 border border-[rgba(255,255,255,0.15)] rounded-lg max-h-60 overflow-y-auto z-50 shadow-2xl" style={{ backgroundColor: "#18181B" }}>
              {filteredDepts.length > 0 ? (
                filteredDepts.map((item) => (
                  <button
                    key={item.department}
                    onClick={() => {
                      setSelectedDept(item);
                      setSearchQuery("");
                    }}
                    className="w-full text-left text-xs p-2.5 hover:bg-[#6D28D9]/25 hover:text-white border-b border-white/10 font-mono transition-colors cursor-pointer"
                    style={{ backgroundColor: "#18181B", color: "#C084FC" }}
                  >
                    {item.department} (Sales: {formatCurrency(item.sales)})
                  </button>
                ))
              ) : (
                <div className="text-xs text-[#A1A1AA] p-4 text-center" style={{ backgroundColor: "#18181B", color: "#A1A1AA" }}>No departments matched.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Department detailed Profile Panel & Metrics (Side-by-Side Cards) */}
      {selectedDept && (
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {/* Department stats card */}
          <div className="glass-card p-6 flex flex-col justify-between min-h-[350px]">
            <div>
              <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest bg-purple-900/40 border border-purple-700/40 px-2 py-0.5 rounded">
                Department Profile
              </span>
              <h3 className="text-sm font-bold text-white mt-3 truncate">
                {selectedDept.department}
              </h3>
              <p className="text-[10px] text-[#A1A1AA] mt-0.5 font-mono">Performance Assessment</p>
            </div>
            <div className="space-y-3.5 mt-6">
              <div className="flex justify-between border-b border-white/15 pb-2">
                <span className="text-sm text-[#A1A1AA]">Net Revenue contribution</span>
                <span className="text-sm font-bold text-white font-mono">{formatCurrency(selectedDept.sales)}</span>
              </div>
              <div className="flex justify-between border-b border-white/15 pb-2">
                <span className="text-sm text-[#A1A1AA]">Gross Profit share</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">{formatCurrency(selectedDept.profit)}</span>
              </div>
              <div className="flex justify-between border-b border-white/15 pb-2">
                <span className="text-sm text-[#A1A1AA]">Gross Margin %</span>
                <span className="text-sm font-bold text-purple-300 font-mono">{(selectedDept.margin_pct || 0).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between border-b border-white/15 pb-2">
                <span className="text-sm text-[#A1A1AA]">Active SKU count</span>
                <span className="text-sm font-bold text-indigo-300 font-mono">{selectedDept.sku_count || 0} Products</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-sm text-[#A1A1AA]">Closing inventory stock</span>
                <span className="text-sm font-bold text-blue-300 font-mono">{selectedDept.stock_qty.toLocaleString()} Units</span>
              </div>
            </div>
          </div>

          {/* Department Logistics KPIs */}
          <div className="glass-card p-6 flex flex-col justify-between min-h-[350px]">
            <div>
              <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-900/40 border border-indigo-700/40 px-2 py-0.5 rounded">
                Logistics & Quality
              </span>
              <h3 className="text-sm font-bold text-white mt-3">
                Operations KPIs
              </h3>
              <p className="text-[10px] text-[#A1A1AA] mt-0.5 font-mono">Stock flow dynamics</p>
            </div>
            <div className="space-y-3.5 mt-6">
              <div className="flex justify-between border-b border-white/15 pb-2">
                <span className="text-sm text-[#A1A1AA]">Incoming Goods Received</span>
                <span className="text-sm font-bold text-emerald-500 font-mono">{(selectedDept.receive_qty || 0).toLocaleString()} Units</span>
              </div>
              <div className="flex justify-between border-b border-white/15 pb-2">
                <span className="text-sm text-[#A1A1AA]">Returned Goods Volume</span>
                <span className="text-sm font-bold text-rose-500 font-mono">{(selectedDept.return_qty || 0).toLocaleString()} Units</span>
              </div>
              <div className="flex justify-between border-b border-white/15 pb-2">
                <span className="text-sm text-[#A1A1AA]">Department Return Rate %</span>
                <span className={`text-sm font-bold font-mono ${selectedDept.return_rate_pct > 10 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {(selectedDept.return_rate_pct || 0).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between border-b border-white/15 pb-2">
                <span className="text-sm text-[#A1A1AA]">Avg sales revenue per SKU</span>
                <span className="text-sm font-bold text-white font-mono">
                  {formatCurrency((selectedDept.sales || 0) / (selectedDept.sku_count || 1))}
                </span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-sm text-[#A1A1AA]">Profit Margin Grade</span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${selectedDept.margin_pct > 12 ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40' : 'bg-amber-900/40 text-amber-300 border border-amber-700/40'
                  }`}>
                  {selectedDept.margin_pct > 12 ? "High Margin" : "Low Margin"}
                </span>
              </div>
            </div>
          </div>

          {/* Top 5 Products of Selected Department */}
          <div className="glass-card p-6 flex flex-col justify-between min-h-[350px]">
            <div>
              <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest bg-amber-900/40 border border-amber-700/40 px-2 py-0.5 rounded">
                Product Rankings
              </span>
              <h3 className="text-sm font-bold text-white mt-3">
                Top 5 Best-Selling Products
              </h3>
              <p className="text-[10px] text-[#A1A1AA] mt-0.5 font-mono">Ranked by revenue contribution</p>
            </div>
            {loadingProducts ? (
              <div className="flex-1 flex items-center justify-center animate-pulse text-xs text-[#A1A1AA] min-h-[150px]">
                Querying products database...
              </div>
            ) : topProducts.length > 0 ? (
              <div className="flex-1 space-y-3 mt-6">
                {topProducts.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[11px] font-mono border-b border-white/15 pb-2">
                    <div className="truncate max-w-[180px]">
                      <span className="text-[#A1A1AA] block text-[9px]">{p.icode}</span>
                      <span className="text-white block font-medium truncate">{p.description}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 block font-bold">{formatCurrency(p.sales)}</span>
                      <span className="text-[#A1A1AA] block text-[9px]">{p.qty.toLocaleString()} units</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-[#A1A1AA] min-h-[150px]">
                No sales records mapped for this department.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rankings Side-by-Side Tables (Best vs Lowest Selling) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best Selling Departments */}
        <div className="glass-card p-6 flex flex-col justify-between h-[440px]">
          <div className="flex items-center gap-2.5 mb-4">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <div>
              <h3 className="text-sm font-bold text-white">Top 10 Best Selling Departments</h3>
              <p className="text-[11px] text-[#A1A1AA]">Highest contribution to Net Sales</p>
            </div>
          </div>
          {loading ? (
            <div className="h-64 bg-white/5 rounded animate-pulse"></div>
          ) : (
            <div className="overflow-y-auto flex-1 pr-1">
              <table className="w-full text-left text-[11px] font-mono border-collapse">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.08)] bg-white/5 sticky top-0 bg-[#121217]">
                    <th className="p-2.5 text-[#A1A1AA]">Department</th>
                    <th className="p-2.5 text-[#A1A1AA] text-right">Net Sales</th>
                    <th className="p-2.5 text-[#A1A1AA] text-right">Gross Profit</th>
                    <th className="p-2.5 text-[#A1A1AA] text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.best_selling.map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => setSelectedDept(item)}
                      className={`border-b border-[rgba(255,255,255,0.03)] hover:bg-[#6D28D9]/10 cursor-pointer ${selectedDept?.department === item.department ? "bg-[#6D28D9]/20 font-bold" : ""
                        }`}
                    >
                      <td className="p-2.5 text-white max-w-[200px] truncate">{item.department}</td>
                      <td className="p-2.5 text-white text-right">{formatCurrency(item.sales)}</td>
                      <td className="p-2.5 text-emerald-400 text-right">{formatCurrency(item.profit)}</td>
                      <td className="p-2.5 text-purple-300 text-right">{(item.margin_pct || 0).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Lowest Selling Departments */}
        <div className="glass-card p-6 flex flex-col justify-between h-[440px]">
          <div className="flex items-center gap-2.5 mb-4">
            <TrendingDown className="h-5 w-5 text-rose-500" />
            <div>
              <h3 className="text-sm font-bold text-white">Top 10 Low Selling Departments</h3>
              <p className="text-[11px] text-[#A1A1AA]">Lowest contribution to sales (excluding zero-sales)</p>
            </div>
          </div>
          {loading ? (
            <div className="h-64 bg-white/5 rounded animate-pulse"></div>
          ) : (
            <div className="overflow-y-auto flex-1 pr-1">
              <table className="w-full text-left text-[11px] font-mono border-collapse">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.08)] bg-white/5 sticky top-0 bg-[#121217]">
                    <th className="p-2.5 text-[#A1A1AA]">Department</th>
                    <th className="p-2.5 text-[#A1A1AA] text-right">Net Sales</th>
                    <th className="p-2.5 text-[#A1A1AA] text-right">Gross Profit</th>
                    <th className="p-2.5 text-[#A1A1AA] text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.lowest_selling.map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => setSelectedDept(item)}
                      className={`border-b border-[rgba(255,255,255,0.03)] hover:bg-[#6D28D9]/10 cursor-pointer ${selectedDept?.department === item.department ? "bg-[#6D28D9]/20 font-bold" : ""
                        }`}
                    >
                      <td className="p-2.5 text-white max-w-[200px] truncate">{item.department}</td>
                      <td className="p-2.5 text-white text-right">{formatCurrency(item.sales)}</td>
                      <td className="p-2.5 text-rose-400 text-right">{formatCurrency(item.profit)}</td>
                      <td className="p-2.5 text-purple-300 text-right">{(item.margin_pct || 0).toFixed(1)}%</td>
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
