"""Low-latency Yjs relay.

Pure binary broadcast: every message from a client is forwarded verbatim to the
other clients in the same room. y-websocket peers answer each other's sync +
awareness messages through this relay, so the doc converges with no server-side
CRDT state. Only binary deltas cross the wire -> low network usage. Durable
state lives in Supabase (saved by clients over REST) + each browser's IndexedDB.
"""
import asyncio
from collections import defaultdict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
from config import settings
from utils.auth import ALGORITHM
from models.supabase_client import get_supabase

router = APIRouter(tags=["collab"])

# room name ("<workspace_id>:<file_id>") -> set of connected sockets
_rooms: dict[str, set[WebSocket]] = defaultdict(set)
_lock = asyncio.Lock()


def _auth(token: str) -> int | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (JWTError, KeyError, TypeError, ValueError):
        return None


def _is_member(workspace_id: str, user_id: int) -> bool:
    try:
        sb = get_supabase()
        r = (sb.table("workspace_members").select("id")
             .eq("workspace_id", int(workspace_id)).eq("user_id", user_id).execute())
        return bool(r.data)
    except (ValueError, Exception):
        return False


@router.websocket("/ws/collab/{room}")
async def collab(websocket: WebSocket, room: str, token: str = Query("")):
    user_id = _auth(token)
    if user_id is None:
        await websocket.close(code=4401)
        return
    workspace_id = room.split(":", 1)[0]
    if not _is_member(workspace_id, user_id):
        await websocket.close(code=4403)
        return

    await websocket.accept()
    async with _lock:
        _rooms[room].add(websocket)
    try:
        while True:
            data = await websocket.receive_bytes()
            async with _lock:
                peers = [p for p in _rooms[room] if p is not websocket]
            for p in peers:
                try:
                    await p.send_bytes(data)
                except Exception:
                    pass
    except WebSocketDisconnect:
        pass
    finally:
        async with _lock:
            _rooms[room].discard(websocket)
            if not _rooms[room]:
                _rooms.pop(room, None)
