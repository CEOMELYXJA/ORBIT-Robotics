"""Handswizard: local-only server receiving iPhone tilt gestures over private HTTPS.

Run only on Windows. It binds to 127.0.0.1 and must NEVER be published
through public tunnels, port-forwarding or Tailscale Funnel.
"""
import asyncio
import hmac
import json
import logging
import secrets
import time
from pathlib import Path

from aiohttp import web
import pyautogui

from mouse_core import MouseController

HOST = "127.0.0.1"
PORT = 8766
MAX_MESSAGE = 512
SESSION_AGE = 8 * 60 * 60
PAIR_TRIES = 5
PAIR_WINDOW = 60
COOKIE = "handswizard_session"

# Keep PyAutoGUI's emergency top-left-corner fail-safe enabled.
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0

controller = MouseController(pyautogui)
pair_code = f"{secrets.randbelow(1000000):06d}"
session_token = None
session_born = 0
attempts = []
active_ws = None
web_root = Path(__file__).resolve().parent


def origin_ok(request):
    origin = request.headers.get("Origin")
    if not origin:
        return False
    # Same-origin is required, including scheme and port. The trusted HTTPS
    # domain is your own private Tailscale Serve domain.
    from urllib.parse import urlsplit
    try:
        parsed = urlsplit(origin)
        return (parsed.scheme in ("https", "http")
                and parsed.netloc == request.host
                and not parsed.username
                and not parsed.password
                and (parsed.scheme == "https" or request.host in
                     ("127.0.0.1:8766", "localhost:8766")))
    except ValueError:
        return False


def authorized(request):
    cookie = request.cookies.get(COOKIE, "")
    return bool(session_token and time.monotonic() - session_born < SESSION_AGE
                and hmac.compare_digest(cookie, session_token))


async def index(request):
    response = web.FileResponse(web_root / "mobile.html")
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; script-src 'self'; style-src 'self'; "
        "connect-src 'self' wss: ws:; img-src 'self'; base-uri 'none'; "
        "form-action 'self'; frame-ancestors 'none'")
    return response


async def static_js(request):
    response = web.FileResponse(web_root / "mobile.js")
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


async def status(request):
    return web.json_response({"authorized": authorized(request),
                              "active": bool(active_ws and not active_ws.closed)})


async def pair(request):
    global session_token, session_born, attempts, active_ws
    if not origin_ok(request):
        raise web.HTTPForbidden(text="Origin non autorisée")
    now = time.monotonic()
    attempts = [t for t in attempts if now - t < PAIR_WINDOW]
    if len(attempts) >= PAIR_TRIES:
        raise web.HTTPTooManyRequests(text="Attends une minute")
    if request.content_length is None or request.content_length > 200:
        raise web.HTTPBadRequest()
    try:
        data = await request.json()
    except (ValueError, json.JSONDecodeError):
        raise web.HTTPBadRequest()
    attempts.append(now)
    supplied = data.get("code") if isinstance(data, dict) else None
    if not isinstance(supplied, str) or not hmac.compare_digest(supplied, pair_code):
        await asyncio.sleep(0.5)
        raise web.HTTPUnauthorized(text="Code incorrect")
    attempts.clear()
    if active_ws and not active_ws.closed:
        await active_ws.close(code=1008, message=b"re-pairing")
    controller.stop()
    session_token = secrets.token_urlsafe(32)
    session_born = now
    response = web.json_response({"ok": True})
    response.set_cookie(COOKIE, session_token, secure=True, httponly=True,
                        samesite="Strict", max_age=SESSION_AGE, path="/")
    return response


async def logout(request):
    global session_token
    if not origin_ok(request) or not authorized(request):
        raise web.HTTPForbidden()
    session_token = None
    controller.stop()
    if active_ws and not active_ws.closed:
        await active_ws.close()
    response = web.json_response({"ok": True})
    response.del_cookie(COOKIE, path="/")
    return response


async def websocket(request):
    global active_ws
    if not authorized(request) or not origin_ok(request):
        raise web.HTTPForbidden()
    # One active controller at a time; the earlier connection is shut down.
    if active_ws and not active_ws.closed:
        await active_ws.close(code=1008, message=b"new client")
    ws = web.WebSocketResponse(heartbeat=10, max_msg_size=MAX_MESSAGE)
    await ws.prepare(request)
    active_ws = ws
    controller.stop()
    await ws.send_json({"type": "ready", "paused": True})
    last_message = time.monotonic()
    try:
        async for message in ws:
            if message.type == web.WSMsgType.TEXT:
                if time.monotonic() - last_message < 0.006:
                    continue
                last_message = time.monotonic()
                try:
                    command = json.loads(message.data)
                    controller.dispatch(command)
                except (ValueError, TypeError, pyautogui.FailSafeException):
                    controller.stop()
            elif message.type == web.WSMsgType.ERROR:
                break
    finally:
        controller.stop()
        if active_ws is ws:
            active_ws = None
    return ws


async def watchdog(app):
    while True:
        await asyncio.sleep(0.25)
        try:
            controller.watchdog()
        except pyautogui.FailSafeException:
            controller.stop()


async def start_background(app):
    task = asyncio.create_task(watchdog(app))
    yield
    task.cancel()
    controller.stop()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = web.Application(client_max_size=512)
app.router.add_get("/", index)
app.router.add_get("/mobile.js", static_js)
app.router.add_get("/status", status)
app.router.add_post("/pair", pair)
app.router.add_post("/logout", logout)
app.router.add_get("/ws", websocket)
app.cleanup_ctx.append(start_background)

if __name__ == "__main__":
    print("\n=== HANDSWIZARD : IPHONE -> SOURIS WINDOWS ===")
    print("Code d'appairage temporaire (à garder privé) :", pair_code)
    print("Lance Tailscale Serve en HTTPS avant d'ouvrir sur Safari :")
    print("  tailscale serve --bg http://127.0.0.1:8766")
    print("Puis ouvre l'adresse https://...ts.net sur ton iPhone avec Tailscale actif.")
    print("Arrêt immédiat : Ctrl+C sur ce PC. Aucun port public n'est ouvert.\n")
    logging.basicConfig(level=logging.WARNING)
    web.run_app(app, host=HOST, port=PORT, print=None)

