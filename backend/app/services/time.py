from datetime import date, datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def today_ist() -> date:
    """The business runs on Indian time; servers (Vercel) run on UTC."""
    return datetime.now(IST).date()
