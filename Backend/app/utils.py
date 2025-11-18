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


# High-level subcategory labels for analytics / prompting.
ZUZU_SUBCATEGORIES: Dict[str, List[str]] = {
    # HOUSING – updated to match your detailed structure
    "Housing": [
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

    "Admissions": [
        "Application and deadlines",
        "Documents and test scores",
        "Program requirements",
        "Decision and next steps",
    ],
    "Visa and Immigration": [
        "I-20 and DS-2019",
        "Visa interview and documents",
        "SEVIS and reporting",
        "Maintaining status",
    ],
    "Travel and Arrival": [
        "Booking flights and timing",
        "Airport pickup and directions",
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
        "Bank accounts and cards",
        "Budgeting and cost of living",
        "Scholarships and assistantships",
    ],
    "Campus Life and Academics": [
        "Class registration",
        "Advising and tutoring",
        "Clubs and organizations",
        "Campus services and facilities",
    ],
    "Health and Safety": [
        "Health insurance and care",
        "Counseling and mental health",
        "Campus safety and emergency",
    ],
    "Phone and Connectivity": [
        "Phone plans and SIM cards",
        "Wi-Fi and internet",
    ],
    "Work and Career": [
        "On-campus jobs",
        "CPT / OPT basics",
        "Career services and internships",
    ],
    "Community and Daily Life": [
        "Shopping and groceries",
        "Transportation",
        "Local community and culture",
    ],
    "Other Inquiries": [
        "General questions",
        "Not sure / other",
    ],
}


# ---------------- CATEGORY HEURISTICS ----------------


def naive_category(text: str) -> str:
    """
    Very simple keyword-based classifier that maps a message to one of the
    top-level ZUZU_CATEGORIES for analytics and message_events.

    It does NOT have to be perfect; just good enough for charts and grouping.
    """
    if not text:
        return "Other Inquiries"

    t = text.lower()

    # Housing
    if any(
        kw in t
        for kw in [
            "housing",
            "dorm",
            "residence hall",
            "hall",
            "apartment",
            "roommate",
            "room mate",
            "move-in",
            "move in",
            "move-out",
            "move out",
            "lease",
            "contract",
        ]
    ):
        return "Housing"

    # Admissions
    if any(
        kw in t
        for kw in [
            "admission",
            "apply",
            "application",
            "deadline",
            "program requirements",
            "gpa",
            "transcript",
            "offer letter",
        ]
    ):
        return "Admissions"

    # Visa / immigration
    if any(
        kw in t
        for kw in [
            "visa",
            "i-20",
            "i20",
            "sevis",
            "ds-2019",
            "immigration",
            "status",
            "consulate",
        ]
    ):
        return "Visa and Immigration"

    # Travel / arrival
    if any(
        kw in t
        for kw in [
            "flight",
            "airport",
            "arrival",
            "travel",
            "pickup",
            "pick up",
            "hotel",
            "temporary housing",
        ]
    ):
        return "Travel and Arrival"

    # Forms & docs
    if any(
        kw in t
        for kw in [
            "form",
            "forms",
            "document",
            "documents",
            "paperwork",
            "pdf upload",
        ]
    ):
        return "Forms and Documentation"

    # Money & banking
    if any(
        kw in t
        for kw in [
            "tuition",
            "fee",
            "bank",
            "account",
            "card",
            "loan",
            "scholarship",
            "assistantship",
            "budget",
            "money",
            "rent",
        ]
    ):
        return "Money and Banking"

    # Campus life & academics
    if any(
        kw in t
        for kw in [
            "class",
            "course",
            "registration",
            "enroll",
            "enrol",
            "advisor",
            "adviser",
            "tutoring",
            "club",
            "organization",
            "society",
            "campus",
        ]
    ):
        return "Campus Life and Academics"

    # Health & safety
    if any(
        kw in t
        for kw in [
            "insurance",
            "health",
            "doctor",
            "hospital",
            "clinic",
            "mental health",
            "counseling",
            "counselling",
            "safety",
            "emergency",
        ]
    ):
        return "Health and Safety"

    # Phone & connectivity
    if any(
        kw in t
        for kw in [
            "phone",
            "sim",
            "sim card",
            "wifi",
            "wi-fi",
            "internet",
            "data plan",
        ]
    ):
        return "Phone and Connectivity"

    # Work & career
    if any(
        kw in t
        for kw in [
            "job",
            "work",
            "internship",
            "cpt",
            "opt",
            "career",
            "on-campus job",
            "on campus job",
            "employment",
        ]
    ):
        return "Work and Career"

    # Community & daily life
    if any(
        kw in t
        for kw in [
            "grocery",
            "groceries",
            "shopping",
            "bus",
            "transport",
            "transportation",
            "parking",
            "community",
            "restaurant",
        ]
    ):
        return "Community and Daily Life"

    return "Other Inquiries"


# ---------------- PII DETECTION ----------------

# We treat these as "PII" for ZUZU:
# - SSN-like numbers
# - Phone numbers
# - Email addresses
# - Card / bank-like numbers
# - Addresses
# - Full names (very rough)
# - Age statements ("I'm 23", "my age is 23")


_PII_REGEXES = [
    # US SSN-like: 123-45-6789 or 123456789
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    re.compile(r"\b\d{9}\b"),

    # Phone numbers: +1 555-555-5555, (555) 555-5555, 555-555-5555
    re.compile(
        r"\b(?:\+?1[\s-]?)?(?:\(\d{3}\)|\d{3})[\s-]?\d{3}[\s-]?\d{4}\b"
    ),

    # Email addresses
    re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),

    # Credit/debit card-like (very rough)
    re.compile(r"\b(?:\d[ -]*?){13,16}\b"),

    # Address-like (very rough): number + street word
    re.compile(
        r"\b\d+\s+(?:street|st\.?|avenue|ave\.?|road|rd\.?|lane|ln\.?|drive|dr\.?)\b",
        re.IGNORECASE,
    ),

    # Name-like: "my name is <First Last>" or "I am <First Last>"
    re.compile(
        r"\bmy\s+name\s+is\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b"
    ),
    re.compile(
        r"\b(i\s*am|i'm)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b",
        re.IGNORECASE,
    ),

    # Age: "I am 23", "I'm 19 years old"
    re.compile(
        r"\b(i\s*am|i'm)\s*(\d{1,2})\s*(?:years?\s*old|yrs?\s*old|y/o)?\b",
        re.IGNORECASE,
    ),
    # Age: "my age is 23"
    re.compile(
        r"\bmy\s+age\s+is\s*(\d{1,2})\b",
        re.IGNORECASE,
    ),
]


def detect_pii_spans(text: str) -> List[tuple]:
    """
    Return a list of (start, end, value, pattern) for each PII span detected.
    """
    spans: List[tuple] = []
    if not text:
        return spans

    for pat in _PII_REGEXES:
        for m in pat.finditer(text):
            spans.append((m.start(), m.end(), m.group(0), pat.pattern))

    # Merge overlapping spans conservatively
    spans.sort(key=lambda x: x[0])
    merged: List[tuple] = []
    for s, e, val, pat in spans:
        if not merged:
            merged.append((s, e, val, pat))
            continue
        last_s, last_e, last_val, last_pat = merged[-1]
        if s <= last_e:
            # overlap, extend the previous span
            merged[-1] = (last_s, max(last_e, e), last_val, last_pat)
        else:
            merged.append((s, e, val, pat))
    return merged


def contains_pii(text: str) -> bool:
    return bool(detect_pii_spans(text or ""))


def mask_pii(text: str) -> str:
    out = text or ""
    spans = detect_pii_spans(text or "")
    # replace from end to start to avoid messing up indices
    for s, e, _val, _pat in sorted(spans, key=lambda x: x[0], reverse=True):
        out = out[:s] + "<PII>" + out[e:]
    return out
