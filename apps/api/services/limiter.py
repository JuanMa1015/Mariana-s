from slowapi import Limiter
from slowapi.util import get_remote_address


def _clave_cliente(request):
    """Identifica al cliente para los limites de tasa.

    Detras del proxy de Render (uvicorn sin --proxy-headers) todas las
    conexiones llegan desde la misma IP; la IP real del cliente viaja al
    final de X-Forwarded-For. En desarrollo (sin proxy) se usa la IP remota.
    """
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        ip = xff.split(",")[-1].strip()
        if ip:
            return ip
    return get_remote_address(request)


limiter = Limiter(key_func=_clave_cliente, default_limits=["240/minute"])
