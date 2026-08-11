"""
realtime.py — the single in-process WebSocket fan-out used by the events feed.

WHY THIS IS ITS OWN MODULE
--------------------------
The manager used to live inside routers/events.py, which meant only that router
could broadcast. RSVPs are handled in routers/rsvp.py, so "someone just said
they're going" could never reach connected clients — the live feed covered
event creation and nothing else. Extracting the manager lets both routers
publish to the same set of sockets without routers/rsvp.py importing
routers/events.py.

SCOPE LIMIT — READ BEFORE SCALING
---------------------------------
`active_connections` is a plain in-process set. It fans out to clients attached
to THIS process only. Running EDEN under more than one uvicorn worker (or more
than one replica) silently splits the audience: a student connected to worker A
never sees an event published on worker B, and the bug looks like "realtime
works sometimes". Until this is backed by a shared broker (Redis pub/sub is
already in the stack for the Express backend), EDEN must run single-worker.
"""

import json

from fastapi import WebSocket


class EventSocketManager:
    def __init__(self):
        self.active_connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, payload: dict):
        if not self.active_connections:
            return
        message = json.dumps(payload, default=str)
        stale: list[WebSocket] = []
        for websocket in list(self.active_connections):
            try:
                await websocket.send_text(message)
            except Exception:
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(websocket)


event_socket_manager = EventSocketManager()
