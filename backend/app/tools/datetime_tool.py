import datetime
from typing import Dict, Any
from backend.app.core.logging import get_logger

logger = get_logger(__name__)


def get_current_datetime_info() -> Dict[str, Any]:
    """
    Datetime Tool: Provides accurate current date, time, weekday, timezone,
    and calendar data so the model never hallucinates current time or dates.
    """
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    now_local = datetime.datetime.now()

    info = {
        "current_date": now_local.strftime("%Y-%m-%d"),
        "current_time_local": now_local.strftime("%H:%M:%S"),
        "current_time_utc": now_utc.strftime("%Y-%m-%d %H:%M:%S UTC"),
        "day_of_week": now_local.strftime("%A"),
        "month": now_local.strftime("%B"),
        "year": now_local.year,
        "is_leap_year": (now_local.year % 4 == 0 and (now_local.year % 100 != 0 or now_local.year % 400 == 0)),
        "iso_timestamp": now_local.isoformat(),
    }
    logger.info(f"Datetime tool called: {info['current_date']} {info['current_time_local']}")
    summary_str = (
        f"Today is {info['day_of_week']}, {info['month']} {now_local.day}, {info['year']}. "
        f"Local time is {info['current_time_local']}. UTC time is {info['current_time_utc']}."
    )
    return {
        "tool": "datetime",
        "human": summary_str,
        "summary": summary_str,
        "local_iso": info["iso_timestamp"],
        "utc_iso": info["current_time_utc"],
        "timezone": "Local System Timezone",
        "result": info,
    }
