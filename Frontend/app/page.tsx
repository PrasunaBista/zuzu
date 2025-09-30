"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Send,
  Plus,
  BarChart3,
  TrendingUp,
  Trash,
  MessageSquare,
  Bot,
  Sparkles,
  Zap,
} from "lucide-react";

// ---- Types ----
type Role = "user" | "bot";

interface Message {
  id: string;
  role: Role;
  content: string;
  ts: number; // epoch ms
}

interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
}

interface ZuzuAnalytics {
  totalQuestions: number;
  questionCategories: { category: string; count: number }[];
  dailyQuestions: { date: string; questions: number }[];
}

// ---- Config ----
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

// ---- Helpers ----
const uid = () => Math.random().toString(36).slice(2);
const timeHHMM = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const BEIGE = {
  bg: "bg-[#F7F2E7]",
  bg2: "bg-[#F3EAD9]",
  panel: "bg-[#FFF7E8]",
  border: "border-[#EAC999]/50",
  accentFrom: "from-[#D49A3A]",
  accentTo: "to-[#E8B560]",
  text1: "text-[#5A4525]",
  text2: "text-[#8C6B3D]",
  white: "text-white",
};

async function chatToBackend(message: string): Promise<string> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`Chat API ${res.status}`);
  const data = (await res.json()) as { reply: string };
  return data.reply;
}

async function loadAnalytics(tf: string): Promise<ZuzuAnalytics> {
  const res = await fetch(`${API_BASE}/analytics?tf=${encodeURIComponent(tf)}`);
  if (!res.ok) throw new Error(`Analytics ${res.status}`);
  return (await res.json()) as ZuzuAnalytics;
}

// ================= MAIN =================
export default function ZuzuApp() {
  const [view, setView] = useState<"chat" | "admin">("chat");

  // conversations + selection
  const [convos, setConvos] = useState<Conversation[]>(() => {
    // optional: hydrate from localStorage
    try {
      const raw = localStorage.getItem("zuzu_convos");
      if (raw) return JSON.parse(raw) as Conversation[];
    } catch {}
    return [];
  });
  const [activeId, setActiveId] = useState<string | null>(convos[0]?.id ?? null);
  const activeConvo = useMemo(
    () => convos.find((c) => c.id === activeId) ?? null,
    [convos, activeId]
  );

  // compose
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvo?.messages, isTyping]);

  useEffect(() => {
    try {
      localStorage.setItem("zuzu_convos", JSON.stringify(convos));
    } catch {}
  }, [convos]);

  // Create a new empty conversation
  const createConvo = () => {
    const id = uid();
    const newC: Conversation = {
      id,
      title: "New Conversation",
      createdAt: Date.now(),
      messages: [],
    };
    setConvos((prev) => [newC, ...prev]);
    setActiveId(id);
  };

  // Delete conversation from sidebar
  const deleteConvo = (id: string) => {
    setConvos((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      const next = convos.find((c) => c.id !== id);
      setActiveId(next?.id ?? null);
    }
  };

  const ensureActive = () => {
    if (!activeId) createConvo();
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    ensureActive();

    const convId = activeId ?? convos[0]?.id;
    if (!convId) return;

    const newUserMsg: Message = {
      id: uid(),
      role: "user",
      content: text,
      ts: Date.now(),
    };

    // If the convo is empty, update its title to the first message snippet
    setConvos((prev) =>
      prev.map((c) =>
        c.id === convId
          ? {
              ...c,
              title:
                c.messages.length === 0
                  ? (text.length > 40 ? text.slice(0, 40) + "…" : text)
                  : c.title,
              messages: [...c.messages, newUserMsg],
            }
          : c
      )
    );
    setInput("");
    setIsTyping(true);

    try {
      const reply = await chatToBackend(text);
      const botMsg: Message = {
        id: uid(),
        role: "bot",
        content: reply,
        ts: Date.now(),
      };
      setConvos((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, messages: [...c.messages, botMsg] } : c
        )
      );
    } catch {
      const errMsg: Message = {
        id: uid(),
        role: "bot",
        content:
          "I couldn’t reach the backend. Make sure Nginx proxies /api/* to FastAPI on :8000, or set NEXT_PUBLIC_API_BASE.",
        ts: Date.now(),
      };
      setConvos((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, messages: [...c.messages, errMsg] } : c
        )
      );
    } finally {
      setIsTyping(false);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  // Admin view
  if (view === "admin") {
    return (
      <AdminDashboard
        onBack={() => setView("chat")}
      />
    );
  }

  return (
    <div
      className={`flex h-screen relative overflow-hidden ${BEIGE.bg} bg-gradient-to-br from-[#F7F2E7] via-[#F3EAD9] to-[#F9EDD2]`}
    >
      {/* Ambient blobs */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 rounded-full blur-3xl bg-gradient-to-br from-[#E7B157] to-[#FFD48A] animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full blur-3xl bg-gradient-to-br from-[#F0C36A] to-[#FFDFA6] animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full blur-2xl bg-gradient-to-br from-[#E3A545] to-[#FFC96D] animate-pulse delay-500" />
      </div>

      {/* Sidebar */}
      <aside
        className={`w-80 ${BEIGE.panel} backdrop-blur-2xl border-r ${BEIGE.border} flex flex-col relative z-10`}
      >
        <div className="h-20 px-6 border-b ${BEIGE.border} flex items-center">
          <div className="flex items-center gap-3">
            <Image
              src="/zuzu.png"
              alt="ZUZU"
              width={48}
              height={48}
              className="select-none pointer-events-none drop-shadow-[0_0_12px_rgba(232,181,96,0.45)]"
              priority
              unoptimized
            />
            <div className="leading-tight">
              <h1 className={`text-2xl font-bold bg-gradient-to-r ${BEIGE.accentFrom} ${BEIGE.accentTo} bg-clip-text text-transparent`}>
                ZUZU
              </h1>
              <p className="text-[#B4883A] text-xs font-medium">AI Assistant</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-auto">
          <button
            onClick={createConvo}
            className={`w-full p-4 bg-gradient-to-r ${BEIGE.accentFrom} via-[#E8B560] ${BEIGE.accentTo} text-white rounded-2xl hover:shadow-2xl hover:shadow-[#E8B560]/40 transition-all duration-300 flex items-center justify-center space-x-3 group`}
          >
            <div className="p-1 bg-white/20 rounded-lg">
              <Plus size={18} />
            </div>
            <span className="font-semibold">New Conversation</span>
            <Zap size={16} className="group-hover:animate-bounce" />
          </button>

          {/* Conversations list with DELETE on the SIDEBAR */}
          {convos.length === 0 ? (
            <div className="text-[#B4883A]/70 text-sm">Recent chats will appear here.</div>
          ) : (
            <div className="space-y-2">
              {convos.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <div
                    key={c.id}
                    className={`group flex items-center gap-2 rounded-xl border ${BEIGE.border} px-3 py-2 cursor-pointer transition ${
                      isActive ? "bg-white/60" : "hover:bg-white/40"
                    }`}
                    onClick={() => setActiveId(c.id)}
                  >
                    <MessageSquare size={18} className={BEIGE.text2} />
                    <div className="flex-1 min-w-0">
                      <div className={`truncate text-sm font-medium ${BEIGE.text1}`}>{c.title}</div>
                      <div className="text-xs text-[#A9884A]">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    {/* DELETE BUTTON for history item */}
                    <button
                      className="opacity-70 hover:opacity-100 p-2 rounded-lg hover:bg-white/60 transition"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConvo(c.id);
                      }}
                      aria-label="Delete conversation"
                      title="Delete conversation"
                    >
                      <Trash size={16} className="text-[#A2711F]" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-[#EAC999]/50 space-y-3">
          <button
            onClick={() => setView("admin")}
            className="w-full p-3 text-left rounded-xl flex items-center gap-3 transition hover:bg-white/50"
          >
            <div className="p-1 bg-[#E8B560]/30 rounded-lg">
              <BarChart3 size={16} className={BEIGE.text1} />
            </div>
            <span className={`text-sm font-medium ${BEIGE.text1}`}>Admin Dashboard</span>
            <TrendingUp size={14} className="ml-auto text-[#C5933C]" />
          </button>
        </div>
      </aside>

      {/* Main Chat */}
      <main className="flex-1 flex flex-col relative z-10">
        {/* Header */}
        <div className={`h-20 ${BEIGE.panel} backdrop-blur-2xl border-b ${BEIGE.border}`}>
          <div className="h-full px-6 flex items-center">
            <div className="flex items-center gap-3">
              <div
                className="h-7 w-7"
                style={{
                  WebkitMaskImage: "url('/zuzu-logo.svg')",
                  maskImage: "url('/zuzu-logo.svg')",
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                  background:
                    "linear-gradient(90deg, #D49A3A, #E8B560)",
                }}
              />
              <div>
                <h2 className={`text-lg font-bold ${BEIGE.text2}`}>Here to help</h2>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-600 text-sm font-medium">Online</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hero (no messages) */}
        {!activeConvo || activeConvo.messages.length === 0 ? (
          <div className="flex-1 grid place-items-center pointer-events-none">
            <div className="text-center p-6">
              <Image
                src="/zuzu-logo.svg"
                alt="ZUZU Logo"
                width={280}
                height={280}
                className="mx-auto"
                priority
                unoptimized
              />
              <h1 className="mt-5 text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-[#D49A3A] to-[#E8B560] bg-clip-text text-transparent">
                Hi, How can I help you?
              </h1>
            </div>
          </div>
        ) : null}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeConvo?.messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`relative max-w-2xl px-6 py-4 rounded-3xl border shadow ${
                    isUser
                      ? `bg-gradient-to-r ${BEIGE.accentFrom} ${BEIGE.accentTo} ${BEIGE.white} ${BEIGE.border} shadow-[#E8B560]/30`
                      : `${BEIGE.panel} ${BEIGE.text1} ${BEIGE.border} shadow-[#E8B560]/20`
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!isUser && (
                      <div className="w-10 h-10 mt-1 flex-shrink-0 grid place-items-center rounded-xl bg-white/70">
                        <Bot size={18} className="text-[#C2872F]" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="leading-relaxed font-medium">{m.content}</p>
                      <div className="mt-3 text-xs text-[#9E7C42]">
                        {timeHHMM(m.ts)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex justify-start">
              <div
                className={`px-6 py-4 rounded-3xl border ${BEIGE.border} ${BEIGE.panel} shadow`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-2xl grid place-items-center bg-gradient-to-br from-[#D49A3A] to-[#E8B560] shadow">
                    <Bot size={14} className="text-white" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-[#D49A3A] to-[#E8B560] animate-bounce" />
                    <div
                      className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-[#D49A3A] to-[#E8B560] animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-[#D49A3A] to-[#E8B560] animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                  <span className="text-[#B4883A] text-sm">Thinking…</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className={`p-6 border-t ${BEIGE.border} ${BEIGE.panel} backdrop-blur-2xl`}>
          <div className="flex items-end gap-4">
            <div className="flex-1 relative">
              <div className="absolute inset-0 rounded-3xl blur-xl bg-gradient-to-r from-[#D49A3A]/15 to-[#E8B560]/15" />
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask ZUZU anything about your international education journey..."
                className={`w-full px-6 py-4 rounded-3xl border ${BEIGE.border} focus:outline-none focus:ring-2 focus:ring-[#E8B560] resize-none max-h-32 relative z-10 ${BEIGE.bg} ${BEIGE.text1} placeholder-[#B4883A]/70 font-medium`}
                rows={1}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#C5933C]">
                <Sparkles size={18} />
              </div>
            </div>
            <button
              onClick={() => void sendMessage()}
              disabled={!input.trim()}
              className={`p-4 rounded-3xl text-white bg-gradient-to-r ${BEIGE.accentFrom} ${BEIGE.accentTo} transition hover:shadow-xl hover:shadow-[#E8B560]/40 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ================= ADMIN =================
function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [tf, setTf] = useState<"24h" | "7d" | "30d" | "90d">("7d");
  const [data, setData] = useState<ZuzuAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const d = await loadAnalytics(tf);
        if (!ok) return;
        setData(d);
        setError(null);
      } catch {
        if (!ok) return;
        setError("Failed to load analytics. Is /api/analytics proxied to the backend?");
        setData(null);
      }
    })();
    return () => {
      ok = false;
    };
  }, [tf]);

  return (
    <div className={`min-h-screen relative overflow-hidden ${BEIGE.bg} bg-gradient-to-br from-[#F7F2E7] via-[#F3EAD9] to-[#F9EDD2]`}>
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-10 left-10 w-96 h-96 rounded-full blur-3xl bg-gradient-to-br from-[#E7B157] to-[#FFD48A] animate-pulse" />
        <div className="absolute bottom-10 right-10 w-80 h-80 rounded-full blur-3xl bg-gradient-to-br from-[#F0C36A] to-[#FFDFA6] animate-pulse delay-1000" />
        <div className="absolute top-1/3 right-1/3 w-64 h-64 rounded-full blur-2xl bg-gradient-to-br from-[#E3A545] to-[#FFC96D] animate-pulse delay-500" />
      </div>

      <header className={`p-6 border-b ${BEIGE.border} ${BEIGE.panel} backdrop-blur-2xl relative z-10`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-3 rounded-2xl hover:bg-white/60 transition"
              title="Back to chat"
            >
              <MessageSquare className="text-[#B4883A]" size={22} />
            </button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-[#D49A3A] via-[#E8B560] to-[#D49A3A] bg-clip-text text-transparent">
                ZUZU Admin
              </h1>
              <p className="text-[#B4883A]">Intelligence Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="px-4 py-2 rounded-2xl border border-green-400/30 bg-green-100/40">
              <span className="text-green-700 text-sm font-semibold">● LIVE</span>
            </div>
            <select
              value={tf}
              onChange={(e) => setTf(e.target.value as typeof tf)}
              className="px-4 py-2 rounded-2xl border border-[#EAC999]/60 bg-white/70 text-[#5A4525] font-medium focus:outline-none focus:ring-2 focus:ring-[#E8B560]"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
        </div>
      </header>

      <div className="p-8 relative z-10">
        {/* Total Questions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className={`p-6 rounded-3xl border ${BEIGE.border} ${BEIGE.panel} shadow`}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl grid place-items-center bg-gradient-to-r from-[#6DB0FF] to-[#59D4E0] text-white shadow">
                <MessageSquare size={20} />
              </div>
              <div className="text-[#B4883A] text-sm font-semibold">Total</div>
            </div>
            <div>
              <p className="text-[#7A6239] text-sm font-medium mb-1">Total Questions</p>
              <p className="text-3xl font-bold text-[#5A4525]">
                {data ? data.totalQuestions.toLocaleString() : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-10">
          {/* Categories */}
          <div className={`xl:col-span-2 p-8 rounded-3xl border ${BEIGE.border} ${BEIGE.panel} shadow`}>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-[#5A4525]">Question Categories</h3>
              <div className="px-3 py-1 rounded-full border border-[#EAC999]/60 bg-white/60">
                <span className="text-[#B4883A] text-sm font-semibold">LIVE</span>
              </div>
            </div>
            {data ? (
              <CategoriesView data={data} />
            ) : (
              <div className="text-[#A9884A] text-sm">
                Connect /api/analytics to populate categories.
              </div>
            )}
          </div>

          {/* Live activity placeholder */}
          <div className={`p-8 rounded-3xl border ${BEIGE.border} ${BEIGE.panel} shadow`}>
            <h3 className="text-2xl font-bold text-[#5A4525] mb-6">Live Activity</h3>
            <div className="text-[#A9884A] text-sm">
              Hook a websocket or polling endpoint to render recent events here.
            </div>
          </div>
        </div>

        {/* Weekly */}
        <div className={`p-8 rounded-3xl border ${BEIGE.border} ${BEIGE.panel} shadow`}>
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold text-[#5A4525]">Weekly Performance</h3>
          </div>
          {data ? (
            <div className="h-80 flex items-end justify-between gap-3">
              {data.dailyQuestions.map((d, i) => {
                const max = Math.max(...data.dailyQuestions.map((x) => x.questions), 1);
                const height = (d.questions / max) * 250;
                return (
                  <div key={i} className="flex flex-col items-center flex-1 gap-2">
                    <div className="w-full">
                      <div
                        className="w-full rounded-t-2xl bg-gradient-to-t from-[#D49A3A] to-[#E8B560] transition-all"
                        style={{ height }}
                      />
                    </div>
                    <span className="text-[#7A6239] text-sm font-medium">{d.date}</span>
                    <div className="text-center text-[#5A4525] font-bold text-sm">
                      {d.questions}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-[#A9884A] text-sm">
              Connect /api/analytics to populate weekly performance.
            </div>
          )}
          {error && <div className="mt-6 text-rose-600 text-sm">{error}</div>}
        </div>
      </div>
    </div>
  );
}

function CategoriesView({ data }: { data: ZuzuAnalytics }) {
  const order = [
    "Housing",
    "Admissions",
    "Travel",
    "Forms and Documentations",
    "Visa and Immigrations",
    "Phone and Communication",
    "Other Inquiries",
  ];
  const counts = new Map<string, number>();
  (data.questionCategories || []).forEach((c) => counts.set(c.category, c.count));
  const max = Math.max(...order.map((k) => counts.get(k) ?? 0), 1);

  return (
    <div className="space-y-6">
      {order.map((label) => {
        const val = counts.get(label) ?? 0;
        const pct = Math.min(100, (val / max) * 100);
        return (
          <div key={label} className="group">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[#5A4525] font-semibold">{label}</span>
              <span className="text-[#B4883A] font-bold">{val.toLocaleString()}</span>
            </div>
            <div className="h-3 bg-[#EEDFC0] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#D49A3A] via-[#E8B560] to-[#D49A3A] rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
