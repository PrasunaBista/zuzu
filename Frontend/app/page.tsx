"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Plus, Bot, MessageSquare, BarChart3, Sparkles, Zap, TrendingUp, Trash } from "lucide-react";

// ==== BACKEND INTEGRATION (replace with your real endpoints) ====
async function sendToZuzuBackend(message: string): Promise<string> {
  const res = await fetch("https://askzuzu.com/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const data = await res.json();
  return data.reply; // backend must return { reply: "..." }
}

async function fetchAnalytics(timeframe: string): Promise<ZuzuAnalytics> {
  const res = await fetch(`https://askzuzu.com/api/analytics?tf=${timeframe}`);
  return await res.json();
}

// Types
interface ZuzuAnalytics {
  totalQuestions: number;
  questionCategories: { category: string; count: number }[];
  dailyQuestions: { date: string; questions: number }[];
}

// ======== CHAT UI ========
export default function ZuzuApp() {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [currentView, setCurrentView] = useState<"chat" | "admin">("chat");
  const [firstOpen, setFirstOpen] = useState(true);
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
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 2, type: "bot", content: "Backend not connected yet. Wire /api/chat.", timestamp: new Date() },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: any) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (currentView === "admin") return <AdminDashboard onBackToChat={() => setCurrentView("chat")} />;

  return (
    <div className="flex h-screen bg-gradient-to-br from-beige-100 via-beige-200 to-beige-300 relative overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-amber-100 backdrop-blur-2xl border-r border-orange-400/20 flex flex-col relative z-10">
        <div className="h-20 px-6 border-b border-orange-400/20 flex items-center">
          <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">ZUZU</h1>
        </div>
        <div className="flex-1 p-6">
          <button
            className="w-full mb-6 p-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white rounded-2xl"
            onClick={() => { setMessages([]); setFirstOpen(true); }}
          >
            New Conversation
          </button>
          <div className="text-orange-300/60 text-sm">Recent chats will appear here.</div>
        </div>
        <div className="p-6 border-t border-orange-400/20 space-y-3">
          <button
            onClick={() => setCurrentView("admin")}
            className="w-full p-3 text-left text-orange-300 hover:bg-orange-900/30 rounded-xl flex items-center space-x-3"
          >
            <BarChart3 size={16} />
            <span className="text-sm font-medium">Admin Dashboard</span>
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative z-10">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`relative max-w-2xl px-6 py-4 rounded-3xl backdrop-blur-xl border shadow-2xl ${
                  message.type === "user"
                    ? "bg-gradient-to-r from-beige-200 to-beige-300 text-black border-orange-200 shadow-orange-200"
                    : "bg-black/30 border-orange-400/20 text-white shadow-black/50"
                }`}
              >
                {/* DELETE BUTTON */}
                <button
                  onClick={() => setMessages((prev) => prev.filter((m) => m.id !== message.id))}
                  className="absolute top-2 right-2 text-orange-300 hover:text-red-500 transition"
                >
                  <Trash size={16} />
                </button>

                <div className="flex items-start space-x-3">
                  {message.type === "bot" && (
                    <div className="w-12 h-12 mt-1 flex-shrink-0 grid place-items-center">
                      <img src="/zuzu.png" alt="" className="h-full w-full object-contain zuzu-glow" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="leading-relaxed font-medium">{message.content}</p>
                    <p className="text-xs text-orange-300 mt-2">{formatTime(message.timestamp)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {isTyping && <p className="text-orange-400">Zuzu is typing…</p>}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className="bg-black/20 backdrop-blur-2xl border-t border-orange-400/20 p-6">
          <div className="flex items-end space-x-4">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Zuzu anything..."
              className="w-full px-6 py-4 bg-amber/100 border rounded-3xl text-black"
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim()}
              className="p-4 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-3xl"
            >
              <Send size={20} />
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
    <div className="min-h-screen bg-gradient-to-br from-beige-100 via-beige-200 to-beige-300 relative overflow-hidden">
      <button onClick={onBackToChat}>← Back</button>
      <h1 className="text-2xl">ZUZU Admin Dashboard</h1>
      {error && <p className="text-red-400">{error}</p>}
      {data && <p>Total Questions: {data.totalQuestions}</p>}
    </div>
  );
}

