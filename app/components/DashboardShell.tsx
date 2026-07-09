"use client";

import React, { useState } from "react";
import { useDashboard } from "../DashboardContext";
import {
  LayoutDashboard,
  TrendingUp,
  Shirt,
  Truck,
  Folder,
  Layers,
  Store,
  LineChart,
  Bot,
  Settings,
  Sun,
  Moon,
  Search,
  Filter,
  X,
  ChevronDown,
  RotateCcw,
  Menu,
} from "lucide-react";
import { cn } from "../../lib/utils";

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
    theme,
    toggleTheme,
  } = useDashboard();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

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

  const handleDropdownToggle = (dropdown: string) => {
    setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
  };

  const hasActiveFilters = Object.values(filters).some(
    (val) => (Array.isArray(val) && val.length > 0) || (typeof val === "string" && val !== "")
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar Navigation */}
      <aside
        className={cn(
          "border-r border-border bg-card flex flex-col transition-all duration-300 z-30 shrink-0",
          sidebarOpen ? "w-64" : "w-20"
        )}
      >
        {/* Brand Header */}
        <div className={cn("h-16 flex items-center border-b border-border px-4", sidebarOpen ? "justify-between" : "justify-center")}>
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                  <TrendingUp className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-bold text-lg text-foreground">
                  Metro <span className="text-red-500">Bot</span>
                </span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-secondary cursor-pointer"
                title="Collapse Sidebar"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-secondary cursor-pointer"
              title="Expand Sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                title={item.name}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer relative",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {sidebarOpen && <span>{item.name}</span>}
                {isActive && !sidebarOpen && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-l-md" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-border flex items-center justify-center gap-2">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-muted-foreground hover:text-foreground p-2 rounded-md hover:bg-secondary"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          {sidebarOpen && (
            <div className="w-full flex items-center justify-between text-xs text-muted-foreground">
              <span>v1.0.0 (Production)</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Navbar / Header */}
        <header className="h-16 border-b border-border bg-card/60 backdrop-blur-md flex items-center justify-between px-8 z-20 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold tracking-tight text-foreground">{activeTab}</h2>
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-md">
              <span>Workspace</span>
              <span className="text-border">/</span>
              <span>MBazars Analytics</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search (Decorative) */}
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search metrics..."
                className="w-48 xl:w-64 bg-secondary border border-border rounded-lg pl-9 pr-4 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
              />
            </div>

            {/* Filter Toggle Button */}
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all",
                filtersOpen || hasActiveFilters
                  ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/10"
                  : "bg-background border-border text-foreground hover:bg-secondary"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary-foreground text-primary text-[10px] font-bold">
                  Active
                </span>
              )}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
              title={theme === "light" ? "Dark Mode" : "Light Mode"}
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Collapsible Filter Panel */}
        {filtersOpen && (
          <div className="bg-card border-b border-border p-6 shadow-lg z-10 overflow-y-auto shrink-0 max-h-[50vh] transition-all">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {/* Division Dropdown */}
              <div className="relative">
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 block">
                  Division
                </label>
                <button
                  onClick={() => handleDropdownToggle("division")}
                  className="w-full flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground hover:bg-secondary/50 cursor-pointer"
                >
                  <span className="truncate">
                    {filters.division.length === 0
                      ? "All Divisions"
                      : `${filters.division.length} Selected`}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
                {activeDropdown === "division" && (
                  <div className="absolute left-0 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto p-1">
                    {loadingOptions ? (
                      <div className="p-2 text-xs text-muted-foreground">Loading...</div>
                    ) : filterOptions.divisions.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground">No options</div>
                    ) : (
                      filterOptions.divisions.map((val) => (
                        <label
                          key={val}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary text-xs text-foreground cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={filters.division.includes(val)}
                            onChange={() => handleMultiSelectChange("division", val)}
                            className="rounded border-border text-primary focus:ring-primary"
                          />
                          <span>{val}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Section Dropdown */}
              <div className="relative">
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 block">
                  Section
                </label>
                <button
                  onClick={() => handleDropdownToggle("section")}
                  className="w-full flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground hover:bg-secondary/50 cursor-pointer"
                >
                  <span className="truncate">
                    {filters.section.length === 0
                      ? "All Sections"
                      : `${filters.section.length} Selected`}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
                {activeDropdown === "section" && (
                  <div className="absolute left-0 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto p-1">
                    {loadingOptions ? (
                      <div className="p-2 text-xs text-muted-foreground">Loading...</div>
                    ) : filterOptions.sections.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground">No options</div>
                    ) : (
                      filterOptions.sections.map((val) => (
                        <label
                          key={val}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary text-xs text-foreground cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={filters.section.includes(val)}
                            onChange={() => handleMultiSelectChange("section", val)}
                            className="rounded border-border text-primary focus:ring-primary"
                          />
                          <span>{val}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Department Dropdown */}
              <div className="relative">
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 block">
                  Department
                </label>
                <button
                  onClick={() => handleDropdownToggle("department")}
                  className="w-full flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground hover:bg-secondary/50 cursor-pointer"
                >
                  <span className="truncate">
                    {filters.department.length === 0
                      ? "All Departments"
                      : `${filters.department.length} Selected`}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
                {activeDropdown === "department" && (
                  <div className="absolute left-0 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto p-1">
                    {loadingOptions ? (
                      <div className="p-2 text-xs text-muted-foreground">Loading...</div>
                    ) : filterOptions.departments.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground">No options</div>
                    ) : (
                      filterOptions.departments.map((val) => (
                        <label
                          key={val}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary text-xs text-foreground cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={filters.department.includes(val)}
                            onChange={() => handleMultiSelectChange("department", val)}
                            className="rounded border-border text-primary focus:ring-primary"
                          />
                          <span>{val}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Category Dropdown */}
              <div className="relative">
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 block">
                  Category
                </label>
                <button
                  onClick={() => handleDropdownToggle("category")}
                  className="w-full flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground hover:bg-secondary/50 cursor-pointer"
                >
                  <span className="truncate">
                    {filters.category.length === 0
                      ? "All Categories"
                      : `${filters.category.length} Selected`}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
                {activeDropdown === "category" && (
                  <div className="absolute left-0 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto p-1">
                    {loadingOptions ? (
                      <div className="p-2 text-xs text-muted-foreground">Loading...</div>
                    ) : filterOptions.categories.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground">No options</div>
                    ) : (
                      filterOptions.categories.map((val) => (
                        <label
                          key={val}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary text-xs text-foreground cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={filters.category.includes(val)}
                            onChange={() => handleMultiSelectChange("category", val)}
                            className="rounded border-border text-primary focus:ring-primary"
                          />
                          <span>{val}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Supplier Dropdown */}
              <div className="relative">
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 block">
                  Supplier
                </label>
                <button
                  onClick={() => handleDropdownToggle("supplier")}
                  className="w-full flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground hover:bg-secondary/50 cursor-pointer"
                >
                  <span className="truncate">
                    {filters.supplier.length === 0
                      ? "All Suppliers"
                      : `${filters.supplier.length} Selected`}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
                {activeDropdown === "supplier" && (
                  <div className="absolute left-0 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto p-1">
                    {loadingOptions ? (
                      <div className="p-2 text-xs text-muted-foreground">Loading...</div>
                    ) : filterOptions.suppliers.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground">No options</div>
                    ) : (
                      filterOptions.suppliers.map((val) => (
                        <label
                          key={val}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary text-xs text-foreground cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={filters.supplier.includes(val)}
                            onChange={() => handleMultiSelectChange("supplier", val)}
                            className="rounded border-border text-primary focus:ring-primary"
                          />
                          <span>{val}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Store Dropdown */}
              <div className="relative">
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 block">
                  Store
                </label>
                <button
                  onClick={() => handleDropdownToggle("store")}
                  className="w-full flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground hover:bg-secondary/50 cursor-pointer"
                >
                  <span className="truncate">
                    {filters.store.length === 0
                      ? "All Stores"
                      : `${filters.store.length} Selected`}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
                {activeDropdown === "store" && (
                  <div className="absolute left-0 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto p-1">
                    {loadingOptions ? (
                      <div className="p-2 text-xs text-muted-foreground">Loading...</div>
                    ) : filterOptions.stores.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground">No options</div>
                    ) : (
                      filterOptions.stores.map((val) => (
                        <label
                          key={val}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary text-xs text-foreground cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={filters.store.includes(val)}
                            onChange={() => handleMultiSelectChange("store", val)}
                            className="rounded border-border text-primary focus:ring-primary"
                          />
                          <span>{val}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Date Inputs */}
              <div className="flex flex-col">
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 block">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 block">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* MRP Range Inputs */}
              <div className="flex flex-col">
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 block">
                  Min MRP
                </label>
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.minMrp}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      minMrp: e.target.value === "" ? "" : Number(e.target.value),
                    }))
                  }
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 block">
                  Max MRP
                </label>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.maxMrp}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      maxMrp: e.target.value === "" ? "" : Number(e.target.value),
                    }))
                  }
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* Reset Actions */}
              <div className="flex items-end gap-2 sm:col-span-2">
                <button
                  onClick={resetFilters}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-secondary text-foreground hover:bg-secondary-foreground/10 border border-border rounded-lg text-xs font-semibold cursor-pointer transition-all"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset All</span>
                </button>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                >
                  <span>Apply</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Selected filters tags summary row */}
        {hasActiveFilters && (
          <div className="bg-secondary/40 px-8 py-3 border-b border-border flex items-center gap-2 flex-wrap shrink-0">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Active Filters:
            </span>
            {filters.division.map((val) => (
              <span
                key={val}
                onClick={() => handleMultiSelectChange("division", val)}
                className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-1 font-medium"
              >
                <span>{val}</span>
                <X className="h-2.5 w-2.5" />
              </span>
            ))}
            {filters.section.map((val) => (
              <span
                key={val}
                onClick={() => handleMultiSelectChange("section", val)}
                className="text-[10px] bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-sky-500 hover:text-white transition-all flex items-center gap-1 font-medium"
              >
                <span>{val}</span>
                <X className="h-2.5 w-2.5" />
              </span>
            ))}
            {filters.department.map((val) => (
              <span
                key={val}
                onClick={() => handleMultiSelectChange("department", val)}
                className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-indigo-500 hover:text-white transition-all flex items-center gap-1 font-medium"
              >
                <span>{val}</span>
                <X className="h-2.5 w-2.5" />
              </span>
            ))}
            {filters.category.map((val) => (
              <span
                key={val}
                onClick={() => handleMultiSelectChange("category", val)}
                className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-amber-500 hover:text-white transition-all flex items-center gap-1 font-medium"
              >
                <span>{val}</span>
                <X className="h-2.5 w-2.5" />
              </span>
            ))}
            {filters.supplier.map((val) => (
              <span
                key={val}
                onClick={() => handleMultiSelectChange("supplier", val)}
                className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1 font-medium"
              >
                <span>{val}</span>
                <X className="h-2.5 w-2.5" />
              </span>
            ))}
            {filters.store.map((val) => (
              <span
                key={val}
                onClick={() => handleMultiSelectChange("store", val)}
                className="text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-purple-500 hover:text-white transition-all flex items-center gap-1 font-medium"
              >
                <span>{val}</span>
                <X className="h-2.5 w-2.5" />
              </span>
            ))}
            {filters.startDate && (
              <span
                onClick={() => setFilters((prev) => ({ ...prev, startDate: "" }))}
                className="text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-rose-500 hover:text-white transition-all flex items-center gap-1 font-medium"
              >
                <span>Start: {filters.startDate}</span>
                <X className="h-2.5 w-2.5" />
              </span>
            )}
            {filters.endDate && (
              <span
                onClick={() => setFilters((prev) => ({ ...prev, endDate: "" }))}
                className="text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-rose-500 hover:text-white transition-all flex items-center gap-1 font-medium"
              >
                <span>End: {filters.endDate}</span>
                <X className="h-2.5 w-2.5" />
              </span>
            )}
            {(filters.minMrp !== "" || filters.maxMrp !== "") && (
              <span
                onClick={() => setFilters((prev) => ({ ...prev, minMrp: "", maxMrp: "" }))}
                className="text-[10px] bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-orange-500 hover:text-white transition-all flex items-center gap-1 font-medium"
              >
                <span>
                  MRP: {filters.minMrp || "0"} - {filters.maxMrp || "Max"}
                </span>
                <X className="h-2.5 w-2.5" />
              </span>
            )}
            <button
              onClick={resetFilters}
              className="text-[10px] text-muted-foreground hover:text-primary transition-all font-bold uppercase ml-auto"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Render Dashboard Pages inside scrollable area */}
        <main className="flex-1 overflow-y-auto bg-background p-6 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
