"use client";

import React from "react";
import { Settings as SettingsIcon, KeyRound, ShieldCheck, Database, Bot } from "lucide-react";
import { cn } from "../../lib/utils";

export default function Settings() {
  return (
    <div className="glass-card p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground tracking-wide">Workspace Settings</h3>
          <p className="text-[11px] text-muted-foreground">System configuration and integration status</p>
        </div>
      </div>

      {/* Groq API Key Status */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="h-4 w-4 text-primary" />
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Groq API Key
          </h4>
        </div>
        <div className="flex items-start gap-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4">
          <ShieldCheck className="h-4.5 w-4.5 text-emerald-500 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Configured via Server Environment
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The Groq API Key is securely loaded server-side from the{" "}
              <code className="bg-primary/5 px-1.5 py-0.5 rounded font-mono text-primary text-[10px]">
                .env
              </code>{" "}
              file. It is never exposed to the browser. To update the key, edit{" "}
              <code className="bg-primary/5 px-1.5 py-0.5 rounded font-mono text-primary text-[10px]">
                GROQ_API_KEY
              </code>{" "}
              in your{" "}
              <code className="bg-primary/5 px-1.5 py-0.5 rounded font-mono text-primary text-[10px]">
                .env
              </code>{" "}
              file and restart the server.
            </p>
          </div>
        </div>
      </div>

      {/* Integration Status Row */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Database className="h-4 w-4 text-primary" />
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Active Integrations
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-3 bg-secondary/40 border border-border rounded-xl p-3">
            <Database className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">DuckDB OLAP</p>
              <p className="text-[10px] text-emerald-500 font-semibold">● Connected</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-secondary/40 border border-border rounded-xl p-3">
            <Bot className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">Qwen 3.6 27B</p>
              <p className="text-[10px] text-emerald-500 font-semibold">● Active</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
