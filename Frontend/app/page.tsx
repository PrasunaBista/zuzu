"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Plus, Menu, User, Bot, Settings, MessageSquare, BarChart3, Sparkles, Crown, Zap, TrendingUp, Clock, Star } from "lucide-react";

/**
 * ZUZU Chat + Admin — bronze/gold theme
 * - First screen shows big logo + "Hi, I’m ZUZU — how can I help you?"
 * - No hardcoded analytics; expects your backend.
 * - Admin ↔ Chat navigation in sidebar and header.
 */

// ==== BACKEND INTEGRATION (replace with your real endpoints) ====
async function sendToZuzuBackend(message: string): Promise<string> {
  // Example REST call (uncomment & implement):
  // const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
  // const data = await res.json();
  // return data.reply;
  return "(connect /api/chat to return real answers)";
}

async function fetchAnalytics(timeframe: string): Promise<ZuzuAnalytics> {
  // Expected response shape from your backend:
  // {
  //   totalQuestions: number,
  //   questionCategories: Array<{ category: string; count: number }>,
  //   dailyQuestions: Array<{ date: string; questions: number }>
  // }
  // Example:
  // const res = await fetch(`/api/analytics?tf=${timeframe}`);
  // return await res.json();
  throw new Error("Backend not connected: implement /api/analytics");
}

// Types (optional but helpful)
interface ZuzuAnalytics {
  totalQuestions: number;
  questionCategories: { category: string; count: number }[];
  dailyQuestions: { date: string; questions: number }[];
}

// ======== CHAT UI ========
export default function ZuzuApp() {
  const [messages, setMessages] = useState<any[]>([]); // start empty
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [currentView, setCurrentView] = useState<"chat" | "admin">("chat");
  const [firstOpen, setFirstOpen] = useState(true); // controls hero screen
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    const userMessage = { id: Date.now(), type: "user", content: inputMessage, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);
    setFirstOpen(false);

    try {
      const reply = await sendToZuzuBackend(userMessage.content);
      const botMessage = { id: Date.now() + 1, type: "bot", content: reply, timestamp: new Date() };
      setMessages((prev) => [...prev, botMessage]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { id: Date.now() + 2, type: "bot", content: "Backend not connected yet. Wire /api/chat.", timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: any) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (currentView === "admin") return <AdminDashboard onBackToChat={() => setCurrentView("chat")} />;

  return (
    // <div className="flex h-screen bg-gradient-to-br from-slate-900 via-orange-950 to-amber-900 relative overflow-hidden">
    <div className="flex h-screen bg-gradient-to-br from-beige-100 via-beige-200 to-beige-300 relative overflow-hidden">
  


      {/* Animated Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-20 w-72 h-72 bg-orange-400 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-amber-500 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-orange-300 rounded-full blur-2xl animate-pulse delay-500" />
      </div>

      {/* Sidebar */}
      <div className="w-80 bg-amber-100 backdrop-blur-2xl border-r border-orange-400/20 flex flex-col relative z-10">
        <div className="h-20 px-6 border-b border-orange-400/20 flex items-center">
          <div className="flex items-center gap- -1">
            <img
              src="/zuzu.png" // or /zuzu-mark.png /zuzu-logo-transparent.svg
              alt="ZUZU"
              className="h-25 w-25 zuzu-glow select-none pointer-events-none"
            />
            <div className="leading-tight">
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
                ZUZU
              </h1>
              <p className="text-orange-300/80 text-xs md:text-sm font-medium">AI Assistant</p>
            </div>
          </div>
        </div>


        <div className="flex-1 p-6">
          <button className="w-full mb-6 p-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white rounded-2xl hover:shadow-2xl hover:shadow-orange-500/50 transition-all duration-500 flex items-center justify-center space-x-3 group transform hover:scale-105" onClick={() => { setMessages([]); setFirstOpen(true); }}>
            <div className="p-1 bg-white/20 rounded-lg"><Plus size={18} /></div>
            <span className="font-semibold">New Conversation</span>
            <Zap size={16} className="group-hover:animate-bounce" />
          </button>

          {/* Recent items could go here (from backend). Leaving empty state for now */}
          <div className="text-orange-300/60 text-sm">Recent chats will appear here.</div>
        </div>

        <div className="p-6 border-t border-orange-400/20 space-y-3">
          <button onClick={() => setCurrentView("admin")} className="w-full p-3 text-left text-orange-300 hover:bg-orange-900/30 rounded-xl flex items-center space-x-3 transition-all duration-300 hover:shadow-lg group">
            <div className="p-1 bg-orange-500/20 rounded-lg group-hover:bg-orange-500/30 transition-colors"><BarChart3 size={16} /></div>
            <span className="text-sm font-medium">Admin Dashboard</span>
            <TrendingUp size={14} className="ml-auto group-hover:animate-pulse" />
          </button>
          {/* <button className="w-full p-3 text-left text-orange-300 hover:bg-orange-900/30 rounded-xl flex items-center space-x-3 transition-all duration-300 hover:shadow-lg group">
            <div className="p-1 bg-orange-500/20 rounded-lg group-hover:bg-orange-500/30 transition-colors"><Settings size={16} /></div>
            <span className="text-sm font-medium">Preferences</span>
          </button> */}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative z-10">
        {/* Header (fixed height, no Admin button) */}
        <div className="h-20 bg-amber-100 backdrop-blur-2xl border-b border-orange-400/20">
          <div className="h-full mx-0 px-6 flex items-center">
            <div className="flex items-center gap-3 md:gap-4">
              {/* Use the SVG as a mask so it’s always visible on dark/amber */}
              <div
                className="zuzu-mark h-18 w-18 shrink-0"
                style={{
                  WebkitMaskImage: "url('/zuzu-logo.svg')",
                  maskImage: "url('/zuzu-logo.svg')",
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                }}
              />
              <div>
                <h2 className="text-lg md:text-xl font-bold text-orange-300/80">Here to help</h2>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-400 text-sm font-medium">Online</span>
                </div>
              </div>
            </div>
          </div>
        </div>





        {/* HERO first-open screen */}
        {firstOpen && messages.length === 0 && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="text-center p-6">
              <img
                src="/zuzu-logo.svg"
                alt="ZUZU Logo"
                className="h-56 md:h-72 mx-auto drop-shadow-[0_0_40px_rgba(251,191,36,0.35)]"
              />
              <h1 className="mt-5 text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-orange-300 to-amber-300 bg-clip-text text-transparent">Hi, How can I help you?</h1>
            
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-2xl px-6 py-4 rounded-3xl backdrop-blur-xl border shadow-2xl ${message.type === "user" ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white border-orange-400/30 shadow-orange-500/30" : "bg-black/30 border-orange-400/20 text-white shadow-black/50"}`}>
                <div className="flex items-start space-x-3">
                  {message.type === 'bot' && (
                    <div className="w-20 h-20 mt-1 flex-shrink-0 grid place-items-center">
                      <img
                        src="/zuzu.png"          // make sure this is in /public
                        alt=""
                        className="h-full w-full object-contain zuzu-glow"
                      />
                    </div>
                  )}
  
                  <div className="flex-1">
                    <p className="leading-relaxed font-medium">{message.content}</p>
                    <div className="flex items-center justify-between mt-3">
                      <p className={`text-xs ${message.type === "user" ? "text-orange-100" : "text-orange-300"}`}>{formatTime(message.timestamp)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-black/30 border border-orange-400/20 rounded-3xl px-6 py-4 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg"><Bot className="text-white" size={14} /></div>
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-gradient-to-r from-orange-400 to-amber-500 rounded-full animate-bounce" />
                    <div className="w-3 h-3 bg-gradient-to-r from-orange-400 to-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                    <div className="w-3 h-3 bg-gradient-to-r from-orange-400 to-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                  </div>
                  <span className="text-orange-300 text-sm">Thinking…</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className="bg-black/20 backdrop-blur-2xl border-t border-orange-400/20 p-6">
          <div className="flex items-end space-x-4">
            <div className="flex-1 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-amber-500/20 rounded-3xl blur-xl" />
              <textarea value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={handleKeyPress} placeholder="Ask Zuzu anything about your international education journey..." className="w-full px-6 py-4 bg-amber/100
               backdrop-blur-xl border border-orange-400/30 rounded-3xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none max-h-32 text-white placeholder-orange-300/60 font-medium relative z-10" rows={1} />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-300/60 text-sm"><Sparkles size={16} /></div>
            </div>
            <button onClick={handleSendMessage} disabled={!inputMessage.trim()} className="p-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white rounded-3xl hover:shadow-2xl hover:shadow-orange-500/50 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed group transform hover:scale-110">
              <Send size={20} className="group-hover:animate-pulse" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ======== ADMIN DASHBOARD ========
function AdminDashboard({ onBackToChat }: { onBackToChat: () => void }) {
  const [selectedTimeframe, setSelectedTimeframe] = useState("7d");
  const [data, setData] = useState<ZuzuAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await fetchAnalytics(selectedTimeframe);
        setData(d);
        setError(null);
      } catch (e: any) {
        setError(e.message || "Failed to load analytics");
        setData(null);
      }
    })();
  }, [selectedTimeframe]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-orange-950 to-amber-900 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-96 h-96 bg-orange-400 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-amber-500 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-orange-300 rounded-full blur-2xl animate-pulse delay-500" />
      </div>

      {/* Header */}
      <div className="bg-black/20 backdrop-blur-2xl border-b border-orange-400/20 p-8 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <button onClick={onBackToChat} className="p-3 hover:bg-orange-900/30 rounded-2xl transition-all duration-300 group">
              <MessageSquare className="text-orange-400 group-hover:text-orange-300" size={24} />
            </button>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">ZUZU Admin</h1>
              <p className="text-orange-300/80 text-lg">Intelligence Dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl border border-green-400/30">
              <span className="text-green-300 text-sm font-semibold">● LIVE</span>
            </div>
            <select value={selectedTimeframe} onChange={(e) => setSelectedTimeframe(e.target.value)} className="px-4 py-3 bg-black/30 backdrop-blur-xl border border-orange-400/30 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-white font-medium">
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
        </div>
      </div>

      <div className="p-8 relative z-10">
        {/* Stats Grid — ONLY total questions retained (others removed) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-10">
          <div className="bg-black/30 backdrop-blur-2xl p-6 rounded-3xl border border-orange-400/20 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                <MessageSquare className="text-white" size={20} />
              </div>
              <div className="text-orange-300 text-sm font-semibold">Total</div>
            </div>
            <div>
              <p className="text-white/70 text-sm font-medium mb-1">Total Questions</p>
              <p className="text-3xl font-bold text-white">{data ? data.totalQuestions.toLocaleString() : "—"}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-10">
          {/* Question Categories — fixed list of labels, dynamic counts */}
          <div className="xl:col-span-2 bg-black/30 backdrop-blur-2xl p-8 rounded-3xl border border-orange-400/20 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-white">Question Categories</h3>
              <div className="px-3 py-1 bg-gradient-to-r from-orange-500/20 to-amber-500/20 rounded-full border border-orange-400/30">
                <span className="text-orange-300 text-sm font-semibold">LIVE</span>
              </div>
            </div>
            {/* Desired categories */}
            {(() => {
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
              (data?.questionCategories || []).forEach((c) => counts.set(c.category, c.count));
              return (
                <div className="space-y-6">
                  {order.map((label) => {
                    const val = counts.get(label) || 0;
                    return (
                      <div key={label} className="group">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-white font-semibold">{label}</span>
                          <span className="text-orange-300 font-bold">{val.toLocaleString()}</span>
                        </div>
                        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-full transition-all duration-700 shadow-lg" style={{ width: `${data ? Math.min(100, (val / Math.max(1, Math.max(...(data.questionCategories.map((x)=>x.count)||[1])))) * 100) : 0}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            {!data && (
              <div className="mt-6 text-orange-300/70 text-sm">Connect /api/analytics to populate categories.</div>
            )}
          </div>

          {/* Live Activity placeholder (no prefill) */}
          <div className="bg-black/30 backdrop-blur-2xl p-8 rounded-3xl border border-orange-400/20 shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6">Live Activity</h3>
            <div className="text-orange-300/70 text-sm">Hook a websocket or polling endpoint to render recent events here.</div>
          </div>
        </div>

        {/* Weekly Performance (simple bars) — uses dailyQuestions */}
        <div className="bg-black/30 backdrop-blur-2xl p-8 rounded-3xl border border-orange-400/20 shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold text-white">Weekly Performance</h3>
          </div>
          {data ? (
            <div className="h-80 flex items-end justify-between space-x-3">
              {data.dailyQuestions.map((day, index) => (
                <div key={index} className="flex flex-col items-center flex-1 space-y-2">
                  <div className="w-full relative group">
                    <div className="w-full bg-gradient-to-t from-orange-500 to-amber-400 rounded-t-2xl transition-all duration-700" style={{ height: `${(day.questions / Math.max(...data.dailyQuestions.map((d) => d.questions))) * 250}px` }} />
                  </div>
                  <span className="text-white/60 text-sm font-medium">{day.date}</span>
                  <div className="text-center">
                    <div className="text-white font-bold text-sm">{day.questions}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-orange-300/70 text-sm">Connect /api/analytics to populate weekly performance.</div>
          )}

          {error && <div className="mt-6 text-rose-300 text-sm">{error}</div>}
        </div>
      </div>
    </div>
  );
}
