ZUZU_CATEGORIES = [
    "Housing","Admissions","Travel","Forms and Documentations",
    "Visa and Immigrations","Phone and Communication","Other Inquiries"
]

def naive_category(text: str) -> str:
    t = text.lower()
    if any(k in t for k in ["lease","room","dorm","housing"]):
        return "Housing"
    if any(k in t for k in ["admission","apply","deadline","gpa"]):
        return "Admissions"
    if any(k in t for k in ["flight","airport","travel","trip"]):
        return "Travel"
    if any(k in t for k in ["form","document","transcript","letter"]):
        return "Forms and Documentations"
    if any(k in t for k in ["visa","i-20","sevis","immigration"]):
        return "Visa and Immigrations"
    if any(k in t for k in ["phone","sim","number","plan"]):
        return "Phone and Communication"
    return "Other Inquiries"
