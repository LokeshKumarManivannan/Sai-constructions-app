"""Where uploaded bytes live. Chosen by STORAGE_BACKEND:

- local: a folder on disk (development, or your own server)
- vercel_blob: a private Vercel Blob store (Vercel's file system is read-only)

Files are still only reachable through the API's signed /files links, never directly.
"""

from pathlib import Path

from app.config import settings


def _local_path(key: str) -> Path:
    root = Path(settings.upload_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root / key


def save(key: str, data: bytes, content_type: str) -> None:
    if settings.storage_backend == "vercel_blob":
        from vercel.blob.sync import put_blob

        put_blob(f"uploads/{key}", data, access="private", content_type=content_type)
    else:
        _local_path(key).write_bytes(data)


def load(key: str) -> bytes | None:
    if settings.storage_backend == "vercel_blob":
        from vercel.blob.sync import BlobNotFoundError, get_blob

        try:
            return get_blob(f"uploads/{key}", access="private").body
        except BlobNotFoundError:
            return None
    path = _local_path(key)
    return path.read_bytes() if path.exists() else None
