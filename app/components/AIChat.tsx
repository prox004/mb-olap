"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot, Send, Download, RefreshCw, Sparkles, Copy, Check,
  ChevronDown, ChevronUp, Trash2, Plus, MessageSquare,
  Clock, Database, MoreHorizontal, ChevronLeft, ChevronRight,
} from "lucide-react";

/* ─── Types ────────────────────────────────────────────────────── */
interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  report?: string;
  tableData?: Record<string, unknown>[];
  ts: number; // epoch ms
  isError?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

/* ─── Helpers ───────────────────────────────────────────────────── */
const uid = () => Math.random().toString(36).slice(2, 10);

const STORAGE_KEY = "olap_ai_conversations";

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function makeWelcomeMessage(): Message {
  return {
    id: uid(),
    sender: "bot",
    text: "Welcome! I'm your **AI Inventory Analyst** powered by Qwen 3.6 27B on Groq.\n\nAsk me anything about sales, supplier performance, product margins, stock velocity, or inventory health — and I'll compile a full executive report.",
    ts: Date.now(),
  };
}

const CHIPS = [
  "Which supplier generated the highest profit?",
  "Show products with zero sales.",
  "Top 5 products by gross margin",
  "Show slow-moving products with closing stock value",
];

/* ─── Markdown renderer ─────────────────────────────────────────── */
function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return <strong key={i} className="text-white font-semibold">{p.slice(2, -2)}</strong>;
        if (p.startsWith("`") && p.endsWith("`"))
          return <code key={i} className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-[11px] text-purple-300">{p.slice(1, -1)}</code>;
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </>
  );
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("### ")) {
      elements.push(<h4 key={i} className="text-sm font-bold text-white mt-4 mb-1.5"><InlineText text={line.slice(4)} /></h4>);
    } else if (line.startsWith("## ")) {
      elements.push(<h3 key={i} className="text-base font-bold text-white mt-5 mb-2"><InlineText text={line.slice(3)} /></h3>);
    } else if (line.startsWith("# ")) {
      elements.push(<h2 key={i} className="text-lg font-bold text-white mt-6 mb-3"><InlineText text={line.slice(2)} /></h2>);
    } else if (line.startsWith("* ") || line.startsWith("- ")) {
      elements.push(
        <li key={i} className="text-[13px] text-[#D4D4D8] leading-relaxed ml-4 list-disc">
          <InlineText text={line.slice(2)} />
        </li>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const m = line.match(/^(\d+)\.\s(.*)/);
      if (m) elements.push(
        <li key={i} className="text-[13px] text-[#D4D4D8] leading-relaxed ml-4 list-decimal">
          <InlineText text={m[2]} />
        </li>
      );
    } else if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="text-[13px] text-[#D4D4D8] leading-relaxed"><InlineText text={line} /></p>);
    }
    i++;
  }
  return <div className="space-y-0.5">{elements}</div>;
}

/* ─── Data table with export ────────────────────────────────────── */
function DataTable({ data, msgId, expanded, onToggle }: {
  data: Record<string, unknown>[];
  msgId: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const exportCSV = (e: React.MouseEvent) => {
    e.stopPropagation();
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const uri = encodeURI("data:text/csv;charset=utf-8," + [headers, ...rows].join("\n"));
    const a = document.createElement("a"); a.href = uri; a.download = `report-${msgId}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-black/30 mt-3">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-[#A1A1AA] hover:text-white transition-colors bg-white/[0.02] hover:bg-white/[0.04]">
        <span className="flex items-center gap-1.5">
          <Database className="h-3 w-3 text-purple-400" />
          Source Data · {data.length} rows
        </span>
        <div className="flex items-center gap-2">
          <span onClick={exportCSV} className="text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full hover:bg-purple-500/20 transition-colors">
            Export CSV
          </span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>
      {expanded && (
        <div className="overflow-x-auto border-t border-white/[0.05] max-h-56">
          <table className="w-full text-left text-[10px] font-mono border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04] sticky top-0">
                {Object.keys(data[0]).map((k) => <th key={k} className="px-3 py-2 text-[#A1A1AA] font-semibold whitespace-nowrap">{k}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.map((row, ri) => (
                <tr key={ri} className="border-b border-white/[0.03] hover:bg-white/[0.03]">
                  {Object.values(row).map((v: unknown, ci) => (
                    <td key={ci} className="px-3 py-1.5 text-white whitespace-nowrap">
                      {typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Message bubble ────────────────────────────────────────────── */
function MessageBubble({ msg, onCopy, copied, tableExpanded, onToggleTable }: {
  msg: Message;
  onCopy: () => void;
  copied: boolean;
  tableExpanded: boolean;
  onToggleTable: () => void;
}) {
  const isUser = msg.sender === "user";
  return (
    <div className={`flex gap-3 group ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="h-7 w-7 shrink-0 mt-1 rounded-lg bg-purple-900/40 border border-purple-500/20 flex items-center justify-center">
          <Bot className="h-3.5 w-3.5 text-purple-400" />
        </div>
      )}

      {/* Bubble */}
      <div className={`relative max-w-[82%] ${isUser ? "" : "w-full"}`}>
        <div className={`rounded-2xl px-4 py-3 transition-all duration-200 ${
          isUser
            ? "bg-[#6D28D9] text-white rounded-tr-sm shadow-lg shadow-purple-500/10"
            : msg.isError
            ? "bg-red-900/20 border border-red-500/20 text-red-300 rounded-tl-sm"
            : "bg-white/[0.04] border border-white/[0.06] text-[#F4F4F5] rounded-tl-sm"
        }`}>
          {isUser ? (
            <p className="text-sm leading-relaxed">{msg.text}</p>
          ) : (
            <div>
              {/* Bot header */}
              {msg.report && (
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.06]">
                  <span className="text-[10px] font-bold tracking-widest text-purple-400 uppercase flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" /> AI Insights Report
                  </span>
                  <button onClick={onCopy} title="Copy report" className="p-1 rounded hover:bg-white/10 text-[#A1A1AA] hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}
              {/* Content */}
              {msg.report ? (
                <>
                  <Markdown text={msg.report} />
                  {msg.tableData && msg.tableData.length > 0 && (
                    <DataTable data={msg.tableData} msgId={msg.id} expanded={tableExpanded} onToggle={onToggleTable} />
                  )}
                </>
              ) : (
                <Markdown text={msg.text} />
              )}
            </div>
          )}
        </div>
        {/* Timestamp */}
        <p className={`text-[10px] text-[#52525B] mt-1 ${isUser ? "text-right" : "text-left"}`}>
          {relativeTime(msg.ts)}
        </p>
      </div>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────── */
export default function AIChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestions, setActiveSuggestions] = useState<string[]>([]);
  const [suggestionIdx, setSuggestionIdx] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* Load from localStorage on mount + fetch server suggestions */
  useEffect(() => {
    const saved = loadConversations();
    if (saved.length > 0) {
      setConversations(saved);
      setActiveId(saved[0].id);
    } else {
      const first = newConversation(false);
      setConversations([first]);
      setActiveId(first.id);
    }
    // Seed suggestions from server cache
    fetch("http://127.0.0.1:8000/api/v1/ai/suggestions")
      .then((r) => r.json())
      .then((d) => setSuggestions(d.suggestions || []))
      .catch(() => {});
  }, []);

  /* Persist whenever conversations change */
  useEffect(() => {
    if (conversations.length > 0) saveConversations(conversations);
  }, [conversations]);

  /* Auto-scroll */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, loading]);

  /* Helpers */
  const activeConv = conversations.find((c) => c.id === activeId);

  function newConversation(update = true): Conversation {
    const conv: Conversation = {
      id: uid(),
      title: "New conversation",
      messages: [makeWelcomeMessage()],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (update) {
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
    }
    return conv;
  }

  function deleteConversation(id: string) {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (activeId === id && next.length > 0) setActiveId(next[0].id);
      if (next.length === 0) {
        const fresh = newConversation(false);
        setTimeout(() => { setConversations([fresh]); setActiveId(fresh.id); }, 0);
      }
      return next;
    });
  }

  function updateActiveMessages(msgs: Message[]) {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeId) return c;
        const title = msgs.find((m) => m.sender === "user")?.text.slice(0, 38) || c.title;
        return { ...c, messages: msgs, title: title === c.title ? c.title : title + (title.length >= 38 ? "…" : ""), updatedAt: Date.now() };
      })
    );
  }

  /* Send handler */
  const handleSend = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: Message = { id: uid(), sender: "user", text, ts: Date.now() };
    const currentMsgs = activeConv ? [...activeConv.messages, userMsg] : [userMsg];
    updateActiveMessages(currentMsgs);
    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      });

      if (res.ok) {
        const data = await res.json();
        const botMsg: Message = {
          id: uid(), sender: "bot", ts: Date.now(),
          text: "",
          report: data.report,
          tableData: data.results,
        };
        updateActiveMessages([...currentMsgs, botMsg]);
      } else {
        const err = await res.json().catch(() => ({}));
        const botMsg: Message = { id: uid(), sender: "bot", ts: Date.now(), text: err.detail || "Failed to execute query.", isError: true };
        updateActiveMessages([...currentMsgs, botMsg]);
      }
    } catch {
      const botMsg: Message = { id: uid(), sender: "bot", ts: Date.now(), text: "Cannot reach the OLAP backend. Make sure `python scripts/server.py` is running.", isError: true };
      updateActiveMessages([...currentMsgs, botMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, loading, activeConv, activeId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && activeSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestionIdx((i) => Math.min(i + 1, activeSuggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestionIdx((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && suggestionIdx >= 0)) {
        e.preventDefault();
        const chosen = activeSuggestions[suggestionIdx >= 0 ? suggestionIdx : 0];
        setInput(chosen);
        setShowSuggestions(false);
        setSuggestionIdx(-1);
        return;
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
        setSuggestionIdx(-1);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleCopy = (msg: Message) => {
    navigator.clipboard.writeText(msg.report || msg.text);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleTable = (id: string) => setExpandedTables((p) => ({ ...p, [id]: !p[id] }));

  /* Compute autocomplete suggestions as user types */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
    if (val.trim().length < 2) {
      setShowSuggestions(false);
      setActiveSuggestions([]);
      return;
    }
    // Merge server cache + localStorage past queries
    const localQueries = conversations
      .flatMap((c) => c.messages.filter((m) => m.sender === "user").map((m) => m.text))
      .filter((q, i, arr) => arr.indexOf(q) === i);
    const allSuggestions = Array.from(new Set([...localQueries, ...suggestions]));
    const lower = val.toLowerCase();
    const filtered = allSuggestions
      .filter((s) => s.toLowerCase().includes(lower))
      .slice(0, 8);
    setActiveSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
    setSuggestionIdx(-1);
  };

  /* Group convos by date */
  const groupedConvos = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const groups: { label: string; items: Conversation[] }[] = [
      { label: "Today", items: [] },
      { label: "Yesterday", items: [] },
      { label: "Earlier", items: [] },
    ];
    conversations.forEach((c) => {
      const d = new Date(c.updatedAt); d.setHours(0, 0, 0, 0);
      if (d >= today) groups[0].items.push(c);
      else if (d >= yesterday) groups[1].items.push(c);
      else groups[2].items.push(c);
    });
    return groups.filter((g) => g.items.length > 0);
  })();

  return (
    <div className="flex h-[780px] rounded-2xl overflow-hidden border border-white/[0.06] bg-[rgba(10,10,14,0.92)] shadow-2xl shadow-black/50">

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className={`flex flex-col border-r border-white/[0.06] bg-[rgba(12,12,18,0.96)] transition-all duration-300 ease-in-out ${sidebarOpen ? "w-64" : "w-0 overflow-hidden"}`}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-3 border-b border-white/[0.06]">
          <span className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-widest">History</span>
          <button
            onClick={() => newConversation()}
            title="New conversation"
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-[#A1A1AA] hover:text-white transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto py-2 space-y-4 px-2">
          {groupedConvos.map((group) => (
            <div key={group.label}>
              <p className="text-[9px] font-bold text-[#52525B] uppercase tracking-widest px-2 mb-1">{group.label}</p>
              {group.items.map((conv) => (
                <div
                  key={conv.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveId(conv.id)}
                  onKeyDown={(e) => e.key === "Enter" && setActiveId(conv.id)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 group/item flex items-start gap-2 transition-all duration-150 cursor-pointer ${
                    conv.id === activeId
                      ? "bg-purple-900/30 border border-purple-500/20 text-white"
                      : "hover:bg-white/[0.04] text-[#A1A1AA] hover:text-white border border-transparent"
                  }`}
                >
                  <MessageSquare className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${conv.id === activeId ? "text-purple-400" : "text-[#52525B]"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] truncate font-medium leading-snug">{conv.title}</p>
                    <p className="text-[10px] text-[#52525B] mt-0.5 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />{relativeTime(conv.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                    className="opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10 text-[#52525B] hover:text-red-400 shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-white/[0.06]">
          <button
            onClick={() => {
              if (confirm("Clear all conversation history?")) {
                const fresh = newConversation(false);
                setConversations([fresh]);
                setActiveId(fresh.id);
              }
            }}
            className="w-full flex items-center gap-2 text-[11px] text-[#52525B] hover:text-red-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/[0.03]"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear all history
          </button>
        </div>
      </aside>

      {/* ── Main chat area ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.01] shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-[#A1A1AA] hover:text-white transition-colors"
              title={sidebarOpen ? "Hide history" : "Show history"}
            >
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <div className="h-8 w-8 rounded-xl bg-purple-900/40 border border-purple-500/20 flex items-center justify-center">
              <Bot className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-white tracking-wide flex items-center gap-2">
                Qwen OLAP Analyst
                <span className="text-[9px] bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full text-purple-300 font-normal">qwen/qwen3.6-27b</span>
              </h3>
              <p className="text-[10px] text-[#52525B]">Natural language · Read-only · Retail OLAP</p>
            </div>
          </div>
          <button
            onClick={() => newConversation()}
            className="flex items-center gap-1.5 text-[11px] text-[#A1A1AA] hover:text-white border border-white/[0.06] hover:border-white/20 px-3 py-1.5 rounded-lg transition-all hover:bg-white/[0.04]"
          >
            <Plus className="h-3.5 w-3.5" /> New chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
          {activeConv?.messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              onCopy={() => handleCopy(msg)}
              copied={copiedId === msg.id}
              tableExpanded={!!expandedTables[msg.id]}
              onToggleTable={() => toggleTable(msg.id)}
            />
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-3">
              <div className="h-7 w-7 shrink-0 mt-1 rounded-lg bg-purple-900/40 border border-purple-500/20 flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 text-purple-400" />
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-3">
                <RefreshCw className="h-4 w-4 animate-spin text-purple-400" />
                <span className="text-[12px] text-[#A1A1AA]">Querying database and generating report…</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested chips — only show when last message is from bot and no loading */}
        {!loading && activeConv && activeConv.messages[activeConv.messages.length - 1]?.sender === "bot" && activeConv.messages.length < 4 && (
          <div className="px-5 pb-2 flex flex-wrap gap-2">
            {CHIPS.map((chip, i) => (
              <button
                key={i}
                onClick={() => handleSend(chip)}
                className="text-[11px] bg-white/[0.03] border border-white/[0.06] text-[#A1A1AA] px-3 py-1.5 rounded-full hover:border-purple-500/40 hover:text-white hover:bg-purple-950/20 transition-all duration-200"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="px-5 pb-5 pt-3 border-t border-white/[0.06] bg-white/[0.01] shrink-0">
          {/* Autocomplete dropdown */}
          {showSuggestions && activeSuggestions.length > 0 && (
            <div className="mb-2 rounded-xl border border-white/[0.08] bg-[#0f0f16] shadow-xl overflow-hidden">
              {activeSuggestions.map((s, i) => (
                <div
                  key={i}
                  role="option"
                  aria-selected={i === suggestionIdx}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setInput(s);
                    setShowSuggestions(false);
                    setSuggestionIdx(-1);
                    inputRef.current?.focus();
                  }}
                  className={`px-4 py-2.5 text-[12px] cursor-pointer flex items-center gap-2 transition-colors ${
                    i === suggestionIdx
                      ? "bg-purple-900/40 text-white"
                      : "text-[#A1A1AA] hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <Clock className="h-3 w-3 text-purple-400 shrink-0" />
                  <span className="truncate">{s}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-3 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 focus-within:border-purple-500/40 transition-colors">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => input.trim().length >= 2 && activeSuggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Ask about sales, suppliers, margins, stock velocity…  (Enter to send, Shift+Enter for newline)"
              disabled={loading}
              className="flex-1 bg-transparent resize-none text-[13px] text-white placeholder-[#52525B] outline-none leading-relaxed max-h-[120px] disabled:opacity-50"
              style={{ height: "24px" }}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="h-8 w-8 flex items-center justify-center rounded-xl bg-[#6D28D9] hover:bg-[#7C3AED] text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-[#3F3F46] text-center mt-2">Read-only queries only · Powered by Qwen 3.6 27B on Groq · DuckDB OLAP</p>
        </div>
      </div>
    </div>
  );
}
