import os, json
from datetime import datetime, timezone
from azure.storage.blob import BlobServiceClient
from azure.core.exceptions import ResourceExistsError

_account = os.getenv("AZURE_STORAGE_ACCOUNT_NAME")
_conn = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
_container = os.getenv("AZURE_BLOB_CONTAINER", "chathistory")

if _conn:
    bsc = BlobServiceClient.from_connection_string(_conn)
else:
    # fall back to account/key auth
    bsc = BlobServiceClient(
        f"https://{_account}.blob.core.windows.net",
        credential=os.getenv("AZURE_STORAGE_ACCOUNT_KEY")
    )

container = bsc.get_container_client(_container)
try:
    container.create_container()
except ResourceExistsError:
    pass

# File path pattern: chats/{chat_id}.jsonl

def _blob_name(chat_id: str) -> str:
    return f"chats/{chat_id}.jsonl"

async def append_message(chat_id: str, role: str, content: str, ts: datetime | None = None):
    ts = ts or datetime.now(timezone.utc)
    line = json.dumps({
        "role": role,
        "content": content,
        "timestamp": ts.isoformat()
    }, ensure_ascii=False)
    name = _blob_name(chat_id)

    try:
        existing = container.download_blob(name).readall().decode("utf-8")
        payload = existing + ("\n" if existing and not existing.endswith("\n") else "") + line + "\n"
    except Exception:
        payload = line + "\n"

    container.upload_blob(name, payload.encode("utf-8"), overwrite=True)

async def get_chat(chat_id: str) -> list[dict]:
    name = _blob_name(chat_id)
    try:
        data = container.download_blob(name).readall().decode("utf-8")
    except Exception:
        return []
    return [json.loads(x) for x in data.splitlines() if x.strip()]

async def delete_chat(chat_id: str):
    name = _blob_name(chat_id)
    try:
        container.delete_blob(name)
    except Exception:
        pass
async def get_last_messages(chat_id: str, limit: int = 8) -> list[dict]:
    msgs = await get_chat(chat_id)
    return msgs[-limit:] if msgs else []
