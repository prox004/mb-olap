"use client";

import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, Download, RefreshCw, Sparkles, Copy, Check, ChevronDown, ChevronUp, Database } from "lucide-react";

interface Message {
  sender: "user" | "bot";
  text: string;
  report?: string;
  tableData?: any[];
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Welcome! I am your AI Inventory Analyst. Ask me anything about our sales metrics, categories, suppliers, or products, and I will compile the report for you."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [expandedTable, setExpandedTable] = useState<Record<number, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (customQuery?: string) => {
    const textToSend = customQuery || input;
    if (!textToSend.trim()) return;

    // Append user message
    setMessages((prev) => [...prev, { sender: "user", text: textToSend }]);
    if (!customQuery) setInput("");
    setLoading(true);

    try {
      const apiKey = typeof window !== "undefined" ? localStorage.getItem("gemini_api_key") : null;
      const res = await fetch("http://127.0.0.1:8000/api/v1/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: textToSend,
          gemini_key: apiKey
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: `Analyzed results for: "${textToSend}"`,
            report: data.report,
            tableData: data.results,
          },
        ]);
      } else {
        const errData = await res.json();
        const msg = errData.detail || "Failed to execute query.";
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: `Error processing query: ${msg}` }
        ]);
      }
    } catch (err) {
      console.error("AI chat query error", err);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Failed to connect to the OLAP AI Gateway. Please ensure the Python backend server is running." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = (tableData: any[], filename = "ai_report.csv") => {
    if (!tableData || tableData.length === 0) return;
    const headers = Object.keys(tableData[0]).join(",");
    const rows = tableData.map((row) =>
      Object.values(row)
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const toggleTable = (idx: number) => {
    setExpandedTable((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const renderInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={index} className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-xs text-purple-300">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const renderMarkdown = (text?: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      if (line.startsWith("### ")) {
        return <h4 key={idx} className="text-sm font-bold text-white mt-3 mb-1.5">{renderInlineStyles(line.slice(4))}</h4>;
      }
      if (line.startsWith("## ")) {
        return <h3 key={idx} className="text-base font-bold text-white mt-4 mb-2">{renderInlineStyles(line.slice(3))}</h3>;
      }
      if (line.startsWith("# ")) {
        return <h2 key={idx} className="text-lg font-bold text-white mt-5 mb-3">{renderInlineStyles(line.slice(2))}</h2>;
      }
      if (line.startsWith("* ") || line.startsWith("- ")) {
        return (
          <ul key={idx} className="list-disc pl-5 my-1 text-[#D4D4D8] space-y-1">
            <li className="text-xs md:text-sm">{renderInlineStyles(line.slice(2))}</li>
          </ul>
        );
      }
      const numMatch = line.match(/^(\d+)\.\s(.*)/);
      if (numMatch) {
        return (
          <ol key={idx} className="list-decimal pl-5 my-1 text-[#D4D4D8] space-y-1">
            <li className="text-xs md:text-sm">{renderInlineStyles(numMatch[2])}</li>
          </ol>
        );
      }
      if (!line.trim()) {
        return <div key={idx} className="h-2.5" />;
      }
      return <p key={idx} className="text-xs md:text-sm text-[#D4D4D8] leading-relaxed my-1">{renderInlineStyles(line)}</p>;
    });
  };

  const chips = [
    "Which supplier generated the highest profit?",
    "Show products with zero sales.",
    "Show inventory values exceeding 20 lakh",
  ];

  return (
    <div className="glass-card flex flex-col h-[700px] border border-[rgba(255,255,255,0.06)] bg-[rgba(15,15,20,0.85)] relative overflow-hidden rounded-2xl">
      {/* ChatGPT-Like Banner Header */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] bg-white/[0.02] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-900/40 border border-purple-500/20 text-[#6D28D9]">
            <Bot className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              Gemini OLAP Analyst <span className="text-[10px] bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full text-purple-300 font-normal">v1.2</span>
            </h3>
            <p className="text-[11px] text-[#A1A1AA]">Secure Natural Language to report engine</p>
          </div>
        </div>
      </div>

      {/* Main Conversation Logs */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex w-full ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`relative max-w-[85%] rounded-2xl px-5 py-4 transition-all duration-200 ${
                msg.sender === "user"
                  ? "bg-[#6D28D9] text-white shadow-lg shadow-purple-500/10 rounded-tr-none"
                  : "bg-white/[0.03] border border-[rgba(255,255,255,0.05)] text-[#F4F4F5] rounded-tl-none"
              }`}
            >
              {/* Message Header Info for Bot */}
              {msg.sender === "bot" && (
                <div className="flex items-center justify-between gap-4 mb-2 pb-2 border-b border-white/[0.04]">
                  <span className="text-[10px] font-bold tracking-wider text-purple-400 uppercase flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    AI Insights Report
                  </span>
                  {msg.report && (
                    <button
                      onClick={() => handleCopyText(msg.report || "", idx)}
                      className="p-1 rounded hover:bg-white/5 text-[#A1A1AA] hover:text-white transition-colors"
                      title="Copy Report"
                    >
                      {copiedIdx === idx ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Text content */}
              {!msg.report ? (
                <p className="text-xs md:text-sm leading-relaxed">{msg.text}</p>
              ) : (
                <div className="space-y-4">
                  {/* Generated word report rendered with markdown styling */}
                  <div className="markdown-report text-xs md:text-sm">
                    {renderMarkdown(msg.report)}
                  </div>

                  {/* Accordion: Data Results Table */}
                  {msg.tableData && msg.tableData.length > 0 && (
                    <div className="border border-white/[0.05] rounded-lg overflow-hidden bg-black/35">
                      <button
                        onClick={() => toggleTable(idx)}
                        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold text-[#A1A1AA] hover:text-white transition-colors bg-white/[0.02]"
                      >
                        <span className="flex items-center gap-1.5 uppercase tracking-wider">
                          <Download className="h-3.5 w-3.5 text-purple-400" />
                          Source Data Results ({msg.tableData.length} Rows)
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportCSV(msg.tableData!);
                            }}
                            className="text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-300 px-2 py-0.5 rounded hover:bg-purple-500/20 transition-colors"
                          >
                            Export CSV
                          </span>
                          {expandedTable[idx] ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </div>
                      </button>
                      {expandedTable[idx] && (
                        <div className="overflow-x-auto border-t border-white/[0.05] max-h-56">
                          <table className="w-full text-left text-[10px] font-mono border-collapse bg-[#09090B]">
                            <thead>
                              <tr className="border-b border-white/10 bg-white/5 sticky top-0">
                                {Object.keys(msg.tableData[0]).map((key) => (
                                  <th key={key} className="p-2 text-[#A1A1AA] font-semibold">{key}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {msg.tableData.map((row, rIdx) => (
                                <tr key={rIdx} className="border-b border-white/[0.03] hover:bg-white/5">
                                  {Object.values(row).map((val: any, cIdx) => (
                                    <td key={cIdx} className="p-2 text-white">
                                      {typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(val)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-3 text-xs text-[#A1A1AA] animate-pulse pl-2">
            <RefreshCw className="h-4 w-4 animate-spin text-[#6D28D9]" />
            <span>AI agent is compiling database results and generating report...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Chips */}
      <div className="px-6 py-3 bg-white/[0.01] border-t border-[rgba(255,255,255,0.06)] flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] text-purple-400 uppercase font-bold shrink-0 flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Suggested:
        </span>
        {chips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(chip)}
            disabled={loading}
            className="text-[10px] bg-white/[0.03] border border-[rgba(255,255,255,0.05)] text-[#A1A1AA] px-3.5 py-1.5 rounded-full hover:border-[#6D28D9] hover:text-white hover:bg-purple-950/20 transition-all duration-200 cursor-pointer shrink-0 disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="p-4 bg-white/[0.02] border-t border-[rgba(255,255,255,0.08)] flex gap-3 items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="Ask about inventory, supplier margins, sales stats, or stock velocity classes..."
          disabled={loading}
          className="flex-1 glass-input text-xs md:text-sm py-3 px-4 focus:ring-1 focus:ring-purple-500"
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          className="glass-btn flex items-center justify-center h-10 w-10 p-0 rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
