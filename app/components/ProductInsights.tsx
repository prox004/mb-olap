"use client";

import React, { useState, useEffect } from "react";
import { Search, ShieldAlert, AlertTriangle } from "lucide-react";

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
    <div className="glass-card p-6 flex flex-col justify-between mt-8">
      <div>
        <h3 className="text-sm font-semibold text-white">Instant Product Search</h3>
        <p className="text-xs text-[#A1A1AA]">Fuzzy matching lookup against indexed product columns</p>
      </div>

      <div className="relative mt-4">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by product ICODE or name description..."
          className="w-full glass-input text-xs py-2.5"
          style={{ paddingLeft: "2.5rem" }}
        />
        <Search className="absolute left-3 top-2 h-4 w-4 text-[#A1A1AA]" />
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center animate-pulse text-xs text-[#A1A1AA]">
          Searching product records...
        </div>
      ) : error ? (
        <div className="h-48 flex flex-col items-center justify-center text-xs">
          <ShieldAlert className="h-8 w-8 text-red-500 mb-2" />
          <span className="text-[#A1A1AA]">Search service failed</span>
        </div>
      ) : results.length > 0 ? (
        <div className="mt-4 overflow-x-auto border border-[rgba(255,255,255,0.08)] rounded-lg">
          <table className="w-full text-left text-xs font-mono border-collapse bg-[#09090B]">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.08)] bg-white/5">
                <th className="p-3 text-[#A1A1AA] font-semibold">ICODE</th>
                <th className="p-3 text-[#A1A1AA] font-semibold">Description</th>
                <th className="p-3 text-[#A1A1AA] font-semibold text-right">MRP</th>
                <th className="p-3 text-[#A1A1AA] font-semibold text-right">Supplier Rate</th>
              </tr>
            </thead>
            <tbody>
              {results.map((item, idx) => (
                <tr key={idx} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-white/5">
                  <td className="p-3 text-white">{item.icode}</td>
                  <td className="p-3 text-white">{item.desc}</td>
                  <td className="p-3 text-white text-right">{formatCurrency(item.mrp)}</td>
                  <td className="p-3 text-white text-right">{formatCurrency(item.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : q.trim().length > 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-xs text-[#A1A1AA] gap-2">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          No matching products found.
        </div>
      ) : (
        <div className="h-48 flex items-center justify-center text-xs text-[#A1A1AA]">
          Enter search keyword to query database
        </div>
      )}
    </div>
  );
}
