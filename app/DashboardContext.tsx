"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Filters = {
  division: string[];
  section: string[];
  department: string[];
  supplier: string[];
  store: string[];
  category: string[];
  startDate: string;
  endDate: string;
  minMrp: number | "";
  maxMrp: number | "";
};

type FilterOptions = {
  divisions: string[];
  sections: string[];
  departments: string[];
  suppliers: string[];
  stores: string[];
  categories: string[];
  min_date: string;
  max_date: string;
};

type DashboardContextType = {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  filterOptions: FilterOptions;
  loadingOptions: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  resetFilters: () => void;
};

const defaultFilters: Filters = {
  division: [],
  section: [],
  department: [],
  supplier: [],
  store: [],
  category: [],
  startDate: "",
  endDate: "",
  minMrp: "",
  maxMrp: "",
};

const defaultOptions: FilterOptions = {
  divisions: [],
  sections: [],
  departments: [],
  suppliers: [],
  stores: [],
  categories: [],
  min_date: "",
  max_date: "",
};

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(defaultOptions);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [activeTab, setActiveTab] = useState("Dashboard");

  // Load filter boundaries from API
  useEffect(() => {
    async function fetchOptions() {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/v1/filters");
        if (res.ok) {
          const data = await res.json();
          setFilterOptions(data);
          // Set initial date boundaries if they aren't set
          setFilters((prev) => ({
            ...prev,
            startDate: data.min_date ? data.min_date.split(" ")[0] : "",
            endDate: data.max_date ? data.max_date.split(" ")[0] : "",
          }));
        }
      } catch (err) {
        console.error("Failed to load global filters boundaries", err);
      } finally {
        setLoadingOptions(false);
      }
    }
    fetchOptions();
  }, []);

  const resetFilters = () => {
    setFilters({
      ...defaultFilters,
      startDate: filterOptions.min_date ? filterOptions.min_date.split(" ")[0] : "",
      endDate: filterOptions.max_date ? filterOptions.max_date.split(" ")[0] : "",
    });
  };

  return (
    <DashboardContext.Provider
      value={{
        filters,
        setFilters,
        filterOptions,
        loadingOptions,
        activeTab,
        setActiveTab,
        resetFilters,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
