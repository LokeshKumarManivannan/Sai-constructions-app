import phonenumbers


class InvalidPhone(ValueError):
    pass


def normalize_phone(raw: str, default_region: str = "IN") -> str:
    """Return E.164 (+919876543210). A bare 10-digit number is treated as Indian."""
    try:
        parsed = phonenumbers.parse(raw.strip(), default_region)
    except phonenumbers.NumberParseException as exc:
        raise InvalidPhone(str(exc)) from exc
    if not phonenumbers.is_valid_number(parsed):
        raise InvalidPhone("not a valid phone number")
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


def mask_phone(e164: str) -> str:
    """+919876543210 -> +91******3210"""
    return e164[:3] + "*" * (len(e164) - 7) + e164[-4:]
