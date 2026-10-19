#!/usr/bin/env python3
"""Reelhaven server: serves the game and runs the online features.

Python standard library only (3.9+), nothing to install:

    python server.py              # then open http://localhost:8000
    PORT=3000 python server.py    # pick another port

Online features (all over one WebSocket at /ws):
  * accounts: username + password (PBKDF2-hashed), sign-in tokens per device
  * cloud saves: one per account, revision-checked so devices never silently
    overwrite each other
  * friends: friend codes, requests (send / accept / decline / cancel), remove
  * presence: which friends are online / visiting
  * island visits: a friend's public island snapshot + live movement relay

Everything is saved to server-data/reelhaven.json (set RH_DATA to move it,
e.g. onto a mounted disk at /data/reelhaven.json).
"""
import asyncio
import base64
import gzip
import hashlib
import hmac
import json
import os
import re
import secrets
import socket
import struct
import sys
import time
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent
# Never inside a served folder: data/ holds the game's content scripts.
DATA_FILE = Path(os.environ.get("RH_DATA", ROOT / "server-data" / "reelhaven.json"))
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8000"))

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
MAX_MESSAGE = 2 * 1024 * 1024     # a full save is well under this
MAX_SAVE = 1_500_000              # bytes of JSON per cloud save
MAX_SNAPSHOT = 300_000            # bytes of JSON per public island snapshot
IDLE_TIMEOUT = 90                 # clients ping every 25 s

# Only these paths are served (never server.py, data/, .git, ...).
PUBLIC_FILES = {"index.html", "manifest.json", "service-worker.js"}
PUBLIC_DIRS = {"css", "js", "data", "assets"}
MIME = {
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".wav": "audio/wav",
    ".mp3": "audio/mpeg", ".ico": "image/x-icon", ".md": "text/plain; charset=utf-8",
}

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
USERNAME_RE = re.compile(r"^[a-z0-9_\-]{3,16}$")
NAME_RE = re.compile(r"^[\w .'\-]{2,20}$", re.UNICODE)
PASSWORD_MIN, PASSWORD_MAX = 6, 64
PBKDF2_ROUNDS = 150_000
MAX_TOKENS = 10                   # signed-in devices per account
MAX_PENDING = 50                  # outgoing friend requests
ISLANDS = {"sunny", "coral", "mangrove", "moon"}
FACINGS = {"up", "down", "left", "right"}


class ApiError(Exception):
    """An error shown to the player (code is machine-readable)."""
    def __init__(self, message, code="error"):
        super().__init__(message)
        self.code = code


# --------------------------------------------------------------------------
# Persistence
# --------------------------------------------------------------------------

class Store:
    """All data in one JSON file, written atomically a few seconds after changes."""

    def __init__(self, path):
        self.path = path
        self.accounts = {}      # username -> {name, salt, hash, tokens, code, created, allowVisits, level, look}
        self.codes = {}         # friend code -> username
        self.saves = {}         # username -> {data, revision, updatedAt, device}
        self.snapshots = {}     # username -> {data, updatedAt}
        self.friendships = {}   # id (str) -> {a, b, status, created, responded}
        self.next_id = 1
        self.dirty = False
        if path.exists():
            data = json.loads(path.read_text("utf-8"))
            self.accounts = data.get("accounts", {})
            self.saves = data.get("saves", {})
            self.snapshots = data.get("snapshots", {})
            self.friendships = data.get("friendships", {})
            self.next_id = data.get("nextId", 1)
        self.codes = {a["code"]: u for u, a in self.accounts.items()}

    def mark(self):
        self.dirty = True

    def save(self):
        if not self.dirty:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps({
            "accounts": self.accounts, "saves": self.saves, "snapshots": self.snapshots,
            "friendships": self.friendships, "nextId": self.next_id,
        }, ensure_ascii=False, separators=(",", ":")), "utf-8")
        os.replace(tmp, self.path)
        self.dirty = False

    async def autosave(self):
        while True:
            await asyncio.sleep(3)
            try:
                self.save()
            except OSError as e:
                print("save failed:", e)

    def new_code(self):
        while True:
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))
            if code not in self.codes:
                return code

    def pair(self, a, b):
        """The friendship row between two users (either direction), if any."""
        for fid, f in self.friendships.items():
            if (f["a"] == a and f["b"] == b) or (f["a"] == b and f["b"] == a):
                return fid, f
        return None, None

    def are_friends(self, a, b):
        _, f = self.pair(a, b)
        return bool(f and f["status"] == "accepted")


def hash_password(pw, salt):
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), PBKDF2_ROUNDS).hex()


def clean_text(v, n):
    return str(v or "").strip()[:n]


def json_size(v):
    return len(json.dumps(v, separators=(",", ":")))


def clean_look(look):
    """Appearance is public: keep only known keys with short string values."""
    out = {}
    if isinstance(look, dict):
        for k in ("skin", "hair", "hairStyle", "shirt", "pants", "hat"):
            v = look.get(k)
            if isinstance(v, str) and len(v) <= 24:
                out[k] = v
    return out


def clean_snapshot(snap):
    """Public island snapshot: only the layout friends need, nothing private."""
    if not isinstance(snap, dict):
        raise ApiError("Bad island snapshot.")
    islands = []
    for isl in snap.get("islands", [])[:8]:
        if not isinstance(isl, dict) or isl.get("id") not in ISLANDS:
            continue
        placements = []
        for p in isl.get("placements", [])[:600]:
            if isinstance(p, dict) and isinstance(p.get("type"), str) and len(p["type"]) <= 32:
                placements.append({"type": p["type"], "x": int(p.get("x", 0)), "y": int(p.get("y", 0)), "rot": int(p.get("rot", 0)) % 4})
        flags = isl.get("flags") if isinstance(isl.get("flags"), dict) else {}
        islands.append({"id": isl["id"], "name": clean_text(isl.get("name"), 30), "flags": {"bridgeRepaired": bool(flags.get("bridgeRepaired"))}, "placements": placements})
    return {"schema": 2, "name": clean_text(snap.get("name"), 20), "level": int(snap.get("level", 1)), "look": clean_look(snap.get("look")),
            "species": int(snap.get("species", 0)), "speciesTotal": int(snap.get("speciesTotal", 0)), "islands": islands}


# --------------------------------------------------------------------------
# Game server
# --------------------------------------------------------------------------

class Client:
    def __init__(self, ws):
        self.ws = ws
        self.user = None            # username once signed in
        self.room = None            # (host, island) while on an island channel
        self.status = "home"
        self.pos = None
        self.attempts = []          # recent failed sign-ins (rate limit)
        self.last_pos = 0.0


class Server:
    def __init__(self, store):
        self.store = store
        self.clients = set()
        self.rooms = {}             # (host, island) -> set(Client)

    # ------------------------------------------------------------ helpers
    def online_users(self):
        return {c.user: c for c in self.clients if c.user}

    def account_view(self, user):
        a = self.store.accounts[user]
        return {"username": user, "name": a["name"], "code": a["code"], "allowVisits": a.get("allowVisits", True),
                "level": a.get("level", 1), "look": a.get("look", {})}

    def card(self, user):
        a = self.store.accounts[user]
        return {"user": user, "name": a["name"], "code": a["code"], "level": a.get("level", 1), "look": a.get("look", {}),
                "allowVisits": a.get("allowVisits", True)}

    def friends_of(self, user):
        out = []
        for f in self.store.friendships.values():
            if f["status"] == "accepted" and user in (f["a"], f["b"]):
                out.append(f["b"] if f["a"] == user else f["a"])
        return out

    def presence_for(self, user):
        online = self.online_users()
        return {u: online[u].status for u in self.friends_of(user) if u in online}

    def push_presence(self, user):
        """Tell a user's online friends (and the user) about presence changes."""
        online = self.online_users()
        targets = set(self.friends_of(user)) | {user}
        for u in targets:
            c = online.get(u)
            if c:
                c.ws.send({"t": "presence", "online": self.presence_for(u)})

    def notify_friends_changed(self, *users):
        online = self.online_users()
        for u in users:
            if u in online:
                online[u].ws.send({"t": "friends_changed"})

    def require(self, c):
        if not c.user:
            raise ApiError("Please sign in first.", "auth")
        return self.store.accounts[c.user]

    # ------------------------------------------------------------ dispatch
    def dispatch(self, c, m):
        rid = m.get("id")
        t = str(m.get("t", ""))
        handler = getattr(self, "on_" + t, None)
        try:
            if not handler:
                raise ApiError("Unknown request.")
            result = handler(c, m)
            if rid is not None:
                c.ws.send({"t": "res", "id": rid, "ok": True, "data": result})
        except ApiError as e:
            if rid is not None:
                c.ws.send({"t": "res", "id": rid, "ok": False, "error": str(e), "code": e.code})
        except (ValueError, TypeError, KeyError) as e:
            print("bad request", t, repr(e))
            if rid is not None:
                c.ws.send({"t": "res", "id": rid, "ok": False, "error": "That request didn't look right.", "code": "bad"})

    # ------------------------------------------------------------ accounts
    def rate_limit(self, c):
        now = time.time()
        c.attempts = [t for t in c.attempts if now - t < 60]
        if len(c.attempts) >= 6:
            raise ApiError("Too many attempts. Please wait a minute and try again.", "rate")

    def sign_in(self, c, user, token=None):
        a = self.store.accounts[user]
        if token is None:
            token = secrets.token_urlsafe(24)
            a["tokens"] = (a.get("tokens", []) + [hashlib.sha256(token.encode()).hexdigest()])[-MAX_TOKENS:]
            self.store.mark()
        if c.user and c.user != user:
            self.leave_room(c)
        c.user = user
        c.status = "home"
        self.push_presence(user)
        return {"account": self.account_view(user), "token": token}

    def on_signup(self, c, m):
        self.rate_limit(c)
        user = clean_text(m.get("username"), 16).lower()
        pw = str(m.get("password", ""))
        name = clean_text(m.get("name"), 20) or user
        if not USERNAME_RE.match(user):
            raise ApiError("Usernames are 3–16 letters, numbers, _ or -.", "username")
        if not (PASSWORD_MIN <= len(pw) <= PASSWORD_MAX):
            raise ApiError(f"Passwords need {PASSWORD_MIN}–{PASSWORD_MAX} characters.", "password")
        if not NAME_RE.match(name):
            raise ApiError("Display names are 2–20 letters, numbers, spaces and . ' - _", "name")
        if user in self.store.accounts:
            c.attempts.append(time.time())
            raise ApiError("That username is taken — try another, or sign in.", "taken")
        salt = secrets.token_hex(16)
        code = self.store.new_code()
        self.store.accounts[user] = {"name": name, "salt": salt, "hash": hash_password(pw, salt), "tokens": [],
                                     "code": code, "created": int(time.time()), "allowVisits": True, "level": 1, "look": {}}
        self.store.codes[code] = user
        self.store.mark()
        return self.sign_in(c, user)

    def on_login(self, c, m):
        self.rate_limit(c)
        user = clean_text(m.get("username"), 16).lower()
        a = self.store.accounts.get(user)
        pw = str(m.get("password", ""))
        if not a or not hmac.compare_digest(hash_password(pw, a["salt"]), a["hash"]):
            c.attempts.append(time.time())
            raise ApiError("That username and password don't match.", "credentials")
        return self.sign_in(c, user)

    def on_resume(self, c, m):
        """Sign back in on a device that has been signed in before (it keeps a token, not the password)."""
        user = clean_text(m.get("username"), 16).lower()
        a = self.store.accounts.get(user)
        token = str(m.get("token", ""))
        if not a or not token or hashlib.sha256(token.encode()).hexdigest() not in a.get("tokens", []):
            raise ApiError("Please sign in again.", "expired")
        return self.sign_in(c, user, token)

    def on_logout(self, c, m):
        if c.user:
            a = self.store.accounts[c.user]
            digest = hashlib.sha256(str(m.get("token", "")).encode()).hexdigest()
            if digest in a.get("tokens", []):
                a["tokens"].remove(digest)
                self.store.mark()
            user = c.user
            self.leave_room(c)
            c.user = None
            self.push_presence(user)
        return {}

    def on_password(self, c, m):
        a = self.require(c)
        self.rate_limit(c)
        if not hmac.compare_digest(hash_password(str(m.get("old", "")), a["salt"]), a["hash"]):
            c.attempts.append(time.time())
            raise ApiError("Your current password isn't right.", "credentials")
        new = str(m.get("new", ""))
        if not (PASSWORD_MIN <= len(new) <= PASSWORD_MAX):
            raise ApiError(f"Passwords need {PASSWORD_MIN}–{PASSWORD_MAX} characters.", "password")
        a["salt"] = secrets.token_hex(16)
        a["hash"] = hash_password(new, a["salt"])
        a["tokens"] = []           # sign out other devices
        self.store.mark()
        return self.sign_in(c, c.user)

    def on_profile(self, c, m):
        a = self.require(c)
        if "name" in m:
            name = clean_text(m["name"], 20)
            if not NAME_RE.match(name):
                raise ApiError("Display names are 2–20 letters, numbers, spaces and . ' - _", "name")
            a["name"] = name
        if "allowVisits" in m:
            a["allowVisits"] = bool(m["allowVisits"])
        self.store.mark()
        self.notify_friends_changed(*self.friends_of(c.user))
        return {"account": self.account_view(c.user)}

    # ------------------------------------------------------------ saves
    def on_save_get(self, c, m):
        self.require(c)
        return {"save": self.store.saves.get(c.user)}

    def on_save_put(self, c, m):
        a = self.require(c)
        data = m.get("data")
        base = int(m.get("base", -1))
        if not isinstance(data, dict) or not isinstance(data.get("player"), dict):
            raise ApiError("That save doesn't look right.", "bad")
        if json_size(data) > MAX_SAVE:
            raise ApiError("That save is too large.", "too_large")
        cur = self.store.saves.get(c.user)
        cur_rev = cur["revision"] if cur else 0
        # Only accept a save based on the latest cloud revision: another device
        # that saved in between makes this one stop and ask the player.
        if base != cur_rev:
            raise ApiError("Your cloud save changed on another device.", "conflict")
        rev = cur_rev + 1
        self.store.saves[c.user] = {"data": data, "revision": rev, "updatedAt": int(time.time() * 1000),
                                    "device": clean_text(m.get("device"), 60)}
        # Keep the public card's level / look in step with the save.
        p = data["player"]
        if isinstance(p.get("level"), int):
            a["level"] = max(1, min(999, p["level"]))
        a["look"] = clean_look(p.get("look"))
        self.store.mark()
        return {"revision": rev, "updatedAt": self.store.saves[c.user]["updatedAt"]}

    def on_snapshot_put(self, c, m):
        self.require(c)
        snap = clean_snapshot(m.get("data"))
        if json_size(snap) > MAX_SNAPSHOT:
            raise ApiError("That island is too large to share.", "too_large")
        self.store.snapshots[c.user] = {"data": snap, "updatedAt": int(time.time() * 1000)}
        self.store.mark()
        return {}

    # ------------------------------------------------------------ friends
    def on_friends(self, c, m):
        self.require(c)
        online = self.online_users()
        out = []
        for fid, f in self.store.friendships.items():
            if c.user not in (f["a"], f["b"]):
                continue
            other = f["b"] if f["a"] == c.user else f["a"]
            if other not in self.store.accounts:
                continue
            direction = "friend" if f["status"] == "accepted" else ("outgoing" if f["a"] == c.user else "incoming")
            item = {"id": fid, "direction": direction, **self.card(other)}
            if direction == "friend":
                item["online"] = other in online
                item["status"] = online[other].status if other in online else None
            out.append(item)
        out.sort(key=lambda x: (x["direction"] != "incoming", x["direction"] != "friend", x["name"].lower()))
        return {"list": out}

    def on_find(self, c, m):
        self.require(c)
        code = clean_text(m.get("code"), 8).upper()
        user = self.store.codes.get(code)
        if not user:
            return {"player": None}
        if user == c.user:
            rel = "self"
        else:
            _, f = self.store.pair(c.user, user)
            rel = "none" if not f else "friend" if f["status"] == "accepted" else "outgoing" if f["a"] == c.user else "incoming"
        card = self.card(user)
        card.pop("allowVisits", None)
        return {"player": {**card, "relation": rel}}

    def on_friend_request(self, c, m):
        self.require(c)
        code = clean_text(m.get("code"), 8).upper()
        target = self.store.codes.get(code)
        if not target:
            raise ApiError("No islander has that friend code.", "not_found")
        if target == c.user:
            raise ApiError("That's your own friend code!", "self")
        fid, f = self.store.pair(c.user, target)
        if f:
            if f["status"] == "accepted":
                return {"status": "already_friends"}
            if f["a"] == c.user:
                return {"status": "already_requested"}
            f["status"] = "accepted"          # they asked first: accept
            f["responded"] = int(time.time())
            self.store.mark()
            self.notify_friends_changed(c.user, target)
            self.push_presence(c.user)
            self.push_presence(target)
            return {"status": "accepted"}
        pending = sum(1 for x in self.store.friendships.values() if x["a"] == c.user and x["status"] == "pending")
        if pending >= MAX_PENDING:
            raise ApiError("You have too many pending requests. Cancel some first.", "limit")
        fid = str(self.store.next_id)
        self.store.next_id += 1
        self.store.friendships[fid] = {"a": c.user, "b": target, "status": "pending", "created": int(time.time()), "responded": None}
        self.store.mark()
        self.notify_friends_changed(target)
        return {"status": "sent"}

    def on_friend_respond(self, c, m):
        self.require(c)
        fid = str(m.get("fid", ""))
        f = self.store.friendships.get(fid)
        if not f or f["b"] != c.user or f["status"] != "pending":
            raise ApiError("That request is no longer available.", "not_found")
        if m.get("accept"):
            f["status"] = "accepted"
            f["responded"] = int(time.time())
        else:
            del self.store.friendships[fid]
        self.store.mark()
        self.notify_friends_changed(c.user, f["a"])
        self.push_presence(c.user)
        self.push_presence(f["a"])
        return {}

    def on_friend_remove(self, c, m):
        """Cancel an outgoing request, decline, or unfriend — only rows you are part of."""
        self.require(c)
        fid = str(m.get("fid", ""))
        f = self.store.friendships.get(fid)
        if not f or c.user not in (f["a"], f["b"]):
            raise ApiError("That friendship no longer exists.", "not_found")
        other = f["b"] if f["a"] == c.user else f["a"]
        del self.store.friendships[fid]
        self.store.mark()
        self.notify_friends_changed(c.user, other)
        self.push_presence(c.user)
        self.push_presence(other)
        return {}

    def on_presence(self, c, m):
        self.require(c)
        status = m.get("status")
        c.status = status if status in ("home", "visiting") else "home"
        self.push_presence(c.user)
        return {}

    # ------------------------------------------------------------ visits
    def on_visit_get(self, c, m):
        self.require(c)
        host = clean_text(m.get("user"), 16).lower()
        a = self.store.accounts.get(host)
        if not a or not self.store.are_friends(c.user, host):
            raise ApiError("You can only visit your friends' islands.", "forbidden")
        if not a.get("allowVisits", True):
            raise ApiError(f"{a['name']} has island visits turned off.", "forbidden")
        snap = self.store.snapshots.get(host)
        return {"snapshot": snap}

    def on_island_join(self, c, m):
        self.require(c)
        host = clean_text(m.get("host"), 16).lower()
        island = str(m.get("island", ""))
        if island not in ISLANDS or host not in self.store.accounts:
            raise ApiError("That island doesn't exist.", "not_found")
        if host != c.user and not self.store.are_friends(c.user, host):
            raise ApiError("You can only visit your friends' islands.", "forbidden")
        self.leave_room(c)
        key = (host, island)
        c.room = key
        c.pos = self.clean_pos(m)
        self.rooms.setdefault(key, set()).add(c)
        self.push_peers(key)
        return {}

    def on_island_leave(self, c, m):
        self.leave_room(c)
        return {}

    def clean_pos(self, m):
        f = m.get("f")
        return {"x": max(0, min(4000, int(m.get("x", 0)))), "y": max(0, min(4000, int(m.get("y", 0)))), "f": f if f in FACINGS else "down"}

    def on_pos(self, c, m):
        """Relay a position to everyone else on the same island (no reply)."""
        if not c.user or not c.room:
            return None
        now = time.time()
        if now - c.last_pos < 0.05:          # at most ~20 updates a second
            return None
        c.last_pos = now
        c.pos = self.clean_pos(m)
        msg = {"t": "pos", "user": c.user, **c.pos}
        for other in self.rooms.get(c.room, ()):
            if other is not c:
                other.ws.send(msg)
        return None

    def push_peers(self, key):
        members = self.rooms.get(key, set())
        for c in members:
            peers = [{"user": o.user, "name": self.store.accounts[o.user]["name"], "look": self.store.accounts[o.user].get("look", {}),
                      "host": o.user == key[0], **(o.pos or {})} for o in members if o is not c and o.user]
            c.ws.send({"t": "peers", "host": key[0], "island": key[1], "list": peers})

    def leave_room(self, c):
        if c.room:
            key = c.room
            members = self.rooms.get(key)
            if members:
                members.discard(c)
                if not members:
                    del self.rooms[key]
                else:
                    self.push_peers(key)
            c.room = None

    def on_ping(self, c, m):
        return {}

    def leave(self, c):
        self.clients.discard(c)
        self.leave_room(c)
        if c.user:
            user, c.user = c.user, None
            self.push_presence(user)


# --------------------------------------------------------------------------
# WebSocket (RFC 6455) — just what browsers need
# --------------------------------------------------------------------------

class WebSocket:
    def __init__(self, reader, writer):
        self.reader = reader
        self.writer = writer
        self.closed = False

    async def recv(self):
        """Next text message, or None when the client closes."""
        parts = []
        while True:
            b1, b2 = await self.reader.readexactly(2)
            fin, op = b1 & 0x80, b1 & 0x0F
            n = b2 & 0x7F
            if n == 126:
                n = struct.unpack("!H", await self.reader.readexactly(2))[0]
            elif n == 127:
                n = struct.unpack("!Q", await self.reader.readexactly(8))[0]
            if n > MAX_MESSAGE:
                return None
            mask = await self.reader.readexactly(4) if b2 & 0x80 else b"\0\0\0\0"
            payload = bytearray(await self.reader.readexactly(n))
            for i in range(n):
                payload[i] ^= mask[i % 4]
            if op == 0x8:                       # close
                return None
            if op == 0x9:                       # ping → pong
                self._frame(0xA, bytes(payload))
                continue
            if op == 0xA:
                continue
            parts.append(bytes(payload))
            if fin:
                data = b"".join(parts)
                if sum(len(p) for p in parts) > MAX_MESSAGE:
                    return None
                return data.decode("utf-8", "replace")

    def _frame(self, op, data):
        if self.closed:
            return
        n = len(data)
        head = bytes([0x80 | op])
        if n < 126:
            head += bytes([n])
        elif n < 65536:
            head += bytes([126]) + struct.pack("!H", n)
        else:
            head += bytes([127]) + struct.pack("!Q", n)
        try:
            self.writer.write(head + data)
        except (ConnectionError, OSError, RuntimeError):
            self.closed = True

    def send(self, obj):
        self._frame(0x1, json.dumps(obj, separators=(",", ":")).encode())

    def close(self):
        if not self.closed:
            self._frame(0x8, b"")
            self.closed = True


# --------------------------------------------------------------------------
# HTTP + connection handling
# --------------------------------------------------------------------------

async def client_loop(server, ws):
    c = Client(ws)
    server.clients.add(c)
    try:
        while True:
            text = await asyncio.wait_for(ws.recv(), IDLE_TIMEOUT)
            if text is None:
                break
            try:
                msg = json.loads(text)
            except ValueError:
                continue
            if isinstance(msg, dict):
                server.dispatch(c, msg)
                await ws.writer.drain()
    except (asyncio.IncompleteReadError, asyncio.TimeoutError, ConnectionError, OSError):
        pass
    finally:
        server.leave(c)
        ws.close()


def respond(writer, status, body=b"", ctype="text/plain; charset=utf-8", head_only=False, extra=""):
    writer.write(
        f"HTTP/1.1 {status}\r\nContent-Type: {ctype}\r\nContent-Length: {len(body)}\r\n"
        f"Cache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n{extra}\r\n".encode()
    )
    if not head_only:
        writer.write(body)


_gzip_cache = {}


def static_body(file, accept_encoding):
    data = file.read_bytes()
    if "gzip" not in accept_encoding or file.suffix not in (".js", ".css", ".html", ".json"):
        return data, ""
    key = (file, file.stat().st_mtime_ns)
    if key not in _gzip_cache:
        _gzip_cache[key] = gzip.compress(data, 6)
    return _gzip_cache[key], "Content-Encoding: gzip\r\nVary: Accept-Encoding\r\n"


def public_file(path):
    """Map a URL path to a game file, refusing anything outside the public set."""
    rel = path.lstrip("/") or "index.html"
    parts = rel.split("/")
    if ".." in parts or not (rel in PUBLIC_FILES or parts[0] in PUBLIC_DIRS):
        return None
    # data/ only holds the game's content scripts — never serve anything else from it.
    if parts[0] == "data" and not rel.endswith(".js"):
        return None
    file = (ROOT / rel).resolve()
    try:
        file.relative_to(ROOT)
    except ValueError:
        return None
    return file if file.is_file() else None


async def handle_connection(server, reader, writer):
    try:
        head = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), 15)
        lines = head.decode("latin-1").split("\r\n")
        method, target, _ = lines[0].split(" ", 2)
        headers = {}
        for line in lines[1:]:
            if ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip().lower()] = v.strip()
        path = unquote(target.split("?", 1)[0])

        if path == "/ws" and headers.get("upgrade", "").lower() == "websocket":
            key = headers.get("sec-websocket-key", "")
            accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
            writer.write(
                "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                f"Sec-WebSocket-Accept: {accept}\r\n\r\n".encode()
            )
            await client_loop(server, WebSocket(reader, writer))
            return

        if path == "/api/health":
            respond(writer, "200 OK", b'{"ok":true,"server":"reelhaven"}', "application/json")
        elif method not in ("GET", "HEAD"):
            respond(writer, "405 Method Not Allowed", b"Method not allowed")
        else:
            file = public_file(path)
            if file:
                ctype = MIME.get(file.suffix, "application/octet-stream")
                body, extra = static_body(file, headers.get("accept-encoding", ""))
                respond(writer, "200 OK", body, ctype, head_only=method == "HEAD", extra=extra)
            else:
                respond(writer, "404 Not Found", b"Not found")
        writer.transport.set_write_buffer_limits(high=0)
        await writer.drain()
        try:
            await asyncio.wait_for(reader.read(), 10)
        except (asyncio.TimeoutError, ConnectionError, OSError):
            pass
    except (asyncio.IncompleteReadError, asyncio.LimitOverrunError, asyncio.TimeoutError,
            ConnectionError, ValueError, OSError):
        pass
    finally:
        writer.close()
        try:
            await asyncio.wait_for(writer.wait_closed(), 30)
        except (asyncio.TimeoutError, ConnectionError, OSError):
            pass


def lan_address():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
    except OSError:
        return None


async def main():
    store = Store(DATA_FILE)
    server = Server(store)
    srv = await asyncio.start_server(lambda r, w: handle_connection(server, r, w), HOST, PORT, limit=MAX_MESSAGE)
    saver = asyncio.create_task(store.autosave())
    print(f"Reelhaven is running: http://localhost:{PORT}  (data: {DATA_FILE})")
    lan = lan_address()
    if lan:
        print(f"Play on your phone (same Wi-Fi): http://{lan}:{PORT}")
    try:
        async with srv:
            await srv.serve_forever()
    finally:
        saver.cancel()
        store.save()


def run():
    if sys.platform != "win32":
        asyncio.run(main())
    elif sys.version_info >= (3, 12):
        asyncio.run(main(), loop_factory=asyncio.SelectorEventLoop)
    else:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        asyncio.run(main())


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        print("\nSaved. Bye!")
