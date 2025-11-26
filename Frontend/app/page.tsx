"use client";
/* eslint-disable @next/next/no-img-element */

import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  KeyboardEvent,
} from "react";

import Image from "next/image";
import {
  Send,
  Plus,
  Trash,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  User,
  ArrowLeft,
  Lock,
  Sparkles,
  PieChart as PieChartIcon,
} from "lucide-react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

// ============================================================
//                     BACKEND CATEGORIES
// ============================================================

export const ZUZU_CATEGORIES: string[] = [
  "Housing",
  "Admissions",
  "Visa and Immigration",
  "Travel and Arrival",
  "Forms and Documentation",
  "Money and Banking",
  "Campus Life and Academics",
  "Health and Safety",
  "Phone and Connectivity",
  "Work and Career",
  "Community and Daily Life",
  "Other Inquiries",
];

export const ZUZU_SUBCATEGORIES: Record<string, string[]> = {
  Housing: [
    "Apply / Eligibility",
    "Housing options overview",
    "Residence halls",
    "Apartments",
    "Rates & contracts",
    "Move-in & move-out",
    "Roommates",
    "Break housing & guest housing",
    "Parent guide / safety",
    "Services & support (living features)",
  ],
  Admissions: [
    "Application and deadlines",
    "Test scores and GPA",
    "Transcripts and academic records",
    "Offer letter and deposits",
    "Deferral or change of term",
  ],
  "Visa and Immigration": [
    "I-20 / DS-2019 questions",
    "SEVIS fee and SEVIS record",
    "Visa interview preparation",
    "At the port of entry",
    "Maintaining status",
    "CPT, OPT, and STEM-OPT",
    "Travel and re-entry",
  ],
  "Travel and Arrival": [
    "Booking flights and timing",
    "Airport pickup and directions to campus",
    "Temporary housing / hotels",
    "What to pack",
    "Arriving early or late",
  ],
  "Forms and Documentation": [
    "Immunization and health forms",
    "Financial forms and proof of funding",
    "Housing application forms",
    "Enrollment and registration forms",
    "Other university forms",
  ],
  "Money and Banking": [
    "Paying tuition and fees",
    "Opening a bank account",
    "Budget and cost of living",
    "Scholarships and assistantships",
    "Refunds and payment plans",
  ],
  "Campus Life and Academics": [
    "Class registration and add/drop",
    "Choosing majors and advisors",
    "Tutoring and academic support",
    "Using campus resources",
    "Academic policies",
  ],
  "Health and Safety": [
    "Health insurance requirements",
    "On-campus clinic and medical care",
    "Mental health support",
    "Campus safety and emergency contacts",
  ],
  "Phone and Connectivity": [
    "SIM cards and phone plans",
    "Wi-Fi and internet on campus",
    "University accounts, passwords, and MFA",
  ],
  "Work and Career": [
    "On-campus jobs",
    "Internships and co-ops",
    "Career center and resume help",
    "Social Security Number for work",
  ],
  "Community and Daily Life": [
    "Groceries, shopping, and food options",
    "Weather and clothing",
    "Transportation (bus, parking, ride-share)",
    "Student clubs and making friends",
  ],
  "Other Inquiries": ["Anything else"],
};

const HOUSING_THIRD_LEVEL: Record<string, string[]> = {
  "Apply / Eligibility": [
    "How to apply (WINGS → Student → Housing)",
    "Who can live where (first-year, transfer, grad, international)",
    "Prepayment & refund basics",
    "Registration needed to move in",
    "Under-18 co-signature requirements",
    "Dining plan rule for halls",
    "Wright Path student info",
    "When you'll see your assignment",
    "Contact Housing (hours, phone, email)",
  ],
  "Housing options overview": [
    "Compare halls vs. apartments",
    "See floor plans and virtual tours",
    "Furnished vs. unfurnished notes",
    "What's included (utilities, Wi-Fi, etc.)",
    "Theme / interest / gender-inclusive options",
  ],
  "Residence halls": [
    "Hamilton Hall (rooms, location)",
    "Honors Community (eligibility, setup)",
    "The Woods (9 halls, suite style, amenities)",
    "Meal plan required in halls",
    "Hall staffing & support (RAs, community team)",
  ],
  Apartments: [
    "College Park (layouts, furnished, kitchen/laundry)",
    "Forest Lane (studio/2-BR options, vibe)",
    "University Park (4-BR layout, eligibility)",
    "The Village (independence, longer commitment)",
    "Dining plan optional in apartments",
  ],
  "Rates & contracts": [
    "Current rates by hall/apartment",
    "What the rate includes",
    "$50 prepayment & refund window",
    "Typical contract length",
    "Where to view past years' rates",
  ],
  "Move-in & move-out": [
    "Move-in assignment and check-in details",
    "What to do before you arrive",
    "What to bring / what NOT to bring",
    "If you're delayed or no-show",
    "Move-out deadlines, fees, key return",
  ],
  Roommates: [
    "Request a roommate (name + UID)",
    "Sign up with roommate PIN",
    "Tips for matching & communicating",
    "Room renewal & selection",
  ],
  "Services & support (living features)": [
    "Academic help (PALs, Scholar-in-Residence)",
    "ADA accommodations (ESA/service animal info)",
    "Dining plans & locations (Grubhub)",
    "Internet/TV/Phone setup",
    "Maintenance & billing",
    "Mail & packages (pickup, addressing, forwarding)",
  ],
};

// ============================================================
//                         TYPES
// ============================================================

type Role = "user" | "bot";
type ButtonKind = "category" | "subcategory" | "thirdlevel";

interface ZuzuButton {
  id: string;
  label: string;
  kind: ButtonKind;
  category?: string;
  subcategory?: string;
}

interface Message {
  id: string;
  role: Role;
  content: string;
  ts: number;
  sources?: { id: number; title: string; url: string; score: number }[];
  buttons?: ZuzuButton[];
}

interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
}

// ============================================================
//                      API BASE URL
// ============================================================


// const API_BASE = "http://localhost:8000/api";
// const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

const rawEnv = process.env.NEXT_PUBLIC_API_BASE;

// If NEXT_PUBLIC_API_BASE is missing or literally "undefined",
// hard-fallback to the real Azure backend URL
const API_BASE =
  rawEnv && rawEnv !== "undefined"
    ? rawEnv
    : "https://zuzu-backend-api.azurewebsites.net/api";

console.log("API_BASE in production:", API_BASE);


// ============================================================
//                          THEME
// ============================================================

const THEME = {
  appBg: "bg-[#FFEFD9]",
  sidebarBg: "bg-[#FDE3C5]",
  sidebarBorder: "border-[#F3C58C]",
  bubbleBotBg: "bg-white",
  bubbleUserBg: "bg-[#FDE6C8]",
  bubbleBorder: "border-[#F3C58C]",
  textMain: "text-[#5C3B1F]",
  textSub: "text-[#A06A32]",
  brand: "text-[#F7931E]",
  brandBg: "bg-[#FF8A00]",
  brandBgHover: "hover:bg-[#FF9E1E]",
};

// ============================================================
//                       DEVICE ID
// ============================================================

// const DEVICE_KEY = "zuzu_device_id";

// function getDeviceId(): string {
//   if (typeof window === "undefined") return "server";

//   let id: string | null = window.localStorage.getItem(DEVICE_KEY);

//   if (!id) {
//     const randomId =
//       (crypto as any)?.randomUUID?.() ??
//       `${Date.now().toString(36)}-${Math.random()
//         .toString(36)
//         .slice(2)}`;

//     window.localStorage.setItem(DEVICE_KEY, randomId); // ✅ randomId is string
//     id = randomId;
//   }

//   return id; // ✅ TS now knows this is string here (because we always set it)
// }
const DEVICE_KEY = "zuzu_device_id";

function getDeviceId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  // Try to read existing id
  const existing = window.localStorage.getItem(DEVICE_KEY);
  if (existing) {
    return existing; // ✅ definitely a string
  }

  // Create and store a new id
  const randomId =
    (crypto as any)?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(DEVICE_KEY, randomId);
  return randomId; // ✅ definitely a string
}


const DEVICE_ID =
  typeof window !== "undefined" ? getDeviceId() : "server";

// ============================================================
//                        HELPERS
// ============================================================

const uid = () => Math.random().toString(36).slice(2);

const timeHHMM = (ms: number) =>
  new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const d = diff / (1000 * 60 * 60 * 24);
  const h = diff / (1000 * 60 * 60);
  const m = diff / (1000 * 60);

  if (d >= 1) return `${Math.floor(d)}d ago`;
  if (h >= 1) return `${Math.floor(h)}h ago`;
  if (m >= 1) return `${Math.floor(m)}m ago`;
  return "just now";
}

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

function parseStudentType(answer: string) {
  const t = answer.toLowerCase();

  const phd = /\b(phd|ph\.d|doctorate|doctoral)\b/.test(t);
  const grad = !phd && /\bgrad(uate)?\b/.test(t);
  const undergrad = /\bundergrad(uate)?\b/.test(t);

  const level = phd
    ? "PhD"
    : grad
    ? "graduate"
    : undergrad
    ? "undergraduate"
    : null;

  return { level, valid: !!level };
}


// function buildCategoryButtonMessage(parsed: {
//   level: string | null;
//   origin: string | null;
//   valid: boolean;
// }): { content: string; buttons: ZuzuButton[] } {
//   const { level, origin, valid } = parsed;

//   const profileText = valid
//     ? `Great! I've noted that you're a **${origin} ${level}** student.`
//     : `Thanks for sharing that! I’ll still tailor things as best I can.`;

//   const content =
//     profileText +
//     `\n\nHere are the main areas I can help with:`;

//   const buttons: ZuzuButton[] = ZUZU_CATEGORIES.map((cat) => ({
//     id: `cat-${cat}`,
//     label: cat,
//     kind: "category",
//     category: cat,
//   }));

//   return { content, buttons };
// }

function buildCategoryButtonMessage(parsed: {
  level: string | null;
  valid: boolean;
}): { content: string; buttons: ZuzuButton[] } {
  const { level, valid } = parsed;

  const profileText =
    valid && level
      ? `Great! I've noted that you're a **${level}** student.`
      : `Thanks for sharing that! I’ll still tailor things as best I can.`;

  const content =
    profileText + `\n\nHere are the main areas I can help with:`;

  const buttons: ZuzuButton[] = ZUZU_CATEGORIES.map((cat) => ({
    id: `cat-${cat}`,
    label: cat,
    kind: "category",
    category: cat,
  }));

  return { content, buttons };
}


/**
 * Strip ANY trailing "Sources" blocks from the LLM text
 * so we only show the clean Sources list at the bottom.
 */
function stripSourcesSection(text: string): string {
  if (!text) return text;
  const lines = text.split("\n");
  const idx = lines.findIndex((line) => {
    const t = line.trim().toLowerCase();
    return (
      t.startsWith("sources") || // "Sources:", "Sources (vector DB):"
      t.startsWith("**sources**")
    );
  });
  if (idx === -1) return text;
  return lines.slice(0, idx).join("\n").trimEnd();
}


// Canonical URLs we want to always show as clean Markdown links
const WINGS_LOGIN_URL =
  "https://login.microsoftonline.com/5c46d65d-ee5c-4513-8cd4-af98d15e6833/oauth2/authorize?client_id=00000003-0000-0ff1-ce00-000000000000&response_mode=form_post&response_type=code%20id_token&resource=00000003-0000-0ff1-ce00-000000000000&scope=openid&nonce=880052A85FD9DD18229A1CC2FF030074545BD6DD7E4BB9A1%2DF48A2313E66AB6404CB99269B1419575C5FCE80D868358287090900099E99FBD&redirect_uri=https%3A%2F%2Fraidermailwright.sharepoint.com%2F_forms%2Fdefault.aspx&state=OD0w&claims=%7B%22id_token%22%3A%7B%22xms_cc%22%3A%7B%22values%22%3A%5B%22CP1%22%5D%7D%7D%7D&wsucxt=1&cobrandid=11bd8083-87e0-41b5-bb78-0bc43c8a8e8a&client-request-id=7440dca1-70be-a000-e122-d780c2e117d5";

const ARRIVAL_FORM_URL =
  "https://i-raider.wright.edu/istart/controllers/client/ClientEngine.cfm?serviceid=EFormArrivalNotification0ServiceProvider";

const VISA_FORM_URL =
  "https://i-raider.wright.edu/istart/controllers/client/ClientEngine.cfm?serviceid=EFormCommitmenttoWrightStateUniversity0ServiceProvider";

const SEVIS_FEE_URL = "https://www.fmjfee.com";

const TEMP_HOUSING_URL =
  "https://www.extendedstayamerica.com/corporate/?corpaccount=1382";

// One config array so it's easy to add more later
const LINK_MAPPINGS: {
  name: string;
  // something unique we can regex-match even if the LLM mangles query params
  basePattern: RegExp;
  canonicalUrl: string;
  label: string;
}[] = [
  {
    name: "wings",
    basePattern:
      /https:\/\/login\.microsoftonline\.com\/5c46d65d-ee5c-4513-8cd4-af98d15e6833[^\s)]*/gi,
    canonicalUrl: WINGS_LOGIN_URL,
    label: "WINGS login",
  },
  {
    name: "arrival",
    basePattern:
      /https:\/\/i-raider\.wright\.edu\/istart\/controllers\/client\/ClientEngine\.cfm\?serviceid=EFormArrivalNotification0ServiceProvider[^\s)]*/gi,
    canonicalUrl: ARRIVAL_FORM_URL,
    label: "Arrival Notification Form",
  },
  {
    name: "visa",
    basePattern:
      /https:\/\/i-raider\.wright\.edu\/istart\/controllers\/client\/ClientEngine\.cfm\?serviceid=EFormCommitmenttoWrightStateUniversity0ServiceProvider[^\s)]*/gi,
    canonicalUrl: VISA_FORM_URL,
    label:
      "Visa Information / Commitment to Wright State University form",
  },
  {
    name: "sevis",
    basePattern: /https:\/\/www\.fmjfee\.com[^\s)]*/gi,
    canonicalUrl: SEVIS_FEE_URL,
    label: "Pay SEVIS I-901 fee",
  },
  {
    name: "tempHousing",
    basePattern:
      /https:\/\/www\.extendedstayamerica\.com\/corporate\/\?corpaccount=1382[^\s)]*/gi,
    canonicalUrl: TEMP_HOUSING_URL,
    label: "Extended Stay America corporate rate",
  },
];

// Generic normalizer: for each known URL, collapse messy versions
// and wrap them in a nice Markdown link [label](url)
function normalizeAllLinks(text: string): string {
  if (!text) return text;

  let out = text;

  for (const mapping of LINK_MAPPINGS) {
    const { basePattern, canonicalUrl, label } = mapping;

    // 1) Replace any variant with the canonical URL
    out = out.replace(basePattern, canonicalUrl);

    // 2) If canonical URL is present but not already in a Markdown link,
    //    wrap it as [label](canonicalUrl)
    if (out.includes(canonicalUrl)) {
      const alreadyLinked = new RegExp(
        `\\[${label.replace(/\s+/g, "\\s+")}\\]\\(${canonicalUrl.replace(
          /[-/\\^$*+?.()|[\]{}]/g,
          "\\$&"
        )}\\)`,
        "i"
      ).test(out);

      if (!alreadyLinked) {
        out = out.replace(
          canonicalUrl,
          `[${label}](${canonicalUrl})`
        );
      }
    }
  }

  return out;
}

// ============================================================
//               INITIAL BOT MESSAGE
// ============================================================

const INITIAL_BOT_MESSAGE = `
Hi! I'm **ZUZU** 👋 your onboarding guide for Wright State University 😊  

Are you an **undergraduate**, **graduate**, or **PhD** student?
`.trim();

// ============================================================
//              BACKEND MESSAGE SENDER
// ============================================================

async function sendToBackend(
  chatId: string,
  text: string
): Promise<{ reply: string; sources: any[] }> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Device-Id": DEVICE_ID,
    },
    body: JSON.stringify({ chat_id: chatId, message: text }),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("Backend error:", res.status, t);
    throw new Error(`Backend error: ${res.status}`);
  }

  const data = await res.json();
  return {
    reply: data.reply,
    sources: data.sources || [],
  };
}

// ============================================================
//                   MAIN COMPONENT START
// ============================================================

function ZuzuApp() {
  const [view, setView] = useState<"chat" | "admin">("chat");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeConvo = useMemo(
    () => convos.find((c) => c.id === activeId) ?? null,
    [convos, activeId]
  );

  const [flowStep, setFlowStep] = useState<
    "intro" | "categories" | "subcategories" | "thirdlevel" | "chat"
  >("intro");

  const [introState, setIntroState] = useState<
    "waiting_first" | "waiting_retry" | "done"
  >("waiting_first");

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(
    null
  );

  // 🔹 NEW: track the current topic so follow-up questions keep context
  const [currentContext, setCurrentContext] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const bootRef = useRef(false);

  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [studentLevel, setStudentLevel] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvo?.messages, isTyping]);

  // useEffect(() => {
  //   if (bootRef.current) return;
  //   bootRef.current = true;

  //   if (typeof window === "undefined") return;

  //   try {
  //     const stored = localStorage.getItem("zuzu_convos");
  //     if (stored) {
  //       const parsed = JSON.parse(stored) as Conversation[];
  //       if (parsed.length > 0) {
  //         setConvos(parsed);
  //         setActiveId(parsed[0].id);
  //         return;
  //       }
  //     }
  //   } catch {
  //     // ignore
  //   }

  //   createNewConversation(true);
  // }, []);


  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;

    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem("zuzu_convos");
      if (stored) {
        const parsed = JSON.parse(stored) as Conversation[];
        if (parsed.length > 0) {
          setConvos(parsed);
          setActiveId(parsed[0].id);

          // ✅ If we’re restoring from history, assume the intro already ran.
          setIntroState("done");
          setFlowStep("chat");
          return;
        }
      }
    } catch {
      // ignore
    }

    // No stored conversations -> fresh chat, intro is needed
    createNewConversation(true);
  }, []);


  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("zuzu_convos", JSON.stringify(convos));
  }, [convos]);

  function isConversationEmpty(c: Conversation) {
    if (!c.messages) return true;
    if (c.messages.length === 1 && c.messages[0].role === "bot") return true;
    return false;
  }

  function createNewConversation(isInitial = false) {
    if (!isInitial) {
      const empty = convos.find(isConversationEmpty);
      if (empty) {
        setActiveId(empty.id);
        setFlowStep("intro");
        setIntroState("waiting_first");
        setSelectedCategory(null);
        setSelectedSubcategory(null);
        setCurrentContext(null);
        return;
      }
    }

    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

    const firstMsg: Message = {
      id: uid(),
      role: "bot",
      content: INITIAL_BOT_MESSAGE,
      ts: Date.now(),
    };

    const convo: Conversation = {
      id,
      title: "New Conversation",
      createdAt: Date.now(),
      messages: [firstMsg],
    };

    setConvos((x) => [convo, ...x]);
    setActiveId(id);
    setFlowStep("intro");
    setIntroState("waiting_first");
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setCurrentContext(null);
  }

  function deleteConvo(id: string) {
    setConvos((x) => x.filter((c) => c.id !== id));
    if (activeId === id) {
      const next = convos.find((c) => c.id !== id);
      setActiveId(next?.id ?? null);
    }
  }

  function updateConversationTitle(convoId: string, content: string) {
    const words = content.split(/\s+/);
    const title = words.slice(0, 6).join(" ").slice(0, 40);

    setConvos((prev) =>
      prev.map((c) =>
        c.id === convoId ? { ...c, title: title || "Conversation" } : c
      )
    );
  }

  // 🔹 NEW: track category selections for analytics
  function trackCategorySelection(label: string) {
    if (!activeConvo) return;
    fetch(`${API_BASE}/track-category`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": DEVICE_ID,
      },
      body: JSON.stringify({
        chat_id: activeConvo.id,
        category: label,
      }),
    }).catch(() => {
      // ignore tracking errors on frontend
    });
  }

  async function sendMessageWithText(
    text: string,
    options?: { skipUserMessage?: boolean }
  ) {
    if (!activeConvo) return;

    const skipUserMessage = options?.skipUserMessage ?? false;

    if (!skipUserMessage) {
      const hasUserMessages =
        activeConvo.messages.filter((m) => m.role === "user").length > 0;
      if (!hasUserMessages) {
        // First free-text after intro: if we still have "New Conversation"
        // and no category yet, keep current behavior (title = text).
        updateConversationTitle(activeConvo.id, text);
      }

      const newUser: Message = {
        id: uid(),
        role: "user",
        content: text,
        ts: Date.now(),
      };

      setConvos((prev) =>
        prev.map((c) =>
          c.id === activeConvo.id
            ? { ...c, messages: [...c.messages, newUser] }
            : c
        )
      );
    }

    setFlowStep("chat");

    setIsTyping(true);

    // 🔹 NEW: add soft context to help LLM remember what topic we're on
    // const effectiveText =
    //   currentContext && currentContext.trim().length > 0
    //     ? `${text}\n\n(Context: this question is about "${currentContext}".)`
    //     : text;
    const profilePrefix = studentLevel
      ? `Student profile: ${studentLevel} student.\n\n`
      : "";

    const effectiveText =
      currentContext && currentContext.trim().length > 0
        ? `${profilePrefix}${text}\n\n(Context: this question is about "${currentContext}".)`
        : `${profilePrefix}${text}`;

    let reply = "";
    let sources: Message["sources"] = [];
    try {
      const res = await sendToBackend(activeConvo.id, effectiveText);
      reply = res.reply;
      sources = res.sources;
    } catch {
      reply = "Sorry - I am unable to provide you with an answer at this moment.";
      sources = [];
    }
    setIsTyping(false);

    const botMsg: Message = {
      id: uid(),
      role: "bot",
      content: reply,
      ts: Date.now(),
      sources,
    };

    setConvos((prev) =>
      prev.map((c) =>
        c.id === activeConvo.id
          ? { ...c, messages: [...c.messages, botMsg] }
          : c
      )
    );
  }

  async function handleIntroAnswer(text: string) {
    if (!activeConvo) return;

    const userMsg: Message = {
      id: uid(),
      role: "user",
      content: text,
      ts: Date.now(),
    };

    setConvos((prev) =>
      prev.map((c) =>
        c.id === activeConvo.id
          ? { ...c, messages: [...c.messages, userMsg] }
          : c
      )
    );

    // const parsed = parseStudentType(text);

    // // 🔹 NEW: if we can detect profile, use it as a temporary title
    // // (e.g., "international graduate") so chats aren't stuck as "New Conversation"
    // if (parsed.valid) {
    //   const levelLabel = parsed.level ?? "";
    //   const originLabel = parsed.origin ?? "";
    //   const prettyTitle = `${originLabel} ${levelLabel}`.trim();
    //   if (prettyTitle) {
    //     updateConversationTitle(activeConvo.id, prettyTitle);
    //   }
    // }

    const parsed = parseStudentType(text);

// If we can detect profile, use it as a temporary title
// (e.g., "graduate student", "PhD student") so chats aren't stuck as "New Conversation"
    if (parsed.valid && parsed.level) {
      const prettyTitle =
        parsed.level === "PhD"
          ? "PhD student"
          : `${parsed.level} student`;
      updateConversationTitle(activeConvo.id, prettyTitle);
      setStudentLevel(parsed.level);
    }


    if (!parsed.valid && introState === "waiting_first") {
      const retryBot: Message = {
        id: uid(),
        role: "bot",
        content:
          "I didn’t quite catch that, and I definitely want to help you with it. 💛\n\n" +
          "Before I give you a detailed answer, could you please tell me whether you are an **undergraduate**, **graduate**, or **PhD** student?\n\n" +
          "This helps me give the most accurate information for your situation.",
        ts: Date.now(),
      };

      setConvos((prev) =>
        prev.map((c) =>
          c.id === activeConvo.id
            ? { ...c, messages: [...c.messages, retryBot] }
            : c
        )
      );

      setIntroState("waiting_retry");
      return;
    }

    // const { level } = parsed;
    // const summaryForLLM = parsed.valid
    //   ? `Student profile: ${level} student, ${origin}.`
    //   : "Student profile: not clearly specified.";

    const { level } = parsed;
    const summaryForLLM =
      parsed.valid && level
        ? `Student profile: ${level} student.`
        : "Student profile: not clearly specified.";


    setIntroState("done");
    setFlowStep("chat");

    const { content, buttons } = buildCategoryButtonMessage(parsed);

    const botMsg: Message = {
      id: uid(),
      role: "bot",
      content,
      ts: Date.now(),
      buttons,
    };

    // We still let categories override the profile title later.
    setConvos((prev) =>
      prev.map((c) =>
        c.id === activeConvo.id
          ? {
              ...c,
              messages: [...c.messages, botMsg],
            }
          : c
      )
    );

    try {
      await sendToBackend(activeConvo.id, summaryForLLM);
    } catch (err) {
      console.error("Failed to send profile summary to backend", err);
    }
  }

  // function sendMessage() {
  //   const t = input.trim();
  //   if (!t) return;

    // if (introState !== "done") {
    //   setInput("");
    //   void handleIntroAnswer(t);
    //   return;
    // }

  //   if (introState !== "done") {
  // // Only allow intro ONCE — if introState is "done", NEVER go back
  //     if (introState === "waiting_first" || introState === "waiting_retry") {
  //       setInput("");
  //       void handleIntroAnswer(t);
  //       return;
  //     }
  //   }


  //   setInput("");
  //   void sendMessageWithText(t);
  // }
    
  function sendMessage() {
    const t = input.trim();
    if (!t || !activeConvo) return;

    // Check if this conversation already has normal user messages
    const hasUserMessages =
      activeConvo.messages.filter((m) => m.role === "user").length > 0;

    if (introState !== "done" && !hasUserMessages) {
      // ✅ FIRST-EVER user message in this convo -> treat as intro
      setInput("");
      void handleIntroAnswer(t);
      return;
    }

    // ✅ If we somehow ended up with introState != "done" but we already
    // have user messages, force intro to done and treat this as normal chat.
    if (introState !== "done" && hasUserMessages) {
      setIntroState("done");
    }

    setInput("");
    void sendMessageWithText(t);
  }


  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleButtonClick(btn: ZuzuButton) {
    if (!activeConvo) return;

    let selectionText = btn.label;
    if (btn.kind === "subcategory" && btn.category) {
      selectionText = `${btn.category} → ${btn.label}`;
    } else if (btn.kind === "thirdlevel" && btn.category && btn.subcategory) {
      selectionText = `${btn.category} → ${btn.subcategory} → ${btn.label}`;
    }

    // 🔹 NEW: remember this as the current context for follow-up questions
    setCurrentContext(selectionText);

    const userMsg: Message = {
      id: uid(),
      role: "user",
      content: selectionText,
      ts: Date.now(),
    };

    const hasUserMessages =
      activeConvo.messages.filter((m) => m.role === "user").length > 0;

    const maybeUpdateTitle = (text: string) => {
      const title = activeConvo.title;
      // const looksLikeProfile =
      //   /international|domestic/i.test(title) &&
      //   /graduate|undergraduate|grad|undergrad/i.test(title);
      const looksLikeProfile =/undergraduate|graduate|phd|grad|undergrad/i.test(title);


      // 🔹 Allow overriding "New Conversation" **and** simple profile titles
      if (!hasUserMessages || title === "New Conversation" || looksLikeProfile) {
        updateConversationTitle(activeConvo.id, text);
      }
    };

    if (btn.kind === "category") {
      // Special behavior for "Other Inquiries"
      if (btn.label === "Other Inquiries") {
        const botMsg: Message = {
          id: uid(),
          role: "bot",
          ts: Date.now(),
          content:
            "Great! 😊\n\n" +
            "“Other Inquiries” just means anything that doesn’t quite fit the other buttons.\n\n" +
            "Please go ahead and **type your question in your own words**, and I’ll do my best to help.",
        };

        maybeUpdateTitle(btn.label);

        setConvos((prev) =>
          prev.map((c) =>
            c.id === activeConvo.id
              ? { ...c, messages: [...c.messages, userMsg, botMsg] }
              : c
          )
        );
        setSelectedCategory(btn.label);

        // 🔹 track category click
        trackCategorySelection(btn.label);
        return;
      }

      // Default behavior for all other categories
      const subs = ZUZU_SUBCATEGORIES[btn.label] ?? [];

      const subButtons: ZuzuButton[] = subs.map((sub) => ({
        id: `sub-${btn.label}-${sub}`,
        label: sub,
        kind: "subcategory",
        category: btn.label,
      }));

      const botMsg: Message = {
        id: uid(),
        role: "bot",
        ts: Date.now(),
        content: `Great, let's look at **${btn.label}**. Here are the main sections I can walk you through:`,
        buttons: subButtons,
      };

      maybeUpdateTitle(btn.label);

      setConvos((prev) =>
        prev.map((c) =>
          c.id === activeConvo.id
            ? { ...c, messages: [...c.messages, userMsg, botMsg] }
            : c
        )
      );
      setSelectedCategory(btn.label);

      // 🔹 track category click
      trackCategorySelection(btn.label);
      return;
    }

    if (btn.kind === "subcategory") {
      if (
        btn.category === "Housing" &&
        HOUSING_THIRD_LEVEL[btn.label] &&
        HOUSING_THIRD_LEVEL[btn.label].length > 0
      ) {
        const detailButtons: ZuzuButton[] = HOUSING_THIRD_LEVEL[btn.label].map(
          (detail) => ({
            id: `detail-${btn.category}-${btn.label}-${detail}`,
            label: detail,
            kind: "thirdlevel",
            category: btn.category,
            subcategory: btn.label,
          })
        );

        const botMsg: Message = {
          id: uid(),
          role: "bot",
          ts: Date.now(),
          content: `Here are the specific topics under **${btn.label}**:`,
          buttons: detailButtons,
        };

        maybeUpdateTitle(`${btn.category} – ${btn.label}`);

        setConvos((prev) =>
          prev.map((c) =>
            c.id === activeConvo.id
              ? { ...c, messages: [...c.messages, userMsg, botMsg] }
              : c
          )
        );
        setSelectedCategory(btn.category ?? null);
        setSelectedSubcategory(btn.label);

        // 🔹 track subcategory as part of category usage
        trackCategorySelection(`${btn.category} – ${btn.label}`);
        return;
      }

      const ctx = `Category selection: ${btn.category} | Subcategory: ${btn.label}`;
      maybeUpdateTitle(`${btn.category} – ${btn.label}`);

      setConvos((prev) =>
        prev.map((c) =>
          c.id === activeConvo.id
            ? { ...c, messages: [...c.messages, userMsg] }
            : c
        )
      );

      // 🔹 track subcategory
      trackCategorySelection(`${btn.category} – ${btn.label}`);

      void sendMessageWithText(ctx, { skipUserMessage: true });
      return;
    }

    if (btn.kind === "thirdlevel") {
      const ctx = `Category selection: ${btn.category} | Subcategory: ${btn.subcategory} | Detail: ${btn.label}`;
      maybeUpdateTitle(
        `${btn.category} – ${btn.subcategory ?? ""} – ${btn.label}`
      );

      setConvos((prev) =>
        prev.map((c) =>
          c.id === activeConvo.id
            ? { ...c, messages: [...c.messages, userMsg] }
            : c
        )
      );

      // 🔹 track third-level selection too (fine-grained)
      trackCategorySelection(
        `${btn.category} – ${btn.subcategory ?? ""} – ${btn.label}`
      );

      void sendMessageWithText(ctx, { skipUserMessage: true });
    }
  }

  if (view === "admin") {
    if (!adminKey) {
      return (
        <AdminModal
          open={true}
          onClose={() => {
            setView("chat");
          }}
          onSuccess={(validCode) => {
            setAdminKey(validCode);
          }}
        />
      );
    }

    return (
      <AdminDashboard
        adminKey={adminKey}
        onBack={() => {
          setView("chat");
        }}
      />
    );
  }

  return (
    <div
      className={`flex h-screen ${THEME.appBg}`}
      style={{
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Segoe UI, sans-serif',
      }}
    >
      <aside
        className={`${sidebarCollapsed ? "w-16" : "w-80"} ${
          THEME.sidebarBg
        } border-r ${THEME.sidebarBorder} flex flex-col transition-all duration-300`}
      >
        <div className="h-20 px-4 flex items-center justify-between">
          {!sidebarCollapsed ? (
            <div>
              <h1 className={`text-2xl font-extrabold ${THEME.brand}`}>ZUZU</h1>
              <p className={`text-xs ${THEME.textSub}`}>
                Onboarding assistant
              </p>
            </div>
          ) : (
            <h1 className={`text-xl font-extrabold ${THEME.brand}`}>Z</h1>
          )}

          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="rounded-full border border-[#F3C58C] bg-[#FFEFD9] p-1.5 hover:bg-white transition"
          >
            {sidebarCollapsed ? (
              <ChevronRight size={16} className={THEME.textSub} />
            ) : (
              <ChevronLeft size={16} className={THEME.textSub} />
            )}
          </button>
        </div>

        <div className="px-3">
          <button
            onClick={() => createNewConversation(false)}
            className={`w-full flex items-center justify-center gap-2 rounded-full ${THEME.brandBg} ${THEME.brandBgHover} text-white py-2.5 text-sm font-semibold`}
          >
            <Plus size={16} />
            {!sidebarCollapsed && "New Conversation"}
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="p-3 space-y-1 flex-1 overflow-auto">
            {convos.map((c) => {
              const active = c.id === activeId;
              return (
                <div
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`group flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer ${
                    active
                      ? "bg-[#FF8A00] text-white"
                      : "hover:bg-[#FFE5C9] text-[#5C3B1F]"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium">
                      {c.title}
                    </div>

                    <div className="text-[11px] opacity-80">
                      {timeAgo(c.createdAt)}
                    </div>
                  </div>

                  <button
                    className={`p-1 rounded-full hover:bg-black/5 ${
                      active ? "text-white" : THEME.textSub
                    } opacity-0 group-hover:opacity-100`}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConvo(c.id);
                    }}
                  >
                    <Trash size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="p-3 border-t border-[#F3C58C]">
          <button
            onClick={() => setView("admin")}
            className="w-full flex items-center justify-center gap-2 rounded-full border border-[#F3C58C] bg-[#FFEFD9] py-2.5 text-xs hover:bg-white"
          >
            <BarChart3 size={16} className={THEME.textSub} />
            {!sidebarCollapsed && "Admin Dashboard"}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto px-10 py-8 space-y-6">
          {activeConvo?.messages.map((m) => {
            const isUser = m.role === "user";
            // const contentToShow =
            //   !isUser && m.sources && m.sources.length > 0
            //     ? stripSourcesSection(m.content)
            //     : m.content;
            const rawContent =
              !isUser && m.sources && m.sources.length > 0
                ? stripSourcesSection(m.content)
                : m.content;

            // ✅ apply link normalization for ALL bot messages
            const contentToShow = !isUser
              ? normalizeAllLinks(rawContent)
              : rawContent;


            return (
              <div
                key={m.id}
                className={`flex ${
                  isUser ? "justify-end" : "justify-start"
                } gap-3`}
              >
                {!isUser && (
                  <div className="flex items-start pt-1">
                    <Image
                      src="/zuzu.png"
                      width={32}
                      height={32}
                      alt="ZUZU"
                    />
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-3xl border ${
                    THEME.bubbleBorder
                  } px-6 py-4 shadow ${
                    isUser ? THEME.bubbleUserBg : THEME.bubbleBotBg
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    {isUser ? (
                      <p className={THEME.textMain}>{m.content}</p>
                    ) : (
                      <>
                        <div className={`prose max-w-none ${THEME.textMain}`}>
                          {/* <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeSanitize]}
                          >
                            {contentToShow}
                          </ReactMarkdown> */}
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeSanitize]}
                            components={{
                              a: ({ node, ...props }) => (
                                <a
                                  {...props}
                                  className="text-blue-600 underline font-medium hover:text-blue-800"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                />
                              ),
                            }}
                          >
                            {contentToShow}
                          </ReactMarkdown>

                        </div>

                        {m.buttons && m.buttons.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {m.buttons.map((btn) => {
                              const isCategory =
                                btn.kind === "category";

                              const baseClasses =
                                "w-full block text-sm transition-all duration-200 cursor-pointer shadow-sm";

                              const categoryClasses = `
                                ${baseClasses}
                                text-center px-5 py-4 rounded-lg
                                bg[#FFF8F0]
                                text-[#D68910]
                                font-bold uppercase tracking-[0.05em]
                                border-0
                                hover:bg-[#FFE8CC]
                                hover:shadow-md
                              `;

                              const detailClasses = `
                                ${baseClasses}
                                text-left px-5 py-4 rounded-lg
                                bg-white
                                border-2 border-[#FF8C42]
                                text-[#333333]
                                hover:border-[#FF7A28]
                                hover:shadow-md
                                hover:-translate-y-[1px]
                              `;

                              return (
                                <button
                                  key={btn.id}
                                  onClick={() => handleButtonClick(btn)}
                                  className={
                                    isCategory
                                      ? categoryClasses
                                      : detailClasses
                                  }
                                >
                                  {isCategory ? (
                                    <span>{btn.label}</span>
                                  ) : (
                                    <div>
                                      <div className="button-title text-[#FF8C42] text-base font-semibold mb-1">
                                        {btn.label}
                                      </div>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {m.sources && m.sources.length > 0 && (
                          <div className="mt-3 text-xs text-gray-500">
                            <div className="font-semibold mb-1">
                              Sources
                            </div>
                            <ul className="list-disc list-inside space-y-1">
                              {[
                                ...new Map(
                                  m.sources.map((s) => [
                                    (s.url || "") +
                                      "|" +
                                      (s.title || ""),
                                    s,
                                  ])
                                ).values(),
                              ].map((s, idx) => (
                                <li
                                  key={
                                    s.url ||
                                    s.title ||
                                    String(idx)
                                  }
                                >
                                  <a
                                    href={s.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline"
                                  >
                                    {s.title || s.url}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}

                    <span
                      className={`text-[11px] ${THEME.textSub} self-end`}
                    >
                      {timeHHMM(m.ts)}
                    </span>
                  </div>
                </div>

                {isUser && (
                  <div className="flex items-start pt-4">
                    <div className="w-9 h-9 rounded-full border border-[#F3C58C] bg-[#FFEFD9] grid place-items-center">
                      <User size={18} className={THEME.textSub} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing indicator bubble */}
          {isTyping && (
            <div className="flex justify-start gap-3 mb-4">
              <div className="flex items-start pt-1">
                <Image src="/zuzu.png" width={32} height={32} alt="ZUZU" />
              </div>
              <div
                className={`max-w-xs rounded-3xl border ${THEME.bubbleBorder} px-4 py-3 shadow ${THEME.bubbleBotBg}`}
              >
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Sparkles size={14} className={THEME.textSub} />
                  <span>ZUZU is thinking…</span>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0.15s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0.3s]"></span>
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div
          className={`px-8 py-4 border-t ${THEME.sidebarBorder} bg-[#FBDDBD]`}
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#FFEFD9] border border-[#F3C58C] flex items-center justify-center">
              <User size={18} className={THEME.textSub} />
            </div>

            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask ZUZU anything…"
                rows={1}
                className={`
                  w-full resize-none rounded-full border ${THEME.sidebarBorder} 
                  bg-white px-6 py-3 text-sm ${THEME.textMain}
                  placeholder[#C38A4A] focus:outline-none focus:ring-2
                  focus:ring-[#FF9E1E]
                `}
              />
            </div>

            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className={`
                h-11 w-11 rounded-full ${THEME.brandBg} ${THEME.brandBgHover}
                text-white flex items-center justify-center shadow
                disabled:opacity-40 disabled:cursor-not-allowed
              `}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ============================================================
   ADMIN PORTAL (ACCESS MODAL + DASHBOARD)
   ============================================================ */

async function verifyAdminToken(token: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${API_BASE}/admin/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": DEVICE_ID,
      },
      body: JSON.stringify({ token }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Admin verify failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data.valid === true;
  } finally {
    clearTimeout(timeoutId);
  }
}

function AdminModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
}) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="w-[95%] max-w-sm rounded-2xl bg-white border border-[#F3C58C] shadow-xl p-6 text-center">
        <Lock size={40} className="mx-auto text-[#A06A32] mb-3" />
        <h2 className="text-xl font-bold text-[#5C3B1F]">
          Admin Access Required
        </h2>
        <p className="text-sm text-[#A06A32] mt-2 mb-4">
          Enter your admin access code to continue.
        </p>

        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter access code"
          className="w-full border border-[#F3C58C] rounded-xl px-4 py-2 text-sm focus:outline-none
                     focus:ring-2 focus:ring-[#FF8A00]"
        />

        {error && <p className="text-red-600 text-xs mt-2">{error}</p>}

        <button
          disabled={!code.trim() || checking}
          onClick={async () => {
            setChecking(true);
            setError("");
            try {
              const ok = await verifyAdminToken(code.trim());
              if (!ok) {
                setError("Invalid access code");
                return;
              }
              onSuccess(code.trim());
            } catch {
              setError("Unable to verify admin code. Please try again.");
            } finally {
              setChecking(false);
            }
          }}
          className="mt-4 w-full rounded-full bg-[#FF8A00] hover:bg-[#FF9E1E] text-white py-2
                     font-semibold shadow disabled:opacity-40"
        >
          {checking ? "Checking…" : "Enter Dashboard"}
        </button>

        <button
          onClick={onClose}
          className="mt-3 text-xs text-[#A06A32] underline"
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}

async function fetchDashboard(adminKey: string) {
  const res = await fetch(`${API_BASE}/analytics`, {
    headers: {
      "X-Admin-Key": adminKey,
      "X-Device-Id": DEVICE_ID,
    },
  });
  if (!res.ok) {
    throw new Error(`Analytics fetch failed: ${res.status} ${res.statusText}`);
  }
  return await res.json();
}

function BarRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span>{value.toFixed(0)}</span>
      </div>
      <div className="h-2 bg-[#F3D4AA] rounded-full overflow-hidden mt-1">
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            backgroundColor: color || "#FF8A00",
          }}
        />
      </div>
    </div>
  );
}

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
//         // const json = await fetchDashboard(adminKey);
//         // setD(json);
//         // JUST ADDDED
//         const json = await fetchDashboard(adminKey);
//         console.log("analytics raw:", json);
//         setD(json);
//          // JUST ADDDED

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
//   // const byDay = d.by_day || [];
//   // Accept both snake_case and camelCase, fallback to empty.
//   // const rawByDay = d.by_day || d.byDay || [];  

//   const topCategories = d.top_categories || [];
//   const consistencyScore = d.consistencyScore ?? 0;
//   const consistencyByCategory = d.consistencyByCategory || {};

//   // Normalize by_day into uniform [{ date: "YYYY-MM-DD", count: number }]
// // const byDay = Array.isArray(rawByDay)
// //   ? rawByDay
// //       .map((row: any) => {
// //         const date =
// //           row.date ||
// //           row.day ||
// //           (typeof row.created_at === "string"
// //             ? row.created_at.slice(0, 10)
// //             : null) ||
// //           row.dt ||
// //           row.d;

// //         const count =
// //           row.count ??
// //           row.total ??
// //           row.questions ??
// //           row.num_questions ??
// //           0;

// //         if (!date) return null;
// //         return {
// //           date,
// //           count: Number(count) || 0,
// //         };
// //       })
// //       .filter(Boolean)
// //   : [];


// // Normalize by_day into uniform [{ date: "YYYY-MM-DD", count: number }]
//   const rawByDay = d.by_day || d.byDay || [];
 

//   const byDay = Array.isArray(rawByDay)
//     ? rawByDay
//         .map((row: any) => {
//           const date =
//             row.date ||
//             row.day ||
//             (typeof row.created_at === "string"
//               ? row.created_at.slice(0, 10)
//               : null) ||
//             row.dt ||
//             row.d ||
//             row.date_str ||
//             row.date_string;

//           let count = 0;
//           for (const [key, value] of Object.entries(row)) {
//             if (
//               /count|total|questions|num_questions|question_count|usage/i.test(
//                 key
//               ) &&
//               value != null
//             ) {
//               const n =
//                 typeof value === "number" ? value : Number(value as any);
//               if (!Number.isNaN(n)) {
//                 count = n;
//                 break;
//               }
//             }
//           }

//           if (!date) return null;
//           return { date, count };
//         })
//         .filter(Boolean)
//     : [];

//   console.log("normalized byDay:", byDay);
 

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
//             <h2 className={`text-sm font-semibold ${THEME.textMain} mb-1`}>
//               Usage (last 7 days)
//             </h2>

//             <div className="flex gap-1 items-end h-40">
//               {byDay.length === 0 ? (
//                 <p className={`${THEME.textSub} text-xs`}>
//                   No usage data yet.
//                 </p>
//               ) : (
//                 (() => {
//                   const maxCount =
//                     Math.max(...byDay.map((x: any) => x.count)) || 0;

//                   return byDay.map((row: any) => {
//                     // const pct = maxCount
//                     //   ? (row.count / maxCount) * 100
//                     //   : 0;
//                     const pct = maxCount
//                       ? (row.count / maxCount) * 90 + 10 // 10–100% instead of 0–100%
//                       : 0;


//                     return (
//                       // <div
//                       //   key={row.date}
//                       //   className="flex-1 flex flex-col items-center"
//                       <div
//                           key={row.date}
//                           className="flex-1 min-w-[10px] flex flex-col items-center"
//                         >

                  
//                         <div
//                           className="w-full bg-[#FF8A00] rounded-t-full"
//                           style={{ height: `${pct}%` }}
//                         />
//                         <span className="text-[10px] text-[#A06A32] mt-1">
//                           {row.date.slice(5)}
//                         </span>
//                       </div>
//                     );
//                   });
//                 })()
//               )}
//             </div>
//           </div>
//         </main>
//       </div>
//     );
//     }

// /* ------------------------------------------------------------
//    DEFAULT EXPORT FOR NEXT.JS
// ------------------------------------------------------------ */

// const Page: React.FC = () => {
//   return <ZuzuApp />;
// };

// export default Page;



export function AdminDashboard({
  adminKey,
  onBack,
}: {
  adminKey: string;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  type DayUsage = { date: string; count: number };


  useEffect(() => {
    (async () => {
      try {
        const json = await fetchDashboard(adminKey);
        console.log("analytics raw:", json);
        setD(json);
      } catch (err: any) {
        console.error("Failed to load analytics", err);
        setError("Failed to load analytics from server.");
      } finally {
        setLoading(false);
      }
    })();
  }, [adminKey]);

  if (loading) {
    return (
      <div
        className={`absolute inset-0 ${THEME.appBg} flex items-center justify-center`}
      >
        <div className="rounded-2xl border border-[#F3C58C] bg-[#FFF6EA] px-6 py-4 shadow">
          <p className={`${THEME.textMain} text-sm`}>Loading analytics…</p>
        </div>
      </div>
    );
  }

  if (error || !d) {
    return (
      <div
        className={`absolute inset-0 ${THEME.appBg} flex items-center justify-center`}
      >
        <div className="rounded-2xl border border-red-300 bg-red-50 px-6 py-4 shadow">
          <p className="text-sm text-red-700">
            {error ?? "No analytics data."}
          </p>
          <button
            onClick={onBack}
            className="mt-3 px-4 py-2 rounded-full bg-[#FF8A00] hover:bg-[#FF9E1E] text-white text-xs"
          >
            Back to chat
          </button>
        </div>
      </div>
    );
  }

  const totals = d.totals || {};
  const rawByDay = d.by_day || d.byDay || [];
  const topCategories = d.top_categories || [];
  const consistencyScore = d.consistencyScore ?? 0;
  const consistencyByCategory = d.consistencyByCategory || {};

  // 🔹 Normalize byDay
  // const byDay = Array.isArray(rawByDay)
  //   ? rawByDay
  //       .map((row: any) => {
  //         const date =
  //           row.date ||
  //           row.day ||
  //           (typeof row.created_at === "string"
  //             ? row.created_at.slice(0, 10)
  //             : null) ||
  //           row.dt ||
  //           row.d;

  //         const count =
  //           row.count ??
  //           row.total ??
  //           row.questions ??
  //           row.num_questions ??
  //           0;

  //         if (!date) return null;
  //         return {
  //           date,
  //           count: Number(count) || 0,
  //         };
  //       })
  //       .filter(Boolean)
  //   : [];

  const byDay: DayUsage[] = Array.isArray(rawByDay)
  ? rawByDay
      .map((row: any): DayUsage | null => {
        const date =
          row.date ||
          row.day ||
          (typeof row.created_at === "string"
            ? row.created_at.slice(0, 10)
            : null) ||
          row.dt ||
          row.d;

        const count =
          row.count ??
          row.total ??
          row.questions ??
          row.num_questions ??
          0;

        if (!date) return null;
        return {
          date,
          count: Number(count) || 0,
        };
      })
      .filter((row): row is DayUsage => row !== null)
  : [];

  const usageData = byDay;
  const maxUsage = usageData.length
    ? Math.max(...usageData.map((d) => d.count))
    : 0;



  const CATEGORY_COLORS = [
    "#FF8A00",
    "#FFC107",
    "#7C3AED",
    "#0EA5E9",
    "#22C55E",
    "#16A34A",
    "#F97316",
    "#EC4899",
    "#10B981",
    "#6366F1",
    "#F59E0B",
    "#3B82F6",
  ];

  const countsByCat: Record<string, number> = {};
  topCategories.forEach((c: any) => {
    countsByCat[c.category] = c.count;
  });

  const chartData = ZUZU_CATEGORIES.map((name, idx) => ({
    label: name,
    value: countsByCat[name] ?? 0,
    color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
  }));

  return (
    <div className={`absolute inset-0 ${THEME.appBg} overflow-auto`}>
      <header
        className={`p-5 border-b ${THEME.sidebarBorder} ${THEME.sidebarBg}`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-full border border-[#F3C58C] bg-[#FFEFD9] hover:bg-white transition"
          >
            <ArrowLeft size={18} className={THEME.textSub} />
          </button>

          <div>
            <h1 className={`text-2xl font-extrabold ${THEME.brand}`}>
              ZUZU Admin
            </h1>
            <p className={`text-xs mt-1 ${THEME.textSub}`}>
              Analytics &amp; Insights
            </p>
          </div>
        </div>
      </header>

      <main className="p-5 space-y-6">
        {/* Top stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[#F3C58C] bg-[#FFF6EA] p-4">
            <p className="text-[11px] font-semibold text-[#A06A32]">
              Total Users
            </p>
            <p className="text-3xl font-bold">
              {totals.totalUsers ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-[#F3C58C] bg-[#FFF6EA] p-4">
            <p className="text-[11px] font-semibold text-[#A06A32]">
              Total Questions
            </p>
            <p className="text-3xl font-bold">
              {totals.totalQuestions ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-[#F3C58C] bg-[#FFF6EA] p-4">
            <p className="text-[11px] font-semibold text-[#A06A32]">
              PII Alerts
            </p>
            <p className="text-3xl font-bold">
              {totals.totalPiiEvents ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-[#F3C58C] bg-[#FFF6EA] p-4">
            <p className="text-[11px] font-semibold text-[#A06A32]">
              Overall Consistency
            </p>
            <p className="text-3xl font-bold">
              {Math.round(consistencyScore)}%
            </p>
          </div>
        </div>

        {/* Questions by Category – DONUT */}
        <div className="rounded-2xl border border-[#F3C58C] bg-[#FFF6EA] p-4">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon size={18} className={THEME.textSub} />
            <h2 className={`text-sm font-semibold ${THEME.textMain}`}>
              Questions by Category
            </h2>
          </div>

          <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:justify-center">
            <div className="flex items-center justify-center">
              {/* 🔹 Fixed-size RePieChart: no ResponsiveContainer */}
              <RePieChart width={260} height={260}>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  innerRadius={0}
                  paddingAngle={1}
                  isAnimationActive={false}
                >
                  {chartData.map((slice) => (
                    <Cell key={slice.label} fill={slice.color} />
                  ))}
                </Pie>
              </RePieChart>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {chartData.map((slice) => (
                <div key={slice.label} className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className={THEME.textMain}>{slice.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Consistency by Category */}
        <div className="rounded-2xl border border-[#F3C58C] bg-[#FFF6EA] p-4">
          <h2 className={`text-sm font-semibold ${THEME.textMain} mb-1`}>
            Consistency by Category
          </h2>

          <div className="space-y-3">
            {Object.entries(consistencyByCategory).map(([cat, v]) => {
              const idx = ZUZU_CATEGORIES.indexOf(cat);
              const color =
                idx >= 0 ? CATEGORY_COLORS[idx] : "#FF8A00";

              return (
                <BarRow
                  key={cat}
                  label={cat}
                  value={Number(v)}
                  max={100}
                  color={color}
                />
              );
            })}
          </div>
        </div>

        {/* Usage (last 7 days) – VERTICAL BARS */}
          <div className="rounded-2xl border border-[#F3C58C] bg-[#FFF6EA] p-4">
          <h2 className={`text-sm font-semibold ${THEME.textMain} mb-1`}>
            Usage (last 7 days)
          </h2>

          <div className="flex gap-1 items-end h-40 mt-2">
            {usageData.length === 0 ? (
              <p className={`${THEME.textSub} text-xs`}>
                No usage data yet.
              </p>
            ) : (
              usageData.map((row: any) => {
                const barHeightPx = maxUsage
                  ? (row.count / maxUsage) * 140 // a bit less than 160 so text fits nicely
                  : 0;

                return (
                  <div
                    key={row.date}
                    className="flex-1 flex flex-col items-center justify-end"
                  >
                    {/* Count on top of the bar */}
                    <span className="text-[10px] text-[#A06A32] mb-1">
                      {row.count}
                    </span>

                    {/* Bar */}
                    <div
                      className="w-3 sm:w-4 rounded-t-full"
                      style={{
                        height: `${barHeightPx}px`,
                        backgroundColor: "#FF8A00",
                      }}
                    />

                    {/* Date label under the bar */}
                    <span className="text-[10px] text-[#A06A32] mt-1">
                      {row.date.slice(5)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>


      </main>
    </div>
  );
}
// /* ------------------------------------------------------------
//    DEFAULT EXPORT FOR NEXT.JS
// ------------------------------------------------------------ */

// ------------------------------------------------------------
// DEFAULT EXPORT FOR NEXT.JS
// ------------------------------------------------------------

export default function Page() {
  return <ZuzuApp />;
}


