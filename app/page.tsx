"use client";

import React from "react";
import { useDashboard } from "./DashboardContext";
import KPIsGrid from "./components/KPIsGrid";
import SalesAnalytics from "./components/SalesAnalytics";
import InventoryFlow from "./components/InventoryFlow";
import ProductInsights from "./components/ProductInsights";
import AIChat from "./components/AIChat";
import SupplierInsights from "./components/SupplierInsights";
import CategoryInsights from "./components/CategoryInsights";
import DepartmentInsights from "./components/DepartmentInsights";
import Forecasting from "./components/Forecasting";
import Settings from "./components/Settings";

export default function Home() {
  const { activeTab } = useDashboard();

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{activeTab}</h1>
          <p className="text-xs text-[#A1A1AA]">MB OLAP Retail Business Intelligence Dashboard Workspace</p>
        </div>
      </div>

      {/* Render tab content */}
      {activeTab === "Dashboard" && (
        <div className="space-y-8">
          <KPIsGrid />
          <SalesAnalytics />
          <InventoryFlow />
        </div>
      )}

      {activeTab === "Sales Analytics" && <SalesAnalytics />}

      {activeTab === "Products" && <ProductInsights />}

      {activeTab === "Suppliers" && <SupplierInsights />}

      {activeTab === "Categories" && <CategoryInsights />}

      {activeTab === "Departments" && <DepartmentInsights />}

      {activeTab === "Forecasting" && <Forecasting />}

      {activeTab === "AI Assistant" && <AIChat />}

      {activeTab === "Settings" && <Settings />}

      {/* Fallback for other tabs */}
      {!["Dashboard", "Sales Analytics", "Products", "Suppliers", "Categories", "Departments", "Forecasting", "AI Assistant", "Settings"].includes(activeTab) && (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
          <h3 className="text-lg font-bold text-white mb-2">{activeTab} Panel</h3>
          <p className="text-xs text-[#A1A1AA] max-w-sm">
            This module is structured and ready for analytical queries. Configure filters in the top workspace panel to adjust metrics.
          </p>
        </div>
      )}
    </div>
  );
}
