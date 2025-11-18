// "use client";
// /* eslint-disable @next/next/no-img-element */

// import React, {
//   useEffect,
//   useRef,
//   useState,
//   useMemo,
//   KeyboardEvent,
// } from "react";

// import Image from "next/image";
// import {
//   Send,
//   Plus,
//   Trash,
//   ChevronLeft,
//   ChevronRight,
//   BarChart3,
//   User,
//   ArrowLeft,
//   Lock,
//   Sparkles,
//   PieChart as PieChartIcon,
// } from "lucide-react";
// import { createPortal } from "react-dom";
// import ReactMarkdown from "react-markdown";
// import remarkGfm from "remark-gfm";
// import rehypeSanitize from "rehype-sanitize";
// import {
//   PieChart as RePieChart,
//   Pie,
//   Cell,
//   ResponsiveContainer,
// } from "recharts";

// // ============================================================
// //                     BACKEND CATEGORIES
// // ============================================================

// export const ZUZU_CATEGORIES: string[] = [
//   "Housing",
//   "Admissions",
//   "Visa and Immigration",
//   "Travel and Arrival",
//   "Forms and Documentation",
//   "Money and Banking",
//   "Campus Life and Academics",
//   "Health and Safety",
//   "Phone and Connectivity",
//   "Work and Career",
//   "Community and Daily Life",
//   "Other Inquiries",
// ];

// export const ZUZU_SUBCATEGORIES: Record<string, string[]> = {
//   Housing: [
//     "Apply / Eligibility",
//     "Housing options overview",
//     "Residence halls",
//     "Apartments",
//     "Rates & contracts",
//     "Move-in & move-out",
//     "Roommates",
//     "Break housing & guest housing",
//     "Parent guide / safety",
//     "Services & support (living features)",
//   ],
//   Admissions: [
//     "Application and deadlines",
//     "Test scores and GPA",
//     "Transcripts and academic records",
//     "Offer letter and deposits",
//     "Deferral or change of term",
//   ],
//   "Visa and Immigration": [
//     "I-20 / DS-2019 questions",
//     "SEVIS fee and SEVIS record",
//     "Visa interview preparation",
//     "At the port of entry",
//     "Maintaining status",
//     "CPT, OPT, and STEM-OPT",
//     "Travel and re-entry",
//   ],
//   "Travel and Arrival": [
//     "Booking flights and timing",
//     "Airport pickup and directions to campus",
//     "Temporary housing / hotels",
//     "What to pack",
//     "Arriving early or late",
//   ],
//   "Forms and Documentation": [
//     "Immunization and health forms",
//     "Financial forms and proof of funding",
//     "Housing application forms",
//     "Enrollment and registration forms",
//     "Other university forms",
//   ],
//   "Money and Banking": [
//     "Paying tuition and fees",
//     "Opening a bank account",
//     "Budget and cost of living",
//     "Scholarships and assistantships",
//     "Refunds and payment plans",
//   ],
//   "Campus Life and Academics": [
//     "Class registration and add/drop",
//     "Choosing majors and advisors",
//     "Tutoring and academic support",
//     "Using campus resources",
//     "Academic policies",
//   ],
//   "Health and Safety": [
//     "Health insurance requirements",
//     "On-campus clinic and medical care",
//     "Mental health support",
//     "Campus safety and emergency contacts",
//   ],
//   "Phone and Connectivity": [
//     "SIM cards and phone plans",
//     "Wi-Fi and internet on campus",
//     "University accounts, passwords, and MFA",
//   ],
//   "Work and Career": [
//     "On-campus jobs",
//     "Internships and co-ops",
//     "Career center and resume help",
//     "Social Security Number for work",
//   ],
//   "Community and Daily Life": [
//     "Groceries, shopping, and food options",
//     "Weather and clothing",
//     "Transportation (bus, parking, ride-share)",
//     "Student clubs and making friends",
//   ],
//   "Other Inquiries": ["Anything else"],
// };

// // Detailed third-level items for Housing only
// const HOUSING_THIRD_LEVEL: Record<string, string[]> = {
//   "Apply / Eligibility": [
//     "How to apply (WINGS → Student → Housing)",
//     "Who can live where (first-year, transfer, grad, international)",
//     "Prepayment & refund basics",
//     "Registration needed to move in",
//     "Under-18 co-signature requirements",
//     "Dining plan rule for halls",
//     "Wright Path student info",
//     "When you'll see your assignment",
//     "Contact Housing (hours, phone, email)",
//   ],
//   "Housing options overview": [
//     "Compare halls vs. apartments",
//     "See floor plans and virtual tours",
//     "Furnished vs. unfurnished notes",
//     "What's included (utilities, Wi-Fi, etc.)",
//     "Theme / interest / gender-inclusive options",
//   ],
//   "Residence halls": [
//     "Hamilton Hall (rooms, location)",
//     "Honors Community (eligibility, setup)",
//     "The Woods (9 halls, suite style, amenities)",
//     "Meal plan required in halls",
//     "Hall staffing & support (RAs, community team)",
//   ],
//   Apartments: [
//     "College Park (layouts, furnished, kitchen/laundry)",
//     "Forest Lane (studio/2-BR options, vibe)",
//     "University Park (4-BR layout, eligibility)",
//     "The Village (independence, longer commitment)",
//     "Dining plan optional in apartments",
//   ],
//   "Rates & contracts": [
//     "Current rates by hall/apartment",
//     "What the rate includes",
//     "$50 prepayment & refund window",
//     "Typical contract length",
//     "Where to view past years' rates",
//   ],
//   "Move-in & move-out": [
//     "Move-in assignment and check-in details",
//     "What to do before you arrive",
//     "What to bring / what NOT to bring",
//     "If you're delayed or no-show",
//     "Move-out deadlines, fees, key return",
//   ],
//   Roommates: [
//     "Request a roommate (name + UID)",
//     "Sign up with roommate PIN",
//     "Tips for matching & communicating",
//     "Room renewal & selection",
//   ],
//   "Services & support (living features)": [
//     "Academic help (PALs, Scholar-in-Residence)",
//     "ADA accommodations (ESA/service animal info)",
//     "Dining plans & locations (Grubhub)",
//     "Internet/TV/Phone setup",
//     "Maintenance & billing",
//     "Mail & packages (pickup, addressing, forwarding)",
//   ],
// };

// // ============================================================
// //                         TYPES
// // ============================================================

// type Role = "user" | "bot";

// type MessageKind = "text" | "categories" | "subcategories" | "thirdlevel";

// interface Message {
//   id: string;
//   role: Role;
//   content: string;
//   ts: number;
//   // UI kind for special bot messages with buttons
//   kind?: MessageKind;
//   category?: string;
//   subcategory?: string;
//   // Optional: populated only for bot messages that used vector DB
//   sources?: { id: number; title: string; url: string; score: number }[];
// }

// interface Conversation {
//   id: string;
//   title: string;
//   createdAt: number;
//   messages: Message[];
// }

// // ============================================================
// //                      API BASE URL
// // ============================================================

// const API_BASE = "http://localhost:8000/api";

// // ============================================================
// //                          THEME
// // ============================================================

// const THEME = {
//   appBg: "bg-[#FFEFD9]",
//   sidebarBg: "bg-[#FDE3C5]",
//   sidebarBorder: "border-[#F3C58C]",
//   bubbleBotBg: "bg-white",
//   bubbleUserBg: "bg-[#FDE6C8]",
//   bubbleBorder: "border-[#F3C58C]",
//   textMain: "text-[#5C3B1F]",
//   textSub: "text-[#A06A32]",
//   brand: "text-[#F7931E]",
//   brandBg: "bg-[#FF8A00]",
//   brandBgHover: "hover:bg-[#FF9E1E]",
// };

// // ============================================================
// //                       DEVICE ID
// // ============================================================

// const DEVICE_KEY = "zuzu_device_id";

// function getDeviceId(): string {
//   if (typeof window === "undefined") return "server";

//   let id = localStorage.getItem(DEVICE_KEY);
//   if (!id) {
//     id = crypto.randomUUID();
//     localStorage.setItem(DEVICE_KEY, id);
//   }
//   return id;
// }

// const DEVICE_ID =
//   typeof window !== "undefined" ? getDeviceId() : "server";

// // ============================================================
// //                        HELPERS
// // ============================================================

// const uid = () => Math.random().toString(36).slice(2);

// const timeHHMM = (ms: number) =>
//   new Date(ms).toLocaleTimeString([], {
//     hour: "2-digit",
//     minute: "2-digit",
//   });

// function timeAgo(ts: number): string {
//   const diff = Date.now() - ts;
//   const d = diff / (1000 * 60 * 60 * 24);
//   const h = diff / (1000 * 60 * 60);
//   const m = diff / (1000 * 60);

//   if (d >= 1) return `${Math.floor(d)}d ago`;
//   if (h >= 1) return `${Math.floor(h)}h ago`;
//   if (m >= 1) return `${Math.floor(m)}m ago`;
//   return "just now";
// }

// function parseStudentType(answer: string) {
//   const t = answer.toLowerCase();

//   const grad = /\bgrad(uate)?\b/.test(t);
//   const undergrad = /\bundergrad(uate)?\b/.test(t);

//   const international = /\b(international|intl|int'l)\b/.test(t);
//   const domestic = /\b(domestic|national|dom)\b/.test(t);

//   const level = grad ? "graduate" : undergrad ? "undergraduate" : null;
//   const origin = international ? "international" : domestic ? "domestic" : null;

//   return { level, origin, valid: !!(level && origin) };
// }

// // Split label into title + subtitle for detailed buttons
// function splitLabel(label: string): { title: string; subtitle?: string } {
//   // Try parentheses first: "How to apply (WINGS → Student → Housing)"
//   const parenIndex = label.indexOf("(");
//   if (parenIndex > 0 && label.endsWith(")")) {
//     const title = label.slice(0, parenIndex).trim();
//     const subtitle = label.slice(parenIndex + 1, label.length - 1).trim();
//     return { title, subtitle };
//   }

//   // Try dash
//   const dashIndex = label.indexOf(" - ");
//   if (dashIndex > 0) {
//     const title = label.slice(0, dashIndex).trim();
//     const subtitle = label.slice(dashIndex + 3).trim();
//     return { title, subtitle };
//   }

//   return { title: label };
// }

// // ============================================================
// //               INITIAL BOT MESSAGE
// // ============================================================

// const INITIAL_BOT_MESSAGE = `
// Hi! I'm **ZUZU** 👋 your onboarding guide for Wright State University 😊  

// Are you a **graduate or undergraduate** student, and are you **international** or **domestic/national**?
// `.trim();

// // ============================================================
// //              BACKEND MESSAGE SENDER
// // ============================================================

// async function sendToBackend(
//   chatId: string,
//   text: string
// ): Promise<{ reply: string; sources: any[] }> {
//   const res = await fetch(`${API_BASE}/chat`, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       "X-Device-Id": DEVICE_ID,
//     },
//     body: JSON.stringify({ chat_id: chatId, message: text }),
//   });

//   if (!res.ok) {
//     const t = await res.text();
//     console.error("Backend error:", res.status, t);
//     throw new Error(`Backend error: ${res.status}`);
//   }

//   const data = await res.json();
//   return {
//     reply: data.reply,
//     sources: data.sources || [],
//   };
// }

// // ============================================================
// //                   MAIN COMPONENT START
// // ============================================================

// export default function ZuzuApp() {
//   const [view, setView] = useState<"chat" | "admin">("chat");

//   // Sidebar
//   const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

//   // Conversations
//   const [convos, setConvos] = useState<Conversation[]>([]);
//   const [activeId, setActiveId] = useState<string | null>(null);

//   const activeConvo = useMemo(
//     () => convos.find((c) => c.id === activeId) ?? null,
//     [convos, activeId]
//   );

//   // Intro flow only
//   const [introState, setIntroState] = useState<
//     "waiting_first" | "waiting_retry" | "done"
//   >("waiting_first");

//   const [input, setInput] = useState("");
//   const [isTyping, setIsTyping] = useState(false);

//   const bottomRef = useRef<HTMLDivElement | null>(null);
//   const bootRef = useRef(false);

//   // admin access
//   const [adminKey, setAdminKey] = useState<string | null>(null);

//   // ============================================================
//   //                   AUTO SCROLL ON MESSAGE
//   // ============================================================

//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [activeConvo?.messages, isTyping]);

//   // ============================================================
//   //                     LOAD LOCAL STORAGE
//   // ============================================================

//   useEffect(() => {
//     if (bootRef.current) return;
//     bootRef.current = true;

//     if (typeof window === "undefined") return;

//     try {
//       const stored = localStorage.getItem("zuzu_convos");
//       if (stored) {
//         const parsed = JSON.parse(stored) as Conversation[];
//         if (parsed.length > 0) {
//           setConvos(parsed);
//           setActiveId(parsed[0].id);
//           return;
//         }
//       }
//     } catch {
//       // ignore
//     }

//     // otherwise: create new conversation
//     createNewConversation(true);
//   }, []);

//   // ============================================================
//   //                     SAVE LOCAL STORAGE
//   // ============================================================

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     localStorage.setItem("zuzu_convos", JSON.stringify(convos));
//   }, [convos]);

//   // ==================================================================
//   //            NEW CONVERSATION — ONE EMPTY RULE
//   // ==================================================================

//   function isConversationEmpty(c: Conversation) {
//     if (!c.messages) return true;
//     if (c.messages.length === 1 && c.messages[0].role === "bot") return true;
//     return false;
//   }

//   function createNewConversation(isInitial = false) {
//     if (!isInitial) {
//       const empty = convos.find(isConversationEmpty);
//       if (empty) {
//         setActiveId(empty.id);
//         setIntroState("waiting_first");
//         return;
//       }
//     }

//     const id = crypto.randomUUID();

//     const firstMsg: Message = {
//       id: uid(),
//       role: "bot",
//       content: INITIAL_BOT_MESSAGE,
//       ts: Date.now(),
//       kind: "text",
//     };

//     const convo: Conversation = {
//       id,
//       title: "New Conversation",
//       createdAt: Date.now(),
//       messages: [firstMsg],
//     };

//     setConvos((x) => [convo, ...x]);
//     setActiveId(id);
//     setIntroState("waiting_first");
//   }

//   // ============================================================
//   //                     DELETE CONVERSATION
//   // ============================================================

//   function deleteConvo(id: string) {
//     setConvos((x) => x.filter((c) => c.id !== id));

//     if (activeId === id) {
//       const next = convos.find((c) => c.id !== id);
//       setActiveId(next?.id ?? null);
//     }
//   }

//   // ============================================================
//   //                     UPDATE AUTO TITLE
//   // ============================================================

//   function updateConversationTitle(convoId: string, content: string) {
//     const words = content.split(/\s+/);
//     const title = words.slice(0, 6).join(" ").slice(0, 40);

//     setConvos((prev) =>
//       prev.map((c) =>
//         c.id === convoId ? { ...c, title: title || "Conversation" } : c
//       )
//     );
//   }

//   // ============================================================
//   //                     CORE HELPERS
//   // ============================================================

//   function appendMessages(convoId: string, newMessages: Message[]) {
//     setConvos((prev) =>
//       prev.map((c) =>
//         c.id === convoId ? { ...c, messages: [...c.messages, ...newMessages] } : c
//       )
//     );
//   }

//   async function sendMessageWithText(text: string) {
//     if (!activeConvo) return;

//     const hasUserMessages =
//       activeConvo.messages.filter((m) => m.role === "user").length > 0;
//     if (!hasUserMessages) {
//       updateConversationTitle(activeConvo.id, text);
//     }

//     const newUser: Message = {
//       id: uid(),
//       role: "user",
//       content: text,
//       ts: Date.now(),
//       kind: "text",
//     };

//     appendMessages(activeConvo.id, [newUser]);

//     setIsTyping(true);
//     let reply = "";
//     let sources: Message["sources"] = [];
//     try {
//       const res = await sendToBackend(activeConvo.id, text);
//       reply = res.reply;
//       sources = res.sources;
//     } catch (e: any) {
//       reply = "Sorry — backend error.";
//       sources = [];
//     }
//     setIsTyping(false);

//     const botMsg: Message = {
//       id: uid(),
//       role: "bot",
//       content: reply,
//       ts: Date.now(),
//       kind: "text",
//       sources,
//     };

//     appendMessages(activeConvo.id, [botMsg]);
//   }

//   function sendMessage() {
//     const t = input.trim();
//     if (!t || !activeConvo) return;

//     if (introState !== "done") {
//       setInput("");
//       void handleIntroAnswer(t);
//       return;
//     }

//     setInput("");
//     void sendMessageWithText(t);
//   }

//   // ============================================================
//   //                  INTRO ANSWER HANDLER
//   // ============================================================

//   async function handleIntroAnswer(text: string) {
//     if (!activeConvo) return;

//     // User answer message
//     const userMsg: Message = {
//       id: uid(),
//       role: "user",
//       content: text,
//       ts: Date.now(),
//       kind: "text",
//     };

//     appendMessages(activeConvo.id, [userMsg]);

//     const parsed = parseStudentType(text);

//     // FIRST INVALID → one retry only
//     if (!parsed.valid && introState === "waiting_first") {
//       const retryBot: Message = {
//         id: uid(),
//         role: "bot",
//         content:
//           "I didn’t quite understand.\n\n" +
//           "Are you a **graduate** or **undergraduate** student,\n" +
//           "and are you **international** or **domestic/national**?",
//         ts: Date.now(),
//         kind: "text",
//       };

//       appendMessages(activeConvo.id, [retryBot]);
//       setIntroState("waiting_retry");
//       return;
//     }

//     // After second answer (valid or not) → move on and NEVER ask again
//     const { level, origin } = parsed;
//     const profileSummary = parsed.valid
//       ? `Student profile: ${level} student, ${origin}.`
//       : "Student profile: not clearly specified.";

//     setIntroState("done");

//     // Acknowledge user + show main categories as a bot message with buttons
//     const friendlyText = parsed.valid
//       ? `Great! I've noted that you're a **${origin} ${level}** student.\n\nHere are the main areas I can help with:`
//       : `Got it! I'll still do my best to help.\n\nHere are the main areas I can help with:`;

//     const categoriesMsg: Message = {
//       id: uid(),
//       role: "bot",
//       content: friendlyText,
//       ts: Date.now(),
//       kind: "categories",
//     };

//     appendMessages(activeConvo.id, [categoriesMsg]);

//     // Silently send summary to backend so LLM has context
//     try {
//       await sendToBackend(activeConvo.id, profileSummary);
//     } catch (err) {
//       console.error("Failed to send profile summary to backend", err);
//     }
//   }

//   // ============================================================
//   //          BUTTON CLICK HANDLERS (PERSISTENT IN CHAT)
//   // ============================================================

//   function handleCategoryClick(category: string) {
//     if (!activeConvo) return;

//     const userMsg: Message = {
//       id: uid(),
//       role: "user",
//       content: category,
//       ts: Date.now(),
//       kind: "text",
//     };

//     const botMsg: Message = {
//       id: uid(),
//       role: "bot",
//       ts: Date.now(),
//       kind: "subcategories",
//       category,
//       content: `Great, let's look at **${category}**. Here are the main sections I can walk you through:`,
//     };

//     appendMessages(activeConvo.id, [userMsg, botMsg]);
//   }

//   function handleSubcategoryClick(sub: string, category: string) {
//     if (!activeConvo) return;

//     // Housing → go one more level with persistent buttons
//     if (
//       category === "Housing" &&
//       HOUSING_THIRD_LEVEL[sub] &&
//       HOUSING_THIRD_LEVEL[sub].length > 0
//     ) {
//       const userMsg: Message = {
//         id: uid(),
//         role: "user",
//         content: sub,
//         ts: Date.now(),
//         kind: "text",
//       };

//       const botMsg: Message = {
//         id: uid(),
//         role: "bot",
//         ts: Date.now(),
//         kind: "thirdlevel",
//         category,
//         subcategory: sub,
//         content: `Here are detailed topics under **${sub}**:`,
//       };

//       appendMessages(activeConvo.id, [userMsg, botMsg]);
//       return;
//     }

//     // Non-housing subcategories: treat as immediate query context to backend
//     const ctx = `I need help with ${category} → ${sub}.`;
//     void sendMessageWithText(ctx);
//   }

//   function handleThirdLevelClick(item: string, category: string, sub: string) {
//     const ctx = `Category selection: ${category} | Subcategory: ${sub} | Detail: ${item}`;
//     void sendMessageWithText(ctx);
//   }

//   function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
//     if (e.key === "Enter" && !e.shiftKey) {
//       e.preventDefault();
//       sendMessage();
//     }
//   }

//   // ============================================================
//   //          ADMIN STATE + MODAL + DASHBOARD RENDER
//   // ============================================================

//   if (view === "admin") {
//     if (!adminKey) {
//       return (
//         <AdminModal
//           open={true}
//           onClose={() => {
//             setView("chat");
//           }}
//           onSuccess={(validCode) => {
//             setAdminKey(validCode);
//           }}
//         />
//       );
//     }

//     return (
//       <AdminDashboard
//         adminKey={adminKey}
//         onBack={() => {
//           setView("chat");
//         }}
//       />
//     );
//   }

//   // ============================================================
//   //                           UI
//   // ============================================================

//   return (
//     <div
//       className={`flex h-screen ${THEME.appBg}`}
//       style={{
//         fontFamily:
//           'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Segoe UI, sans-serif',
//       }}
//     >
//       {/* ============================================================
//                       SIDEBAR
//       ============================================================ */}
//       <aside
//         className={`${sidebarCollapsed ? "w-16" : "w-80"} ${
//           THEME.sidebarBg
//         } border-r ${THEME.sidebarBorder} flex flex-col transition-all duration-300`}
//       >
//         {/* Header */}
//         <div className="h-20 px-4 flex items-center justify-between">
//           {!sidebarCollapsed ? (
//             <div>
//               <h1 className={`text-2xl font-extrabold ${THEME.brand}`}>ZUZU</h1>
//               <p className={`text-xs ${THEME.textSub}`}>Onboarding assistant</p>
//             </div>
//           ) : (
//             <h1 className={`text-xl font-extrabold ${THEME.brand}`}>Z</h1>
//           )}

//           <button
//             onClick={() => setSidebarCollapsed((v) => !v)}
//             className="rounded-full border border-[#F3C58C] bg-[#FFEFD9] p-1.5 hover:bg-white transition"
//           >
//             {sidebarCollapsed ? (
//               <ChevronRight size={16} className={THEME.textSub} />
//             ) : (
//               <ChevronLeft size={16} className={THEME.textSub} />
//             )}
//           </button>
//         </div>

//         {/* New conversation */}
//         <div className="px-3">
//           <button
//             onClick={() => createNewConversation(false)}
//             className={`w-full flex items-center justify-center gap-2 rounded-full ${THEME.brandBg} ${THEME.brandBgHover} text-white py-2.5 text-sm font-semibold`}
//           >
//             <Plus size={16} />
//             {!sidebarCollapsed && "New Conversation"}
//           </button>
//         </div>

//         {/* Conversation List */}
//         {!sidebarCollapsed && (
//           <div className="p-3 space-y-1 flex-1 overflow-auto">
//             {convos.map((c) => {
//               const active = c.id === activeId;
//               return (
//                 <div
//                   key={c.id}
//                   onClick={() => setActiveId(c.id)}
//                   className={`group flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer ${
//                     active
//                       ? "bg-[#FF8A00] text-white"
//                       : "hover:bg-[#FFE5C9] text-[#5C3B1F]"
//                   }`}
//                 >
//                   <div className="flex-1 min-w-0">
//                     <div className="truncate text-sm font-medium">
//                       {c.title}
//                     </div>
//                     <div className="text-[11px] opacity-80">
//                       {timeAgo(c.createdAt)}
//                     </div>
//                   </div>

//                   <button
//                     className={`p-1 rounded-full hover:bg-black/5 ${
//                       active ? "text-white" : THEME.textSub
//                     } opacity-0 group-hover:opacity-100`}
//                     onClick={(e) => {
//                       e.stopPropagation();
//                       deleteConvo(c.id);
//                     }}
//                   >
//                     <Trash size={14} />
//                   </button>
//                 </div>
//               );
//             })}
//           </div>
//         )}

//         {/* Admin Dashboard Button */}
//         <div className="p-3 border-t border-[#F3C58C]">
//           <button
//             onClick={() => setView("admin")}
//             className="w-full flex items-center justify-center gap-2 rounded-full border border-[#F3C58C] bg-[#FFEFD9] py-2.5 text-xs hover:bg-white"
//           >
//             <BarChart3 size={16} className={THEME.textSub} />
//             {!sidebarCollapsed && "Admin Dashboard"}
//           </button>
//         </div>
//       </aside>

//       {/* ============================================================
//                           MAIN CHAT AREA
//       ============================================================ */}
//       <main className="flex-1 flex flex-col">
//         <div className="flex-1 overflow-y-auto px-10 py-8 space-y-6">
//           {/* ============================================================
//                         RENDER ALL MESSAGES
//           ============================================================ */}
//           {activeConvo?.messages.map((m) => {
//             const isUser = m.role === "user";

//             // USER BUBBLES (simple)
//             if (isUser) {
//               return (
//                 <div
//                   key={m.id}
//                   className="flex justify-end gap-3"
//                 >
//                   <div
//                     className={`max-w-2xl rounded-3xl border ${THEME.bubbleBorder} px-6 py-4 shadow ${THEME.bubbleUserBg}`}
//                   >
//                     <div className="flex flex-col gap-2">
//                       <p className={THEME.textMain}>{m.content}</p>
//                       <span
//                         className={`text-[11px] ${THEME.textSub} self-end`}
//                       >
//                         {timeHHMM(m.ts)}
//                       </span>
//                     </div>
//                   </div>
//                   <div className="flex items-start pt-4">
//                     <div className="w-9 h-9 rounded-full border border-[#F3C58C] bg-[#FFEFD9] grid place-items-center">
//                       <User size={18} className={THEME.textSub} />
//                     </div>
//                   </div>
//                 </div>
//               );
//             }

//             // BOT BUBBLES (text / categories / subcategories / thirdlevel)
//             return (
//               <div
//                 key={m.id}
//                 className="flex justify-start gap-3"
//               >
//                 {/* BOT avatar */}
//                 <div className="flex items-start pt-1">
//                   <Image
//                     src="/zuzu.png"
//                     width={32}
//                     height={32}
//                     alt="ZUZU"
//                   />
//                 </div>

//                 <div
//                   className={`max-w-2xl rounded-3xl border ${THEME.bubbleBorder} px-6 py-4 shadow ${THEME.bubbleBotBg}`}
//                 >
//                   <div className="flex flex-col gap-2">
//                     {/* KIND: categories (main category buttons) */}
//                     {m.kind === "categories" && (
//                       <>
//                         <div
//                           className={`prose max-w-none text-sm ${THEME.textMain}`}
//                         >
//                           <ReactMarkdown
//                             remarkPlugins={[remarkGfm]}
//                             rehypePlugins={[rehypeSanitize]}
//                           >
//                             {m.content}
//                           </ReactMarkdown>
//                         </div>

//                         <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
//                           {ZUZU_CATEGORIES.map((cat) => (
//                             <button
//                               key={cat}
//                               onClick={() => handleCategoryClick(cat)}
//                               className={`
//                                 block w-full px-5 py-4 mb-0 text-center
//                                 bg-[#FFF8F0]
//                                 rounded-lg
//                                 text-[#D68910]
//                                 text-sm font-bold uppercase tracking-[0.05em]
//                                 shadow-sm
//                                 transition-all duration-200
//                                 hover:bg-[#FFE8CC] hover:shadow-md
//                               `}
//                             >
//                               {cat}
//                             </button>
//                           ))}
//                         </div>
//                       </>
//                     )}

//                     {/* KIND: subcategories (detailed buttons) */}
//                     {m.kind === "subcategories" && m.category && (
//                       <>
//                         <div
//                           className={`prose max-w-none text-sm ${THEME.textMain}`}
//                         >
//                           <ReactMarkdown
//                             remarkPlugins={[remarkGfm]}
//                             rehypePlugins={[rehypeSanitize]}
//                           >
//                             {m.content}
//                           </ReactMarkdown>
//                         </div>

//                         <div className="mt-3">
//                           {ZUZU_SUBCATEGORIES[m.category]?.map((sub) => {
//                             const { title, subtitle } = splitLabel(sub);
//                             return (
//                               <button
//                                 key={sub}
//                                 onClick={() =>
//                                   handleSubcategoryClick(sub, m.category!)
//                                 }
//                                 className={`
//                                   w-full text-left mb-3
//                                   bg-white
//                                   border-2 border-[#FF8C42]
//                                   rounded-lg
//                                   px-5 py-4
//                                   shadow
//                                   cursor-pointer
//                                   transition-all duration-200
//                                   hover:border-[#FF7A28]
//                                   hover:shadow-lg
//                                   hover:-translate-y-[1px]
//                                   active:translate-y-0
//                                   active:shadow-sm
//                                 `}
//                               >
//                                 <div className="text-[#FF8C42] text-sm font-semibold mb-1">
//                                   {title}
//                                 </div>
//                                 {subtitle && (
//                                   <div className="text-[#666666] text-xs">
//                                     {subtitle}
//                                   </div>
//                                 )}
//                               </button>
//                             );
//                           })}
//                         </div>
//                       </>
//                     )}

//                     {/* KIND: thirdlevel (housing details) */}
//                     {m.kind === "thirdlevel" &&
//                       m.category === "Housing" &&
//                       m.subcategory && (
//                         <>
//                           <div
//                             className={`prose max-w-none text-sm ${THEME.textMain}`}
//                           >
//                             <ReactMarkdown
//                               remarkPlugins={[remarkGfm]}
//                               rehypePlugins={[rehypeSanitize]}
//                             >
//                               {m.content}
//                             </ReactMarkdown>
//                           </div>

//                           <div className="mt-3">
//                             {HOUSING_THIRD_LEVEL[m.subcategory]?.map(
//                               (item) => {
//                                 const { title, subtitle } = splitLabel(item);
//                                 return (
//                                   <button
//                                     key={item}
//                                     onClick={() =>
//                                       handleThirdLevelClick(
//                                         item,
//                                         m.category!,
//                                         m.subcategory!
//                                       )
//                                     }
//                                     className={`
//                                       w-full text-left mb-3
//                                       bg-white
//                                       border-2 border-[#FF8C42]
//                                       rounded-lg
//                                       px-5 py-4
//                                       shadow
//                                       cursor-pointer
//                                       transition-all duration-200
//                                       hover:border-[#FF7A28]
//                                       hover:shadow-lg
//                                       hover:-translate-y-[1px]
//                                       active:translate-y-0
//                                       active:shadow-sm
//                                     `}
//                                   >
//                                     <div className="text-[#FF8C42] text-sm font-semibold mb-1">
//                                       {title}
//                                     </div>
//                                     {subtitle && (
//                                       <div className="text-[#666666] text-xs">
//                                         {subtitle}
//                                       </div>
//                                     )}
//                                   </button>
//                                 );
//                               }
//                             )}
//                           </div>
//                         </>
//                       )}

//                     {/* KIND: plain text (normal LLM answers) */}
//                     {(m.kind === "text" || !m.kind) && (
//                       <div
//                         className={`prose max-w-none ${THEME.textMain}`}
//                       >
//                         <ReactMarkdown
//                           remarkPlugins={[remarkGfm]}
//                           rehypePlugins={[rehypeSanitize]}
//                         >
//                           {m.content}
//                         </ReactMarkdown>

//                         {m.sources && m.sources.length > 0 && (
//                           <div className="mt-2 text-xs text-gray-400">
//                             <div className="font-semibold">
//                               Sources (vector DB):
//                             </div>
//                             <ul className="list-disc list-inside">
//                               {m.sources.map((s) => (
//                                 <li key={s.id}>
//                                   <a
//                                     href={s.url}
//                                     target="_blank"
//                                     rel="noreferrer"
//                                     className="underline"
//                                   >
//                                     {s.title || s.url}
//                                   </a>{" "}
//                                   ({s.score.toFixed(2)})
//                                 </li>
//                               ))}
//                             </ul>
//                           </div>
//                         )}
//                       </div>
//                     )}

//                     <span className={`text-[11px] ${THEME.textSub} self-end`}>
//                       {timeHHMM(m.ts)}
//                     </span>
//                   </div>
//                 </div>
//               </div>
//             );
//           })}

//           <div ref={bottomRef} />
//         </div>

//         {/* ============================================================
//                         MESSAGE COMPOSER
//         ============================================================ */}
//         <div
//           className={`px-8 py-4 border-t ${THEME.sidebarBorder} bg-[#FBDDBD]`}
//         >
//           <div className="flex items-center gap-4">
//             <div className="w-10 h-10 rounded-full bg-[#FFEFD9] border border-[#F3C58C] flex items-center justify-center">
//               <User size={18} className={THEME.textSub} />
//             </div>

//             <div className="flex-1">
//               <textarea
//                 value={input}
//                 onChange={(e) => setInput(e.target.value)}
//                 onKeyDown={handleKey}
//                 placeholder="Ask ZUZU anything…"
//                 rows={1}
//                 className={`
//                   w-full resize-none rounded-full border ${THEME.sidebarBorder}
//                   bg-white px-6 py-3 text-sm ${THEME.textMain}
//                   placeholder-[#C38A4A] focus:outline-none focus:ring-2
//                   focus:ring-[#FF9E1E]
//                 `}
//               />
//             </div>

//             <button
//               onClick={sendMessage}
//               disabled={!input.trim()}
//               className={`
//                 h-11 w-11 rounded-full ${THEME.brandBg} ${THEME.brandBgHover}
//                 text-white flex items-center justify-center shadow
//                 disabled:opacity-40 disabled:cursor-not-allowed
//               `}
//             >
//               <Send size={18} />
//             </button>
//           </div>
//         </div>
//       </main>
//     </div>
//   );
// }

// /* ============================================================
//    ADMIN PORTAL (ACCESS MODAL + DASHBOARD)
//    ============================================================ */

// async function verifyAdminToken(token: string): Promise<boolean> {
//   const controller = new AbortController();
//   const timeoutId = setTimeout(() => controller.abort(), 8000);

//   try {
//     const res = await fetch(`${API_BASE}/admin/verify`, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "X-Device-Id": DEVICE_ID,
//       },
//       body: JSON.stringify({ token }),
//       signal: controller.signal,
//     });

//     if (!res.ok) {
//       throw new Error(`Admin verify failed: ${res.status} ${res.statusText}`);
//     }

//     const data = await res.json();
//     return data.valid === true;
//   } finally {
//     clearTimeout(timeoutId);
//   }
// }

// function AdminModal({
//   open,
//   onClose,
//   onSuccess,
// }: {
//   open: boolean;
//   onClose: () => void;
//   onSuccess: (token: string) => void;
// }) {
//   const [code, setCode] = useState("");
//   const [checking, setChecking] = useState(false);
//   const [error, setError] = useState("");

//   if (!open) return null;

//   return createPortal(
//     <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999]">
//       <div className="w-[95%] max-w-sm rounded-2xl bg-white border border-[#F3C58C] shadow-xl p-6 text-center">
//         <Lock size={40} className="mx-auto text-[#A06A32] mb-3" />
//         <h2 className="text-xl font-bold text-[#5C3B1F]">
//           Admin Access Required
//         </h2>
//         <p className="text-sm text-[#A06A32] mt-2 mb-4">
//           Enter your admin access code to continue.
//         </p>

//         <input
//           value={code}
//           onChange={(e) => setCode(e.target.value)}
//           placeholder="Enter access code"
//           className="w-full border border-[#F3C58C] rounded-xl px-4 py-2 text-sm focus:outline-none
//                      focus:ring-2 focus:ring-[#FF8A00]"
//         />

//         {error && <p className="text-red-600 text-xs mt-2">{error}</p>}

//         <button
//           disabled={!code.trim() || checking}
//           onClick={async () => {
//             setChecking(true);
//             setError("");
//             try {
//               const ok = await verifyAdminToken(code.trim());
//               if (!ok) {
//                 setError("Invalid access code");
//                 return;
//               }
//               onSuccess(code.trim());
//             } catch {
//               setError("Unable to verify admin code. Please try again.");
//             } finally {
//               setChecking(false);
//             }
//           }}
//           className="mt-4 w-full rounded-full bg-[#FF8A00] hover:bg-[#FF9E1E] text-white py-2
//                      font-semibold shadow disabled:opacity-40"
//         >
//           {checking ? "Checking…" : "Enter Dashboard"}
//         </button>

//         <button
//           onClick={onClose}
//           className="mt-3 text-xs text-[#A06A32] underline"
//         >
//           Cancel
//         </button>
//       </div>
//     </div>,
//     document.body
//   );
// }

// /* ------------------------------------------------------------
//    FETCH DASHBOARD DATA FROM BACKEND
// ------------------------------------------------------------ */
// async function fetchDashboard(adminKey: string) {
//   const res = await fetch(`${API_BASE}/analytics`, {
//     headers: {
//       "X-Admin-Key": adminKey,
//       "X-Device-Id": DEVICE_ID,
//     },
//   });
//   if (!res.ok) {
//     throw new Error(`Analytics fetch failed: ${res.status} ${res.statusText}`);
//   }
//   return await res.json();
// }

// /* ------------------------------------------------------------
//    SIMPLE BAR ROW
// ------------------------------------------------------------ */
// function BarRow({
//   label,
//   value,
//   max,
//   color,
// }: {
//   label: string;
//   value: number;
//   max: number;
//   color?: string;
// }) {
//   const pct = max ? (value / max) * 100 : 0;
//   return (
//     <div>
//       <div className="flex justify-between text-xs">
//         <span>{label}</span>
//         <span>{value.toFixed(0)}</span>
//       </div>
//       <div className="h-2 bg-[#F3D4AA] rounded-full overflow-hidden mt-1">
//         <div
//           className="h-full"
//           style={{
//             width: `${pct}%`,
//             backgroundColor: color || "#FF8A00",
//           }}
//         />
//       </div>
//     </div>
//   );
// }

// /* ------------------------------------------------------------
//    MAIN ADMIN DASHBOARD
// ------------------------------------------------------------ */
// export function AdminDashboard({
//   adminKey,
//   onBack,
// }: {
//   adminKey: string;
//   onBack: () => void;
// }) {
//   const [loading, setLoading] = useState(true);
//   const [d, setD] = useState<any | null>(null);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     (async () => {
//       try {
//         const json = await fetchDashboard(adminKey);
//         setD(json);
//       } catch (err: any) {
//         console.error("Failed to load analytics", err);
//         setError("Failed to load analytics from server.");
//       } finally {
//         setLoading(false);
//       }
//     })();
//   }, [adminKey]);

//   if (loading) {
//     return (
//       <div
//         className={`absolute inset-0 ${THEME.appBg} flex items-center justify-center`}
//       >
//         <div className="rounded-2xl border border-[#F3C58C] bg-[#FFF6EA] px-6 py-4 shadow">
//           <p className={`${THEME.textMain} text-sm`}>Loading analytics…</p>
//         </div>
//       </div>
//     );
//   }

//   if (error || !d) {
//     return (
//       <div
//         className={`absolute inset-0 ${THEME.appBg} flex items-center justify-center`}
//       >
//         <div className="rounded-2xl border border-red-300 bg-red-50 px-6 py-4 shadow">
//           <p className="text-sm text-red-700">
//             {error ?? "No analytics data."}
//           </p>
//           <button
//             onClick={onBack}
//             className="mt-3 px-4 py-2 rounded-full bg-[#FF8A00] hover:bg-[#FF9E1E] text-white text-xs"
//           >
//             Back to chat
//           </button>
//         </div>
//       </div>
//     );
//   }

//   const totals = d.totals || {};
//   const byDay = d.by_day || [];
//   const topCategories = d.top_categories || [];
//   const consistencyScore = d.consistencyScore ?? 0;
//   const consistencyByCategory = d.consistencyByCategory || {};

//   const CATEGORY_COLORS = [
//     "#FF8A00",
//     "#FFC107",
//     "#7C3AED",
//     "#0EA5E9",
//     "#22C55E",
//     "#16A34A",
//     "#F97316",
//     "#EC4899",
//     "#10B981",
//     "#6366F1",
//     "#F59E0B",
//     "#3B82F6",
//   ];

//   const countsByCat: Record<string, number> = {};
//   topCategories.forEach((c: any) => {
//     countsByCat[c.category] = c.count;
//   });

//   const chartData = ZUZU_CATEGORIES.map((name, idx) => ({
//     label: name,
//     value: countsByCat[name] ?? 0,
//     color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
//   }));

//   const totalForPie =
//     chartData.reduce((sum, s) => sum + (s.value || 0), 0) || 1;

//   return (
//     <div className={`absolute inset-0 ${THEME.appBg} overflow-auto`}>
//       <header
//         className={`p-5 border-b ${THEME.sidebarBorder} ${THEME.sidebarBg}`}
//       >
//         <div className="flex items-center gap-3">
//           <button
//             onClick={onBack}
//             className="p-2 rounded-full border border-[#F3C58C] bg-[#FFEFD9] hover:bg-white transition"
//           >
//             <ArrowLeft size={18} className={THEME.textSub} />
//           </button>

//           <div>
//             <h1 className={`text-2xl font-extrabold ${THEME.brand}`}>
//               ZUZU Admin
//             </h1>
//             <p className={`text-xs mt-1 ${THEME.textSub}`}>
//               Analytics &amp; Insights
//             </p>
//           </div>
//         </div>
//       </header>

//       <main className="p-5 space-y-6">
//         <div className="grid gap-4 md:grid-cols-4">
//           <div className="rounded-2xl border border-[#F3C58C] bg-[#FFF6EA] p-4">
//             <p className="text-[11px] font-semibold text-[#A06A32]">
//               Total Users
//             </p>
//             <p className="text-3xl font-bold">
//               {totals.totalUsers ?? 0}
//             </p>
//           </div>

//           <div className="rounded-2xl border border-[#F3C58C] bg-[#FFF6EA] p-4">
//             <p className="text-[11px] font-semibold text-[#A06A32]">
//               Total Questions
//             </p>
//             <p className="text-3xl font-bold">
//               {totals.totalQuestions ?? 0}
//             </p>
//           </div>

//           <div className="rounded-2xl border border-[#F3C58C] bg-[#FFF6EA] p-4">
//             <p className="text-[11px] font-semibold text-[#A06A32]">
//               PII Alerts
//             </p>
//             <p className="text-3xl font-bold">
//               {totals.totalPiiEvents ?? 0}
//             </p>
//           </div>

//           <div className="rounded-2xl border border-[#F3C58C] bg-[#FFF6EA] p-4">
//             <p className="text-[11px] font-semibold text-[#A06A32]">
//               Overall Consistency
//             </p>
//             <p className="text-3xl font-bold">
//               {Math.round(consistencyScore)}%
//             </p>
//           </div>
//         </div>

//         <div className="rounded-2xl border border-[#F3C58C] bg-[#FFF6EA] p-4">
//           <div className="flex items-center gap-2 mb-4">
//             <PieChartIcon size={18} className={THEME.textSub} />
//             <h2 className={`text-sm font-semibold ${THEME.textMain}`}>
//               Questions by Category
//             </h2>
//           </div>

//           <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:justify-center">
//             <div className="w-48 h-48 md:w-64 md:h-64 flex items-center justify-center">
//               <ResponsiveContainer width="100%" height="100%">
//                 <RePieChart>
//                   <Pie
//                     data={chartData}
//                     dataKey="value"
//                     nameKey="label"
//                     cx="50%"
//                     cy="50%"
//                     outerRadius="80%"
//                     innerRadius={0}
//                     paddingAngle={1}
//                     isAnimationActive={false}
//                   >
//                     {chartData.map((slice) => (
//                       <Cell key={slice.label} fill={slice.color} />
//                     ))}
//                   </Pie>
//                 </RePieChart>
//               </ResponsiveContainer>
//             </div>

//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
//               {chartData.map((slice) => (
//                 <div key={slice.label} className="flex items-center gap-2">
//                   <span
//                     className="inline-block w-3 h-3 rounded-full"
//                     style={{ backgroundColor: slice.color }}
//                   />
//                   <span className={THEME.textMain}>{slice.label}</span>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>

//         <div className="rounded-2xl border border-[#F3C58C] bg-[#FFF6EA] p-4">
//           <h2 className={`text-sm font-semibold ${THEME.textMain} mb-1`}>
//             Consistency by Category
//           </h2>

//           <div className="space-y-3">
//             {Object.entries(consistencyByCategory).map(([cat, v]) => {
//               const idx = ZUZU_CATEGORIES.indexOf(cat);
//               const color =
//                 idx >= 0 ? CATEGORY_COLORS[idx] : "#FF8A00";

//               return (
//                 <BarRow
//                   key={cat}
//                   label={cat}
//                   value={Number(v)}
//                   max={100}
//                   color={color}
//                 />
//               );
//             })}
//           </div>
//         </div>

//         <div className="rounded-2xl border border-[#F3C58C] bg-[#FFF6EA] p-4">
//           <h2 className={`text-sm font-semibold ${THEME.textMain} mb-1`}>
//             Usage (last 7 days)
//           </h2>

//           <div className="flex gap-1 items-end h-40">
//             {byDay.length === 0 ? (
//               <p className={`${THEME.textSub} text-xs`}>
//                 No usage data yet.
//               </p>
//             ) : (
//               byDay.map((row: any) => {
//                 const maxCount = Math.max(
//                   ...byDay.map((x: any) => x.count)
//                 );
//                 const pct = maxCount ? (row.count / maxCount) * 100 : 0;

//                 return (
//                   <div
//                     key={row.date}
//                     className="flex-1 flex flex-col items-center"
//                   >
//                     <div
//                       className="w-full bg-[#FF8A00] rounded-t-full"
//                       style={{ height: `${pct}%` }}
//                     />
//                     <span className="text-[10px] text-[#A06A32] mt-1">
//                       {row.date.slice(5)}
//                     </span>
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         </div>
//       </main>
//     </div>
//   );
// }
