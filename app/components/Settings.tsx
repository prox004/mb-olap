"use client";

import React from "react";
import { Settings as SettingsIcon, KeyRound, ShieldCheck, Database, Bot } from "lucide-react";

export default function Settings() {
  return (
    <div className="glass-card p-8 max-w-2xl mx-auto border border-[rgba(255,255,255,0.06)] bg-[rgba(15,15,20,0.85)] rounded-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.08)] pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-900/40 border border-purple-500/20 text-[#6D28D9]">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white tracking-wide">Workspace Settings</h3>
          <p className="text-[11px] text-[#A1A1AA]">System configuration and integration status</p>
        </div>
      </div>

      {/* Gemini API Key Status */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="h-4 w-4 text-purple-400" />
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Gemini API Key</h4>
        </div>
        <div className="flex items-start gap-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4">
          <ShieldCheck className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-emerald-300">Configured via Server Environment</p>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              The Gemini API Key is securely loaded server-side from the <code className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-purple-300 text-[10px]">.env</code> file.
              It is never exposed to the browser. To update the key, edit <code className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-purple-300 text-[10px]">GEMINI_API_KEY</code> in your <code className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-purple-300 text-[10px]">.env</code> file and restart the server.
            </p>
          </div>
        </div>
      </div>

      {/* Integration Status Row */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Database className="h-4 w-4 text-purple-400" />
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Active Integrations</h4>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <Database className="h-4 w-4 text-purple-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-white">DuckDB OLAP</p>
              <p className="text-[10px] text-emerald-400">● Connected</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <Bot className="h-4 w-4 text-purple-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-white">Gemini 2.5 Flash</p>
              <p className="text-[10px] text-emerald-400">● Active</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
