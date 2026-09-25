"""Rate limits.

Counters live in process memory: fine for a single API process. If you ever run
several workers/containers, point slowapi at Redis via `storage_uri`.
Behind a reverse proxy, run uvicorn with `--proxy-headers` so the real client IP is used.

Guest limits are not keyed by IP alone, because every guest on the cafe's Wi-Fi
shares one public IP.
"""

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def ip_and_table(request: Request) -> str:
    return f"{get_remote_address(request)}|{request.path_params.get('table_token', '')}"


def guest_session(request: Request) -> str:
    # Requests without a session header are rejected by the endpoint anyway.
    return request.headers.get("x-session-token") or get_remote_address(request)


limiter = Limiter(key_func=get_remote_address)

LOGIN_LIMIT = "5/minute"  # per IP
SESSION_LIMIT = "10/hour"  # new guest sessions per IP per table
ORDER_LIMIT = "10/10minutes"  # orders per guest session
