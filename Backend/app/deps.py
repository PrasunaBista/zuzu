\from fastapi import Header
from typing import Optional

# Example dependency to capture client IP if you need it later
async def get_client_ip(x_forwarded_for: Optional[str] = Header(None)) -> str:
    return (x_forwarded_for or "").split(",")[0].strip() if x_forwarded_for else ""
