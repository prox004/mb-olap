"use client";

import React, { useState, useEffect } from "react";
import { Search, ShieldAlert, AlertTriangle, X } from "lucide-react";
import { cn } from "../../lib/utils";

type SearchResult = {
  icode: string;
  desc: string;
  mrp: number;
  rate: number;
};

export default function ProductInsights() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (q.trim().length === 0) {
      setResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Search query error", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [q]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  return (
    <div className="glass-card p-6 flex flex-col justify-between">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Instant Product Search</h3>
        <p className="text-xs text-muted-foreground">Fuzzy matching lookup against indexed product columns</p>
      </div>

      <div className="relative mt-4 w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by product ICODE or name description..."
          className="w-full h-10 bg-secondary/30 hover:bg-secondary/50 focus:bg-background border border-border focus:border-primary rounded-xl pl-10 pr-10 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all duration-200 shadow-sm focus:ring-2 focus:ring-primary/10"
        />

        {q && (
          <button
            onClick={() => setQ("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 cursor-pointer transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center animate-pulse text-xs text-muted-foreground">
          Searching product records...
        </div>
      ) : error ? (
        <div className="h-48 flex flex-col items-center justify-center text-xs">
          <ShieldAlert className="h-8 w-8 text-primary mb-2" />
          <span className="text-muted-foreground">Search service failed</span>
        </div>
      ) : results.length > 0 ? (
        <div className="mt-4 overflow-x-auto border border-border rounded-lg bg-card">
          <table className="w-full text-left text-xs font-sans border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="p-3 text-muted-foreground font-semibold">ICODE</th>
                <th className="p-3 text-muted-foreground font-semibold">Description</th>
                <th className="p-3 text-muted-foreground font-semibold text-right">MRP</th>
                <th className="p-3 text-muted-foreground font-semibold text-right">Supplier Rate</th>
              </tr>
            </thead>
            <tbody>
              {results.map((item, idx) => (
                <tr
                  key={idx}
                  className="border-b border-border hover:bg-secondary/40 transition-colors"
                >
                  <td className="p-3 font-mono font-medium text-foreground">{item.icode}</td>
                  <td className="p-3 text-foreground">{item.desc}</td>
                  <td className="p-3 text-foreground text-right font-medium">
                    {formatCurrency(item.mrp)}
                  </td>
                  <td className="p-3 text-foreground text-right font-medium">
                    {formatCurrency(item.rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : q.trim().length > 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-xs text-muted-foreground gap-2">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          No matching products found.
        </div>
      ) : (
        <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
          Enter search keyword to query database
        </div>
      )}
    </div>
  );
}
