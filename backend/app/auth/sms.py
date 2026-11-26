import logging

from app.config import settings

log = logging.getLogger("sms")


def send_otp(phone: str, code: str) -> None:
    """Deliver an OTP. Only the dev console provider exists for now."""
    if settings.sms_provider == "console":
        log.warning("OTP for %s: %s", phone, code)
        return
    raise NotImplementedError(f"SMS provider {settings.sms_provider!r} is not configured")
