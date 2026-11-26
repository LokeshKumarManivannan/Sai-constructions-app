"""File storage and signed links.

Files are only reachable through a short-lived signed URL, and the API only hands out a URL
inside a response the user is already allowed to see. That keeps image tags working on web
and phones (no auth headers needed) without making files public.
"""

import hashlib
import hmac
import time
import uuid
from app.config import settings

ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "application/pdf": ".pdf",
}


def new_storage_key(content_type: str) -> str:
    return f"{uuid.uuid4().hex}{ALLOWED_TYPES[content_type]}"


def _sig(file_id: uuid.UUID, exp: int) -> str:
    return hmac.new(settings.jwt_secret.encode(), f"file:{file_id}:{exp}".encode(), hashlib.sha256).hexdigest()[:32]


def signed_url(file_id: uuid.UUID | None) -> str | None:
    if file_id is None:
        return None
    exp = int(time.time()) + settings.file_url_ttl_seconds
    return f"{settings.api_base_url}/files/{file_id}?exp={exp}&sig={_sig(file_id, exp)}"


def check_signature(file_id: uuid.UUID, exp: int, sig: str) -> bool:
    return exp >= int(time.time()) and hmac.compare_digest(_sig(file_id, exp), sig)
