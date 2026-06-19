import time
import threading
from typing import Any, Callable

_cache: dict[str, tuple[float, Any]] = {}
_lock = threading.Lock()
_TTL_DEFAULT = 300
_MAX_ENTRIES = 500


def _make_key(func: Callable, args: tuple, kwargs: dict) -> str:
    name = getattr(func, "__name__", None)
    if name is None:
        name = f"mock@{id(func)}"
    else:
        module = getattr(func, "__module__", None)
        if module:
            name = f"{module}.{name}"
    parts = [name]
    parts.extend(str(a) for a in args)
    parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
    return ":".join(parts)


def cached_call(func: Callable, ttl: int = _TTL_DEFAULT, *args: Any, **kwargs: Any) -> Any:
    key = _make_key(func, args, kwargs)
    now = time.monotonic()

    with _lock:
        if key in _cache:
            ts, value = _cache[key]
            if now - ts < ttl:
                return value

    result = func(*args, **kwargs)

    with _lock:
        if len(_cache) >= _MAX_ENTRIES:
            oldest_key = min(_cache, key=lambda k: _cache[k][0])
            del _cache[oldest_key]
        _cache[key] = (now, result)

    return result


def clear_cache() -> None:
    with _lock:
        _cache.clear()


def cache_size() -> int:
    with _lock:
        return len(_cache)
