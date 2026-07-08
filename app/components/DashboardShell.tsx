"use client";

import React from "react";
import { useDashboard } from "../DashboardContext";
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  Shirt,
  Truck,
  Folder,
  Layers,
  Store,
  FileText,
  LineChart,
  Bot,
  Settings,
  RefreshCw,
  Search,
} from "lucide-react";

const navigationItems = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Sales Analytics", icon: TrendingUp },
  { name: "Products", icon: Shirt },
  { name: "Suppliers", icon: Truck },
  { name: "Categories", icon: Folder },
  { name: "Departments", icon: Layers },
  { name: "Stores", icon: Store },
  { name: "Forecasting", icon: LineChart },
  { name: "AI Assistant", icon: Bot },
  { name: "Settings", icon: Settings },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const {
    filters,
    setFilters,
    filterOptions,
    loadingOptions,
    activeTab,
    setActiveTab,
    resetFilters,
  } = useDashboard();

  const handleMultiSelectChange = (
    field: "division" | "section" | "department" | "supplier" | "store" | "category",
    value: string
  ) => {
    setFilters((prev) => {
      const current = prev[field];
      const updated = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      return { ...prev, [field]: updated };
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#09090B] text-[#F4F4F5]">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-[rgba(255,255,255,0.08)] bg-[rgba(18,18,23,0.9)] flex flex-col">
        <div className="h-16 flex items-center px-6 gap-3 border-b border-[rgba(255,255,255,0.08)]">
          <TrendingUp className="h-6 w-6 text-[#6D28D9]" />
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent">
            MB OLAP Engine
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${isActive
                    ? "bg-[#6D28D9] text-white shadow-lg shadow-purple-900/30"
                    : "text-[#A1A1AA] hover:text-white hover:bg-[rgba(255,255,255,0.03)]"
                  }`}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Selected filters tags summary row */}
        {Object.values(filters).some((val) => Array.isArray(val) && val.length > 0) && (
          <div className="bg-[#121217] px-8 py-2 border-b border-[rgba(255,255,255,0.08)] flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-[#A1A1AA] uppercase font-bold">Active:</span>
            {filters.division.map((val) => (
              <span
                key={val}
                onClick={() => handleMultiSelectChange("division", val)}
                className="text-[10px] bg-[#6D28D9]/20 border border-[#6D28D9]/40 text-purple-300 px-2 py-0.5 rounded cursor-pointer hover:bg-[#6D28D9]/40"
              >
                {val} ×
              </span>
            ))}
            {filters.department.map((val) => (
              <span
                key={val}
                onClick={() => handleMultiSelectChange("department", val)}
                className="text-[10px] bg-indigo-900/40 border border-indigo-700/40 text-indigo-300 px-2 py-0.5 rounded cursor-pointer hover:bg-indigo-700/60"
              >
                {val} ×
              </span>
            ))}
            {filters.section.map((val) => (
              <span
                key={val}
                onClick={() => handleMultiSelectChange("section", val)}
                className="text-[10px] bg-blue-900/40 border border-blue-700/40 text-blue-300 px-2 py-0.5 rounded cursor-pointer hover:bg-blue-700/60"
              >
                {val} ×
              </span>
            ))}
          </div>
        )}

        {/* Render Dashboard Pages inside scrollable area */}
        <main className="flex-1 overflow-y-auto bg-[#09090B] p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
