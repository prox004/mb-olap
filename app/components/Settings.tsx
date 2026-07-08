"use client";

import React, { useState, useEffect } from "react";
import { Settings as SettingsIcon, Key, Save, Eye, EyeOff, Trash2, CheckCircle2 } from "lucide-react";

export default function Settings() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "cleared">("idle");

  // Load key from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("gemini_api_key");
      if (savedKey) {
        setApiKey(savedKey);
      }
    }
  }, []);

  const handleSave = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("gemini_api_key", apiKey.trim());
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const handleClear = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("gemini_api_key");
      setApiKey("");
      setStatus("cleared");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <div className="glass-card p-8 max-w-2xl mx-auto border border-[rgba(255,255,255,0.06)] bg-[rgba(15,15,20,0.85)] rounded-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.08)] pb-4 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-900/40 border border-purple-500/20 text-[#6D28D9]">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white tracking-wide">Workspace Settings</h3>
          <p className="text-[11px] text-[#A1A1AA]">Configure credentials and integrations for your BI Workspace</p>
        </div>
      </div>

      {/* Gemini Integration Panel */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-purple-400" />
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Gemini API Key</h4>
        </div>

        <p className="text-xs text-[#A1A1AA] leading-relaxed">
          Specify your custom Gemini API key. This key is stored securely in your browser's local storage and is sent to the backend OLAP gateway to compile queries and generate reports.
        </p>

        <div className="flex gap-2 relative">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="flex-1 glass-input text-xs py-3 pl-4 pr-10 border border-white/10"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-2 text-[#A1A1AA] hover:text-white transition-colors"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="glass-btn flex items-center gap-2 text-xs py-2.5 px-4 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="h-3.5 w-3.5" />
            Save Key
          </button>

          {apiKey && (
            <button
              onClick={handleClear}
              className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all py-2.5 px-4 rounded-lg text-xs flex items-center gap-2 cursor-pointer font-medium"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear Key
            </button>
          )}
        </div>

        {/* Status Message */}
        {status === "saved" && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg animate-pulse">
            <CheckCircle2 className="h-4 w-4" />
            <span>API Key saved successfully! The AI Assistant will now use this key.</span>
          </div>
        )}
        {status === "cleared" && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg animate-pulse">
            <CheckCircle2 className="h-4 w-4" />
            <span>API Key removed. Backend environment variable will be used as fallback.</span>
          </div>
        )}
      </div>
    </div>
  );
}
