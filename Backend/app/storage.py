# app/storage.py
import os
import json
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Optional

from azure.storage.blob import BlobServiceClient  # azure-storage-blob
from azure.core.exceptions import ResourceNotFoundError

# -------- Config --------
_CONTAINER_NAME = os.getenv("AZURE_BLOB_CONTAINER", "chathistory")

# Env options:
#   A) AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=...;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
#   OR
#   B) AZURE_STORAGE_ACCOUNT_NAME=<name> + AZURE_STORAGE_ACCOUNT_KEY=<key>
_CONN_STR = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "").strip()
_ACCT = os.getenv("AZURE_STORAGE_ACCOUNT_NAME", "").strip()
_KEY = os.getenv("AZURE_STORAGE_ACCOUNT_KEY", "").strip()

# Singletons (lazy-inited)
_blob_service: Optional[BlobServiceClient] = None
_container = None
_init_lock = asyncio.Lock()  # avoid races under load


def _blob_name(chat_id: str) -> str:
    # One blob per chat as JSONL
    return f"{chat_id}.jsonl"


async def _ensure_container():
    """
    Lazy-initialize the BlobServiceClient and container client.
    Never raises out; logs and leaves container None on failure.
    """
    global _blob_service, _container

    if _container is not None:
        return

    async with _init_lock:
        if _container is not None:  # double-checked
            return
        try:
            if _CONN_STR:
                # Preferred: full connection string
                _blob_service = BlobServiceClient.from_connection_string(_CONN_STR)
            elif _ACCT and _KEY:
                # Fallback: name + key
                _blob_service = BlobServiceClient(
                    account_url=f"https://{_ACCT}.blob.core.windows.net",
                    credential=_KEY,
                )
            else:
                print("[blob-init] WARN: No valid Azure Blob credentials found. "
                      "Set AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT_NAME + AZURE_STORAGE_ACCOUNT_KEY.")
                _blob_service = None
                _container = None
                return

            _container = _blob_service.get_container_client(_CONTAINER_NAME)
            try:
                _container.create_container()
            except Exception:
                # Already exists or we lack perms — fine if we can still read/write
                pass
        except Exception as e:
            print(f"[blob-init] WARN: failed to init blob client: {e}")
            _blob_service = None
            _container = None


async def append_message(chat_id: str, role: str, content: str):
    """
    Append a line to the chat transcript blob as JSONL.
    Fails open (logs but does not raise) so API remains responsive.
    """
    await _ensure_container()
    if _container is None:
        print("[blob] WARN: container unavailable; skipping append.")
        return

    name = _blob_name(chat_id)
    line_obj = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "role": role,
        "content": content,
    }
    line = json.dumps(line_obj, ensure_ascii=False)

    try:
        # Try to download existing content (small chats are fine; for very large, switch to Append Blobs)
        try:
            existing = _container.download_blob(name).readall().decode("utf-8")
        except ResourceNotFoundError:
            existing = ""

        payload = (existing + ("\n" if existing and not existing.endswith("\n") else "") + line + "\n")
        _container.upload_blob(name, payload.encode("utf-8"), overwrite=True)
    except Exception as e:
        print(f"[blob] WARN: append failed for {name}: {e}")


async def get_chat(chat_id: str) -> List[Dict]:
    """
    Return full transcript as list[dict]. On failure returns [].
    """
    await _ensure_container()
    if _container is None:
        print("[blob] WARN: container unavailable; returning empty chat.")
        return []

    name = _blob_name(chat_id)
    try:
        data = _container.download_blob(name).readall().decode("utf-8")
    except ResourceNotFoundError:
        return []
    except Exception as e:
        print(f"[blob] WARN: read failed for {name}: {e}")
        return []

    messages = []
    for line in data.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            messages.append(json.loads(line))
        except Exception:
            # skip malformed lines
            continue
    return messages


async def get_last_messages(chat_id: str, limit: int = 8) -> List[Dict]:
    msgs = await get_chat(chat_id)
    return msgs[-limit:] if msgs else []


async def delete_chat(chat_id: str):
    """
    Delete the chat blob. No-ops on failure.
    """
    await _ensure_container()
    if _container is None:
        print("[blob] WARN: container unavailable; skipping delete.")
        return

    name = _blob_name(chat_id)
    try:
        _container.delete_blob(name)
    except ResourceNotFoundError:
        return
    except Exception as e:
        print(f"[blob] WARN: delete failed for {name}: {e}")

