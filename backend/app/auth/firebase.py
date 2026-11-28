"""Check a Firebase phone-login token and return the verified phone number."""

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.config import settings


class FirebaseTokenError(ValueError):
    pass


_session = google_requests.Request()  # caches Google's signing keys between calls


def verified_phone(token: str) -> str:
    """Signature, expiry, audience (our Firebase project) and issuer are checked by google-auth."""
    if not settings.firebase_project_id:
        raise FirebaseTokenError("Firebase login is not set up on the server")
    try:
        claims = id_token.verify_firebase_token(token, _session, audience=settings.firebase_project_id)
    except Exception as e:  # invalid signature, expired, wrong project, network error fetching keys
        raise FirebaseTokenError(str(e)) from None
    phone = (claims or {}).get("phone_number")
    if not phone:
        raise FirebaseTokenError("this login was not made with a phone number")
    return phone
