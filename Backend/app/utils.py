# app/utils.py
import re
from typing import List, Dict

# ---------------- ZUZU CATEGORIES & HIERARCHY ----------------
# Clear, onboarding-focused categories for international students.

ZUZU_CATEGORIES: List[str] = [
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
]

# High-level → subcategories (used for prompt / analytics docs, not hardcoded in UI)
ZUZU_SUBCATEGORIES: Dict[str, List[str]] = {
    "Housing": [
        "Housing options overview",
        "Residence halls",
        "Apartments and off-campus housing",
        "Rates and contracts",
        "Move-in and move-out",
        "Roommates and matching",
        "Housing problems and maintenance",
    ],
    "Admissions": [
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
        "Maintaining status (full-time, online credits, address updates)",
        "CPT, OPT, and STEM-OPT",
        "Travel and re-entry while on visa",
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
        "Using campus resources (library, rec center, labs)",
        "Academic policies (GPA, probation, etc.)",
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
    "Other Inquiries": [
        "Anything that does not fit in the categories above",
    ],
}


def naive_category(text: str) -> str:
    """
    Very simple keyword-based classifier so analytics can bucket questions.
    """
    t = (text or "").lower()

    if any(k in t for k in ["lease", "room", "dorm", "housing", "apartment", "hall"]):
        return "Housing"
    if any(k in t for k in ["admission", "apply", "deadline", "gpa", "offer letter", "i-20"]):
        return "Admissions"
    if any(k in t for k in ["visa", "sevis", "immigration", "opt", "cpt", "stem opt", "status"]):
        return "Visa and Immigration"
    if any(k in t for k in ["flight", "airport", "travel", "arrival", "uber", "bus", "baggage"]):
        return "Travel and Arrival"
    if any(k in t for k in ["form", "document", "transcript", "letter", "immunization", "proof"]):
        return "Forms and Documentation"
    if any(k in t for k in ["tuition", "fee", "bank", "account", "budget", "scholarship", "assistantship"]):
        return "Money and Banking"
    if any(k in t for k in ["class", "course", "register", "drop", "major", "advisor", "tutor", "library"]):
        return "Campus Life and Academics"
    if any(k in t for k in ["insurance", "clinic", "doctor", "hospital", "health", "emergency", "911", "safety"]):
        return "Health and Safety"
    if any(k in t for k in ["phone", "sim", "number", "plan", "wifi", "internet", "account", "password", "duo"]):
        return "Phone and Connectivity"
    if any(k in t for k in ["job", "internship", "co-op", "career", "resume", "cpt", "opt", "on-campus work"]):
        return "Work and Career"
    if any(k in t for k in ["grocery", "groceries", "store", "shopping", "club", "friend", "weather", "clothes"]):
        return "Community and Daily Life"

    return "Other Inquiries"


# ----------------------- PII DETECTION -----------------------
# Extended to also catch:
# - Explicit names ("my name is ...")
# - Ages ("I am 22 years old")

_PII_REGEXES = [
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),  # SSN
    re.compile(r"\b\d{9}\b"),  # 9-digit id/passport-like
    re.compile(
        r"\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}\b"
    ),  # US phone
    re.compile(r"\b[A-PR-WY][0-9]{7}\b", re.IGNORECASE),  # passport-ish
    re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b"),  # 16-digit card numbers
    re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE),  # email
    re.compile(
        r"\b(19|20)\d{2}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b"
    ),  # YYYY-MM-DD DOB-like
    # Name patterns (we treat "my name is Prasuna Bista" as PII)
    re.compile(
        r"\b(?:my\s+name\s+is|i\s*am\s+called|this\s+is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b",
        re.IGNORECASE,
    ),
    # Age patterns: "I am 22 years old", "I'm 19", etc.
    re.compile(
        r"\b(i\s*am|i'm)\s*(\d{1,2})\s*(?:years?\s*old|yrs?\s*old|y/o)?\b",
        re.IGNORECASE,
    ),
]


def detect_pii_spans(text: str):
    spans = []
    for rgx in _PII_REGEXES:
        for m in rgx.finditer(text or ""):
            spans.append((m.start(), m.end(), m.group(0), rgx.pattern))
    return spans


def contains_pii(text: str) -> bool:
    return bool(detect_pii_spans(text))


def mask_pii(text: str) -> str:
    out = text or ""
    for s, e, _val, _pat in sorted(
        detect_pii_spans(text or ""), key=lambda x: x[1] - x[0], reverse=True
    ):
        out = out[:s] + "<PII>" + out[e:]
    return out
